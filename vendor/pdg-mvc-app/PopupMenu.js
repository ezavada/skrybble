// -----------------------------------------------
// PopupMenu.js
// 
// JavaScript port of the PopupMenu UI component
// A popup menu with scrolling and selection functionality
//
// Ported from C++ by Assistant, 2024
// Original Copyright (c) 2004-2012, Dream Rock Studios, LLC
// -----------------------------------------------

const { View } = require('./View');

// Constants
const ITEM_SIZE_OFFSET = 8;
const TEXT_WIDTH_OFFSET = 10;
const IMAGE_HEIGHT_OFFSET = 4;
const VIEW_HEIGHT_OFFSET = 20;
const VIEW_WIDTH_OFFSET = 12;
const VIEW_HSHIFT_OFFSET = 3;
const MAX_ARROW_IMAGES = 2;
const TEXT_LEFT_MARGIN = 2;
const HIGHLIGHT_AREA_MARGIN = 2;
const CLIP_TEXT = '...';
const RES_MENU_IMAGES = 143;
const TEXT_RESOURCE_ID_NONE = -1;
const MAX_MENU_WIDTH = 200;
const ITEM_UP_ARROW = 1;
const ITEM_DOWN_ARROW = 2;
const RES_PULL_ARROW = 4;
const START_INDEX_NONE = -1;
const HOT_ITEM_NONE = -1;

/**
 * PopupMenu item information
 */
class ItemInfo {
    constructor(itemID, text, resourceID = -1, textStyle = 'textStyle_Plain + textStyle_LeftJustified') {
        this.itemString = text;
        this.resourceID = resourceID;
        this.itemID = itemID;
        this.style = textStyle;
    }

    equals(item2) {
        if (item2 instanceof ItemInfo) {
            return this.itemString === item2.itemString && 
                   this.resourceID === item2.resourceID && 
                   this.itemID === item2.itemID;
        } else if (typeof item2 === 'string') {
            return this.itemString === item2;
        } else if (typeof item2 === 'number') {
            return this.itemID === item2;
        }
        return false;
    }
}

/**
 * PopupMenu UI component that extends View
 * Provides popup menu functionality with scrolling and selection
 */
class PopupMenu extends View {
    constructor(controller, topLeft, bkColor = new pdg.Color(0.8, 0.8, 0.8, 1.0), 
                textColor = new pdg.Color(0.0, 0.0, 0.0, 1.0), 
                highlightColor = new pdg.Color(0.0, 0.0, 1.0, 1.0), 
                textSize = 14) {
        
        let rect;
        if (topLeft instanceof pdg.Point) {
            // Calculate default size based on text size
            const defaultWidth = 150;
            const defaultHeight = 200;
            rect = new pdg.Rect(topLeft.x, topLeft.y, topLeft.x + defaultWidth, topLeft.y + defaultHeight);
        } else if (topLeft instanceof pdg.Rect) {
            rect = topLeft;
        } else {
            throw new Error('PopupMenu constructor requires Point or Rect for topLeft');
        }
        
        super(controller, rect);
        
        this.resMgr = controller.getApplication().getResourceManager();
        this.drawableItemList = []; // Array of { rect: Rect, item: ItemInfo }
        this.startIndex = START_INDEX_NONE;
        this.longestText = '';
        this.itemList = [];
        this.bkColor = bkColor;
        this.textColor = textColor;
        this.highlightColor = highlightColor;
        this.hotItem = HOT_ITEM_NONE;
        this.textSize = textSize;
        this.itemShowable = 0;
        this.needScrolling = false;
        this.showUpArrow = false;
        this.showDownArrow = false;
        this.oldScrollPos = new pdg.Point(0, 0);
        this.pullArrowImage = null;
        this.minWidth = 50;
        this.baseRect = new pdg.Rect(rect);
        
        this.loadImages();
        this.calcClickableAreas();
    }

