// -----------------------------------------------
// Checkbox.js
// 
// JavaScript port of the Checkbox UI component
// A checkbox with text label
//
// Ported from C++ by Assistant, 2024
// Original Copyright (c) 2004-2012, Dream Rock Studios, LLC
// -----------------------------------------------

const { View } = require('./View');
const { ControlAttributes, ControlState, ControlType } = require('./ControlAttributes');
const pdgDefs = require('../pdg-defs');

const CHECKBOX_TEXT_SIZE = 16;
const SPACE_BETWEEN_BOX_AND_TEXT = 5;
const SPACE_UP_FROM_BOTTOM = 5;

function getCheckboxTextStyle() {
    return Number.isFinite(pdg.textStyle_Bold)
        ? pdg.textStyle_Bold : pdgDefs.textStyle_Bold;
}

/**
 * Checkbox click IDs
 */
const CheckboxClickIDs = {
    CLICK_ID_CHECKBOX: 1
};

/**
 * Checkbox images enumeration
 */
const CBImages = {
    OPEN: 0,    // Unchecked state
    CLOSED: 1,  // Checked state
    NUM_CHECKBOX_IMAGES: 2
};

/**
 * Checkbox UI component that extends View
 */
class Checkbox extends View {
    constructor(controller, viewArea) {
        if (!controller) {
            throw new Error("Controller is required");
        }

        super(controller, viewArea);
        
        this.resMgr = controller.getApplication().getResourceManager();
        this.mpCheckboxImages = new Array(CBImages.NUM_CHECKBOX_IMAGES).fill(null);
        this.attributes = new ControlAttributes();
        this.checked = false;
        this.string = '';
        this.textSize = CHECKBOX_TEXT_SIZE;
        
        this.attributes
            .stateForeground(ControlState.Normal, new pdg.Color(0, 0, 0, 1))
            .stateForeground(ControlState.Selected, new pdg.Color(0, 0, 0, 1))
            .stateForeground(ControlState.Disabled, new pdg.Color(0.7, 0.7, 0.7, 1))
            .stateForeground(ControlState.SelectedDisabled, new pdg.Color(0.7, 0.7, 0.7, 1));
        this.attributes.merge(controller.getTopController()
            .getControlAttributes(ControlType.Checkbox));
        this.calcClickableAreas();
    }

    /**
     * Load checkbox images
     */
    loadImages() {
        try {
            // Try to load images from resources
            // In a real implementation, you would load actual checkbox images
            for (let i = 0; i < CBImages.NUM_CHECKBOX_IMAGES; i++) {
                // this.mpCheckboxImages[i] = this.resMgr.getImage(CHECKBOX_IMAGE_ID, i);
                this.mpCheckboxImages[i] = null; // Placeholder
            }
        } catch (error) {
            console.warn('Failed to load checkbox images:', error);
            // Create placeholder images
            this.createPlaceholderImages();
        }
    }

    /**
     * Create placeholder checkbox images
     */
    createPlaceholderImages() {
        // In a real implementation, you would create actual images
        // For now, we'll handle drawing in drawSelf()
        for (let i = 0; i < CBImages.NUM_CHECKBOX_IMAGES; i++) {
            this.mpCheckboxImages[i] = null;
        }
    }

    /**
     * Draw the checkbox
     */
    drawSelf() {
        const port = this.getPort();
        const viewArea = this.getViewArea();
        const state = this.checked
            ? (this.isEnabled() ? ControlState.Selected : ControlState.SelectedDisabled)
            : (this.isEnabled() ? ControlState.Normal : ControlState.Disabled);
        const visual = this.attributes.state(state);
        const normal = this.attributes.state(ControlState.Normal);
        const image = visual.hasImage ? visual.image : (normal.hasImage ? normal.image : null);
        const imageWidth = image ? (typeof image.width === 'function' ? image.width() : image.width) : 0;
        const imageHeight = image ? (typeof image.height === 'function' ? image.height() : image.height) : 0;
        const metrics = this.getTextMetrics(port);
        const baseline = Math.round(
            (viewArea.height() - metrics.ascent - metrics.descent) * 0.5 + metrics.ascent);
        const checkboxSize = image ? imageWidth : Math.max(1, Math.round(metrics.ascent));
        const checkboxHeight = image ? imageHeight : checkboxSize;
        const checkboxTop = image
            ? viewArea.top + (viewArea.height() - checkboxHeight) / 2
            : viewArea.top + baseline - checkboxHeight;
        const checkboxRect = new pdg.Rect(
            viewArea.left,
            checkboxTop,
            viewArea.left + checkboxSize,
            checkboxTop + checkboxHeight
        );

        this.attributes.draw(port, checkboxRect, state);
        if (!image && !visual.hasDrawing && !visual.hasDrawRoutine &&
            !normal.hasDrawing && !normal.hasDrawRoutine) {
            const markColor = visual.hasForeground ? visual.foreground : normal.foreground;
            port.drawRect(checkboxRect, new pdg.Attributes()
                .fillColor(new pdg.Color(1, 1, 1, 1)).lineColor(markColor).lineThickness(1));
            if (this.checked) this.drawCheckmark(checkboxRect, markColor);
        }
        
        // Draw text if present
        if (this.string) {
            const textColor = visual.hasForeground ? visual.foreground : normal.foreground;
            this.drawText(checkboxSize, baseline, textColor);
        }
    }

