// -----------------------------------------------
// Button.js
// 
// JavaScript port of the Button UI component
// A clickable button with text and images
//
// Ported from C++ by Assistant, 2024
// Original Copyright (c) 2004-2012, Dream Rock Studios, LLC
// -----------------------------------------------

const { View } = require('./View');
const { ControlAttributes, ControlState, ControlType } = require('./ControlAttributes');
const pdgDefs = require('../pdg-defs');

const MAX_BUTTON_IMAGES = 3;
const RES_DEFAULT_BUTTON_IMAGE_NAMES = ['button_default.png', 'button_pressed.png', 'button_disabled.png'];

// Keep this expression parallel with buttonTextStyle in Button.cpp, but resolve
// it at use time. PDG publishes its constants during runtime initialization.
function getButtonTextStyle() {
    const bold = Number.isFinite(pdg.textStyle_Bold)
        ? pdg.textStyle_Bold : pdgDefs.textStyle_Bold;
    const centered = Number.isFinite(pdg.textStyle_Centered)
        ? pdg.textStyle_Centered : pdgDefs.textStyle_Centered;
    return bold + centered;
}

function rectValues(rect) {
    return rect ? {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom
    } : null;
}

function colorValues(color) {
    return color ? {
        red: color.red,
        green: color.green,
        blue: color.blue,
        alpha: color.alpha
    } : null;
}

// FIXME: this breaks when run under pdg, but is needed for node
// const pdg = require('pdg'); // uncomment this to run under node

/**
 * Button UI component that extends View
 */
class Button extends View {
    constructor(controller, frameOrPoint, buttonID, resourceTextID = -1,
                substring = -1, imageNames = null, styleId = -1) {
        
        let rect;
        if (frameOrPoint instanceof pdg.Point) {
            // Make button size match image
            rect = new pdg.Rect(frameOrPoint.x, frameOrPoint.y, 0, 0);
        } else {
            // Make button size match rectangle
            rect = frameOrPoint;
        }

        super(controller, rect);

        if (typeof imageNames === 'number') {
            styleId = imageNames;
            imageNames = null;
        }
        
        this.resMgr = controller.getApplication().getResourceManager();
        this.buttonImage = new Array(MAX_BUTTON_IMAGES).fill(null);
        this.attributes = new ControlAttributes();
        this.text = '';
        this.buttonID = buttonID;
        this.imageNames = imageNames;
        this.styleId = styleId;
        this.isButtonPressed = false;
        this.isHovered = false;
        
        // Tooltip support
        this.isToolTipEnabled = false;
        this.toolTipCtrl = null;
        this.nHasChangedAreaHit = 0;
        this.textBaselineCenterPoint = new pdg.Point(0, 0);
        this.buttonTextSize = 14;
        this.textDrawDiagnosticCount = 0;
        this.lastTextMetrics = null;
        
        this.initializeButton(resourceTextID, substring);
        this.finishInitButton();
    }

    /**
     * Initialize button with text from resources
     * @param {number} resourceTextID - Resource ID for text
     * @param {number} substring - Substring index
     */
    initializeButton(resourceTextID, substring) {
        if (resourceTextID !== -1) {
            this.setTextFromResource(resourceTextID, substring);
        }
    }

    /**
     * Finish button initialization
     */
    finishInitButton() {
        this.attributes
            .stateAttributes(ControlState.Normal, new pdg.Attributes()
                .fillColor(new pdg.Color(1, 207 / 255, 82 / 255, 1))
                .lineColor(new pdg.Color(0, 0, 0, 1)).roundedCorners(7))
            .stateAttributes(ControlState.Hovered, new pdg.Attributes()
                .fillColor(new pdg.Color(1, 220 / 255, 120 / 255, 1))
                .lineColor(new pdg.Color(0, 0, 0, 1)).roundedCorners(7))
            .stateAttributes(ControlState.Pressed, new pdg.Attributes()
                .fillColor(new pdg.Color(1, 239 / 255, 173 / 255, 1))
                .lineColor(new pdg.Color(0, 0, 0, 1)).roundedCorners(7))
            .stateAttributes(ControlState.Disabled, new pdg.Attributes()
                .fillColor(new pdg.Color(0.8, 0.8, 0.8, 1.0))
                .lineColor(new pdg.Color(0.6, 0.6, 0.6, 1.0)).roundedCorners(7))
            .stateForeground(ControlState.Normal, new pdg.Color(1, 1, 1, 1))
            .stateForeground(ControlState.Pressed, new pdg.Color(1, 1, 1, 1))
            .stateForeground(ControlState.Disabled, new pdg.Color(0.7, 0.7, 0.7, 1));
        this.attributes.merge(this.controller.getTopController()
            .getControlAttributes(ControlType.Button, this.styleId));
        if (this.imageNames) {
            this.loadImages();
            this.attributes
                .stateImage(ControlState.Normal, this.buttonImage[0])
                .stateImage(ControlState.Pressed, this.buttonImage[1])
                .stateImage(ControlState.Disabled, this.buttonImage[2]);
        }
        this.setWantsMouseOvers(true); // Enable mouse over events for tooltips
        this.updateLayout();
    }