    /**
     * Load popup menu images
     */
    loadImages() {
        try {
            // In a real implementation, you would load images from resources
            // For now, we'll create placeholder images
            this.pullArrowImage = null; // Placeholder
        } catch (error) {
            console.warn('Failed to load popup menu images:', error);
        }
    }

    /**
     * Calculate clickable areas
     */
    calcClickableAreas() {
        const viewArea = this.getViewArea();
        
        // Clear existing clickable areas
        this.clickableParts = [];
        
        // Add clickable areas for each drawable item
        for (let i = 0; i < this.drawableItemList.length; i++) {
            const itemPair = this.drawableItemList[i];
            this.addClickablePart(itemPair.rect, itemPair.item.itemID);
        }
    }

    /**
     * Add menu item by resource ID
     * @param {number} itemID - Item ID
     * @param {number} resourceID - Resource ID
     * @param {string} textStyle - Text style
     * @param {number} index - Insert index (-1 for append)
     * @returns {number} Actual insert index
     */
    addMenuItem(itemID, resourceID, textStyle = 'textStyle_Plain + textStyle_LeftJustified', index = -1) {
        try {
            const text = this.resMgr.getString(resourceID);
            return this.addMenuItem(itemID, text, textStyle, index);
        } catch (error) {
            console.warn(`Failed to load string from resource ${resourceID}:`, error);
            return -1;
        }
    }

    /**
     * Add menu item by text
     * @param {number} itemID - Item ID
     * @param {string} text - Item text
     * @param {string} textStyle - Text style
     * @param {number} index - Insert index (-1 for append)
     * @returns {number} Actual insert index
     */
    addMenuItem(itemID, text, textStyle = 'textStyle_Plain + textStyle_LeftJustified', index = -1) {
        const item = new ItemInfo(itemID, text, -1, textStyle);
        
        if (index === -1 || index >= this.itemList.length) {
            this.itemList.push(item);
            index = this.itemList.length - 1;
        } else {
            this.itemList.splice(index, 0, item);
        }
        
        this.setLongestText();
        this.sanitiseViewArea();
        this.calcClickableAreas();
        
        return index;
    }

    /**
     * Delete menu item by item ID
     * @param {number} itemID - Item ID to delete
     * @returns {boolean} true if deleted
     */
    deleteMenuItemByItemID(itemID) {
        const index = this.itemList.findIndex(item => item.itemID === itemID);
        if (index !== -1) {
            this.itemList.splice(index, 1);
            this.setLongestText();
            this.sanitiseViewArea();
            this.calcClickableAreas();
            return true;
        }
        return false;
    }

    /**
     * Delete menu item by index
     * @param {number} index - Index to delete
     * @returns {boolean} true if deleted
     */
    deleteMenuItemByIndex(index) {
        if (index >= 0 && index < this.itemList.length) {
            this.itemList.splice(index, 1);
            this.setLongestText();
            this.sanitiseViewArea();
            this.calcClickableAreas();
            return true;
        }
        return false;
    }

    /**
     * Delete all menu items
     */
    deleteAllMenuItems() {
        this.itemList = [];
        this.drawableItemList = [];
        this.longestText = '';
        this.hotItem = HOT_ITEM_NONE;
        this.calcClickableAreas();
    }

    /**
     * Get item string by item ID
     * @param {number} itemID - Item ID
     * @returns {string} Item string
     */
    getItemStringByItemID(itemID) {
        const item = this.itemList.find(item => item.itemID === itemID);
        return item ? item.itemString : '';
    }

    /**
     * Get item string by index
     * @param {number} index - Item index
     * @returns {string} Item string
     */
    getItemStringByIndex(index) {
        if (index >= 0 && index < this.itemList.length) {
            return this.itemList[index].itemString;
        }
        return '';
    }

