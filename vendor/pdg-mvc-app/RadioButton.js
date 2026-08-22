// -----------------------------------------------
// RadioButton.js
// 
// JavaScript port of the RadioButton UI component
// A radio button with multiple options
//
// Ported from C++ by Assistant, 2024
// Original Copyright (c) 2004-2012, Dream Rock Studios, LLC
// -----------------------------------------------

const { View  } = require('./View');
const { ControlAttributes, ControlState, ControlType } = require('./ControlAttributes');

const MAX_RADIO_IMAGES = 2;

/**
 * RadioButton UI component that extends View
 * Provides radio button functionality with multiple options
 */
class RadioButton extends View {
    constructor(controller, viewArea, resourceTextID, numStrings) {
        super(controller, viewArea);
        
        this.resMgr = controller.getApplication().getResourceManager();
        this.mpRadioImages = new Array(MAX_RADIO_IMAGES).fill(null);
        this.selectedIndex = 0;
        this.strings = [];
        this.maxStrings = numStrings;
        this.attributes = new ControlAttributes();
        this.textSize = 14;
        
        this.attributes
            .stateForeground(ControlState.Normal, new pdg.Color(0, 0, 0, 1))
            .stateForeground(ControlState.Selected, new pdg.Color(0, 0, 0, 1))
            .stateForeground(ControlState.Disabled, new pdg.Color(0.7, 0.7, 0.7, 1))
            .stateForeground(ControlState.SelectedDisabled, new pdg.Color(0.7, 0.7, 0.7, 1));
        this.attributes.merge(controller.getTopController()
            .getControlAttributes(ControlType.RadioButton));
        this.loadStrings(resourceTextID, numStrings);
        this.calcClickableAreas();
    }

    /**
     * Load radio button images
     */
    loadImages() {
        try {
            // In a real implementation, you would load images from resources
            // For now, we'll create placeholder images
            for (let i = 0; i < MAX_RADIO_IMAGES; i++) {
                this.mpRadioImages[i] = null; // Placeholder
            }
        } catch (error) {
            console.warn('Failed to load radio button images:', error);
        }
    }

    /**
     * Load strings from resources
     * @param {number} resourceID - Resource ID
     * @param {number} numStrings - Number of strings
     */
    loadStrings(resourceID, numStrings) {
        try {
            this.strings = [];
            for (let i = 0; i < numStrings; i++) {
                const text = this.resMgr.getString(resourceID, i);
                this.strings.push(text);
            }
        } catch (error) {
            console.warn(`Failed to load strings from resource ${resourceID}:`, error);
            // Create placeholder strings
            for (let i = 0; i < numStrings; i++) {
                this.strings.push(`Option ${i + 1}`);
            }
        }
    }

    /**
     * Calculate clickable areas
     */
    calcClickableAreas() {
        const viewArea = this.getViewArea();
        const optionWidth = viewArea.width() / Math.max(1, this.strings.length);
        for (let i = 0; i < this.strings.length; i++) {
            this.removeClickablePart(i);
            const optionRect = new pdg.Rect(
                i * optionWidth,
                0,
                (i + 1) * optionWidth,
                viewArea.height()
            );
            
            this.addClickablePart(optionRect, i);
        }
    }

    /**
     * Draw the radio button
     */
    drawSelf(port, frameNum) {
        this.drawRadioOptions(port);
    }