    getTextMetrics(port = this.getPort()) {
        const style = getCheckboxTextStyle();
        try {
            const font = port.getCurrentFont(style);
            const ascent = font.getFontAscent(this.textSize, style);
            const descent = font.getFontDescent(this.textSize, style);
            if (Number.isFinite(ascent) && ascent > 0 &&
                Number.isFinite(descent) && descent >= 0) {
                return { ascent, descent };
            }
        } catch (_) {}
        return { ascent: this.textSize * 0.8, descent: this.textSize * 0.2 };
    }

    /**
     * Draw checkbox using loaded images
     */
    drawWithImages() {
        const port = this.getPort();
        const viewArea = this.getViewArea();
        
        const imageIndex = this.checked ? CBImages.CLOSED : CBImages.OPEN;
        const image = this.mpCheckboxImages[imageIndex];
        
        if (image) {
            // Calculate checkbox size (assume square)
            const checkboxSize = Math.min(viewArea.height(), 20); // Standard checkbox size
            const checkboxRect = new pdg.Rect(viewArea.left, viewArea.top, checkboxSize, checkboxSize);
            
            port.drawImage(image, checkboxRect.leftTop(), checkboxRect);
        }
    }

    /**
     * Draw standard checkbox without images
     */
    drawStandardCheckbox() {
        const port = this.getPort();
        const viewArea = this.getViewArea();
        
        // Calculate checkbox size (assume square)
        const checkboxSize = Math.min(viewArea.height(), 20); // Standard checkbox size
        const checkboxRect = new pdg.Rect(viewArea.left, viewArea.top, checkboxSize, checkboxSize);
        
        // Choose colors based on state
        let borderColor, fillColor, checkColor;
        
        if (!this.isEnabled()) {
            borderColor = new pdg.Color(0.5, 0.5, 0.5, 1.0); // Gray
            fillColor = new pdg.Color(0.8, 0.8, 0.8, 1.0);
            checkColor = new pdg.Color(0.6, 0.6, 0.6, 1.0);
        } else {
            borderColor = new pdg.Color(0.2, 0.2, 0.2, 1.0); // Dark gray
            fillColor = new pdg.Color(1.0, 1.0, 1.0, 1.0); // White
            checkColor = new pdg.Color(0.0, 0.0, 0.0, 1.0); // Black
        }
        
        // Draw checkbox background
        var backgroundAttrs = new pdg.Attributes().fillColor(fillColor);
        port.drawRect(checkboxRect, backgroundAttrs);
        
        // Draw checkbox border
        var borderAttrs = new pdg.Attributes().lineColor(borderColor).lineThickness(1);
        port.drawRect(checkboxRect, borderAttrs);
        
        // Draw checkmark if checked
        if (this.checked) {
            this.drawCheckmark(checkboxRect, checkColor);
        }
    }

    /**
     * Draw checkmark inside checkbox
     * @param {Rect} checkboxRect - Checkbox rectangle
     * @param {Object} color - Checkmark color
     */
    drawCheckmark(checkboxRect, color) {
        const port = this.getPort();
        const line = new pdg.Attributes().lineColor(color).lineThickness(2);
        
        // Draw a simple checkmark using lines
        const margin = 3;
        const left = checkboxRect.left + margin;
        const right = checkboxRect.right - margin;
        const top = checkboxRect.top + margin;
        const bottom = checkboxRect.bottom - margin;
        const centerX = checkboxRect.left + checkboxRect.width() / 2;
        const centerY = checkboxRect.top + checkboxRect.height() / 2;
        
        // Draw checkmark as two lines forming a check
        // First line: from bottom-left to center
        port.drawLine(
            new pdg.Point(left, centerY + 2),
            new pdg.Point(centerX - 1, bottom - 1),
            line
        );
        
        // Second line: from center to top-right
        port.drawLine(
            new pdg.Point(centerX - 1, bottom - 1),
            new pdg.Point(right, top),
            line
        );
    }

