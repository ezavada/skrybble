// -----------------------------------------------
// EditText.js
// 
// JavaScript port of the EditText UI component
// A text input field with caret and selection handling
//
// Ported from C++ by Assistant, 2024
// Original Copyright (c) 2004-2012, Dream Rock Studios, LLC
// -----------------------------------------------

const { View } = require('./View');
const { IObserver } = require('./Observer');

const LEFT_MARGIN = 3;
const RIGHT_MARGIN = 3;
const TEXT_HEIGHT_OFFSET = 4;

/**
 * EditText click IDs
 */
const EditTextClickIDs = {
    CLICK_ID_EDITBOXVIEW: 1002
};

/**
 * EditText UI component that extends View and IObserver
 * Provides text input functionality with caret and selection
 */
class EditText extends View {
    constructor(controller, viewArea, resourceID = -1, fontSize = 10, 
                bkColor = new pdg.Color(1.0, 1.0, 1.0, 1.0), 
                textColor = new pdg.Color(0.0, 0.0, 0.0, 1.0),
                textStyle = pdg.textStyle_Plain) {
        
        super(controller, viewArea);
        
        this.resMgr = controller.getApplication().getResourceManager();
        this.mbkColor = bkColor;
        this.textColor = textColor;
        this.fontSize = fontSize;
        this.style = textStyle;
        this.mbShowCaret = false;
        this.mbHasFocus = false;
        this.text = '';
        this.allowedKeys = '';
        this.blockedKeys = '';
        this.caretPos = 0;
        this.highlightStartPoint = new Point(0, 0);
        this.highlightEndPoint = new Point(0, 0);
        this.highlightStartCharIndex = 0;
        this.highlightEndCharIndex = 0;
        this.maxChars = 256; // Default maximum characters
        
        // Event managers
        this.eventMgr = controller.getApplication().getEventManager();
        this.timerMgr = controller.getApplication().getTimerManager();
        this.logMgr = controller.getApplication().getLogManager();
        
        // Note: Event handling is done through the global pdg.on* methods
        // No need to register with eventMgr.addHandler
        
        this.loadString(resourceID);
        this.calcClickableAreas();
    }

    /**
     * Load string from resource
     * @param {number} resourceID - Resource ID
     */
    loadString(resourceID) {
        if (resourceID !== -1) {
            try {
                const text = this.resMgr.getString(resourceID);
                this.setText(text);
            } catch (error) {
                console.warn(`Failed to load string from resource ${resourceID}:`, error);
            }
        }
    }

    /**
     * Calculate clickable areas
     */
    calcClickableAreas() {
        const viewArea = this.getViewArea();
        this.addClickablePart(viewArea, EditTextClickIDs.CLICK_ID_EDITBOXVIEW);
    }

    /**
     * Draw the EditText
     */
    drawSelf() {
        const port = this.getPort();
        const viewArea = this.getViewArea();
        
        // Draw background
        var backgroundAttrs = new pdg.Attributes().fillColor(this.mbkColor);
        port.drawRect(viewArea, backgroundAttrs);
        
        // Draw border
        this.drawBorder();
        
        // Draw text
        this.drawText();
        
        // Draw selection highlight if any
        if (this.hasSelection()) {
            this.drawSelection();
        }
        
        // Draw caret if focused and visible
        if (this.mbHasFocus && this.mbShowCaret) {
            this.drawCaret();
        }
    }

    /**
     * Draw border around EditText
     */
    drawBorder() {
        const port = this.getPort();
        const viewArea = this.getViewArea();
        
        const borderColor = this.mbHasFocus ? 
            new pdg.Color(0.0, 0.5, 1.0, 1.0) : // Blue when focused
            new pdg.Color(0.7, 0.7, 0.7, 1.0);  // Gray when not focused
        
        var borderAttrs = new pdg.Attributes().lineColor(borderColor).lineThickness(1);
        port.drawRect(viewArea, borderAttrs);
    }

    /**
     * Draw text content
     */
    drawText() {
        const port = this.getPort();
        const viewArea = this.getViewArea();
        
        // Calculate text position
        const textX = viewArea.left + LEFT_MARGIN;
        const textY = viewArea.top + viewArea.height() / 2 + this.fontSize / 2;
        
        // Draw text
        if (this.text) {
            port.drawText(this.text, new Point(textX, textY), this.fontSize, this.style, this.textColor);
        }
    }