    /**
     * Draw radio options
     */
    drawRadioOptions(port = this.getPort()) {
        const viewArea = this.getViewArea();
        const optionWidth = viewArea.width() / Math.max(1, this.strings.length);
        
        for (let i = 0; i < this.strings.length; i++) {
            const selected = i === this.selectedIndex;
            const state = selected
                ? (this.isEnabled() ? ControlState.Selected : ControlState.SelectedDisabled)
                : (this.isEnabled() ? ControlState.Normal : ControlState.Disabled);
            const visual = this.attributes.state(state);
            const normal = this.attributes.state(ControlState.Normal);
            const image = visual.hasImage ? visual.image : (normal.hasImage ? normal.image : null);
            const imageWidth = image ? (typeof image.width === 'function' ? image.width() : image.width) : this.textSize;
            const imageHeight = image ? (typeof image.height === 'function' ? image.height() : image.height) : this.textSize;
            const optionX = viewArea.left + i * optionWidth;
            const radioRect = new pdg.Rect(
                optionX,
                viewArea.top + (viewArea.height() - imageHeight) / 2,
                optionX + imageWidth,
                viewArea.top + (viewArea.height() - imageHeight) / 2 + imageHeight
            );
            this.attributes.draw(port, radioRect, state);
            if (!image && !visual.hasDrawing && !visual.hasDrawRoutine &&
                !normal.hasDrawing && !normal.hasDrawRoutine) {
                this.drawRadioCircle(radioRect, selected,
                    visual.hasForeground ? visual.foreground : normal.foreground);
            }
            
            // Draw text
            const textPoint = new pdg.Point(
                optionX + imageWidth + 5,
                viewArea.top + viewArea.height() / 2 + this.textSize / 2
            );
            const textColor = visual.hasForeground ? visual.foreground : normal.foreground;
            
            port.drawText(this.strings[i], textPoint, new pdg.Attributes()
                .textSize(this.textSize).textStyle(pdg.textStyle_Plain).fillColor(textColor));
        }
    }

    /**
     * Draw radio circle
     * @param {pdg.Rect} rect - Circle rectangle
     * @param {boolean} selected - Whether this option is selected
     */
    drawRadioCircle(rect, selected, color = new pdg.Color(0, 0, 0, 1)) {
        const port = this.getPort();
        
        // Draw outer circle
        port.drawEllipse(rect.centerPoint(), rect.width() / 2, rect.height() / 2,
            new pdg.Attributes().fillColor(new pdg.Color(1, 1, 1, 1)).lineColor(color));
        
        if (selected) {
            // Draw inner filled circle
            const innerRect = new pdg.Rect(
                rect.left + 3,
                rect.top + 3,
                rect.right - 3,
                rect.bottom - 3
            );
            var innerAttrs = new pdg.Attributes().fillColor(new pdg.Color(0.0, 0.0, 0.0, 1.0));
            port.drawEllipse(innerRect.centerPoint(), innerRect.width() / 2, innerRect.height() / 2, innerAttrs);
        }
    }