    updateLayout() {
        this.removeClickablePart(this.buttonID);
        this.addClickablePart(new pdg.Rect(0, 0,
            this.getViewArea().width(), this.getViewArea().height()), this.buttonID);

        const height = this.getViewArea().height();
        this.buttonTextSize = Math.trunc(height / 2 - 1);
        this.textBaselineCenterPoint.x = this.getViewArea().width() / 2;
        this.hasValidTextMetrics = this._updateTextBaseline(this.getPort());
    }

    _updateTextBaseline(port) {
        const style = getButtonTextStyle();
        const height = this.getViewArea().height();
        const fallback = Math.round(
            (height - this.buttonTextSize) * 0.5 + this.buttonTextSize * 0.8) + 1;
        this.textBaselineCenterPoint.y = fallback;
        this.lastTextMetrics = {
            style,
            size: this.buttonTextSize,
            ascent: null,
            descent: null,
            baseline: fallback,
            valid: false
        };
        if (!port || typeof port.getCurrentFont !== 'function') return false;

        try {
            const font = port.getCurrentFont(style);
            const ascent = font && font.getFontAscent(this.buttonTextSize, style);
            const descent = font && font.getFontDescent(this.buttonTextSize, style);
            this.lastTextMetrics.ascent = ascent;
            this.lastTextMetrics.descent = descent;
            if (!Number.isFinite(ascent) || ascent <= 0 ||
                !Number.isFinite(descent) || descent < 0) return false;

            // This is the same baseline calculation used by Button.cpp.
            const measured = Math.round(
                (height - ascent - descent) * 0.5 + ascent) + 1;
            if (measured < this.buttonTextSize || measured > height) return false;
            this.textBaselineCenterPoint.y = measured;
            this.lastTextMetrics.baseline = measured;
            this.lastTextMetrics.valid = true;
            return true;
        } catch (error) {
            this.lastTextMetrics.error = error && error.message;
            return false;
        }
    }

    /**
     * Set button text
     * @param {string} text - Button text
     */
    setText(text) {
        this.text = text || '';
    }

    /**
     * Set text from resource
     * @param {number} resourceID - Resource ID
     * @param {number} substring - Substring index
     */
    setTextFromResource(resourceID, substring) {
        try {
            const text = this.resMgr.getString(resourceID, substring);
            this.setText(text);
        } catch (error) {
            console.warn(`Failed to load text from resource ${resourceID}:`, error);
            this.setText('');
        }
    }

    /**
     * Set click sound
     * @param {Sound} clickSound - Sound to play when clicked
     */
    setClickSound(clickSound) {
        this.attributes.clickSound(clickSound);
    }

    setAttributes(attributes) {
        this.attributes.merge(attributes);
    }

    getAttributes() {
        return this.attributes;
    }

    /**
     * Load button images
     */
    loadImages() {
        for (let i = 0; i < MAX_BUTTON_IMAGES; i++) {
            this.buttonImage[i] = null;
        }
        if (this.imageNames !== null && this.imageNames.length > 2) {
            try {
                for (let i = 0; i < MAX_BUTTON_IMAGES; i++) {
                    this.buttonImage[i] = this.resMgr.getImage(this.imageNames[i]);
                }
            } catch (error) {
                console.warn(`Failed to load button images for ID ${this.imageNames}:`, error);
            }
        }
    }