    /**
     * Draw selection highlight
     */
    drawSelection() {
        if (!this.hasSelection()) return;
        
        const port = this.getPort();
        const viewArea = this.getViewArea();
        
        // Calculate selection rectangle
        const startX = viewArea.left + LEFT_MARGIN + this.getTextWidth(this.text.substring(0, this.highlightStartCharIndex));
        const endX = viewArea.left + LEFT_MARGIN + this.getTextWidth(this.text.substring(0, this.highlightEndCharIndex));
        const selY = viewArea.top + TEXT_HEIGHT_OFFSET;
        const selHeight = viewArea.height() - TEXT_HEIGHT_OFFSET * 2;
        
        const selectionRect = new pdg.Rect(startX, selY, endX - startX, selHeight);
        var selectionAttrs = new pdg.Attributes().fillColor(new pdg.Color(0.3, 0.5, 1.0, 0.3)); // Light blue highlight
        port.drawRect(selectionRect, selectionAttrs);
    }

    /**
     * Draw caret
     */
    drawCaret() {
        const port = this.getPort();
        const viewArea = this.getViewArea();
        
        // Calculate caret position
        const caretX = viewArea.left + LEFT_MARGIN + this.getTextWidth(this.text.substring(0, this.caretPos));
        const caretY = viewArea.top + TEXT_HEIGHT_OFFSET;
        const caretHeight = viewArea.height() - TEXT_HEIGHT_OFFSET * 2;
        
        // Draw caret as a vertical line
        port.drawLine(
            new pdg.Point(caretX, caretY),
            new pdg.Point(caretX, caretY + caretHeight),
            this.textColor, 1
        );
    }

    /**
     * Get text width for a given string
     * @param {string} text - Text to measure
     * @returns {number} Text width in pixels
     */
    getTextWidth(text) {
        // In a real implementation, this would use the port's text measurement
        // For now, we'll use a simple approximation
        return text.length * this.fontSize * 0.6; // Rough character width
    }

    /**
     * Check if there's a text selection
     * @returns {boolean} true if there's a selection
     */
    hasSelection() {
        return this.highlightStartCharIndex !== this.highlightEndCharIndex;
    }

    /**
     * Handle mouse down
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doMouseDown(mouseInfo, id, part) {
        if (part === EditTextClickIDs.CLICK_ID_EDITBOXVIEW) {
            this.setFocus(true);
            
            // Calculate caret position based on click
            const localPoint = this.globalToLocal(mouseInfo.mousePos);
            this.caretPos = this.getCaretPositionFromPoint(localPoint);
            
            // Clear selection
            this.highlightStartCharIndex = this.caretPos;
            this.highlightEndCharIndex = this.caretPos;
            
            return true;
        }
        return false;
    }

    /**
     * Handle mouse up
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doMouseUp(mouseInfo, id, part) {
        if (part === EditTextClickIDs.CLICK_ID_EDITBOXVIEW) {
            // Handle selection end
            const localPoint = this.globalToLocal(mouseInfo.mousePos);
            this.highlightEndCharIndex = this.getCaretPositionFromPoint(localPoint);
            
            return true;
        }
        return false;
    }

    /**
     * Handle mouse move
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     */
    doMouseMove(mouseInfo, id, part) {
        if (part === EditTextClickIDs.CLICK_ID_EDITBOXVIEW && this.mbHasFocus) {
            // Update selection during drag
            const localPoint = this.globalToLocal(mouseInfo.mousePos);
            this.highlightEndCharIndex = this.getCaretPositionFromPoint(localPoint);
        }
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
        if (part === EditTextClickIDs.CLICK_ID_EDITBOXVIEW) {
            this.selectAll();
            return true;
        }
        return false;
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
        if (!this.mbHasFocus) return false;
        
        const key = keyPressInfo.key;
        const keyCode = keyPressInfo.keyCode;
        
        // Handle special keys
        if (keyCode === 8) { // Backspace
            this.handleBackspace();
            return true;
        } else if (keyCode === 46) { // Delete
            this.handleDelete();
            return true;
        } else if (keyCode === 37) { // Left arrow
            this.handleLeftArrow();
            return true;
        } else if (keyCode === 39) { // Right arrow
            this.handleRightArrow();
            return true;
        } else if (keyCode === 36) { // Home
            this.caretPos = 0;
            this.clearSelection();
            return true;
        } else if (keyCode === 35) { // End
            this.caretPos = this.text.length;
            this.clearSelection();
            return true;
        } else if (keyCode === 13) { // Enter
            // Handle enter key (could trigger validation or form submission)
            return true;
        }
        
        // Handle printable characters
        if (this.isPrintableChar(key)) {
            this.handlePrintableChar(key);
            return true;
        }
        
        return false;
    }