    /**
     * Handle click
     * @param {number} part - Clicked part
     */
    doClick(part) {
        if (part >= 0 && part < this.strings.length) {
            this.setSelectedIndex(part);
            this.attributes.playClick();
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
        if (part >= 0 && part < this.strings.length) {
            return true; // We'll handle the selection on mouse up
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
        if (part >= 0 && part < this.strings.length) {
            this.doClick(part);
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
        
        switch (keyCode) {
            case 38: // Up arrow
                this.moveSelection(-1);
                return true;
                
            case 40: // Down arrow
                this.moveSelection(1);
                return true;
                
            case 32: // Space
                // Toggle current selection (though radio buttons don't really toggle)
                return true;
        }
        
        return false;
    }

    /**
     * Move selection by delta
     * @param {number} delta - Delta to move by
     */
    moveSelection(delta) {
        let newIndex = this.selectedIndex + delta;
        newIndex = Math.max(0, Math.min(newIndex, this.strings.length - 1));
        this.setSelectedIndex(newIndex);
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
     * @param {number} selected - Index to select
     */
    setSelectedIndex(selected) {
        if (selected >= 0 && selected < this.strings.length) {
            this.selectedIndex = selected;
            
            // Notify controller of selection change
            if (this.controller && typeof this.controller.radioButtonChanged === 'function') {
                this.controller.radioButtonChanged(this.selectedIndex, this);
            }
        }
    }

    /**
     * Get selected text
     * @returns {string} Selected text
     */
    getSelectedText() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.strings.length) {
            return this.strings[this.selectedIndex];
        }
        return '';
    }

    /**
     * Get string at index
     * @param {number} index - String index
     * @returns {string} String at index
     */
    getString(index) {
        if (index >= 0 && index < this.strings.length) {
            return this.strings[index];
        }
        return '';
    }

    /**
     * Set string at index
     * @param {number} index - String index
     * @param {string} text - New text
     */
    setString(index, text) {
        if (index >= 0 && index < this.strings.length) {
            this.strings[index] = text;
        }
    }

    /**
     * Add string option
     * @param {string} text - Text to add
     */
    addString(text) {
        this.strings.push(text);
        this.maxStrings = this.strings.length;
        this.calcClickableAreas();
    }

    /**
     * Remove string at index
     * @param {number} index - Index to remove
     */
    removeString(index) {
        if (index >= 0 && index < this.strings.length) {
            this.strings.splice(index, 1);
            this.maxStrings = this.strings.length;
            
            // Adjust selection if necessary
            if (this.selectedIndex >= index) {
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            }
            
            this.calcClickableAreas();
        }
    }

    /**
     * Clear all strings
     */
    clearStrings() {
        this.strings = [];
        this.maxStrings = 0;
        this.selectedIndex = 0;
        this.calcClickableAreas();
    }

    /**
     * Get number of options
     * @returns {number} Number of options
     */
    getOptionCount() {
        return this.strings.length;
    }

    /**
     * Check if option is selected
     * @param {number} index - Option index
     * @returns {boolean} true if selected
     */
    isOptionSelected(index) {
        return index === this.selectedIndex;
    }

    /**
     * Select next option
     */
    selectNext() {
        this.moveSelection(1);
    }

    /**
     * Select previous option
     */
    selectPrevious() {
        this.moveSelection(-1);
    }

    /**
     * Select first option
     */
    selectFirst() {
        this.setSelectedIndex(0);
    }

    /**
     * Select last option
     */
    selectLast() {
        this.setSelectedIndex(this.strings.length - 1);
    }

    /**
     * Get all strings
     * @returns {string[]} Array of all strings
     */
    getAllStrings() {
        return [...this.strings];
    }

    /**
     * Set all strings
     * @param {string[]} strings - Array of strings
     */
    setAllStrings(strings) {
        this.strings = [...strings];
        this.maxStrings = this.strings.length;
        
        // Ensure selection is valid
        if (this.selectedIndex >= this.strings.length) {
            this.selectedIndex = Math.max(0, this.strings.length - 1);
        }
        
        this.calcClickableAreas();
    }

    /**
     * Find string index
     * @param {string} text - Text to find
     * @returns {number} Index of string or -1 if not found
     */
    findString(text) {
        return this.strings.indexOf(text);
    }

    /**
     * Set text size
     * @param {number} size - Text size
     */
    setTextSize(size) {
        // This would be used in a more advanced implementation
        // For now, we'll just store it
        this.textSize = size;
    }

    /**
     * Get text size
     * @returns {number} Text size
     */
    getTextSize() {
        return this.textSize || 12;
    }

    setClickSound(clickSound) {
        this.attributes.clickSound(clickSound);
    }

    setAttributes(attributes) {
        this.attributes.merge(attributes);
        this.calcClickableAreas();
    }

    getAttributes() {
        return this.attributes;
    }

    /**
     * Cleanup when radio button is destroyed
     */
    destroy() {
        // Clean up images
        for (let i = 0; i < MAX_RADIO_IMAGES; i++) {
            this.mpRadioImages[i] = null;
        }
        
        // Clear strings
        this.strings = [];
        this.attributes = new ControlAttributes();
    }
}

module.exports = {
    RadioButton,
    MAX_RADIO_IMAGES
};