    /**
     * Set string by index
     * @param {number} index - Item index
     * @param {string} text - New text
     * @returns {boolean} true if set
     */
    setStringByIndex(index, text) {
        if (index >= 0 && index < this.itemList.length) {
            this.itemList[index].itemString = text;
            this.setLongestText();
            this.sanitiseViewArea();
            this.calcClickableAreas();
            return true;
        }
        return false;
    }

    /**
     * Set string by item ID
     * @param {number} itemID - Item ID
     * @param {string} text - New text
     * @returns {boolean} true if set
     */
    setStringByItemID(itemID, text) {
        const item = this.itemList.find(item => item.itemID === itemID);
        if (item) {
            item.itemString = text;
            this.setLongestText();
            this.sanitiseViewArea();
            this.calcClickableAreas();
            return true;
        }
        return false;
    }

    /**
     * Get index by item ID
     * @param {number} itemID - Item ID
     * @returns {number} Item index or -1 if not found
     */
    getIndex(itemID) {
        return this.itemList.findIndex(item => item.itemID === itemID);
    }

    /**
     * Get index by text
     * @param {string} text - Item text
     * @returns {number} Item index or -1 if not found
     */
    getIndexByText(text) {
        return this.itemList.findIndex(item => item.itemString === text);
    }

    /**
     * Draw the popup menu
     */
    drawSelf(port, frameNum) {
        const viewArea = this.getViewArea();
        
        // Draw background
        var backgroundAttrs = new pdg.Attributes().fillColor(this.bkColor);
        port.drawRect(viewArea, backgroundAttrs);
        
        // Draw border
        var borderAttrs = new pdg.Attributes().lineColor(new pdg.Color(0.5, 0.5, 0.5, 1.0)).lineThickness(1);
        port.drawRect(viewArea, borderAttrs);
        
        // Draw menu items
        this.drawMenuItems();
        
        // Draw scroll arrows if needed
        if (this.needScrolling) {
            this.drawScrollArrows();
        }
    }

    /**
     * Draw menu items
     */
    drawMenuItems() {
        const port = this.getPort();
        
        for (let i = 0; i < this.drawableItemList.length; i++) {
            const itemPair = this.drawableItemList[i];
            const rect = itemPair.rect;
            const item = itemPair.item;
            
            // Draw item background
            if (item.itemID === this.hotItem) {
                var highlightAttrs = new pdg.Attributes().fillColor(this.highlightColor);
                port.drawRect(rect, highlightAttrs);
            } else {
                var defaultAttrs = new pdg.Attributes().fillColor(new pdg.Color(1.0, 1.0, 1.0, 1.0));
                port.drawRect(rect, defaultAttrs);
            }
            
            // Draw item text
            const textPoint = new pdg.Point(
                rect.left + TEXT_LEFT_MARGIN,
                rect.top + rect.height() / 2 + this.textSize / 2
            );
            
            port.drawText(item.itemString, textPoint, this.textSize, item.style, this.textColor);
            
            // Draw item separator
            if (i < this.drawableItemList.length - 1) {
                const separatorY = rect.bottom - 1;
                port.drawLine(
                    new pdg.Point(rect.left, separatorY),
                    new pdg.Point(rect.right, separatorY),
                    new pdg.Color(0.8, 0.8, 0.8, 1.0), 1
                );
            }
        }
    }

    /**
     * Draw scroll arrows
     */
    drawScrollArrows() {
        const port = this.getPort();
        const viewArea = this.getViewArea();
        const arrowSize = 16;
        
        // Draw up arrow
        if (this.showUpArrow) {
            const upArrowRect = new pdg.Rect(
                viewArea.right - arrowSize,
                viewArea.top,
                arrowSize,
                arrowSize
            );
            this.drawArrow(upArrowRect, true);
        }
        
        // Draw down arrow
        if (this.showDownArrow) {
            const downArrowRect = new pdg.Rect(
                viewArea.right - arrowSize,
                viewArea.bottom - arrowSize,
                arrowSize,
                arrowSize
            );
            this.drawArrow(downArrowRect, false);
        }
    }

