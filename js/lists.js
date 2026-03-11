// Lists Management Module for Billy's List

class ListsManager {
    constructor(database) {
        this.database = database;
        this.currentListId = null;
        this.userLists = { owned: [], shared: [] };
        this.draggedTabEl = null;
        this.touchDraggedTabEl = null;
        this.tabTouchPressTimer = null;
        this.tabTouchDragActive = false;
        this.tabTouchStartX = 0;
        this.tabTouchStartY = 0;
        
        this.initializeElements();
        this.initializeEventListeners();
    }

    initializeElements() {
        // Lists navigation
        this.listsContainer = document.getElementById('lists-container');
        this.createListBtn = document.getElementById('create-list-btn');
        
        // Modals
        this.createListModal = document.getElementById('create-list-modal');
        this.newListNameInput = document.getElementById('new-list-name');
        this.createListConfirm = document.getElementById('create-list-confirm');
        this.createListCancel = document.getElementById('create-list-cancel');
        
        this.shareListModal = document.getElementById('share-list-modal');
        this.shareEmailInput = document.getElementById('share-email-input');
        this.shareListConfirm = document.getElementById('share-list-confirm');
        this.shareListCancel = document.getElementById('share-list-cancel');
        
        // List actions
        this.shareListBtn = document.getElementById('share-list-btn');
        this.listOptionsBtn = document.getElementById('list-options-btn');
        this.listOptionsMenu = document.getElementById('list-options-menu');
        this.shareListMenuBtn = document.getElementById('share-list-menu-btn');
        this.sortListMenuBtn = document.getElementById('sort-list-menu-btn');
        this.renameListBtn = document.getElementById('rename-list-btn');
        this.duplicateListBtn = document.getElementById('duplicate-list-btn');
        this.deleteListBtn = document.getElementById('delete-list-btn');
        
        // Confirmation modal
        this.confirmModal = document.getElementById('confirm-modal');
        this.confirmTitle = document.getElementById('confirm-title');
        this.confirmMessage = document.getElementById('confirm-message');
        this.confirmYes = document.getElementById('confirm-yes');
        this.confirmNo = document.getElementById('confirm-no');
        
        // Current list display
        this.noListSelected = document.getElementById('no-list-selected');
        this.activeListContainer = document.getElementById('active-list-container');
        this.currentListTitle = document.getElementById('current-list-title');
        this.sharedMetaRow = document.getElementById('shared-meta-row');
        this.sharedMetaText = document.getElementById('shared-meta-text');
        this.sharedMetaAction = document.getElementById('shared-meta-action');

        // Manage sharing modal
        this.manageSharingModal = document.getElementById('manage-sharing-modal');
        this.sharedUsersList = document.getElementById('shared-users-list');
        this.manageSharingClose = document.getElementById('manage-sharing-close');
    }

