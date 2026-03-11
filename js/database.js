// Database Module for Billy's List

class DatabaseManager {
    constructor() {
        this.currentUserId = null;
        this.currentUserEmail = null;
        this.listeners = {};
        this.sortDefaults = { unchecked: 'manual', checked: 'alphabetical' };
        this.initializeRefs();
    }
    
    initializeRefs() {
        try {
            this.usersRef = database.ref('users');
            this.sharedListsRef = database.ref('shared-lists');
            this.userEmailsRef = database.ref('user-emails');
        } catch (error) {
            console.error('Failed to initialize database refs:', error);
            throw error;
        }
    }

    // Initialize user data and profile
    async setCurrentUser(user) {
        this.currentUserId = user.uid;
        this.currentUserEmail = user.email;
        
        // Create/update user profile
        const userProfileRef = this.usersRef.child(`${user.uid}/profile`);
        await userProfileRef.set({
            name: user.displayName || user.email,
            email: user.email,
            lastSeen: firebase.database.ServerValue.TIMESTAMP,
            photoURL: user.photoURL || null
        });

        // Maintain fast email → uid index for sharing lookups
        const normalizedEmail = this.normalizeEmail(user.email);
        if (normalizedEmail) {
            await this.userEmailsRef.child(normalizedEmail).set(user.uid);
        }

        // Ensure sort defaults exist
        const sortDefaultsRef = this.usersRef.child(`${user.uid}/preferences/sortDefaults`);
        const sortSnapshot = await sortDefaultsRef.once('value');
        if (!sortSnapshot.exists()) {
            await sortDefaultsRef.set(this.sortDefaults);
        } else {
            this.sortDefaults = { ...this.sortDefaults, ...sortSnapshot.val() };
        }

        console.log('User profile initialized:', user.displayName);
    }

    // Get user's lists (owned + shared)
    async getUserLists() {
        if (!this.currentUserId) throw new Error('User not authenticated');

        const userListsRef = this.usersRef.child(`${this.currentUserId}/lists`);
        const snapshot = await userListsRef.once('value');
        
        const ownedLists = [];
        const sharedLists = [];

        if (snapshot.exists()) {
            const lists = snapshot.val();
            for (const [listId, listData] of Object.entries(lists)) {
                const listInfo = {
                    id: listId,
                    name: listData.name,
                    createdAt: listData.createdAt,
                    order: typeof listData.order === 'number' ? listData.order : Number.MAX_SAFE_INTEGER,
                    owner: listData.owner,
                    sharedWith: listData.sharedWith || [],
                    sortMode: listData.sortMode || { unchecked: 'default', checked: 'default' },
                    isOwned: listData.owner === this.currentUserId
                };

                if (listData.owner === this.currentUserId) {
                    ownedLists.push(listInfo);
                } else {
                    sharedLists.push(listInfo);
                }
            }
        }

        // Sort by explicit order, then fallback to creation date
        ownedLists.sort((a, b) => (a.order - b.order) || ((a.createdAt || 0) - (b.createdAt || 0)));
        sharedLists.sort((a, b) => (a.order - b.order) || ((a.createdAt || 0) - (b.createdAt || 0)));

        return { owned: ownedLists, shared: sharedLists };
    }

    // Create a new list
    async createList(listName) {
        if (!this.currentUserId) throw new Error('User not authenticated');

        const userListsRef = this.usersRef.child(`${this.currentUserId}/lists`);
        const newListRef = userListsRef.push();
        const nextOrder = await this.getNextListOrder();
        
        const listData = {
            name: listName.trim(),
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            order: nextOrder,
            owner: this.currentUserId,
            sharedWith: [],
            sortMode: { unchecked: 'default', checked: 'default' }
        };

        await newListRef.set(listData);
        
        // Initialize empty items collection
        await newListRef.child('items').set({});
        
        return { 
            success: true, 
            listId: newListRef.key,
            listData: { ...listData, id: newListRef.key }
        };
    }