    /**
     * Draw arrow
     * @param {Rect} rect - Arrow rectangle
     * @param {boolean} up - Whether it's an up arrow
     */
    drawArrow(rect, up) {
        const port = this.getPort();
        
        // Draw arrow background
        var arrowBgAttrs = new pdg.Attributes().fillColor(new pdg.Color(0.9, 0.9, 0.9, 1.0));
        port.drawRect(rect, arrowBgAttrs);
        var arrowBorderAttrs = new pdg.Attributes().lineColor(new pdg.Color(0.5, 0.5, 0.5, 1.0)).lineThickness(1);
        port.drawRect(rect, arrowBorderAttrs);
        
        // Draw arrow shape
        const centerX = rect.left + rect.width() / 2;
        const centerY = rect.top + rect.height() / 2;
        const size = 4;
        
        const arrowColor = new pdg.Color(0.2, 0.2, 0.2, 1.0);
        
        if (up) {
            // Draw up arrow
            port.drawLine(new pdg.Point(centerX, centerY - size), new pdg.Point(centerX - size, centerY), arrowColor, 2);
            port.drawLine(new pdg.Point(centerX, centerY - size), new pdg.Point(centerX + size, centerY), arrowColor, 2);
        } else {
            // Draw down arrow
            port.drawLine(new pdg.Point(centerX, centerY + size), new pdg.Point(centerX - size, centerY), arrowColor, 2);
            port.drawLine(new pdg.Point(centerX, centerY + size), new pdg.Point(centerX + size, centerY), arrowColor, 2);
        }
    }

    /**
     * Show the popup menu
     */
    showSelf() {
        this.show();
    }

    /**
     * Handle mouse move
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     */
    doMouseMove(mouseInfo, id, part) {
        // Update hot item based on mouse position
        const localPoint = this.globalToLocal(mouseInfo.mousePos);
        const itemID = this.getPartClicked(localPoint);
        
        if (itemID !== this.hotItem) {
            this.hotItem = itemID;
        }
    }

    /**
     * Handle mouse leave
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     */
    doMouseLeave(mouseInfo, id, part) {
        this.hotItem = HOT_ITEM_NONE;
    }

    /**
     * Handle mouse enter
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     */
    doMouseEnter(mouseInfo, id, part) {
        // Hot item will be set by mouse move
    }

    /**
     * Get part clicked
     * @param {pdg.Point} screenPoint - Screen point
     * @returns {number} Item ID of part clicked
     */
    getPartClicked(screenPoint) {
        for (let i = 0; i < this.drawableItemList.length; i++) {
            const itemPair = this.drawableItemList[i];
            if (itemPair.rect.contains(screenPoint)) {
                return itemPair.item.itemID;
            }
        }
        return HOT_ITEM_NONE;
    }

    /**
     * Scroll menu by number of items
     * @param {number} nItems - Number of items to scroll (positive = down, negative = up)
     */
    scrollMenu(nItems) {
        if (!this.needScrolling) return;
        
        const newStartIndex = this.startIndex + nItems;
        const maxStartIndex = Math.max(0, this.itemList.length - this.itemShowable);
        
        this.startIndex = Math.max(0, Math.min(newStartIndex, maxStartIndex));
        this.sanitiseViewArea();
        this.calcClickableAreas();
    }

