// -----------------------------------------------
// ListBox.js
// 
// JavaScript port of the ListBox UI component
// A list box with scrolling and selection functionality
//
// Ported from C++ by Assistant, 2024
// Original Copyright (c) 2004-2012, Dream Rock Studios, LLC
// -----------------------------------------------

const { View } = require('./View');
const { Scrollbar, ScrollbarOrientation } = require('./Scrollbar');
const { IObserver } = require('./Observer');

/**
 * ListBox click IDs
 */
const ListBoxClickIDs = {
    VIEW_ID_LIST_BOX_SCROLLBAR: 1,
    VIEW_ID_SELECTION_START: 2
};

/**
 * ListBox selection IDs
 */
const ListBoxSelectionIDs = {
    NO_SELECTION: -1
};

/**
 * ListBox line item
 */
class ListBoxLine {
    constructor() {
        this.text = '';
        this.fgcolor = new pdg.Color(0.0, 0.0, 0.0, 1.0);
        this.bgcolor = new pdg.Color(1.0, 1.0, 1.0, 1.0);
    }
}

/**
 * ListBox UI component that extends View
 * Provides a scrollable list with selection functionality
 */
class ListBox extends View {
    constructor(controller, viewArea, textLines, bkColor, htColor) {
        super(controller, viewArea);
        
        this.resMgr = controller.getApplication().getResourceManager();
        this.parentController = controller;
        
        this.selectedIndex = ListBoxSelectionIDs.NO_SELECTION;
        this.listText = [];
        this.scrollbar = null;
        this.windowTopLineIndex = 0;
        this.visibleTextLines = textLines;
        this.htColor = htColor;
        this.bkColor = bkColor;
        
        this.loadImages();
        this.calcClickableAreas();
    }

    /**
     * Load list box images
     */
    loadImages() {
        // In a real implementation, you would load images for the list box
        // For now, we'll use standard drawing
        console.log('ListBox: Loading images');
    }

    /**
     * Calculate clickable areas
     */
    calcClickableAreas() {
        const viewArea = this.getViewArea();
        
        // Make the main list area clickable
        this.addClickablePart(viewArea, ListBoxClickIDs.VIEW_ID_SELECTION_START);
        
        // Add scrollbar if needed
        if (this.needsScrollbar()) {
            this.createScrollbar();
        }
    }

    /**
     * Check if scrollbar is needed
     * @returns {boolean} true if scrollbar needed
     */
    needsScrollbar() {
        return this.listText.length > this.visibleTextLines;
    }

    /**
     * Create scrollbar
     */
    createScrollbar() {
        const viewArea = this.getViewArea();
        const scrollbarWidth = 16;
        const scrollbarRect = new pdg.Rect(
            viewArea.right - scrollbarWidth, 
            viewArea.top, 
            scrollbarWidth, 
            viewArea.height()
        );
        
        this.scrollbar = new Scrollbar(
            this.parentController,
            scrollbarRect,
            ScrollbarOrientation.VERTICAL,
            this.windowTopLineIndex,
            this.visibleTextLines,
            this.listText.length
        );
        
        // Add scrollbar as observer
        this.scrollbar.addObserver(this);
        
        // Add scrollbar to controller
        this.parentController.addView(this.scrollbar, ListBoxClickIDs.VIEW_ID_LIST_BOX_SCROLLBAR);
    }

    /**
     * Add item to list
     * @param {string} text - Text to add
     * @param {Object} fgColor - Foreground color
     */
    addToList(text, fgColor = new pdg.Color(0.0, 0.0, 0.0, 1.0)) {
        const line = new ListBoxLine();
        line.text = text;
        line.fgcolor = fgColor;
        
        this.listText.push(line);
        
        // Update scrollbar if it exists
        if (this.scrollbar) {
            this.scrollbar.setMaxRange(this.listText.length - this.visibleTextLines);
        }
    }

    /**
     * Clear all items from list
     */
    clear() {
        this.listText = [];
        this.selectedIndex = ListBoxSelectionIDs.NO_SELECTION;
        this.windowTopLineIndex = 0;
        
        // Update scrollbar if it exists
        if (this.scrollbar) {
            this.scrollbar.setMaxRange(0);
            this.scrollbar.setCurrentPosition(0);
        }
    }

    /**
     * Draw the list box
     */
    drawSelf(port, frameNum) {
        const viewArea = this.getViewArea();
        
        // Draw background
        var backgroundAttrs = new pdg.Attributes().fillColor(this.bkColor);
        port.drawRect(viewArea, backgroundAttrs);
        
        // Draw border
        var borderAttrs = new pdg.Attributes().lineColor(new pdg.Color(0.5, 0.5, 0.5, 1.0)).lineThickness(1);
        port.drawRect(viewArea, borderAttrs);
        
        // Draw list items
        this.drawListItems();
        
        // Draw scrollbar if needed
        if (this.scrollbar) {
            this.scrollbar.draw(port, frameNum);
        }
    }

