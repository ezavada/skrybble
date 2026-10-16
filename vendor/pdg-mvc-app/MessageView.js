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
const { layoutText, sameFont } = require('./TextLayout');

/**
 * MessageView UI component that extends View
 * Provides a simple view for displaying text messages
 */
class MessageView extends View {
    constructor(controller, rect, message = '') {
        super(controller, rect);
        
        this._textLayout = null;
        this._textLayoutKey = [];
        this.message = message;
        this.textSize(12);
        this.textColor = new pdg.Color(0.0, 0.0, 0.0, 1.0);
        this.backgroundColor = new pdg.Color(1.0, 1.0, 1.0, 1.0);
        this.textStyle(pdg.textStyle_Plain);
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
        port.drawRect(viewArea, this.getDrawingAttributes(backgroundAttrs));
        
        // Draw border
        var borderAttrs = new pdg.Attributes().lineColor(new pdg.Color(0.7, 0.7, 0.7, 1.0)).lineThickness(1);
        port.drawRect(viewArea, this.getDrawingAttributes(borderAttrs));
        
        // Draw message text
        this.drawMessageText();
    }

    /**
     * Draw message text
     */
    drawMessageText() {
        const layout = this._ensureTextLayout(), port = this.getPort(), area = this.getViewArea();
        const attrs = this._textAttributes();
        // Alignment is baked into each retained x position.
        attrs.textStyle(attrs.getTextStyle() & ~(pdg.textStyle_Centered | pdg.textStyle_RightJustified));
        const saved = port.getClipRect();
        const clip = new pdg.Rect(area.left + this.margins.left, area.top + this.margins.top,
            area.left + this.margins.left + layout.width, area.top + this.margins.top + layout.height);
        port.setClipRect(saved.intersection(clip));
        try {
            for (const line of layout.lines) {
                const y = line.y - this.scrollOffset;
                if (y + line.height <= this.margins.top || y >= this.margins.top + layout.height) continue;
                port.drawText(line.text, new pdg.Point(area.left + line.x,
                    area.top + line.baseline - this.scrollOffset), attrs);
            }
        } finally { port.setClipRect(saved); }
    }

    _textAttributes() {
        return this.getDrawingAttributes(new pdg.Attributes().textSize(super.getTextSize())
            .textStyle(super.getTextStyle()).fillColor(this.textColor), true);
    }