    // Delete a list (owner only)
    async deleteList(listId) {
        if (!this.currentUserId) throw new Error('User not authenticated');

        const listRef = this.usersRef.child(`${this.currentUserId}/lists/${listId}`);
        const snapshot = await listRef.once('value');
        
        if (!snapshot.exists()) {
            throw new Error('List not found');
        }

        const listData = snapshot.val();
        if (listData.owner !== this.currentUserId) {
            throw new Error('Permission denied: not list owner');
        }

        // Remove list from owner
        await listRef.remove();

        // Remove from shared users
        if (listData.sharedWith && listData.sharedWith.length > 0) {
            const removePromises = listData.sharedWith.map(userId => 
                this.usersRef.child(`${userId}/lists/${listId}`).remove()
            );
            await Promise.all(removePromises);
        }

        // Remove from shared-lists tracking
        const sharedListRef = this.sharedListsRef.child(listId);
        await sharedListRef.remove();

        return { success: true };
    }

    // Rename a list (owner only)
    async renameList(listId, newName) {
        if (!this.currentUserId) throw new Error('User not authenticated');

        const listRef = this.usersRef.child(`${this.currentUserId}/lists/${listId}`);
        const snapshot = await listRef.once('value');
        
        if (!snapshot.exists()) {
            throw new Error('List not found');
        }

        const listData = snapshot.val();
        if (listData.owner !== this.currentUserId) {
            throw new Error('Permission denied: not list owner');
        }

        // Update name in owner's copy
        await listRef.child('name').set(newName.trim());

        // Update name in shared users' copies
        if (listData.sharedWith && listData.sharedWith.length > 0) {
            const updatePromises = listData.sharedWith.map(userId => 
                this.usersRef.child(`${userId}/lists/${listId}/name`).set(newName.trim())
            );
            await Promise.all(updatePromises);
        }

        return { success: true };
    }

    // Share a list with another user
    async shareListWithUser(listId, targetEmail) {
        if (!this.currentUserId) throw new Error('User not authenticated');

        // Find target user by email (indexed lookup first, fallback scan for older data)
        const normalizedEmail = this.normalizeEmail(targetEmail);
        let targetUserId = null;

        if (normalizedEmail) {
            const indexSnapshot = await this.userEmailsRef.child(normalizedEmail).once('value');
            if (indexSnapshot.exists()) {
                targetUserId = indexSnapshot.val();
            }
        }

        if (!targetUserId) {
            const usersSnapshot = await this.usersRef.once('value');
            if (usersSnapshot.exists()) {
                const users = usersSnapshot.val();
                for (const [userId, userData] of Object.entries(users)) {
                    if (userData.profile && this.normalizeEmail(userData.profile.email) === normalizedEmail) {
                        targetUserId = userId;
                        break;
                    }
                }
            }
        }

        if (!targetUserId) {
            throw new Error('User not found with that email address');
        }

        if (targetUserId === this.currentUserId) {
            throw new Error('Cannot share list with yourself');
        }

        // Get the list data
        const listRef = this.usersRef.child(`${this.currentUserId}/lists/${listId}`);
        const listSnapshot = await listRef.once('value');
        
        if (!listSnapshot.exists()) {
            throw new Error('List not found');
        }

        const listData = listSnapshot.val();
        if (listData.owner !== this.currentUserId) {
            throw new Error('Permission denied: not list owner');
        }

        // Check if already shared with this user
        const sharedWith = listData.sharedWith || [];
        if (sharedWith.includes(targetUserId)) {
            throw new Error('List is already shared with this user');
        }

        // Add to shared users array in owner's list
        const updatedSharedWith = [...sharedWith, targetUserId];
        await listRef.child('sharedWith').set(updatedSharedWith);

        // Copy list to target user's lists
        const targetListRef = this.usersRef.child(`${targetUserId}/lists/${listId}`);
        await targetListRef.set({ ...listData, sharedWith: updatedSharedWith });

        // Update shared-lists tracking
        const sharedListTrackingRef = this.sharedListsRef.child(listId);
        await sharedListTrackingRef.set({
            owner: this.currentUserId,
            users: [this.currentUserId, ...updatedSharedWith],
            name: listData.name
        });

        return { success: true, targetUserId };
    }

    async getUserProfile(userId) {
        if (!userId) return null;
        const snapshot = await this.usersRef.child(`${userId}/profile`).once('value');
        if (!snapshot.exists()) return null;
        return snapshot.val();
    }

