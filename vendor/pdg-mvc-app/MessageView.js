// -----------------------------------------------
// MessageView.js
// 
// JavaScript port of the MessageView UI component
// A view for displaying text messages
//
// Ported from C++ by Assistant, 2024
// Original Copyright (c) 2004-2012, Dream Rock Studios, LLC
// -----------------------------------------------

const { View } = require('./View');

/**
 * MessageView UI component that extends View
 * Provides a simple view for displaying text messages
 */
class MessageView extends View {
    constructor(controller, rect, message = '') {
        super(controller, rect);
        
        this.message = message;
        this.textSize = 12;
        this.textColor = new pdg.Color(0.0, 0.0, 0.0, 1.0);
        this.backgroundColor = new pdg.Color(1.0, 1.0, 1.0, 1.0);
        this.textStyle = 'textStyle_Plain';
        this.textAlignment = 'textStyle_LeftJustified';
        this.wordWrap = true;
        this.maxLines = 0; // 0 = unlimited
        this.lineSpacing = 2;
        this.margins = { left: 5, right: 5, top: 5, bottom: 5 };
        this.wrappedLines = [];
        this.scrollOffset = 0;
        this.maxScrollOffset = 0;
    }

    /**
     * Draw the message view
     */
    drawSelf(port, frameNum) {
        const viewArea = this.getViewArea();
        
        // Draw background
        var backgroundAttrs = new pdg.Attributes().fillColor(this.backgroundColor);
        port.drawRect(viewArea, backgroundAttrs);
        
        // Draw border
        var borderAttrs = new pdg.Attributes().lineColor(new pdg.Color(0.7, 0.7, 0.7, 1.0)).lineThickness(1);
        port.drawRect(viewArea, borderAttrs);
        
        // Draw message text
        this.drawMessageText();
    }

    /**
     * Draw message text
     */
    drawMessageText() {
        const port = this.getPort();
        const viewArea = this.getViewArea();
        
        if (!this.message || this.message === '') {
            return;
        }
        
        // Calculate text area
        const textArea = new pdg.Rect(
            viewArea.left + this.margins.left,
            viewArea.top + this.margins.top,
            viewArea.width() - this.margins.left - this.margins.right,
            viewArea.height() - this.margins.top - this.margins.bottom
        );
        
        // Wrap text if needed
        if (this.wordWrap) {
            this.wrapText(textArea.width());
        } else {
            this.wrappedLines = [this.message];
        }
        
        // Calculate line height
        const lineHeight = this.textSize + this.lineSpacing;
        
        // Draw lines
        let y = textArea.top - this.scrollOffset;
        const maxLines = this.maxLines > 0 ? Math.min(this.maxLines, this.wrappedLines.length) : this.wrappedLines.length;
        
        for (let i = 0; i < maxLines && y < textArea.bottom; i++) {
            if (y + lineHeight >= textArea.top) {
                const line = this.wrappedLines[i];
                const x = this.getTextX(textArea, line);
                
                port.drawText(line, new pdg.Point(x, y + this.textSize), this.textSize, this.textStyle, this.textColor);
            }
            y += lineHeight;
        }
    }

    /**
     * Get X position for text based on alignment
     * @param {Rect} textArea - Text area
     * @param {string} line - Text line
     * @returns {number} X position
     */
    getTextX(textArea, line) {
        const port = this.getPort();
        const textWidth = port.getTextWidth(line, this.textSize, this.textStyle);
        
        switch (this.textAlignment) {
            case 'textStyle_Centered':
                return textArea.left + (textArea.width() - textWidth) / 2;
            case 'textStyle_RightJustified':
                return textArea.right - textWidth;
            case 'textStyle_LeftJustified':
            default:
                return textArea.left;
        }
    }

    /**
     * Wrap text to fit within width
     * @param {number} width - Maximum width
     */
    wrapText(width) {
        if (!this.message) {
            this.wrappedLines = [];
            return;
        }
        
        const port = this.getPort();
        const words = this.message.split(' ');
        this.wrappedLines = [];
        let currentLine = '';
        
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const testWidth = port.getTextWidth(testLine, this.textSize, this.textStyle);
            
            if (testWidth <= width) {
                currentLine = testLine;
            } else {
                if (currentLine) {
                    this.wrappedLines.push(currentLine);
                    currentLine = word;
                } else {
                    // Single word is too long, force it
                    this.wrappedLines.push(word);
                    currentLine = '';
                }
            }
        }
        