    /** Reflow lazily, including direct field edits and inherited Animated appearance changes. */
    _ensureTextLayout(widthOverride) {
        const area = this.getViewArea(), attrs = this._textAttributes(), port = this.getPort();
        const size = attrs.getTextSize(), style = attrs.getTextStyle();
        const font = (typeof attrs.getFont === 'function' && attrs.getFont()) ||
            (typeof port.getCurrentFont === 'function' ? port.getCurrentFont(style) : null);
        const width = Math.max(0, widthOverride === undefined ? area.width() - this.margins.left - this.margins.right : widthOverride);
        const height = Math.max(0, area.height() - this.margins.top - this.margins.bottom);
        const key = [this.message, width, height, size, style, font, this.wordWrap,
            this.maxLines, this.lineSpacing, this.textAlignment,
            this.margins.left, this.margins.top];
        if (!this._textLayout || key.some((value, i) => i === 5 ? !sameFont(value, this._textLayoutKey[i]) : value !== this._textLayoutKey[i])) {
            const base = new pdg.Attributes().textSize(size).textStyle(style & ~(pdg.textStyle_Centered | pdg.textStyle_RightJustified));
            const measure = (text) => this._measureText(text, base);
            const measured = layoutText(this.message, width, this.wordWrap, measure);
            const lineHeight = Math.max(1, (font ? font.getFontHeight(size, style) + font.getFontLeading(size, style) : size) + this.lineSpacing);
            const ascent = font ? font.getFontAscent(size, style) : size;
            const count = this.maxLines > 0 ? Math.min(Math.floor(this.maxLines), measured.length) : measured.length;
            const alignment = typeof this.textAlignment === 'string' ? pdg[this.textAlignment] : this.textAlignment;
            const lines = measured.slice(0, count).map((line, i) => ({ ...line,
                x: this.margins.left + ((alignment & pdg.textStyle_Centered) ? (width - line.width) / 2 : (alignment & pdg.textStyle_RightJustified) ? width - line.width : 0),
                y: this.margins.top + i * lineHeight,
                baseline: this.margins.top + i * lineHeight + ascent, height: lineHeight }));
            this._textLayout = { lines, width, height, lineHeight, contentHeight: count * lineHeight };
            this._textLayoutKey = key;
            this.wrappedLines = measured.map(line => line.text);
        }
        this.maxScrollOffset = Math.max(0, this._textLayout.contentHeight - height);
        this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, this.maxScrollOffset));
        return this._textLayout;
    }

    /** Return an independent layout snapshot, with local coordinates before scrolling. */
    getTextLayout() {
        const layout = this._ensureTextLayout();
        return { ...layout, lines: layout.lines.map(line => ({ ...line,
            offsets: [...line.offsets], advances: [...line.advances] })) };
    }

    /** Nearest character boundary in a visible line, or null outside text bounds.
     * Input is in Port coordinates; the result uses source UTF-16 indices. */
    getTextHit(screenPoint) {
        const layout = this._ensureTextLayout(), point = this.globalToLocal(screenPoint);
        if (!this.pointInViewVisibleArea(screenPoint) || point.y < this.margins.top ||
            point.y >= this.margins.top + layout.height || point.x < this.margins.left ||
            point.x >= this.margins.left + layout.width) return null;
        const lineIndex = Math.floor((point.y + this.scrollOffset - this.margins.top) / layout.lineHeight);
        const line = layout.lines[lineIndex];
        if (!line || point.x < line.x || point.x > line.x + line.width) return null;
        const x = point.x - line.x;
        let index = 0;
        while (index + 1 < line.advances.length && x >= (line.advances[index] + line.advances[index + 1]) / 2) ++index;
        return { lineIndex, characterIndex: line.offsets[index] };
    }

    /** Get a line's horizontal position in the supplied Port rectangle. */
    getTextX(textArea, line) {
        const layout = this._ensureTextLayout();
        const measured = layout.lines.find(item => item.text === line);
        const width = measured ? measured.width : this._measureText(line, this._textAttributes());
        const alignment = typeof this.textAlignment === 'string' ? pdg[this.textAlignment] : this.textAlignment;
        return (alignment & pdg.textStyle_Centered) ? textArea.left + (textArea.width() - width) / 2 :
            (alignment & pdg.textStyle_RightJustified) ? textArea.right - width : textArea.left;
    }

    /** Retain wrapping for a supplied width; later queries use the current view bounds. */
    wrapText(width) { this._ensureTextLayout(width); }

    /**
     * Set message text
     * @param {string} message - New message text
     */
    setMessage(message) {
        this.message = message || '';
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
        this.textSize(size);
    }

    /**
     * Get text size
     * @returns {number} Current text size
     */
    getTextSize() {
        return super.getTextSize();
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
        this.textStyle(typeof style === 'string' ? pdg[style] : style);
    }

    /**
     * Get text style
     * @returns {string} Current text style
     */
    getTextStyle() {
        return super.getTextStyle();
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
        this._ensureTextLayout();
        return [...this.wrappedLines];
    }

    /**
     * Get number of lines
     * @returns {number} Number of lines
     */
    getLineCount() {
        this._ensureTextLayout();
        return this.wrappedLines.length;
    }

    /**
     * Scroll up
     */
    scrollUp() {
        this._ensureTextLayout();
        if (this.scrollOffset > 0) {
            this.scrollOffset = Math.max(0, this.scrollOffset - 20);
        }
    }

    /**
     * Scroll down
     */
    scrollDown() {
        this._ensureTextLayout();
        if (this.scrollOffset < this.maxScrollOffset) {
            this.scrollOffset = Math.min(this.maxScrollOffset, this.scrollOffset + 20);
        }
    }

    /**
     * Set scroll offset
     * @param {number} offset - Scroll offset
     */
    setScrollOffset(offset) {
        this._ensureTextLayout();
        this.scrollOffset = Math.max(0, Math.min(offset, this.maxScrollOffset));
    }

    /**
     * Get scroll offset
     * @returns {number} Current scroll offset
     */
    getScrollOffset() {
        this._ensureTextLayout();
        return this.scrollOffset;
    }

    /**
     * Check if scrolling is needed
     * @returns {boolean} true if scrolling is needed
     */
    isScrollingNeeded() {
        this._ensureTextLayout();
        return this.maxScrollOffset > 0;
    }

    /**
     * Get scroll percentage
     * @returns {number} Scroll percentage (0.0 to 1.0)
     */
    getScrollPercentage() {
        this._ensureTextLayout();
        if (this.maxScrollOffset === 0) return 0.0;
        return this.scrollOffset / this.maxScrollOffset;
    }

    /**
     * Set scroll percentage
     * @param {number} percentage - Scroll percentage (0.0 to 1.0)
     */
    setScrollPercentage(percentage) {
        this._ensureTextLayout();
        const offset = percentage * this.maxScrollOffset;
        this.setScrollOffset(offset);
    }

    /**
     * Update scroll limits
     */
    updateScrollLimits() {
        this._ensureTextLayout();
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
        this._ensureTextLayout();
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
        super.destroy();
        this.message = '';
        this._textLayout = null;
        this._textLayoutKey = [];
        this.wrappedLines = [];
    }
}

module.exports = {
    MessageView
};