    async getListSharingDetails(listId) {
        if (!this.currentUserId) throw new Error('User not authenticated');

        const listSnapshot = await this.usersRef.child(`${this.currentUserId}/lists/${listId}`).once('value');
        if (!listSnapshot.exists()) throw new Error('List not found');

        const list = listSnapshot.val();
        const ownerProfile = await this.getUserProfile(list.owner);
        const sharedIds = list.sharedWith || [];

        const sharedUsers = await Promise.all(sharedIds.map(async (uid) => {
            const profile = await this.getUserProfile(uid);
            return {
                userId: uid,
                name: profile?.name || profile?.email || uid,
                email: profile?.email || null
            };
        }));

        return {
            listId,
            ownerId: list.owner,
            ownerName: ownerProfile?.name || ownerProfile?.email || list.owner,
            ownerEmail: ownerProfile?.email || null,
            sharedUsers,
            isOwned: list.owner === this.currentUserId
        };
    }

    async unshareListWithUser(listId, targetUserId) {
        if (!this.currentUserId) throw new Error('User not authenticated');

        const ownerListRef = this.usersRef.child(`${this.currentUserId}/lists/${listId}`);
        const listSnapshot = await ownerListRef.once('value');
        if (!listSnapshot.exists()) throw new Error('List not found');

        const list = listSnapshot.val();
        if (list.owner !== this.currentUserId) {
            throw new Error('Permission denied: not list owner');
        }

        const updatedSharedWith = (list.sharedWith || []).filter(uid => uid !== targetUserId);
        await ownerListRef.child('sharedWith').set(updatedSharedWith);

        await this.usersRef.child(`${targetUserId}/lists/${listId}`).remove();

        await this.sharedListsRef.child(listId).set({
            owner: this.currentUserId,
            users: [this.currentUserId, ...updatedSharedWith],
            name: list.name
        });

        // keep sharedWith synced for remaining recipients
        await Promise.all(updatedSharedWith.map(uid =>
            this.usersRef.child(`${uid}/lists/${listId}/sharedWith`).set(updatedSharedWith)
        ));

        return { success: true };
    }

    async leaveSharedList(listId) {
        if (!this.currentUserId) throw new Error('User not authenticated');

        const myListRef = this.usersRef.child(`${this.currentUserId}/lists/${listId}`);
        const myListSnap = await myListRef.once('value');
        if (!myListSnap.exists()) throw new Error('List not found');

        const myList = myListSnap.val();
        if (myList.owner === this.currentUserId) {
            throw new Error('Owner cannot leave their own list. Use unshare instead.');
        }

        const ownerId = myList.owner;
        const ownerListRef = this.usersRef.child(`${ownerId}/lists/${listId}`);
        const ownerListSnap = await ownerListRef.once('value');

        let updatedSharedWith = [];
        let listName = myList.name;

        if (ownerListSnap.exists()) {
            const ownerList = ownerListSnap.val();
            listName = ownerList.name || listName;
            updatedSharedWith = (ownerList.sharedWith || []).filter(uid => uid !== this.currentUserId);
            await ownerListRef.child('sharedWith').set(updatedSharedWith);

            await Promise.all(updatedSharedWith.map(uid =>
                this.usersRef.child(`${uid}/lists/${listId}/sharedWith`).set(updatedSharedWith)
            ));

            await this.sharedListsRef.child(listId).set({
                owner: ownerId,
                users: [ownerId, ...updatedSharedWith],
                name: listName
            });
        }

        await myListRef.remove();

        return { success: true };
    }

    // Get items for a specific list
    async getListItems(listId) {
        if (!this.currentUserId) throw new Error('User not authenticated');

        const itemsRef = this.usersRef.child(`${this.currentUserId}/lists/${listId}/items`);
        const snapshot = await itemsRef.once('value');
        const effectiveSort = await this.getEffectiveSortMode(listId);

        if (!snapshot.exists()) {
            return { unchecked: [], checked: [] };
        }

        return this.processListItems(snapshot.val(), effectiveSort);
    }