    /**
     * Draw checkbox text
     */
    drawText(checkboxSize, baseline, textColor = null) {
        if (!this.string) return;
        
        const port = this.getPort();
        const viewArea = this.getViewArea();
        
        // Calculate text position (to the right of checkbox)
        const textX = viewArea.left + checkboxSize + SPACE_BETWEEN_BOX_AND_TEXT;
        const textY = viewArea.top + baseline;
        
        textColor = textColor || (this.isEnabled() ?
            new pdg.Color(0.0, 0.0, 0.0, 1.0) : // Black
            new pdg.Color(0.5, 0.5, 0.5, 1.0));  // Gray
        
        // Draw text
        port.drawText(this.string, new pdg.Point(textX, textY), new pdg.Attributes()
            .textSize(this.textSize).textStyle(getCheckboxTextStyle()).fillColor(textColor));
    }

    /**
     * Calculate clickable areas
     */
    calcClickableAreas() {
        const viewArea = this.getViewArea();
        this.removeClickablePart(CheckboxClickIDs.CLICK_ID_CHECKBOX);
        this.addClickablePart(new pdg.Rect(0, 0, viewArea.width(), viewArea.height()),
            CheckboxClickIDs.CLICK_ID_CHECKBOX);
    }

    /**
     * Check if checkbox is checked
     * @returns {boolean} true if checked
     */
    isChecked() {
        return this.checked;
    }

    /**
     * Set checked state
     * @param {boolean} checked - Whether checkbox is checked
     */
    setChecked(checked) {
        if (this.checked !== checked) {
            this.checked = checked;
        }
    }

    /**
     * Toggle checked state
     */
    toggle() {
        this.setChecked(!this.checked);
    }

    /**
     * Set checkbox text
     * @param {string} str - Text to display
     */
    setString(str) {
        this.string = str || '';
        if (!this.string) return;

        const port = this.getPort();
        const style = getCheckboxTextStyle();
        const metrics = this.getTextMetrics(port);
        const normal = this.attributes.state(ControlState.Normal);
        const image = normal.hasImage ? normal.image : null;
        const imageWidth = image
            ? (typeof image.width === 'function' ? image.width() : image.width) : 0;
        const imageHeight = image
            ? (typeof image.height === 'function' ? image.height() : image.height) : 0;
        const boxWidth = image ? imageWidth : Math.max(1, Math.round(metrics.ascent));
        const boxHeight = image ? imageHeight : boxWidth;
        const textWidth = port.getTextWidth(this.string, this.textSize, style);
        const newClickArea = new pdg.Rect(this.getViewArea());
        newClickArea.bottom = newClickArea.top + Math.max(
            boxHeight, Math.ceil(metrics.ascent + metrics.descent) + SPACE_UP_FROM_BOTTOM);
        newClickArea.right = newClickArea.left + boxWidth
            + SPACE_BETWEEN_BOX_AND_TEXT + textWidth;
        this.setViewArea(newClickArea);
        this.calcClickableAreas();
    }

    /**
     * Get checkbox text
     * @returns {string} Current text
     */
    getString() {
        return this.string;
    }

    /**
     * Set text size
     * @param {number} pointSize - Text size in points
     */
    setTextSize(pointSize) {
        this.textSize = pointSize;
    }

    /**
     * Get text size
     * @returns {number} Current text size
     */
    getTextSize() {
        return this.textSize;
    }

    /**
     * Handle click
     * @param {number} part - Clicked part
     */
    doClick(part) {
        if (part === CheckboxClickIDs.CLICK_ID_CHECKBOX) {
            this.toggle();
            
            this.attributes.playClick();
        }
    }

    /**
     * Handle left click
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doLeftClick(mouseInfo, id, part) {
        if (this.isEnabled()) {
            this.doClick(part);
            return true;
        }
        return false;
    }

    /**
     * Set click sound
     * @param {Sound} clickSound - Sound to play when clicked
     */
    setClickSound(clickSound) {
        this.attributes.clickSound(clickSound);
    }

    /**
     * Get click sound
     * @returns {Sound} Current click sound
     */
    getClickSound() {
        return this.attributes.getClickSound();
    }

    setAttributes(attributes) {
        this.attributes.merge(attributes);
        this.calcClickableAreas();
    }

    getAttributes() {
        return this.attributes;
    }

    /**
     * Set enabled state and redraw
     * @param {boolean} enabled - Whether checkbox is enabled
     */
    setEnabled(enabled) {
        super.setEnabled(enabled);
    }

    /**
     * Cleanup when checkbox is destroyed
     */
    destroy() {
        // Clean up images
        for (let i = 0; i < CBImages.NUM_CHECKBOX_IMAGES; i++) {
            if (this.mpCheckboxImages[i]) {
                // In C++, this would call image->release()
                this.mpCheckboxImages[i] = null;
            }
        }
        
        // Clean up sound
        this.attributes = new ControlAttributes();
    }
}

module.exports = {
    Checkbox,
    CheckboxClickIDs,
    CBImages
};