    /**
     * Handle backspace key
     */
    handleBackspace() {
        if (this.hasSelection()) {
            this.deleteSelection();
        } else if (this.caretPos > 0) {
            this.text = this.text.substring(0, this.caretPos - 1) + this.text.substring(this.caretPos);
            this.caretPos--;
        }
    }

    /**
     * Handle delete key
     */
    handleDelete() {
        if (this.hasSelection()) {
            this.deleteSelection();
        } else if (this.caretPos < this.text.length) {
            this.text = this.text.substring(0, this.caretPos) + this.text.substring(this.caretPos + 1);
        }
    }

    /**
     * Handle left arrow key
     */
    handleLeftArrow() {
        if (this.caretPos > 0) {
            this.caretPos--;
            this.clearSelection();
        }
    }

    /**
     * Handle right arrow key
     */
    handleRightArrow() {
        if (this.caretPos < this.text.length) {
            this.caretPos++;
            this.clearSelection();
        }
    }

    /**
     * Handle printable character input
     * @param {string} char - Character to insert
     */
    handlePrintableChar(char) {
        // Check if character is allowed
        if (!this.isCharAllowed(char)) {
            return;
        }
        
        // Check maximum length
        if (this.text.length >= this.maxChars) {
            return;
        }
        
        if (this.hasSelection()) {
            this.deleteSelection();
        }
        
        // Insert character
        this.text = this.text.substring(0, this.caretPos) + char + this.text.substring(this.caretPos);
        this.caretPos++;
    }

    /**
     * Delete selected text
     */
    deleteSelection() {
        const start = Math.min(this.highlightStartCharIndex, this.highlightEndCharIndex);
        const end = Math.max(this.highlightStartCharIndex, this.highlightEndCharIndex);
        
        this.text = this.text.substring(0, start) + this.text.substring(end);
        this.caretPos = start;
        this.clearSelection();
    }

    /**
     * Clear text selection
     */
    clearSelection() {
        this.highlightStartCharIndex = this.caretPos;
        this.highlightEndCharIndex = this.caretPos;
    }

    /**
     * Check if character is printable
     * @param {string} char - Character to check
     * @returns {boolean} true if printable
     */
    isPrintableChar(char) {
        return char && char.length === 1 && char.charCodeAt(0) >= 32 && char.charCodeAt(0) <= 126;
    }

    /**
     * Check if character is allowed based on filters
     * @param {string} char - Character to check
     * @returns {boolean} true if allowed
     */
    isCharAllowed(char) {
        if (this.blockedKeys && this.blockedKeys.includes(char)) {
            return false;
        }
        
        if (this.allowedKeys && !this.allowedKeys.includes(char)) {
            return false;
        }
        
        return true;
    }

    /**
     * Get caret position from point
     * @param {Point} point - Point in local coordinates
     * @returns {number} Caret position
     */
    getCaretPositionFromPoint(point) {
        const textX = LEFT_MARGIN;
        const clickX = point.x - textX;
        
        // Find the closest character position
        let pos = 0;
        for (let i = 0; i <= this.text.length; i++) {
            const width = this.getTextWidth(this.text.substring(0, i));
            if (clickX < width + this.getTextWidth(this.text[i] || '') / 2) {
                pos = i;
                break;
            }
            pos = i;
        }
        
        return Math.min(pos, this.text.length);
    }

    /**
     * Check if text can fit in display area
     * @param {Object} keyPressInfo - Key press information
     * @returns {boolean} true if text fits
     */
    canFitInDisplayArea(keyPressInfo) {
        const viewArea = this.getViewArea();
        const availableWidth = viewArea.width() - LEFT_MARGIN - RIGHT_MARGIN;
        
        // Check if adding the character would exceed available width
        const testText = this.text.substring(0, this.caretPos) + 
                        (keyPressInfo.key || '') + 
                        this.text.substring(this.caretPos);
        
        return this.getTextWidth(testText) <= availableWidth;
    }