    /**
     * Draw the button
     */
    drawSelf(port, frameNum) {
        const state = !this.isEnabled() ? ControlState.Disabled
            : (this.isButtonPressed ? ControlState.Pressed
                : (this.isHovered ? ControlState.Hovered : ControlState.Normal));
        this.attributes.draw(port, this.getViewArea(), state);
        
        // Draw text if present
        if (this.text) {
            this.drawText(port, state);
        }
    }

    /**
     * Draw button using loaded images
     */
    drawWithImages(port) {
        const viewArea = this.getViewArea();
        
        let imageIndex = 0; // Default/normal state
        if (this.isButtonPressed) {
            imageIndex = 1; // Pressed state
        } else if (!this.isEnabled()) {
            imageIndex = 2; // Disabled state
        }
        
        const image = this.buttonImage[imageIndex];
        if (image) {
            port.drawImage(image, viewArea.leftTop(), viewArea);
        }
    }

    /**
     * Draw standard button background
     */
    drawStandardButtonBackground(port) {
        const viewArea = this.getViewArea();
        
        // Choose colors based on state
        let bgColor, borderColor, textColor;
        
        if (!this.isEnabled()) {
            bgColor = new pdg.Color(0.7, 0.7, 0.7, 1.0); // Gray
            borderColor = new pdg.Color(0.5, 0.5, 0.5, 1.0);
            textColor = new pdg.Color(0.4, 0.4, 0.4, 1.0);
        } else         if (this.isButtonPressed) {
            bgColor = new pdg.Color(0.6, 0.6, 0.8, 1.0); // Darker blue
            borderColor = new pdg.Color(0.2, 0.2, 0.4, 1.0);
            textColor = new pdg.Color(1.0, 1.0, 1.0, 1.0);
        } else {
            bgColor = new pdg.Color(0.8, 0.8, 0.9, 1.0); // Light blue
            borderColor = new pdg.Color(0.3, 0.3, 0.5, 1.0);
            textColor = new pdg.Color(0.0, 0.0, 0.0, 1.0);
        }
        
        // Draw background
        var backgroundAttrs = new pdg.Attributes().fillColor(bgColor);
        port.drawRect(viewArea, backgroundAttrs);
        
        // Draw border
        var borderAttrs = new pdg.Attributes().lineColor(borderColor).lineThickness(2);
        port.drawRect(viewArea, borderAttrs);
        
        // Store text color for text drawing
        this.textColor = textColor;
    }

    /**
     * Draw button text
     */
    drawText(port, state = ControlState.Normal) {
        if (!this.text) return;
        if (!this.hasValidTextMetrics) {
            this.hasValidTextMetrics = this._updateTextBaseline(port);
        }
        
        const viewArea = this.getViewArea();
        
        // Calculate text position (centered)
        const visual = this.attributes.state(state);
        const normal = this.attributes.state(ControlState.Normal);
        const textColor = visual.hasForeground ? visual.foreground
            : (normal.hasForeground ? normal.foreground : new pdg.Color(0, 0, 0, 1));
        const baseline = this.localToGlobal(this.textBaselineCenterPoint);
        const textPoint = new pdg.Point(baseline.x, baseline.y);
        const textStyle = getButtonTextStyle();
        const textAttributes = new pdg.Attributes()
            .textSize(this.buttonTextSize).textStyle(textStyle).fillColor(textColor);

        const diagnosticOptions = global.PDG_CONTROL_DRAW_DIAGNOSTICS;
        const diagnosticLimit = diagnosticOptions && diagnosticOptions.maxDrawsPerButton || 0;
        if (this.textDrawDiagnosticCount < diagnosticLimit) {
            this.textDrawDiagnosticCount++;
            let clipRect = null;
            try { clipRect = port.getClipRect(); } catch (_) {}
            console.log('[Button.drawText] ' + JSON.stringify({
                draw: this.textDrawDiagnosticCount,
                buttonID: this.buttonID,
                text: this.text,
                localBaseline: {
                    x: this.textBaselineCenterPoint.x,
                    y: this.textBaselineCenterPoint.y
                },
                drawPoint: { x: textPoint.x, y: textPoint.y },
                viewArea: rectValues(viewArea),
                clipRect: rectValues(clipRect),
                requested: {
                    textSize: this.buttonTextSize,
                    textStyle,
                    fillColor: colorValues(textColor)
                },
                attributes: {
                    textSize: textAttributes.getTextSize(),
                    textStyle: textAttributes.getTextStyle(),
                    fillColor: colorValues(textAttributes.getFillColor())
                },
                fontMetrics: this.lastTextMetrics
            }));
        }
        
        // Draw text centered
        try {
            port.drawText(this.text, textPoint, textAttributes);
        } catch (error) {
            console.error('[Button.drawText] drawText rejected the logged arguments:', error);
            throw error;
        }
    }