    // Add item to list
    async addItemToList(listId, itemName) {
        if (!this.currentUserId) throw new Error('User not authenticated');

        const normalizedName = this.normalizeItemName(itemName);
        
        // Check for duplicates
        const duplicateCheck = await this.checkForDuplicates(listId, normalizedName);
        if (duplicateCheck.found) {
            return { duplicate: true, similar: duplicateCheck };
        }

        // Get next order position for unchecked items
        const nextOrder = await this.getNextOrderPosition(listId);

        // Add item to owner's list
        const itemsRef = this.usersRef.child(`${this.currentUserId}/lists/${listId}/items`);
        const newItemRef = itemsRef.push();
        
        const itemData = {
            name: itemName.trim(),
            checked: false,
            order: nextOrder,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            addedBy: this.currentUserId,
            normalizedName: normalizedName
        };

        await newItemRef.set(itemData);

        // Sync to shared users
        await this.syncItemToSharedUsers(listId, newItemRef.key, itemData);

        return { success: true, itemId: newItemRef.key };
    }

    // Toggle item checked status
    async toggleItemInList(listId, itemId) {
        if (!this.currentUserId) throw new Error('User not authenticated');

        const itemRef = this.usersRef.child(`${this.currentUserId}/lists/${listId}/items/${itemId}`);
        const snapshot = await itemRef.once('value');

        if (!snapshot.exists()) return;

        const item = snapshot.val();
        const newCheckedState = !item.checked;
        const effectiveSort = await this.getEffectiveSortMode(listId);

        const updates = {
            checked: newCheckedState,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        // If target section is manual, place item at bottom of that section
        if (newCheckedState && effectiveSort.checked === 'manual') {
            updates.order = await this.getNextOrderPosition(listId, true);
        } else if (!newCheckedState && effectiveSort.unchecked === 'manual') {
            updates.order = await this.getNextOrderPosition(listId, false);
        }

        await itemRef.update(updates);

        // Sync to shared users
        await this.syncItemToSharedUsers(listId, itemId, { ...item, ...updates });

        return { success: true };
    }

    // Update item name
    async updateItemName(listId, itemId, newName) {
        if (!this.currentUserId) throw new Error('User not authenticated');

        const itemRef = this.usersRef.child(`${this.currentUserId}/lists/${listId}/items/${itemId}`);
        const snapshot = await itemRef.once('value');
        
        if (!snapshot.exists()) return;

        const item = snapshot.val();
        const normalizedName = this.normalizeItemName(newName);

        const updates = {
            name: newName.trim(),
            normalizedName: normalizedName,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        await itemRef.update(updates);

        // Sync to shared users
        await this.syncItemToSharedUsers(listId, itemId, { ...item, ...updates });

        return { success: true };
    }

    // Delete item from list
    async deleteItemFromList(listId, itemId) {
        if (!this.currentUserId) throw new Error('User not authenticated');

        const itemRef = this.usersRef.child(`${this.currentUserId}/lists/${listId}/items/${itemId}`);
        await itemRef.remove();

        // Remove from shared users
        await this.removeItemFromSharedUsers(listId, itemId);

        return { success: true };
    }

    // Listen to list changes
    listenToList(listId, callback) {
        if (!this.currentUserId) return;

        const itemsRef = this.usersRef.child(`${this.currentUserId}/lists/${listId}/items`);

        // Remove existing listener if any
        if (this.listeners[listId]) {
            itemsRef.off('value', this.listeners[listId]);
        }

        // Add new listener
        const listener = async (snapshot) => {
            const items = snapshot.exists() ? snapshot.val() : {};
            const effectiveSort = await this.getEffectiveSortMode(listId);
            callback(this.processListItems(items, effectiveSort));
        };

        itemsRef.on('value', listener);
        this.listeners[listId] = listener;

        return () => itemsRef.off('value', listener);
    }

    async getListParticipantUserIds(listId) {
        const currentListRef = this.usersRef.child(`${this.currentUserId}/lists/${listId}`);
        const currentSnap = await currentListRef.once('value');
        if (!currentSnap.exists()) return [this.currentUserId];

        const currentList = currentSnap.val();
        const ownerId = currentList.owner;

        // If current user is owner, participants are owner + sharedWith
        if (ownerId === this.currentUserId) {
            const sharedWith = currentList.sharedWith || [];
            return Array.from(new Set([ownerId, ...sharedWith]));
        }

        // Collaborator: resolve canonical participant list from owner's copy
        const ownerSnap = await this.usersRef.child(`${ownerId}/lists/${listId}`).once('value');
        if (ownerSnap.exists()) {
            const ownerList = ownerSnap.val();
            const sharedWith = ownerList.sharedWith || [];
            return Array.from(new Set([ownerId, ...sharedWith]));
        }

        // Fallback if owner copy missing
        return Array.from(new Set([ownerId, this.currentUserId]));
    }

    // Helper: Sync item changes to all list participants (owner + collaborators)
    async syncItemToSharedUsers(listId, itemId, itemData) {
        try {
            const participantIds = await this.getListParticipantUserIds(listId);
            if (!participantIds || participantIds.length <= 1) return;

            const updatePromises = participantIds.map(userId =>
                this.usersRef.child(`${userId}/lists/${listId}/items/${itemId}`).set(itemData)
            );

            await Promise.all(updatePromises);
        } catch (error) {
            console.error('Error syncing item to shared users:', error);
        }
    }

    // Helper: Remove item from all list participants
    async removeItemFromSharedUsers(listId, itemId) {
        try {
            const participantIds = await this.getListParticipantUserIds(listId);
            if (!participantIds || participantIds.length <= 1) return;

            const removePromises = participantIds.map(userId =>
                this.usersRef.child(`${userId}/lists/${listId}/items/${itemId}`).remove()
            );

            await Promise.all(removePromises);
        } catch (error) {
            console.error('Error removing item from shared users:', error);
        }
    }

    // Helper: Check for duplicate items
    async checkForDuplicates(listId, normalizedName) {
        const itemsRef = this.usersRef.child(`${this.currentUserId}/lists/${listId}/items`);
        const snapshot = await itemsRef.once('value');
        
        if (!snapshot.exists()) return { found: false };

        const items = snapshot.val();
        const similar = [];

        for (const [itemId, item] of Object.entries(items)) {
            // Exact match
            if (item.normalizedName === normalizedName) {
                return {
                    found: true,
                    exact: true,
                    item: item,
                    itemId: itemId
                };
            }

            // Fuzzy match (simple contains check)
            if (item.normalizedName.includes(normalizedName) || 
                normalizedName.includes(item.normalizedName)) {
                similar.push({
                    item: item,
                    itemId: itemId
                });
            }
        }

        if (similar.length > 0) {
            return {
                found: true,
                exact: false,
                similar: similar
            };
        }

        return { found: false };
    }

    // Helper: Get next order position for unchecked items
    async getNextOrderPosition(listId, checkedState = false) {
        const itemsRef = this.usersRef.child(`${this.currentUserId}/lists/${listId}/items`);
        const snapshot = await itemsRef.orderByChild('checked').equalTo(checkedState).once('value');

        let maxOrder = -1;
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const item = child.val();
                if ((item.order ?? -1) > maxOrder) {
                    maxOrder = item.order;
                }
            });
        }