    /**
     * Sanitise view area
     */
    sanitiseViewArea() {
        const viewArea = this.getViewArea();
        const itemHeight = this.textSize + ITEM_SIZE_OFFSET;
        this.itemShowable = Math.floor(viewArea.height() / itemHeight);
        
        // Check if scrolling is needed
        this.needScrolling = this.itemList.length > this.itemShowable;
        
        if (this.needScrolling) {
            // Set up scrolling
            if (this.startIndex === START_INDEX_NONE) {
                this.startIndex = 0;
            }
            
            this.startIndex = Math.max(0, Math.min(this.startIndex, this.itemList.length - this.itemShowable));
            
            // Determine which arrows to show
            this.showUpArrow = this.startIndex > 0;
            this.showDownArrow = this.startIndex < this.itemList.length - this.itemShowable;
        } else {
            this.startIndex = 0;
            this.showUpArrow = false;
            this.showDownArrow = false;
        }
        
        // Update drawable item list
        this.drawableItemList = [];
        const startY = viewArea.top + 2;
        
        for (let i = 0; i < this.itemShowable && this.startIndex + i < this.itemList.length; i++) {
            const item = this.itemList[this.startIndex + i];
            const itemRect = new pdg.Rect(
                viewArea.left + 2,
                startY + i * itemHeight,
                viewArea.width() - 4,
                itemHeight
            );
            
            this.addDrawableItemPart(itemRect, item);
        }
    }

    /**
     * Set text size
     * @param {number} size - Text size
     */
    setTextSize(size) {
        this.textSize = size;
        this.sanitiseViewArea();
        this.calcClickableAreas();
    }

    /**
     * Hide the popup menu
     */
    hide() {
        this.hotItem = HOT_ITEM_NONE;
        super.hide();
    }

    /**
     * Add drawable item part
     * @param {Rect} rect - Item rectangle
     * @param {ItemInfo} item - Item information
     */
    addDrawableItemPart(rect, item) {
        this.drawableItemList.push({ rect: rect, item: item });
    }

    /**
     * Set longest text
     */
    setLongestText() {
        this.longestText = '';
        for (const item of this.itemList) {
            if (item.itemString.length > this.longestText.length) {
                this.longestText = item.itemString;
            }
        }
        
        // Update minimum width based on longest text
        this.minWidth = Math.min(MAX_MENU_WIDTH, this.longestText.length * this.textSize * 0.6 + TEXT_WIDTH_OFFSET);
    }

    /**
     * Load string from resource
     * @param {string} aString - String to load
     * @param {number} resourceID - Resource ID
     * @param {number} numStrings - Number of strings
     */
    loadString(aString, resourceID, numStrings) {
        try {
            aString = this.resMgr.getString(resourceID);
        } catch (error) {
            console.warn(`Failed to load string from resource ${resourceID}:`, error);
            aString = `Resource_${resourceID}`;
        }
    }

    /**
     * Get item count
     * @returns {number} Number of items
     */
    getItemCount() {
        return this.itemList.length;
    }

    /**
     * Get hot item
     * @returns {number} Hot item ID
     */
    getHotItem() {
        return this.hotItem;
    }

    /**
     * Set hot item
     * @param {number} itemID - Item ID to set as hot
     */
    setHotItem(itemID) {
        this.hotItem = itemID;
    }

    /**
     * Cleanup when popup menu is destroyed
     */
    destroy() {
        this.itemList = [];
        this.drawableItemList = [];
        this.pullArrowImage = null;
    }
}

module.exports = {
    PopupMenu,
    ItemInfo,
    ITEM_SIZE_OFFSET,
    TEXT_WIDTH_OFFSET,
    IMAGE_HEIGHT_OFFSET,
    VIEW_HEIGHT_OFFSET,
    VIEW_WIDTH_OFFSET,
    VIEW_HSHIFT_OFFSET,
    MAX_ARROW_IMAGES,
    TEXT_LEFT_MARGIN,
    HIGHLIGHT_AREA_MARGIN,
    CLIP_TEXT,
    RES_MENU_IMAGES,
    TEXT_RESOURCE_ID_NONE,
    MAX_MENU_WIDTH,
    ITEM_UP_ARROW,
    ITEM_DOWN_ARROW,
    RES_PULL_ARROW,
    START_INDEX_NONE,
    HOT_ITEM_NONE
};
