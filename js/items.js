// Items Management Module for Billy's List

class ItemsManager {
    constructor(database) {
        this.database = database;
        this.currentListId = null;
        this.isEditMode = false;
        this.originalItemData = {};
        this.selectedItem = null;
        this.currentAction = null;
        this.currentSortMode = { unchecked: 'manual', checked: 'alphabetical' };
        this.draggedItemEl = null;
        this.touchDraggedItemEl = null;
        this.touchDragMoved = false;
        this.lastTapTime = 0;
        this.lastTapItemId = null;
        
        this.initializeElements();
        this.initializeEventListeners();
    }

    initializeElements() {
        // Add item elements
        this.newItemInput = document.getElementById('new-item-input');
        this.addItemBtn = document.getElementById('add-item-btn');
        
        // Items containers
        this.uncheckedItemsContainer = document.getElementById('unchecked-items');
        this.checkedItemsContainer = document.getElementById('checked-items');
        this.currentListItemCount = document.getElementById('current-list-item-count');
        
        // Edit mode controls
        
        // Modals and menus
        this.duplicateModal = document.getElementById('duplicate-modal');
        this.duplicateMessage = document.getElementById('duplicate-message');
        this.addAnywayBtn = document.getElementById('add-anyway-btn');
        this.viewExistingBtn = document.getElementById('view-existing-btn');
        this.cancelAddBtn = document.getElementById('cancel-add-btn');
        
        this.itemMenu = document.getElementById('item-menu');
        this.editItemBtn = document.getElementById('edit-item');
        this.moveItemBtn = document.getElementById('move-item');
        this.copyItemBtn = document.getElementById('copy-item');
        this.deleteItemBtn = document.getElementById('delete-item');
        
        this.moveCopyModal = document.getElementById('move-copy-modal');
        this.moveCopyTitle = document.getElementById('move-copy-title');
        this.targetListsContainer = document.getElementById('target-lists-container');
        this.moveCopyCancel = document.getElementById('move-copy-cancel');
    }