        return maxOrder + 1;
    }

    // Helper: Process and sort list items
    processListItems(items, effectiveSort = { unchecked: 'manual', checked: 'alphabetical' }) {
        const unchecked = [];
        const checked = [];

        for (const [id, item] of Object.entries(items)) {
            const processedItem = { ...item, id };

            if (item.checked) {
                checked.push(processedItem);
            } else {
                unchecked.push(processedItem);
            }
        }

        // Unchecked sorting
        if ((effectiveSort.unchecked || 'manual') === 'alphabetical') {
            unchecked.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        } else {
            unchecked.sort((a, b) => (a.order || 0) - (b.order || 0));
        }

        // Checked sorting
        if ((effectiveSort.checked || 'alphabetical') === 'manual') {
            checked.sort((a, b) => (a.order || 0) - (b.order || 0));
        } else {
            checked.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        }

        return { unchecked, checked };
    }

    async getNextListOrder() {
        if (!this.currentUserId) throw new Error('User not authenticated');
        const userListsRef = this.usersRef.child(`${this.currentUserId}/lists`);
        const snapshot = await userListsRef.once('value');

        let maxOrder = -1;
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const list = child.val();
                if (typeof list.order === 'number' && list.order > maxOrder) {
                    maxOrder = list.order;
                }
            });
        }

        return maxOrder + 1;
    }

    async updateListOrder(orderedListIds) {
        if (!this.currentUserId) throw new Error('User not authenticated');

        const updates = {};
        orderedListIds.forEach((listId, index) => {
            updates[`${listId}/order`] = index;
        });

        await this.usersRef.child(`${this.currentUserId}/lists`).update(updates);
        return { success: true };
    }

    async updateSectionOrder(listId, checkedState, orderedItemIds) {
        if (!this.currentUserId) throw new Error('User not authenticated');

        const updates = {};
        orderedItemIds.forEach((itemId, index) => {
            updates[`${itemId}/order`] = index;
            updates[`${itemId}/checked`] = checkedState;
            updates[`${itemId}/timestamp`] = firebase.database.ServerValue.TIMESTAMP;
        });

        const itemsRef = this.usersRef.child(`${this.currentUserId}/lists/${listId}/items`);
        await itemsRef.update(updates);

        // Best-effort sync to all participants
        try {
            const participantIds = await this.getListParticipantUserIds(listId);
            if (participantIds.length > 1) {
                await Promise.all(participantIds.map(async (uid) => {
                    await this.usersRef.child(`${uid}/lists/${listId}/items`).update(updates);
                }));
            }
        } catch (e) {
            console.warn('Order sync warning:', e);
        }

        return { success: true };
    }

    async getUserSortDefaults() {
        if (!this.currentUserId) throw new Error('User not authenticated');
        const ref = this.usersRef.child(`${this.currentUserId}/preferences/sortDefaults`);
        const snapshot = await ref.once('value');
        const defaults = snapshot.exists()
            ? snapshot.val()
            : { unchecked: 'manual', checked: 'alphabetical' };
        this.sortDefaults = { unchecked: 'manual', checked: 'alphabetical', ...defaults };
        return this.sortDefaults;
    }

    async setUserSortDefaults(defaults) {
        if (!this.currentUserId) throw new Error('User not authenticated');
        const merged = { unchecked: 'manual', checked: 'alphabetical', ...defaults };
        await this.usersRef.child(`${this.currentUserId}/preferences/sortDefaults`).set(merged);
        this.sortDefaults = merged;
        return { success: true, defaults: merged };
    }

    async getListSortMode(listId) {
        if (!this.currentUserId) throw new Error('User not authenticated');
        const ref = this.usersRef.child(`${this.currentUserId}/lists/${listId}/sortMode`);
        const snapshot = await ref.once('value');
        return snapshot.exists()
            ? { unchecked: 'default', checked: 'default', ...snapshot.val() }
            : { unchecked: 'default', checked: 'default' };
    }

    async setListSortMode(listId, sortMode) {
        if (!this.currentUserId) throw new Error('User not authenticated');
        const merged = { unchecked: 'default', checked: 'default', ...sortMode };
        await this.usersRef.child(`${this.currentUserId}/lists/${listId}/sortMode`).set(merged);

        // Sync preference to all list participants for consistent list behavior
        const participantIds = await this.getListParticipantUserIds(listId);
        if (participantIds.length > 1) {
            await Promise.all(participantIds.map(uid =>
                this.usersRef.child(`${uid}/lists/${listId}/sortMode`).set(merged)
            ));
        }

        return { success: true, sortMode: merged };
    }

    async getEffectiveSortMode(listId) {
        const defaults = await this.getUserSortDefaults();
        const listMode = await this.getListSortMode(listId);
        return {
            unchecked: listMode.unchecked === 'default' ? defaults.unchecked : listMode.unchecked,
            checked: listMode.checked === 'default' ? defaults.checked : listMode.checked
        };
    }

    normalizeEmail(email) {
        const normalized = (email || '').toLowerCase().trim();
        // Firebase RTDB keys cannot contain: . # $ [ ] /
        return normalized.replace(/[.#$\[\]\/]/g, ',');
    }

    // Helper: Normalize item name for comparison
    normalizeItemName(name) {
        return name.toLowerCase().trim().replace(/\s+/g, ' ');
    }

    // Clean up listeners
    cleanup() {
        for (const [listId, listener] of Object.entries(this.listeners)) {
            const itemsRef = this.usersRef.child(`${this.currentUserId}/lists/${listId}/items`);
            itemsRef.off('value', listener);
        }
        this.listeners = {};
        this.currentUserId = null;
        this.currentUserEmail = null;
    }
}