    /**
     * Draw list items
     */
    drawListItems() {
        const port = this.getPort();
        const viewArea = this.getViewArea();
        const lineHeight = viewArea.height() / this.visibleTextLines;
        const scrollbarWidth = this.scrollbar ? 16 : 0;
        
        for (let i = 0; i < this.visibleTextLines; i++) {
            const lineIndex = this.windowTopLineIndex + i;
            
            if (lineIndex >= this.listText.length) {
                break; // No more items to draw
            }
            
            const line = this.listText[lineIndex];
            const itemRect = new pdg.Rect(
                viewArea.left + 2,
                viewArea.top + i * lineHeight,
                viewArea.width() - scrollbarWidth - 4,
                lineHeight
            );
            
            // Draw item background
            if (lineIndex === this.selectedIndex) {
                var selectedAttrs = new pdg.Attributes().fillColor(this.htColor);
                port.drawRect(itemRect, selectedAttrs);
            } else {
                var defaultAttrs = new pdg.Attributes().fillColor(new pdg.Color(1.0, 1.0, 1.0, 1.0));
                port.drawRect(itemRect, defaultAttrs);
            }
            
            // Draw item text
            const textPoint = new pdg.Point(
                itemRect.left + 4,
                itemRect.top + lineHeight / 2 + 6
            );
            
            port.drawText(line.text, textPoint, 12, pdg.textStyle_Plain, line.fgcolor);
            
            // Draw item separator
            if (i < this.visibleTextLines - 1) {
                const separatorY = itemRect.bottom - 1;
                port.drawLine(
                    new pdg.Point(itemRect.left, separatorY),
                    new pdg.Point(itemRect.right, separatorY),
                    new pdg.Color(0.8, 0.8, 0.8, 1.0), 1
                );
            }
        }
    }

    /**
     * Handle click
     * @param {number} part - Clicked part
     */
    doClick(part) {
        if (part === ListBoxClickIDs.VIEW_ID_SELECTION_START) {
            // Handle list item selection
            // The actual item selection will be handled by mouse events
        }
    }

    /**
     * Handle mouse down
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doMouseDown(mouseInfo, id, part) {
        if (part === ListBoxClickIDs.VIEW_ID_SELECTION_START) {
            const localPoint = this.globalToLocal(mouseInfo.mousePos);
            const lineIndex = this.getLineIndexFromPoint(localPoint);
            
            if (lineIndex !== -1) {
                this.setSelectedIndex(lineIndex);
                return true;
            }
        }
        return false;
    }

    /**
     * Handle double click
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @param {number} clickCount - Number of clicks
     * @returns {boolean} true if handled
     */
    doDoubleClick(mouseInfo, id, part, clickCount) {
        if (part === ListBoxClickIDs.VIEW_ID_SELECTION_START) {
            const localPoint = this.globalToLocal(mouseInfo.mousePos);
            const lineIndex = this.getLineIndexFromPoint(localPoint);
            
            if (lineIndex !== -1) {
                this.setSelectedIndex(lineIndex);
                // Handle double click on item
                this.onItemDoubleClick(lineIndex);
                return true;
            }
        }
        return false;
    }

    /**
     * Get line index from point
     * @param {pdg.Point} point - Point in local coordinates
     * @returns {number} Line index or -1 if not found
     */
    getLineIndexFromPoint(point) {
        const viewArea = this.getViewArea();
        const lineHeight = viewArea.height() / this.visibleTextLines;
        const scrollbarWidth = this.scrollbar ? 16 : 0;
        
        // Check if point is in the list area
        if (point.x < viewArea.left + 2 || 
            point.x > viewArea.right - scrollbarWidth - 2 ||
            point.y < viewArea.top || 
            point.y > viewArea.bottom) {
            return -1;
        }
        
        const relativeY = point.y - viewArea.top;
        const lineIndex = Math.floor(relativeY / lineHeight);
        const actualIndex = this.windowTopLineIndex + lineIndex;
        
        if (actualIndex >= 0 && actualIndex < this.listText.length) {
            return actualIndex;
        }
        
        return -1;
    }

    /**
     * Handle item double click
     * @param {number} index - Item index
     */
    onItemDoubleClick(index) {
        console.log(`ListBox: Item ${index} double clicked`);
        // Override in subclasses for specific behavior
    }

    /**
     * Handle key press
     * @param {Object} keyPressInfo - Key press information
     * @param {View} view - The view that has focus
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doKeyPress(keyPressInfo, view, id, part) {
        const keyCode = keyPressInfo.keyCode;
        
        switch (keyCode) {
            case 38: // Up arrow
                this.moveSelection(-1);
                return true;
                
            case 40: // Down arrow
                this.moveSelection(1);
                return true;
                
            case 33: // Page up
                this.moveSelection(-this.visibleTextLines);
                return true;
                
            case 34: // Page down
                this.moveSelection(this.visibleTextLines);
                return true;
                
            case 36: // Home
                this.setSelectedIndex(0);
                return true;
                
            case 35: // End
                this.setSelectedIndex(this.listText.length - 1);
                return true;
        }
        
        return false;
    }

    /**
     * Move selection by delta
     * @param {number} delta - Delta to move by
     */
    moveSelection(delta) {
        if (this.listText.length === 0) return;
        
        let newIndex = this.selectedIndex + delta;
        newIndex = Math.max(0, Math.min(newIndex, this.listText.length - 1));
        
        this.setSelectedIndex(newIndex);
    }