    /**
     * Set click state
     * @param {boolean} clicked - Whether button is clicked/pressed
     */
    setClickState(clicked) {
        this.isButtonPressed = clicked;
    }

    /**
     * Handle mouse down
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doMouseDown(mouseInfo, id, part) {
        if (part === this.buttonID && this.isEnabled()) {
            this.setClickState(true);
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
        if (this.isButtonPressed) {
            this.setClickState(false);
        }
        return false;
    }

    /**
     * Handle left click
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doLeftClick(mouseInfo, id, part) {
        if (part === this.buttonID && this.isEnabled()) {
            this.attributes.playClick();
            // Notify controller that button was clicked
            const controller = this.controller;
            if (controller && typeof controller.buttonClicked === 'function') {
                controller.buttonClicked(this.buttonID, this);
            }
            return true;
        }
        return false;
    }

    // ============================ Tooltip Support ============================

    /**
     * Show tooltip
     * @param {number} nArea - Area number
     * @param {Point} pts - Point position
     * @param {Rect} rToolRect - Tooltip rectangle
     */
    showToolTip(nArea, pts, rToolRect) {
        if (this.isToolTipEnabled && this.toolTipCtrl) {
            // Implementation would show tooltip
            console.log(`Showing tooltip for button ${this.buttonID}`);
        }
    }

    /**
     * Check if mouse is in tool area
     * @param {Point} pts - Point position
     * @param {Rect} rToolRect - Tooltip rectangle
     * @returns {boolean} true if mouse is in tool area
     */
    isMouseInToolArea(pts, rToolRect) {
        return rToolRect.contains(pts);
    }

    /**
     * Set tooltip text
     * @param {string} text - Tooltip text
     */
    setToolTipText(text) {
        this.isToolTipEnabled = true;
        // In a real implementation, you would create or update the tooltip control
        console.log(`Setting tooltip text for button ${this.buttonID}: ${text}`);
    }

    /**
     * Handle mouse move (for tooltips)
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     */
    doMouseMove(mouseInfo, id, part) {
        if (!this.isHovered) this.isHovered = true;
        if (this.isToolTipEnabled) {
            // Check if we should show tooltip
            const viewArea = this.getViewArea();
            if (this.isMouseInToolArea(mouseInfo.mousePos, viewArea)) {
                this.showToolTip(part, mouseInfo.mousePos, viewArea);
            }
        }
    }

    doMouseEnter(mouseInfo, id, part) {
        this.isHovered = true;
    }

    /**
     * Handle mouse leave
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     */
    doMouseLeave(mouseInfo, id, part) {
        this.isHovered = false;
        // Hide tooltip when mouse leaves
        if (this.isToolTipEnabled) {
            console.log(`Hiding tooltip for button ${this.buttonID}`);
        }
    }

    /**
     * Get button ID
     * @returns {number} Button ID
     */
    getButtonID() {
        return this.buttonID;
    }

    /**
     * Get button text
     * @returns {string} Button text
     */
    getText() {
        return this.text;
    }

    /**
     * Check if button is pressed
     * @returns {boolean} true if pressed
     */
    isPressed() {
        return this.isButtonPressed;
    }

    /**
     * Set button text size
     * @param {number} size - Text size
     */
    setTextSize(size) {
        this.buttonTextSize = size;
    }

    /**
     * Cleanup when button is destroyed
     */
    destroy() {
        // Clean up images
        for (let i = 0; i < MAX_BUTTON_IMAGES; i++) {
            if (this.buttonImage[i]) {
                this.resMgr.releaseImage(this.buttonImage[i]);
                this.buttonImage[i] = null;
            }
        }
        
        // Clean up sound
        this.attributes = new ControlAttributes();
        
        // Clean up tooltip
        this.toolTipCtrl = null;
    }
}

module.exports = {
    Button,
    MAX_BUTTON_IMAGES,
    RES_DEFAULT_BUTTON_IMAGE_NAMES
};