    initializeEventListeners() {
        // Create list
        this.createListBtn.addEventListener('click', () => this.showCreateListModal());
        this.createListConfirm.addEventListener('click', () => this.createList());
        this.createListCancel.addEventListener('click', () => this.hideCreateListModal());
        this.newListNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createList();
        });

        // Share list
        this.shareListBtn.addEventListener('click', () => this.showShareListModal());
        this.shareListConfirm.addEventListener('click', () => this.shareList());
        this.shareListCancel.addEventListener('click', () => this.hideShareListModal());
        this.shareEmailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.shareList();
        });

        // List options menu
        if (this.listOptionsBtn) {
            this.listOptionsBtn.addEventListener('click', (e) => this.showListOptionsMenu(e));
        }
        this.shareListMenuBtn.addEventListener('click', () => this.openShareFromMenu());
        this.sortListMenuBtn.addEventListener('click', () => this.configureCurrentListSort());
        this.renameListBtn.addEventListener('click', () => this.renameCurrentList());
        this.duplicateListBtn.addEventListener('click', () => this.duplicateCurrentList());
        this.deleteListBtn.addEventListener('click', () => this.deleteCurrentList());

        // Confirmation modal
        this.confirmYes.addEventListener('click', () => this.executeConfirmedAction());
        this.confirmNo.addEventListener('click', () => this.hideConfirmModal());

        // Close modals on outside click
        this.createListModal.addEventListener('click', (e) => {
            if (e.target === this.createListModal) this.hideCreateListModal();
        });
        this.shareListModal.addEventListener('click', (e) => {
            if (e.target === this.shareListModal) this.hideShareListModal();
        });
        this.confirmModal.addEventListener('click', (e) => {
            if (e.target === this.confirmModal) this.hideConfirmModal();
        });

        this.manageSharingClose.addEventListener('click', () => this.hideManageSharingModal());
        this.manageSharingModal.addEventListener('click', (e) => {
            if (e.target === this.manageSharingModal) this.hideManageSharingModal();
        });

        // Close options menu on outside click
        document.addEventListener('click', () => this.hideListOptionsMenu());
    }

    // Load and display user's lists
    async loadUserLists() {
        try {
            this.userLists = await this.database.getUserLists();

            const allLists = [...this.userLists.owned, ...this.userLists.shared];
            const stillExists = allLists.some(list => list.id === this.currentListId);

            // If current selection was deleted/missing, clear it before rendering/selecting
            if (this.currentListId && !stillExists) {
                this.currentListId = null;
            }

            this.renderListsTabs();

            // Ensure one list is selected when lists exist
            if (!this.currentListId && this.userLists.owned.length > 0) {
                this.selectList(this.userLists.owned[0].id);
            } else if (!this.currentListId && this.userLists.shared.length > 0) {
                this.selectList(this.userLists.shared[0].id);
            } else if (!this.currentListId) {
                this.showNoListSelected();
            } else {
                // Reaffirm active state after rerender
                this.selectList(this.currentListId);
            }
        } catch (error) {
            console.error('Error loading user lists:', error);
            this.showError('Failed to load your lists. Please try again.');
        }
    }

    // Render lists tabs
    renderListsTabs() {
        this.listsContainer.innerHTML = '';

        // Add owned lists
        this.userLists.owned.forEach(list => {
            const tab = this.createListTab(list, false);
            this.listsContainer.appendChild(tab);
        });

        // Add shared lists
        this.userLists.shared.forEach(list => {
            const tab = this.createListTab(list, true);
            this.listsContainer.appendChild(tab);
        });

        // Show message if no lists
        if (this.userLists.owned.length === 0 && this.userLists.shared.length === 0) {
            this.listsContainer.innerHTML = `
                <div class="no-lists-message">
                    <p>No lists yet. Create your first list!</p>
                </div>
            `;
            return;
        }

        this.setupTabReorder();
    }

    // Create a list tab element
    createListTab(list, isShared) {
        const tab = document.createElement('div');
        tab.className = `list-tab ${isShared ? 'shared' : ''}`;
        tab.dataset.listId = list.id;

        if (list.id === this.currentListId) {
            tab.classList.add('active');
        }

        const labelBtn = document.createElement('button');
        labelBtn.className = 'list-tab-label';
        labelBtn.type = 'button';
        labelBtn.textContent = list.name;
        labelBtn.addEventListener('click', () => this.selectList(list.id));

        tab.appendChild(labelBtn);

        const isSharedByOwner = Array.isArray(list.sharedWith) && list.sharedWith.length > 0;
        if (isShared || isSharedByOwner) {
            const shared = document.createElement('span');
            shared.className = 'shared-indicator';
            shared.textContent = '👥';
            shared.title = isShared ? 'Shared with you' : 'Shared by you';
            tab.appendChild(shared);
        }

        if (!isShared && list.id === this.currentListId) {
            const menuBtn = document.createElement('button');
            menuBtn.className = 'tab-menu-btn';
            menuBtn.type = 'button';
            menuBtn.textContent = '⋯';
            menuBtn.setAttribute('aria-label', `Options for ${list.name}`);
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showListOptionsMenu(e, menuBtn);
            });
            tab.appendChild(menuBtn);
        }

        return tab;
    }

    setupTabReorder() {
        const tabs = Array.from(this.listsContainer.querySelectorAll('.list-tab'));

        tabs.forEach(tab => {
            const isOwned = this.userLists.owned.some(l => l.id === tab.dataset.listId);
            const labelBtn = tab.querySelector('.list-tab-label');

            tab.draggable = isOwned;
            tab.classList.toggle('tab-reorderable', isOwned);

            tab.ondragstart = null;
            tab.ondragend = null;
            tab.ondragover = null;
            tab.ondrop = null;
            tab.ontouchstart = null;
            tab.ontouchmove = null;
            tab.ontouchend = null;

            if (!isOwned) return;

            tab.ondragstart = (e) => {
                this.draggedTabEl = tab;
                tab.classList.add('dragging');
                if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
            };

            tab.ondragend = async () => {
                if (!this.draggedTabEl) return;
                this.draggedTabEl.classList.remove('dragging');
                this.draggedTabEl = null;
                await this.persistOwnedTabOrder();
            };

            tab.ondragover = (e) => {
                e.preventDefault();
                if (!this.draggedTabEl || this.draggedTabEl === tab) return;
                if (!this.draggedTabEl.classList.contains('tab-reorderable') || !tab.classList.contains('tab-reorderable')) return;

                const rect = tab.getBoundingClientRect();
                const isAfter = (e.clientX - rect.left) > (rect.width / 2);
                if (isAfter) {
                    tab.parentNode.insertBefore(this.draggedTabEl, tab.nextSibling);
                } else {
                    tab.parentNode.insertBefore(this.draggedTabEl, tab);
                }
            };

            // touch reorder (iOS): long-press to drag, swipe to scroll
            tab.ontouchstart = (e) => {
                // don't start when tapping menu button
                if (e.target.closest('.tab-menu-btn')) return;

                const touch = e.touches && e.touches[0];
                if (!touch) return;

                this.tabTouchDragActive = false;
                this.tabTouchStartX = touch.clientX;
                this.tabTouchStartY = touch.clientY;
                this.touchDraggedTabEl = tab;

                clearTimeout(this.tabTouchPressTimer);
                this.tabTouchPressTimer = setTimeout(() => {
                    if (this.touchDraggedTabEl === tab) {
                        this.tabTouchDragActive = true;
                        tab.classList.add('dragging');
                    }
                }, 280); // long-press threshold
            };

            tab.ontouchmove = (e) => {
                if (!this.touchDraggedTabEl) return;

                const touch = e.touches && e.touches[0];
                if (!touch) return;

                const dx = Math.abs(touch.clientX - this.tabTouchStartX);
                const dy = Math.abs(touch.clientY - this.tabTouchStartY);

                // If user is swiping before long-press triggers, allow normal horizontal scroll
                if (!this.tabTouchDragActive) {
                    if (dx > 8 || dy > 8) {
                        clearTimeout(this.tabTouchPressTimer);
                    }
                    return;
                }

                // Active drag: prevent page/list scrolling
                e.preventDefault();

                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                const targetTab = target ? target.closest('.list-tab') : null;
                if (!targetTab || targetTab === this.touchDraggedTabEl) return;
                if (!targetTab.classList.contains('tab-reorderable')) return;

                const rect = targetTab.getBoundingClientRect();
                const isAfter = (touch.clientX - rect.left) > (rect.width / 2);
                if (isAfter) {
                    this.listsContainer.insertBefore(this.touchDraggedTabEl, targetTab.nextSibling);
                } else {
                    this.listsContainer.insertBefore(this.touchDraggedTabEl, targetTab);
                }
            };

            tab.ontouchend = async () => {
                clearTimeout(this.tabTouchPressTimer);

                if (!this.touchDraggedTabEl) return;

                if (this.tabTouchDragActive) {
                    this.touchDraggedTabEl.classList.remove('dragging');
                    this.touchDraggedTabEl = null;
                    this.tabTouchDragActive = false;
                    await this.persistOwnedTabOrder();
                } else {
                    // Treat as normal tap if no drag was activated
                    const tappedId = this.touchDraggedTabEl.dataset.listId;
                    this.touchDraggedTabEl = null;
                    this.tabTouchDragActive = false;
                    this.selectList(tappedId);
                }
            };

            if (labelBtn) {
                labelBtn.style.touchAction = 'manipulation';
            }
        });
    }

    async persistOwnedTabOrder() {
        const orderedOwnedIds = Array.from(this.listsContainer.querySelectorAll('.list-tab.tab-reorderable'))
            .map(tab => tab.dataset.listId);
        if (orderedOwnedIds.length === 0) return;

        try {
            await this.database.updateListOrder(orderedOwnedIds);
            await this.loadUserLists();
            if (this.currentListId) this.selectList(this.currentListId);
        } catch (error) {
            console.error('Error saving tab order:', error);
            this.showError('Failed to save tab order.');
        }
    }

    // Select a list
    selectList(listId) {
        this.currentListId = listId;
        
        // Re-render tabs so active state and active-only menu button stay in sync
        this.renderListsTabs();

        // Find the list data
        const allLists = [...this.userLists.owned, ...this.userLists.shared];
        const selectedList = allLists.find(list => list.id === listId);

        if (selectedList) {
            this.showActiveList(selectedList);
            
            // Notify items manager about list change
            if (window.billysListApp && window.billysListApp.itemsManager) {
                window.billysListApp.itemsManager.setCurrentList(listId);
            }
        }
    }

    // Show active list
    showActiveList(listData) {
        this.noListSelected.style.display = 'none';
        this.activeListContainer.style.display = 'block';
        
        this.currentListTitle.textContent = listData.name;
        
        // Update legacy header button visibility (kept for compatibility)
        if (this.shareListBtn) {
            this.shareListBtn.style.display = listData.isOwned ? 'inline-block' : 'none';
        }
        if (this.listOptionsBtn) {
            this.listOptionsBtn.style.display = 'none';
        }

        this.renderSharedMeta(listData);
    }

    // Show no list selected state
    showNoListSelected() {
        this.currentListId = null;
        this.noListSelected.style.display = 'block';
        this.activeListContainer.style.display = 'none';
        if (this.sharedMetaRow) this.sharedMetaRow.style.display = 'none';
        
        // Clear active tab
        document.querySelectorAll('.list-tab').forEach(tab => {
            tab.classList.remove('active');
        });
    }

    async renderSharedMeta(listData) {
        if (!this.sharedMetaRow || !this.sharedMetaText || !this.sharedMetaAction) return;

        const hasShares = Array.isArray(listData.sharedWith) && listData.sharedWith.length > 0;
        const isSharedRecipient = !listData.isOwned;

        if (!hasShares && !isSharedRecipient) {
            this.sharedMetaRow.style.display = 'none';
            return;
        }

        try {
            const details = await this.database.getListSharingDetails(listData.id);

            if (details.isOwned) {
                const emails = details.sharedUsers.map(u => u.email || u.name).filter(Boolean);
                this.sharedMetaText.textContent = emails.length > 0
                    ? `👥 Shared with: ${emails.join(', ')}`
                    : '👥 Not currently shared';
                this.sharedMetaAction.textContent = 'Manage';
                this.sharedMetaAction.onclick = () => this.openManageSharingModal(details);
            } else {
                this.sharedMetaText.textContent = `👥 Shared by: ${details.ownerEmail || details.ownerName}`;
                this.sharedMetaAction.textContent = 'Leave list';
                this.sharedMetaAction.onclick = () => this.confirmLeaveSharedList();
            }

            this.sharedMetaRow.style.display = 'flex';
        } catch (error) {
            console.error('Error loading sharing metadata:', error);
            this.sharedMetaRow.style.display = 'none';
        }
    }

    openManageSharingModal(details) {
        this.sharedUsersList.innerHTML = '';

        if (!details.sharedUsers || details.sharedUsers.length === 0) {
            this.sharedUsersList.innerHTML = '<p>No users currently have access.</p>';
        } else {
            details.sharedUsers.forEach((user) => {
                const row = document.createElement('div');
                row.className = 'share-user-row';
                row.innerHTML = `
                    <div class="share-user-info">
                        <div class="share-user-name">${this.escapeHtml(user.name || user.email || user.userId)}</div>
                        <div class="share-user-email">${this.escapeHtml(user.email || '')}</div>
                    </div>
                    <button class="btn-cancel" type="button">Remove</button>
                `;

                const btn = row.querySelector('button');
                btn.addEventListener('click', async () => {
                    btn.disabled = true;
                    btn.textContent = 'Removing...';
                    try {
                        await this.database.unshareListWithUser(this.currentListId, user.userId);
                        this.showSuccess(`Removed access for ${user.email || user.name}`);
                        await this.loadUserLists();
                        const allLists = [...this.userLists.owned, ...this.userLists.shared];
                        const current = allLists.find(l => l.id === this.currentListId);
                        if (current) {
                            const refreshed = await this.database.getListSharingDetails(this.currentListId);
                            this.openManageSharingModal(refreshed);
                        } else {
                            this.hideManageSharingModal();
                        }
                    } catch (error) {
                        console.error('Error unsharing list:', error);
                        this.showError(error.message || 'Failed to remove share.');
                        btn.disabled = false;
                        btn.textContent = 'Remove';
                    }
                });

                this.sharedUsersList.appendChild(row);
            });
        }

        this.manageSharingModal.style.display = 'flex';
    }

    hideManageSharingModal() {
        this.manageSharingModal.style.display = 'none';
    }

    confirmLeaveSharedList() {
        this.showConfirmModal(
            'Leave Shared List',
            'Stop using this shared list? You can be re-invited later by the owner.',
            'leave-shared-list'
        );
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    // Create list modal
    showCreateListModal() {
        this.newListNameInput.value = '';
        this.createListModal.style.display = 'flex';
        setTimeout(() => this.newListNameInput.focus(), 100);
    }

    hideCreateListModal() {
        this.createListModal.style.display = 'none';
    }

    async createList() {
        const listName = this.newListNameInput.value.trim();
        if (!listName) {
            this.showError('Please enter a list name');
            return;
        }

        try {
            this.createListConfirm.disabled = true;
            this.createListConfirm.textContent = 'Creating...';
            
            const result = await this.database.createList(listName);
            
            if (result.success) {
                this.hideCreateListModal();
                await this.loadUserLists();
                this.selectList(result.listId);
            }
        } catch (error) {
            console.error('Error creating list:', error);
            this.showError('Failed to create list. Please try again.');
        } finally {
            this.createListConfirm.disabled = false;
            this.createListConfirm.textContent = 'Create List';
        }
    }

    // Share list modal
    showShareListModal() {
        if (!this.currentListId) return;
        
        this.shareEmailInput.value = '';
        this.shareListModal.style.display = 'flex';
        setTimeout(() => this.shareEmailInput.focus(), 100);
    }

    hideShareListModal() {
        this.shareListModal.style.display = 'none';
    }

    async shareList() {
        const email = this.shareEmailInput.value.trim();
        if (!email) {
            this.showError('Please enter an email address');
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        try {
            this.shareListConfirm.disabled = true;
            this.shareListConfirm.textContent = 'Sharing...';
            
            const result = await this.database.shareListWithUser(this.currentListId, email);
            
            if (result.success) {
                this.hideShareListModal();
                this.showSuccess(`List shared with ${email}`);
                await this.loadUserLists();
            }
        } catch (error) {
            console.error('Error sharing list:', error);
            this.showError(error.message || 'Failed to share list. Please try again.');
        } finally {
            this.shareListConfirm.disabled = false;
            this.shareListConfirm.textContent = 'Share List';
        }
    }

    // List options menu
    showListOptionsMenu(e, anchorEl = null) {
        e.stopPropagation();

        if (!this.currentListId) return;

        const anchor = anchorEl || this.listOptionsBtn;
        if (!anchor) return;

        const rect = anchor.getBoundingClientRect();
        this.listOptionsMenu.style.left = `${Math.max(8, rect.right - 180)}px`;
        this.listOptionsMenu.style.top = `${rect.bottom + 6}px`;
        this.listOptionsMenu.style.display = 'block';
    }

    hideListOptionsMenu() {
        this.listOptionsMenu.style.display = 'none';
    }

    openShareFromMenu() {
        this.hideListOptionsMenu();

        const allLists = [...this.userLists.owned, ...this.userLists.shared];
        const selectedList = allLists.find(list => list.id === this.currentListId);
        if (!selectedList || !selectedList.isOwned) {
            this.showError('Only lists you own can be shared.');
            return;
        }

        this.showShareListModal();
    }

    async configureUserSortDefaults() {
        const current = await this.database.getUserSortDefaults();

        const unchecked = prompt(
            'Default sort for UNCHECKED items?\nType: manual or alphabetical',
            current.unchecked || 'manual'
        );
        if (!unchecked) return;

        const checked = prompt(
            'Default sort for CHECKED items?\nType: manual or alphabetical',
            current.checked || 'alphabetical'
        );
        if (!checked) return;

        const normalize = (v, fallback) => {
            const x = (v || '').toLowerCase().trim();
            return (x === 'manual' || x === 'alphabetical') ? x : fallback;
        };

        const defaults = {
            unchecked: normalize(unchecked, 'manual'),
            checked: normalize(checked, 'alphabetical')
        };

        await this.database.setUserSortDefaults(defaults);
        this.showSuccess(`Saved defaults: unchecked=${defaults.unchecked}, checked=${defaults.checked}`);

        if (this.currentListId && window.billysListApp && window.billysListApp.itemsManager) {
            window.billysListApp.itemsManager.setCurrentList(this.currentListId);
        }
    }

    async configureCurrentListSort() {
        this.hideListOptionsMenu();
        if (!this.currentListId) return;

        const current = await this.database.getListSortMode(this.currentListId);

        const unchecked = prompt(
            'Sort for this list (UNCHECKED): default | manual | alphabetical',
            current.unchecked || 'default'
        );
        if (!unchecked) return;

        const checked = prompt(
            'Sort for this list (CHECKED): default | manual | alphabetical',
            current.checked || 'default'
        );
        if (!checked) return;

        const normalize = (v) => {
            const x = (v || '').toLowerCase().trim();
            return (x === 'default' || x === 'manual' || x === 'alphabetical') ? x : 'default';
        };

        const mode = {
            unchecked: normalize(unchecked),
            checked: normalize(checked)
        };

        await this.database.setListSortMode(this.currentListId, mode);
        await this.loadUserLists();
        this.showSuccess(`List sort saved: unchecked=${mode.unchecked}, checked=${mode.checked}`);

        if (window.billysListApp && window.billysListApp.itemsManager) {
            window.billysListApp.itemsManager.setCurrentList(this.currentListId);
        }
    }

    async renameCurrentList() {
        this.hideListOptionsMenu();
        
        if (!this.currentListId) return;

        const currentName = this.currentListTitle.textContent;
        const newName = prompt('Enter new list name:', currentName);
        
        if (!newName || newName.trim() === currentName) return;

        try {
            await this.database.renameList(this.currentListId, newName.trim());
            await this.loadUserLists();
            this.showSuccess('List renamed successfully');
        } catch (error) {
            console.error('Error renaming list:', error);
            this.showError(error.message || 'Failed to rename list. Please try again.');
        }
    }

    async duplicateCurrentList() {
        this.hideListOptionsMenu();
        
        if (!this.currentListId) return;

        const currentName = this.currentListTitle.textContent;
        const newName = prompt('Enter name for duplicate list:', `${currentName} (Copy)`);
        
        if (!newName) return;

        try {
            // Create new list
            const result = await this.database.createList(newName.trim());
            
            if (result.success) {
                // Get current list items
                const items = await this.database.getListItems(this.currentListId);
                
                // Add items to new list
                const allItems = [...items.unchecked, ...items.checked];
                for (const item of allItems) {
                    await this.database.addItemToList(result.listId, item.name);
                }
                
                await this.loadUserLists();
                this.selectList(result.listId);
                this.showSuccess('List duplicated successfully');
            }
        } catch (error) {
            console.error('Error duplicating list:', error);
            this.showError('Failed to duplicate list. Please try again.');
        }
    }

    deleteCurrentList() {
        this.hideListOptionsMenu();
        
        if (!this.currentListId) return;

        const listName = this.currentListTitle.textContent;
        this.showConfirmModal(
            'Delete List',
            `Are you sure you want to delete "${listName}"? This action cannot be undone.`,
            'delete-list'
        );
    }

    // Confirmation modal
    showConfirmModal(title, message, action) {
        this.confirmTitle.textContent = title;
        this.confirmMessage.textContent = message;
        this.confirmModal.style.display = 'flex';
        this.pendingAction = action;
    }

    hideConfirmModal() {
        this.confirmModal.style.display = 'none';
        this.pendingAction = null;
    }

    async executeConfirmedAction() {
        if (!this.pendingAction) return;

        try {
            if (this.pendingAction === 'delete-list') {
                await this.database.deleteList(this.currentListId);
                await this.loadUserLists();
                this.showSuccess('List deleted successfully');
            } else if (this.pendingAction === 'leave-shared-list') {
                await this.database.leaveSharedList(this.currentListId);
                await this.loadUserLists();
                this.showSuccess('You left the shared list');
            }
        } catch (error) {
            console.error('Error executing confirmed action:', error);
            this.showError('Failed to complete action. Please try again.');
        } finally {
            this.hideConfirmModal();
        }
    }

    // Utility methods
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    showError(message) {
        alert(`Error: ${message}`);
    }

    showSuccess(message) {
        alert(`Success: ${message}`);
    }

    getCurrentListId() {
        return this.currentListId;
    }

    cleanup() {
        this.currentListId = null;
        this.userLists = { owned: [], shared: [] };
    }
}