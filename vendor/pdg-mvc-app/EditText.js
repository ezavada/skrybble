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
        this.highlightStartPoint = new pdg.Point(0, 0);
        this.highlightEndPoint = new pdg.Point(0, 0);
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
        this.removeClickablePart(EditTextClickIDs.CLICK_ID_EDITBOXVIEW);
        this.addClickablePart(new pdg.Rect(0, 0, viewArea.width(), viewArea.height()), EditTextClickIDs.CLICK_ID_EDITBOXVIEW);
    }

    /**
     * Draw the EditText
     */
    drawSelf() {
        const port = this.getPort();
        const viewArea = this.getViewArea();
        
        // Draw background
        var backgroundAttrs = new pdg.Attributes().fillColor(this.mbkColor);
        port.drawRect(viewArea, this.getDrawingAttributes(backgroundAttrs));
        
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
        port.drawRect(viewArea, this.getDrawingAttributes(borderAttrs));
    }

    /**
     * Draw text content
     */
    drawText() {
        const port = this.getPort();
        const viewArea = this.getViewArea();
        
        // Calculate text position
        const textX = viewArea.left + LEFT_MARGIN;
        const textAttrs = this.getDrawingAttributes(new pdg.Attributes().textSize(this.fontSize).textStyle(this.style), true);
        const font=port.getCurrentFont(this.style),size=textAttrs.getTextSize();
        const ascent=font.getFontAscent(size,this.style),descent=font.getFontDescent(size,this.style);
        const textY=viewArea.top+viewArea.height()/2+(ascent-descent)/2;
        
        // Draw text
        if (this.text) {
            port.drawText(this.text, new pdg.Point(textX, textY), this.getDrawingAttributes(new pdg.Attributes().textSize(this.fontSize).textStyle(this.style).fillColor(this.textColor), true));
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
        
        const selectionRect = new pdg.Rect(startX, selY, endX, selY + selHeight);
        var selectionAttrs = new pdg.Attributes().fillColor(new pdg.Color(0.3, 0.5, 1.0, 0.3)); // Light blue highlight
        port.drawRect(selectionRect, this.getDrawingAttributes(selectionAttrs));
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
        port.drawLine(new pdg.Point(caretX, caretY), new pdg.Point(caretX, caretY + caretHeight), this.getDrawingAttributes(new pdg.Attributes().lineColor(this.textColor).lineThickness(1), true));
    }

    /**
     * Get text width for a given string
     * @param {string} text - Text to measure
     * @returns {number} Text width in pixels
     */
    getTextWidth(text) {
        return this._measureText(text, new pdg.Attributes().textSize(this.fontSize).textStyle(this.style));
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
            this.setFocus(true);this._selectingText=true;
            
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
            this._selectingText=false;
            // Handle selection end
            const localPoint = this.globalToLocal(mouseInfo.mousePos);
            this.caretPos=this.getCaretPositionFromPoint(localPoint);
            this.highlightEndCharIndex=this.caretPos;
            
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
        if (part === EditTextClickIDs.CLICK_ID_EDITBOXVIEW && this.mbHasFocus && this._selectingText) {
            // Update selection during drag
            const localPoint = this.globalToLocal(mouseInfo.mousePos);
            this.caretPos=this.getCaretPositionFromPoint(localPoint);
            this.highlightEndCharIndex=this.caretPos;
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
        if(!this.mbHasFocus)return false;
        const code=keyPressInfo.unicode,command=keyPressInfo.ctrl || keyPressInfo.meta || keyPressInfo.command;
        this._editUndo ||= [];this._editRedo ||= [];
        const snapshot=()=>({text:this.text,caretPos:this.caretPos,highlightStartCharIndex:this.highlightStartCharIndex,
            highlightEndCharIndex:this.highlightEndCharIndex});
        if(command && [90,122,89,121].includes(code)) {
            const redo=keyPressInfo.shift || [89,121].includes(code);
            const from=redo?this._editRedo:this._editUndo,to=redo?this._editUndo:this._editRedo;
            if(from.length){to.push(snapshot());Object.assign(this,from.pop());}
            this.mbShowCaret=true;this._caretElapsed=0;return true;
        }
        const before=snapshot(),handled=this.processKeyPress(keyPressInfo,view,id,part);
        if(this.text!==before.text){this._editUndo.push(before);this._editRedo=[];}
        return handled;
    }

    processKeyPress(keyPressInfo, view, id, part) {
        if (!this.mbHasFocus) return false;
        
        // PDG KeyPress supplies Unicode characters and PDG control codes.
        const legacy={37:28,39:29,38:30,40:31,36:2,35:3,46:127};
        const code=keyPressInfo.unicode ?? (legacy[keyPressInfo.keyCode] ?? keyPressInfo.keyCode);
        const modifier=keyPressInfo.ctrl || keyPressInfo.meta || keyPressInfo.command;
        const shift=!!keyPressInfo.shift;
        if(modifier && [65,97].includes(code)) {this.selectAll();return true;}
        if(modifier && [67,99,88,120].includes(code)) {
            EditText.clipboard=this.getSelectedText();
            if([88,120].includes(code))this.deleteSelection();
            return true;
        }
        if(modifier && [86,118].includes(code)) {this.replaceSelection(EditText.clipboard || '');return true;}
        if(code===8) {this.handleBackspace();return true;}
        if(code===127) {this.handleDelete();return true;}
        if([28,29,30,31,2,3].includes(code)) {
            const left=code===28, right=code===29;
            let target=this.caretPos;
            if(left || right) {
                if(this.hasSelection() && !shift && !modifier)
                    target=(left?Math.min:Math.max)(this.highlightStartCharIndex,this.highlightEndCharIndex);
                else if(modifier || keyPressInfo.alt) {
                    const before=this.text.slice(0,this.caretPos),after=this.text.slice(this.caretPos);
                    target=left ? before.replace(/\s*\S+\s*$/u,'').length
                        : this.caretPos+(after.match(/^\s*\S+\s*/u)?.[0].length || after.length);
                } else target=this.adjacentPosition(this.caretPos,left?-1:1);
            } else target=(code===2 || code===30)?0:this.text.length;
            this.moveCaret(target,shift);return true;
        }
        if(code===13) return true;
        const key=keyPressInfo.key || (code>=32 && code<=0x10ffff?String.fromCodePoint(code):'');
        if(!modifier && !keyPressInfo.alt && this.isPrintableChar(key)) {this.handlePrintableChar(key);return true;}
        return false;
    }

    positions() {
        if(typeof Intl.Segmenter==='function') return [...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(this.text)]
            .map(segment=>segment.index).concat(this.text.length);
        const positions=[0];for(const char of this.text) positions.push(positions[positions.length-1]+char.length);
        return positions;
    }
    adjacentPosition(position,direction) {
        const positions=this.positions();
        return direction<0 ? [...positions].reverse().find(index=>index<position) ?? 0
            : positions.find(index=>index>position) ?? this.text.length;
    }
    moveCaret(position,extend=false) {
        if(!extend) {this.caretPos=position;this.clearSelection();}
        else {
            if(!this.hasSelection())this.highlightStartCharIndex=this.caretPos;
            this.caretPos=position;this.highlightEndCharIndex=position;
        }
        this.mbShowCaret=true;this._caretElapsed=0;
    }

    /**
     * Handle backspace key
     */
    handleBackspace() {
        if (this.hasSelection()) {
            this.deleteSelection();
        } else if (this.caretPos > 0) {
            const previous=this.adjacentPosition(this.caretPos,-1);
            this.text = this.text.substring(0, previous) + this.text.substring(this.caretPos);
            this.caretPos=previous;this.clearSelection();
        }
    }

    /**
     * Handle delete key
     */
    handleDelete() {
        if (this.hasSelection()) {
            this.deleteSelection();
        } else if (this.caretPos < this.text.length) {
            this.text = this.text.substring(0, this.caretPos) + this.text.substring(this.adjacentPosition(this.caretPos,1));
            this.clearSelection();
        }
    }

    /**
     * Handle left arrow key
     */
    handleLeftArrow() {
        if (this.caretPos > 0) {
            this.caretPos=this.adjacentPosition(this.caretPos,-1);
            this.clearSelection();
        }
    }

    /**
     * Handle right arrow key
     */
    handleRightArrow() {
        if (this.caretPos < this.text.length) {
            this.caretPos=this.adjacentPosition(this.caretPos,1);
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
        const selected=Math.abs(this.highlightEndCharIndex-this.highlightStartCharIndex);
        if (this.text.length-selected+char.length > this.maxChars) {
            return;
        }
        
        if (this.hasSelection()) {
            this.deleteSelection();
        }
        
        // Insert character
        this.text = this.text.substring(0, this.caretPos) + char + this.text.substring(this.caretPos);
        this.caretPos += char.length;
        this.clearSelection();
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
        return !!char && Array.from(char).every(value=>value.codePointAt(0)>=32 && !/[\r\n]/.test(value));
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
        for (const i of this.positions()) {
            const width = this.getTextWidth(this.text.substring(0, i));
            if (clickX < width + this.getTextWidth(this.text.slice(i,this.adjacentPosition(i,1))) / 2) {
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
        this.mbHasFocus=focus;this.mbShowCaret=focus;this._caretElapsed=0;
        if(!focus)this.clearSelection();
    }
    animate(seconds) {
        const changed=super.animate(seconds);
        if(this.mbHasFocus) {
            this._caretElapsed=(this._caretElapsed || 0)+seconds;
            while(this._caretElapsed>=.5) {this._caretElapsed-=.5;this.mbShowCaret=!this.mbShowCaret;}
        }
        return changed;
    }

    /**
     * Set text content
     * @param {string} text - Text to set
     */
    setText(text) {
        this.text=String(text || '');
        this.text=this.text.slice(0,this.positions().filter(position=>position<=this.maxChars).pop() ?? 0);
        this._editUndo=[];this._editRedo=[];
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
        this.clearSelection();
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
        super.destroy();
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