    /**
     * Handle events
     * @param {string} eventType - Event type
     * @param {*} eventData - Event data
     * @returns {boolean} true if handled
     */
    handleEvent(eventType, eventData) {
        if (eventType === 'eventType_Timer') {
            // Toggle caret visibility
            this.mbShowCaret = !this.mbShowCaret;
            return true;
        }
        return false;
    }

    /**
     * Set text filter
     * @param {string} allowedKeys - Allowed characters (empty string means all allowed)
     * @param {string} blockedKeys - Blocked characters
     */
    setFilter(allowedKeys = '', blockedKeys = '') {
        this.allowedKeys = allowedKeys;
        this.blockedKeys = blockedKeys;
    }

    /**
     * Set maximum buffer size
     * @param {number} maxChars - Maximum number of characters
     */
    setBufMax(maxChars) {
        this.maxChars = maxChars;
    }

    /**
     * Get maximum buffer size
     * @returns {number} Maximum number of characters
     */
    getBufMax() {
        return this.maxChars;
    }

    /**
     * Check if EditText has focus
     * @returns {boolean} true if focused
     */
    hasFocus() {
        return this.mbHasFocus;
    }

    /**
     * Set focus state
     * @param {boolean} focus - Whether to have focus
     */
    setFocus(focus = true) {
        if (this.mbHasFocus !== focus) {
            this.mbHasFocus = focus;
            
            if (focus) {
                // Start caret blinking timer
                this.timerMgr.startTimer('EDIT_CARET_TIMER', 500, false); // oneShot = false (repeating), blink every 500ms
                this.mbShowCaret = true;
            } else {
                // Stop caret blinking timer
                this.timerMgr.cancelTimer('EDIT_CARET_TIMER');
                this.mbShowCaret = false;
                this.clearSelection();
            }
        }
    }

    /**
     * Set text content
     * @param {string} text - Text to set
     */
    setText(text) {
        this.text = (text || '').substring(0, this.maxChars);
        this.caretPos = this.text.length;
        this.clearSelection();
    }

    /**
     * Get text content
     * @param {string} outString - Output string (for compatibility)
     * @returns {string} Current text
     */
    getText(outString = '') {
        return this.text;
    }

    /**
     * Select all text
     */
    selectAll() {
        this.highlightStartCharIndex = 0;
        this.highlightEndCharIndex = this.text.length;
        this.caretPos = this.text.length;
    }

    /**
     * Get selected text
     * @returns {string} Selected text
     */
    getSelectedText() {
        if (!this.hasSelection()) return '';
        
        const start = Math.min(this.highlightStartCharIndex, this.highlightEndCharIndex);
        const end = Math.max(this.highlightStartCharIndex, this.highlightEndCharIndex);
        
        return this.text.substring(start, end);
    }

    /**
     * Replace selected text
     * @param {string} newText - Text to replace selection with
     */
    replaceSelection(newText) {
        if (this.hasSelection()) {
            this.deleteSelection();
        }
        
        // Insert new text
        this.text = this.text.substring(0, this.caretPos) + newText + this.text.substring(this.caretPos);
        this.caretPos += newText.length;
    }

    /**
     * Set text color
     * @param {Object} color - Text color
     */
    setTextColor(color) {
        this.textColor = color;
    }

    /**
     * Set background color
     * @param {Object} color - Background color
     */
    setBackgroundColor(color) {
        this.mbkColor = color;
    }

    /**
     * Set font size
     * @param {number} size - Font size
     */
    setFontSize(size) {
        this.fontSize = size;
    }

    /**
     * Cleanup when EditText is destroyed
     */
    destroy() {
        // Unregister event handlers
        this.eventMgr.removeHandler(this, PDGEventTypes.eventType_KeyPress);
        this.eventMgr.removeHandler(this, PDGEventTypes.eventType_Timer);
        
        // Stop caret timer
        if (this.mbHasFocus) {
            this.timerMgr.cancelTimer('EDIT_CARET_TIMER');
        }
    }
}

module.exports = {
    EditText,
    EditTextClickIDs,
    LEFT_MARGIN,
    RIGHT_MARGIN,
    TEXT_HEIGHT_OFFSET
};