    /**
     * Observer notification
     * @param {Subject} subject - The subject that changed
     */
    notify(subject) {
        if (subject === this.scrollbar) {
            // Scrollbar position changed
            this.windowTopLineIndex = this.scrollbar.getCurrentPosition();
        }
    }

    /**
     * Get selected index
     * @returns {number} Selected index
     */
    getSelectedIndex() {
        return this.selectedIndex;
    }

    /**
     * Set selected index
     * @param {number} index - Index to select
     */
    setSelectedIndex(index) {
        if (index >= 0 && index < this.listText.length) {
            this.selectedIndex = index;
            
            // Ensure selected item is visible
            this.ensureItemVisible(index);
        }
    }

    /**
     * Ensure item is visible in the current window
     * @param {number} index - Item index
     */
    ensureItemVisible(index) {
        if (index < this.windowTopLineIndex) {
            // Item is above visible area
            this.windowTopLineIndex = index;
            if (this.scrollbar) {
                this.scrollbar.setCurrentPosition(this.windowTopLineIndex);
            }
        } else if (index >= this.windowTopLineIndex + this.visibleTextLines) {
            // Item is below visible area
            this.windowTopLineIndex = index - this.visibleTextLines + 1;
            if (this.scrollbar) {
                this.scrollbar.setCurrentPosition(this.windowTopLineIndex);
            }
        }
    }

    /**
     * Get text from index
     * @param {number} index - Item index
     * @returns {string} Text at index
     */
    getTextFromIndex(index) {
        if (index >= 0 && index < this.listText.length) {
            return this.listText[index].text;
        }
        return '';
    }

    /**
     * Get selected text
     * @returns {string} Selected text
     */
    getSelectedText() {
        return this.getTextFromIndex(this.selectedIndex);
    }

    /**
     * Get item count
     * @returns {number} Number of items
     */
    getItemCount() {
        return this.listText.length;
    }

    /**
     * Remove item at index
     * @param {number} index - Index to remove
     */
    removeItem(index) {
        if (index >= 0 && index < this.listText.length) {
            this.listText.splice(index, 1);
            
            // Adjust selection
            if (this.selectedIndex === index) {
                this.selectedIndex = ListBoxSelectionIDs.NO_SELECTION;
            } else if (this.selectedIndex > index) {
                this.selectedIndex--;
            }
            
            // Update scrollbar
            if (this.scrollbar) {
                this.scrollbar.setMaxRange(Math.max(0, this.listText.length - this.visibleTextLines));
            }
        }
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.selectedIndex = ListBoxSelectionIDs.NO_SELECTION;
    }

    /**
     * Get item at index
     * @param {number} index - Item index
     * @returns {ListBoxLine} Item at index
     */
    getItem(index) {
        if (index >= 0 && index < this.listText.length) {
            return this.listText[index];
        }
        return null;
    }

    /**
     * Set item text
     * @param {number} index - Item index
     * @param {string} text - New text
     */
    setItemText(index, text) {
        if (index >= 0 && index < this.listText.length) {
            this.listText[index].text = text;
        }
    }

    /**
     * Set item colors
     * @param {number} index - Item index
     * @param {Object} fgColor - Foreground color
     * @param {Object} bgColor - Background color
     */
    setItemColors(index, fgColor, bgColor) {
        if (index >= 0 && index < this.listText.length) {
            this.listText[index].fgcolor = fgColor;
            this.listText[index].bgcolor = bgColor;
        }
    }

    /**
     * Find item by text
     * @param {string} text - Text to find
     * @returns {number} Index of item or -1 if not found
     */
    findItem(text) {
        for (let i = 0; i < this.listText.length; i++) {
            if (this.listText[i].text === text) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Set highlight color
     * @param {Object} color - Highlight color
     */
    setHighlightColor(color) {
        this.htColor = color;
    }

    /**
     * Set background color
     * @param {Object} color - Background color
     */
    setBackgroundColor(color) {
        this.bkColor = color;   
    }

    /**
     * Cleanup when list box is destroyed
     */
    destroy() {
        // Remove scrollbar observer
        if (this.scrollbar) {
            this.scrollbar.removeObserver(this);
            this.scrollbar = null;
        }
        
        // Clear list
        this.listText = [];
    }
}

module.exports = {
    ListBox,
    ListBoxLine,
    ListBoxClickIDs,
    ListBoxSelectionIDs
};