        if (currentLine) {
            this.wrappedLines.push(currentLine);
        }
    }

    /**
     * Set message text
     * @param {string} message - New message text
     */
    setMessage(message) {
        this.message = message || '';
        this.wrappedLines = [];
    }

    /**
     * Get message text
     * @returns {string} Current message text
     */
    getMessage() {
        return this.message;
    }

    /**
     * Set text size
     * @param {number} size - Text size
     */
    setTextSize(size) {
        this.textSize = size;
        this.wrappedLines = [];
    }

    /**
     * Get text size
     * @returns {number} Current text size
     */
    getTextSize() {
        return this.textSize;
    }

    /**
     * Set text color
     * @param {Object} color - Text color
     */
    setTextColor(color) {
        this.textColor = color;
    }

    /**
     * Get text color
     * @returns {Object} Current text color
     */
    getTextColor() {
        return this.textColor;
    }

    /**
     * Set background color
     * @param {Object} color - Background color
     */
    setBackgroundColor(color) {
        this.backgroundColor = color;
    }

    /**
     * Get background color
     * @returns {Object} Current background color
     */
    getBackgroundColor() {
        return this.backgroundColor;
    }

    /**
     * Set text style
     * @param {string} style - Text style
     */
    setTextStyle(style) {
        this.textStyle = style;
    }

    /**
     * Get text style
     * @returns {string} Current text style
     */
    getTextStyle() {
        return this.textStyle;
    }

    /**
     * Set text alignment
     * @param {string} alignment - Text alignment
     */
    setTextAlignment(alignment) {
        this.textAlignment = alignment;
    }

    /**
     * Get text alignment
     * @returns {string} Current text alignment
     */
    getTextAlignment() {
        return this.textAlignment;
    }

    /**
     * Set word wrap
     * @param {boolean} wrap - Whether to wrap text
     */
    setWordWrap(wrap) {
        this.wordWrap = wrap;
        this.wrappedLines = [];
    }

    /**
     * Get word wrap
     * @returns {boolean} Whether text is wrapped
     */
    getWordWrap() {
        return this.wordWrap;
    }

    /**
     * Set maximum lines
     * @param {number} maxLines - Maximum number of lines (0 = unlimited)
     */
    setMaxLines(maxLines) {
        this.maxLines = maxLines;
    }

    /**
     * Get maximum lines
     * @returns {number} Maximum number of lines
     */
    getMaxLines() {
        return this.maxLines;
    }

    /**
     * Set line spacing
     * @param {number} spacing - Line spacing
     */
    setLineSpacing(spacing) {
        this.lineSpacing = spacing;
    }

    /**
     * Get line spacing
     * @returns {number} Current line spacing
     */
    getLineSpacing() {
        return this.lineSpacing;
    }

    /**
     * Set margins
     * @param {Object} margins - Margins {left, right, top, bottom}
     */
    setMargins(margins) {
        this.margins = { ...margins };
    }

    /**
     * Get margins
     * @returns {Object} Current margins
     */
    getMargins() {
        return { ...this.margins };
    }

    /**
     * Get wrapped lines
     * @returns {string[]} Array of wrapped lines
     */
    getWrappedLines() {
        return [...this.wrappedLines];
    }

    /**
     * Get number of lines
     * @returns {number} Number of lines
     */
    getLineCount() {
        return this.wrappedLines.length;
    }

    /**
     * Scroll up
     */
    scrollUp() {
        if (this.scrollOffset > 0) {
            this.scrollOffset = Math.max(0, this.scrollOffset - 20);
        }
    }

    /**
     * Scroll down
     */
    scrollDown() {
        if (this.scrollOffset < this.maxScrollOffset) {
            this.scrollOffset = Math.min(this.maxScrollOffset, this.scrollOffset + 20);
        }
    }

    /**
     * Set scroll offset
     * @param {number} offset - Scroll offset
     */
    setScrollOffset(offset) {
        this.scrollOffset = Math.max(0, Math.min(offset, this.maxScrollOffset));
    }

    /**
     * Get scroll offset
     * @returns {number} Current scroll offset
     */
    getScrollOffset() {
        return this.scrollOffset;
    }

    /**
     * Check if scrolling is needed
     * @returns {boolean} true if scrolling is needed
     */
    isScrollingNeeded() {
        return this.maxScrollOffset > 0;
    }

    /**
     * Get scroll percentage
     * @returns {number} Scroll percentage (0.0 to 1.0)
     */
    getScrollPercentage() {
        if (this.maxScrollOffset === 0) return 0.0;
        return this.scrollOffset / this.maxScrollOffset;
    }

    /**
     * Set scroll percentage
     * @param {number} percentage - Scroll percentage (0.0 to 1.0)
     */
    setScrollPercentage(percentage) {
        const offset = percentage * this.maxScrollOffset;
        this.setScrollOffset(offset);
    }

    /**
     * Update scroll limits
     */
    updateScrollLimits() {
        const viewArea = this.getViewArea();
        const textArea = new pdg.Rect(
            viewArea.left + this.margins.left,
            viewArea.top + this.margins.top,
            viewArea.width() - this.margins.left - this.margins.right,
            viewArea.height() - this.margins.top - this.margins.bottom
        );
        
        const lineHeight = this.textSize + this.lineSpacing;
        const totalHeight = this.wrappedLines.length * lineHeight;
        const visibleHeight = textArea.height();
        
        this.maxScrollOffset = Math.max(0, totalHeight - visibleHeight);
        this.scrollOffset = Math.min(this.scrollOffset, this.maxScrollOffset);
    }

    /**
     * Handle mouse wheel
     * @param {Object} wheelInfo - Wheel information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doMouseWheel(wheelInfo, id, part) {
        if (this.isScrollingNeeded()) {
            if (wheelInfo.deltaY > 0) {
                this.scrollUp();
            } else {
                this.scrollDown();
            }
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
        const keyCode = keyPressInfo.keyCode;
        
        if (this.isScrollingNeeded()) {
            switch (keyCode) {
                case 33: // Page up
                    this.scrollUp();
                    return true;
                case 34: // Page down
                    this.scrollDown();
                    return true;
                case 36: // Home
                    this.setScrollOffset(0);
                    return true;
                case 35: // End
                    this.setScrollOffset(this.maxScrollOffset);
                    return true;
            }
        }
        
        return false;
    }

    /**
     * Clear message
     */
    clear() {
        this.setMessage('');
    }

    /**
     * Append text to message
     * @param {string} text - Text to append
     */
    append(text) {
        this.setMessage(this.message + text);
    }

    /**
     * Prepend text to message
     * @param {string} text - Text to prepend
     */
    prepend(text) {
        this.setMessage(text + this.message);
    }

    /**
     * Insert text at position
     * @param {number} position - Position to insert at
     * @param {string} text - Text to insert
     */
    insert(position, text) {
        if (position >= 0 && position <= this.message.length) {
            const newMessage = this.message.substring(0, position) + text + this.message.substring(position);
            this.setMessage(newMessage);
        }
    }

    /**
     * Remove text at position
     * @param {number} position - Position to remove from
     * @param {number} length - Number of characters to remove
     */
    remove(position, length) {
        if (position >= 0 && position < this.message.length) {
            const newMessage = this.message.substring(0, position) + this.message.substring(position + length);
            this.setMessage(newMessage);
        }
    }

    /**
     * Replace text
     * @param {string} searchText - Text to search for
     * @param {string} replaceText - Text to replace with
     */
    replace(searchText, replaceText) {
        const newMessage = this.message.replace(new RegExp(searchText, 'g'), replaceText);
        this.setMessage(newMessage);
    }

    /**
     * Get text at line
     * @param {number} lineIndex - Line index
     * @returns {string} Text at line
     */
    getLine(lineIndex) {
        if (lineIndex >= 0 && lineIndex < this.wrappedLines.length) {
            return this.wrappedLines[lineIndex];
        }
        return '';
    }

    /**
     * Get character at position
     * @param {number} position - Character position
     * @returns {string} Character at position
     */
    getCharAt(position) {
        if (position >= 0 && position < this.message.length) {
            return this.message.charAt(position);
        }
        return '';
    }

    /**
     * Get message length
     * @returns {number} Message length
     */
    getLength() {
        return this.message.length;
    }

    /**
     * Check if message is empty
     * @returns {boolean} true if message is empty
     */
    isEmpty() {
        return this.message === '';
    }

    /**
     * Check if message is not empty
     * @returns {boolean} true if message is not empty
     */
    isNotEmpty() {
        return this.message !== '';
    }

    /**
     * Cleanup when message view is destroyed
     */
    destroy() {
        this.message = '';
        this.wrappedLines = [];
    }
}

module.exports = {
    MessageView
};