    initializeEventListeners() {
        // Add item functionality
        this.addItemBtn.addEventListener('click', () => this.addItem());
        this.newItemInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addItem();
        });

        // Edit mode controls

        // Duplicate modal
        this.addAnywayBtn.addEventListener('click', () => this.confirmAddItem());
        this.viewExistingBtn.addEventListener('click', () => this.viewExistingItem());
        this.cancelAddBtn.addEventListener('click', () => this.closeDuplicateModal());

        // Item context menu
        this.editItemBtn.addEventListener('click', () => this.editSelectedItem());
        this.moveItemBtn.addEventListener('click', () => this.showMoveCopyModal('move'));
        this.copyItemBtn.addEventListener('click', () => this.showMoveCopyModal('copy'));
        this.deleteItemBtn.addEventListener('click', () => this.deleteSelectedItem());

        // Move/copy modal
        this.moveCopyCancel.addEventListener('click', () => this.hideMoveCopyModal());

        // Close modals on outside click
        this.duplicateModal.addEventListener('click', (e) => {
            if (e.target === this.duplicateModal) this.closeDuplicateModal();
        });
        this.moveCopyModal.addEventListener('click', (e) => {
            if (e.target === this.moveCopyModal) this.hideMoveCopyModal();
        });

        // Close context menu on outside click
        document.addEventListener('click', () => this.hideContextMenu());
    }

    // Set current list
    async setCurrentList(listId) {
        // Clean up previous list listener
        if (this.currentListId) {
            // Remove listener would be handled by database cleanup
        }

        this.currentListId = listId;

        if (listId) {
            this.currentSortMode = await this.database.getEffectiveSortMode(listId);

            // Start listening to list changes
            this.database.listenToList(listId, async (data) => {
                this.currentSortMode = await this.database.getEffectiveSortMode(listId);
                this.renderItems(data);
            });

        }
    }

    // Add new item
    async addItem() {
        if (!this.currentListId) return;
        
        const itemName = this.newItemInput.value.trim();
        if (!itemName) return;

        try {
            this.setAddButtonLoading(true);
            
            const result = await this.database.addItemToList(this.currentListId, itemName);
            
            if (result.duplicate) {
                this.showDuplicateDialog(itemName, result.similar);
                return;
            }

            if (result.success) {
                this.newItemInput.value = '';
                this.newItemInput.focus();
            }
        } catch (error) {
            console.error('Error adding item:', error);
            this.showError('Failed to add item. Please try again.');
        } finally {
            this.setAddButtonLoading(false);
        }
    }

    // Force add item (after duplicate warning)
    async confirmAddItem() {
        const itemName = this.pendingItemName;
        this.closeDuplicateModal();

        try {
            // Force add the item by creating it directly
            const result = await this.database.addItemToList(this.currentListId, itemName);
            // Note: This will bypass duplicate checking in the database layer
            // We need to update the database method to support force adding
            
            this.newItemInput.value = '';
            this.newItemInput.focus();
        } catch (error) {
            console.error('Error force adding item:', error);
            this.showError('Failed to add item. Please try again.');
        }
    }

    viewExistingItem() {
        this.closeDuplicateModal();
        this.newItemInput.value = '';
        // Could scroll to existing item in the future
    }

    // Toggle item checked status
    async toggleItem(itemId) {
        if (!this.currentListId || this.isEditMode) return;

        try {
            await this.database.toggleItemInList(this.currentListId, itemId);
        } catch (error) {
            console.error('Error toggling item:', error);
            this.showError('Failed to update item. Please try again.');
        }
    }

    // Show duplicate dialog
    showDuplicateDialog(itemName, duplicateInfo) {
        this.pendingItemName = itemName;
        
        let message = '';
        if (duplicateInfo.exact) {
            message = `"${duplicateInfo.item.name}" already exists in this list.`;
        } else if (duplicateInfo.similar) {
            const similarNames = duplicateInfo.similar.map(s => `"${s.item.name}"`).join(', ');
            message = `Similar items found in this list: ${similarNames}`;
        }

        this.duplicateMessage.textContent = message;
        this.duplicateModal.style.display = 'flex';
    }

    closeDuplicateModal() {
        this.duplicateModal.style.display = 'none';
        this.pendingItemName = null;
        this.setAddButtonLoading(false);
    }

    showContextMenu(e, itemId) {
        e.preventDefault();
        e.stopPropagation();
        
        this.selectedItem = { listId: this.currentListId, itemId };
        
        const x = e.pageX;
        const y = e.pageY;
        
        this.itemMenu.style.left = `${x}px`;
        this.itemMenu.style.top = `${y}px`;
        this.itemMenu.style.display = 'block';

        // Adjust position if menu goes off screen
        setTimeout(() => {
            const rect = this.itemMenu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                this.itemMenu.style.left = `${x - rect.width}px`;
            }
            if (rect.bottom > window.innerHeight) {
                this.itemMenu.style.top = `${y - rect.height}px`;
            }
        });
    }

    hideContextMenu() {
        this.itemMenu.style.display = 'none';
        this.selectedItem = null;
    }

    async editSelectedItem() {
        if (!this.selectedItem) return;
        
        const itemEl = document.querySelector(`[data-item-id="${this.selectedItem.itemId}"]`);
        if (!itemEl) return;
        
        const textEl = itemEl.querySelector('.item-text');
        const currentName = textEl.textContent;
        const newName = prompt('Edit item name:', currentName);
        
        if (!newName || newName.trim() === currentName) {
            this.hideContextMenu();
            return;
        }

        try {
            await this.database.updateItemName(this.currentListId, this.selectedItem.itemId, newName.trim());
            this.showSuccess('Item updated successfully');
        } catch (error) {
            console.error('Error updating item:', error);
            this.showError('Failed to update item. Please try again.');
        } finally {
            this.hideContextMenu();
        }
    }

    async deleteSelectedItem() {
        if (!this.selectedItem) return;

        try {
            await this.database.deleteItemFromList(this.currentListId, this.selectedItem.itemId);
            this.hideContextMenu();
        } catch (error) {
            console.error('Error deleting item:', error);
            this.showError('Failed to delete item. Please try again.');
        }
    }

    // Move/copy functionality
    showMoveCopyModal(action) {
        this.currentAction = action;
        this.moveCopyTitle.textContent = action === 'move' ? 'Move Item to List' : 'Copy Item to List';
        
        // Get available lists
        if (window.billysListApp && window.billysListApp.listsManager) {
            const userLists = window.billysListApp.listsManager.userLists;
            const allLists = [...userLists.owned, ...userLists.shared];
            
            this.targetListsContainer.innerHTML = '';
            
            allLists.forEach(list => {
                if (list.id !== this.currentListId) {
                    const option = document.createElement('button');
                    option.className = 'target-list-option';
                    option.textContent = list.name;
                    option.addEventListener('click', () => this.executeMoveCopyAction(list.id));
                    this.targetListsContainer.appendChild(option);
                }
            });
        }

        this.moveCopyModal.style.display = 'flex';
        this.hideContextMenu();
    }

    hideMoveCopyModal() {
        this.moveCopyModal.style.display = 'none';
        this.currentAction = null;
    }

    async executeMoveCopyAction(targetListId) {
        if (!this.selectedItem || !this.currentAction) return;

        try {
            // This would require additional database methods for moving/copying between lists
            // For now, we'll show a placeholder
            this.showError('Move/copy between lists not yet implemented');
            this.hideMoveCopyModal();
        } catch (error) {
            console.error(`Error ${this.currentAction}ing item:`, error);
            this.showError(`Failed to ${this.currentAction} item. Please try again.`);
        }
    }

    // Render items in the UI
    renderItems(data) {
        if (this.isEditMode) {
            // Don't re-render during edit mode, just update count
            this.updateItemCount(data.unchecked.length + data.checked.length);
            return;
        }

        // Clear containers
        this.uncheckedItemsContainer.innerHTML = '';
        this.checkedItemsContainer.innerHTML = '';

        // Render unchecked items
        if (data.unchecked.length === 0) {
            this.uncheckedItemsContainer.innerHTML = `
                <div class="empty-items-state">
                    <h4>Your list is empty</h4>
                    <p>Add items using the form above</p>
                </div>
            `;
        } else {
            data.unchecked.forEach(item => {
                this.uncheckedItemsContainer.appendChild(this.createItemElement(item));
            });
        }

        // Render checked items
        data.checked.forEach(item => {
            this.checkedItemsContainer.appendChild(this.createItemElement(item));
        });

        // Update item count
        this.updateItemCount(data.unchecked.length + data.checked.length);

        // Apply drag reorder behavior when sort mode is manual
        this.setupDragAndDrop();
    }

    createItemElement(item) {
        const itemElement = document.createElement('div');
        itemElement.className = `item${item.checked ? ' checked' : ''}`;
        itemElement.dataset.itemId = item.id;
        itemElement.dataset.checked = item.checked ? '1' : '0';
        
        itemElement.innerHTML = `
            <div class="item-checkbox${item.checked ? ' checked' : ''}"></div>
            <div class="drag-handle" aria-hidden="true">≡</div>
            <div class="item-text">${this.escapeHtml(item.name)}</div>
            <div class="item-actions">
                <button class="item-menu-btn">⋮</button>
            </div>
        `;

        // Add event listeners
        const checkbox = itemElement.querySelector('.item-checkbox');
        const menuBtn = itemElement.querySelector('.item-menu-btn');
        const textEl = itemElement.querySelector('.item-text');

        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleItem(item.id);
        });

        // iOS: ensure single-tap toggle on checkbox
        checkbox.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleItem(item.id);
        }, { passive: false });

        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showContextMenu(e, item.id);
        });

        // Double-click text to edit in place (desktop)
        textEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.startInlineEdit(itemElement, item.id);
        });

        // Double-tap text to edit in place (mobile)
        textEl.addEventListener('touchend', (e) => {
            const now = Date.now();
            const isDoubleTap = this.lastTapItemId === item.id && (now - this.lastTapTime) < 350;

            if (isDoubleTap) {
                e.preventDefault();
                e.stopPropagation();
                this.startInlineEdit(itemElement, item.id);
                this.lastTapItemId = null;
                this.lastTapTime = 0;
                return;
            }

            this.lastTapItemId = item.id;
            this.lastTapTime = now;
        }, { passive: false });

        return itemElement;
    }

    async startInlineEdit(itemElement, itemId) {
        if (!this.currentListId || this.isEditMode) return;

        const textEl = itemElement.querySelector('.item-text');
        if (!textEl) return;

        // Avoid opening a second editor in same row
        if (textEl.querySelector('input')) return;

        const currentName = textEl.textContent.trim();
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'item-text-input inline-edit-input';
        input.value = currentName;

        textEl.innerHTML = '';
        textEl.appendChild(input);
        input.focus();
        input.select();

        const cancelEdit = () => {
            textEl.textContent = currentName;
        };

        const saveEdit = async () => {
            const newName = input.value.trim();

            if (!newName) {
                cancelEdit();
                return;
            }

            if (newName === currentName) {
                textEl.textContent = currentName;
                return;
            }

            try {
                await this.database.updateItemName(this.currentListId, itemId, newName);
                textEl.textContent = newName;
            } catch (error) {
                console.error('Error updating item inline:', error);
                this.showError('Could not save item name.');
                textEl.textContent = currentName;
            }
        };

        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                await saveEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        });

        // Save on blur for fast workflow
        input.addEventListener('blur', async () => {
            await saveEdit();
        });
    }

    setupDragAndDrop() {
        const uncheckedManual = this.currentSortMode.unchecked === 'manual';
        const checkedManual = this.currentSortMode.checked === 'manual';

        this.applyDragToSection(this.uncheckedItemsContainer, false, uncheckedManual);
        this.applyDragToSection(this.checkedItemsContainer, true, checkedManual);
    }

    applyDragToSection(container, checkedState, enabled) {
        const items = Array.from(container.querySelectorAll('.item'));

        items.forEach(item => {
            item.draggable = enabled;
            item.classList.toggle('reorderable', enabled);
            const handle = item.querySelector('.drag-handle');
            if (handle) {
                handle.style.display = enabled ? 'inline-flex' : 'none';
            }

            // Desktop drag handlers
            item.ondragstart = null;
            item.ondragend = null;
            item.ondragover = null;
            item.ondrop = null;

            // Touch drag handlers (iOS)
            item.ontouchstart = null;
            item.ontouchmove = null;
            item.ontouchend = null;

            if (!enabled) return;

            // ===== Desktop HTML5 drag =====
            item.ondragstart = (e) => {
                this.draggedItemEl = item;
                item.classList.add('dragging');
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                }
            };

            item.ondragend = async () => {
                if (!this.draggedItemEl) return;
                this.draggedItemEl.classList.remove('dragging');
                this.draggedItemEl = null;
                await this.persistSectionOrder(container, checkedState);
            };

            item.ondragover = (e) => {
                e.preventDefault();
                if (!this.draggedItemEl || this.draggedItemEl === item) return;
                if (this.draggedItemEl.dataset.checked !== item.dataset.checked) return;

                const rect = item.getBoundingClientRect();
                const isAfter = (e.clientY - rect.top) > (rect.height / 2);
                if (isAfter) {
                    item.parentNode.insertBefore(this.draggedItemEl, item.nextSibling);
                } else {
                    item.parentNode.insertBefore(this.draggedItemEl, item);
                }
            };

            item.ondrop = (e) => e.preventDefault();

            // ===== Touch drag (mobile Safari) =====
            item.ontouchstart = (e) => {
                if (!enabled || this.isEditMode) return;

                // Do not start drag from interactive controls (checkbox/menu/buttons)
                const interactive = e.target.closest('.item-checkbox, .item-menu-btn, .item-actions, button, a, input, textarea');
                if (interactive) return;

                this.touchDraggedItemEl = item;
                this.touchDragMoved = false;
                item.classList.add('dragging');
            };

            item.ontouchmove = (e) => {
                if (!this.touchDraggedItemEl) return;

                this.touchDragMoved = true;
                const touch = e.touches && e.touches[0];
                if (!touch) return;

                // Prevent page scroll while dragging
                e.preventDefault();

                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                const targetItem = target ? target.closest('.item') : null;

                if (!targetItem || targetItem === this.touchDraggedItemEl) return;
                if (targetItem.dataset.checked !== this.touchDraggedItemEl.dataset.checked) return;
                if (targetItem.parentNode !== container) return;

                const rect = targetItem.getBoundingClientRect();
                const isAfter = (touch.clientY - rect.top) > (rect.height / 2);
                if (isAfter) {
                    container.insertBefore(this.touchDraggedItemEl, targetItem.nextSibling);
                } else {
                    container.insertBefore(this.touchDraggedItemEl, targetItem);
                }
            };

            item.ontouchend = async () => {
                if (!this.touchDraggedItemEl) return;

                this.touchDraggedItemEl.classList.remove('dragging');
                const moved = this.touchDragMoved;
                this.touchDraggedItemEl = null;
                this.touchDragMoved = false;

                if (moved) {
                    await this.persistSectionOrder(container, checkedState);
                }
            };
        });
    }

    async persistSectionOrder(container, checkedState) {
        const orderedIds = Array.from(container.querySelectorAll('.item')).map(el => el.dataset.itemId);
        if (orderedIds.length > 0 && this.currentListId) {
            try {
                await this.database.updateSectionOrder(this.currentListId, checkedState, orderedIds);
            } catch (error) {
                console.error('Failed to persist reorder:', error);
                this.showError('Failed to save new order. Please try again.');
            }
        }
    }

    updateItemCount(count) {
        if (this.currentListItemCount) {
            this.currentListItemCount.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
        }
    }

    setAddButtonLoading(loading) {
        this.addItemBtn.disabled = loading;
        this.addItemBtn.textContent = loading ? '⏳' : '+';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        alert(`Error: ${message}`);
    }

    showSuccess(message) {
        alert(`Success: ${message}`);
    }

    cleanup() {
        this.currentListId = null;
        this.isEditMode = false;
        this.originalItemData = {};
        this.selectedItem = null;
        this.currentAction = null;
    }
}