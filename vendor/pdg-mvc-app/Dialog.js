// -----------------------------------------------
// Dialog.js
// 
// JavaScript port of the Dialog UI component
// A modal dialog controller with OK/Cancel buttons
//
// Ported from C++ by Assistant, 2024
// Original Copyright (c) 2004-2012, Dream Rock Studios, LLC
// -----------------------------------------------

const { Controller } = require('./Controller');
const { View } = require('./View');
const { ControlState, ControlType } = require('./ControlAttributes');

const DIALOG_BACKGROUND_VIEW_ID = -100;

class DialogBackgroundView extends View {
    constructor(dialog, area, attributes) {
        super(dialog, area);
        this.attributes = attributes;
        this.setID(DIALOG_BACKGROUND_VIEW_ID);
        const backgroundArea = this.getViewArea();
        backgroundArea.left -= 1;
        backgroundArea.top -= 1;
        backgroundArea.right += 1;
        backgroundArea.bottom += 1;
        this.addClickablePart(new pdg.Rect(0, 0,
            backgroundArea.width(), backgroundArea.height()), 1);
    }

    drawSelf(port) {
        const normal = this.attributes.state(ControlState.Normal);
        if (normal.hasDrawRoutine || normal.hasImage || normal.hasDrawing) {
            this.attributes.draw(port, this.getViewArea(), ControlState.Normal);
            return;
        }
        port.drawRect(this.getViewArea(), new pdg.Attributes()
            .fillColor(new pdg.Color(1, 1, 1, 1)));
        port.drawRect(this.getViewArea(), new pdg.Attributes()
            .lineColor(new pdg.Color(0, 0, 0, 1)).lineThickness(1));
    }
}

/**
 * Dialog result constants
 */
const DialogResult = {
    kCancelled: true,
    kAccepted: false
};

/**
 * Dialog flags
 */
const DialogFlags = {
    dialog_Centered: 1 << 0,
    dialog_CreateBackground: 1 << 1,
    dialog_ReservedFlag: 1 << 2,
    dialog_NonModal: 1 << 3,
    dialog_Standard: (1 << 0) | (1 << 1) // dialog_Centered | dialog_CreateBackground
};

/**
 * Dialog UI component that extends Controller
 * A Dialog expects to only have two buttons, ok and cancel, although they can be named however
 * you want. The cancel button is not required, but if it is provided it will have a key 
 * equivalent of <esc>. The <enter> key always acts as an ok button. Both OK and Cancel will call
 * the doClose() method, which will dismiss the dialog.
 */
class Dialog extends Controller {
    constructor(parentController, width, height, flags = DialogFlags.dialog_Standard, 
                okButtonId, cancelButtonId = -1) {
        
        if (!parentController) {
            throw new Error("Parent controller is required");
        }

        // Create with key press events enabled
        super(parentController, null, null, true, true, true, false, true);
        
        this.buttonWithMouseDown = null;
        this.okButtonId = okButtonId;
        this.cancelButtonId = cancelButtonId;
        this.flags = flags;
        this.viewVisibilitySave = null;
        this.parentController = parentController;
        this.dialogRect = new pdg.Rect(0, 0, width, height);
        this.backgroundView = null;
        
        // Calculate dialog position
        this._calculateDialogPosition();
        
        // Create background if requested
        if (flags & DialogFlags.dialog_CreateBackground) {
            this._createBackground();
        }
        
        parentController.childActivated(this);
        if (!(flags & DialogFlags.dialog_NonModal)) {
            parentController.setActive(false);
        }
    }

    /**
     * Calculate dialog position based on flags
     * @private
     */
    _calculateDialogPosition() {
        const port = this.port;
        const drawingArea = port.getDrawingArea();
        const width = this.dialogRect.width();
        const height = this.dialogRect.height();
        const left = drawingArea.left + (drawingArea.width() - width) / 2;
        const top = (this.flags & DialogFlags.dialog_Centered)
            ? drawingArea.top + (drawingArea.height() - height) / 2
            : drawingArea.top + (drawingArea.height() - height) / 3;
        
        this.dialogRect.left = left;
        this.dialogRect.top = top;
        this.dialogRect.right = left + width;
        this.dialogRect.bottom = top + height;
    }

    /**
     * Create dialog background view
     * @private
     */
    _createBackground() {
        const attributes = this.parentController.getTopController()
            .getControlAttributes(ControlType.Dialog);
        this.backgroundView = new DialogBackgroundView(this, this.dialogRect, attributes);
    }

    /**
     * Handle mouse down event
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view that was clicked
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doMouseDown(mouseInfo, view, id, part) {
        // Check if this is a button click
        if (view && typeof view.setClickState === 'function') {
            // This is likely a button
            view.setClickState(true);
            this.buttonWithMouseDown = view;
        }

        // Modal dialogs swallow all mouse-down events, including clicks
        // outside their background, just like the C++ Dialog controller.
        return true;
    }

    /**
     * Handle mouse up event
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view that was clicked
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doMouseUp(mouseInfo, view, id, part) {
        // Check if this is a button release
        if (this.buttonWithMouseDown) {
            this.buttonWithMouseDown.setClickState(false);
            this.buttonWithMouseDown = null;
        }
        // Allow Controller.onMouseUp() to follow with doLeftClick().
        return false;
    }

    /**
     * Handle left click event
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view that was clicked
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doLeftClick(mouseInfo, view, id, part) {
        // Check if this is the OK button
        if (id === this.okButtonId) {
            this.doClose(DialogResult.kAccepted);
            return true;
        }
        
        // Check if this is the Cancel button
        if (this.cancelButtonId !== -1 && id === this.cancelButtonId) {
            this.doClose(DialogResult.kCancelled);
            return true;
        }
        
        // Dialog background and non-button views still consume the click.
        return true;
    }

    /**
     * Handle key press event
     * @param {Object} keyPressInfo - Key press information
     * @param {View} view - The view that has focus
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doKeyPress(keyPressInfo, view, id, part) {
        // Handle Enter key as OK
        if (keyPressInfo.keyCode === 13 || keyPressInfo.key === 'Enter') { // Enter key
            this.doClose(DialogResult.kAccepted);
            return true;
        }
        
        // Handle Escape key as Cancel
        if (keyPressInfo.keyCode === 27 || keyPressInfo.key === 'Escape') { // Escape key
            if (this.cancelButtonId !== -1) {
                this.doClose(DialogResult.kCancelled);
                return true;
            }
        }
        
        return false;
    }

    /**
     * Handle port resize
     * @param {Port} resizedPort - The port that was resized
     */
    portWasResized(resizedPort) {
        const oldTopLeft = this.dialogRect.leftTop();
        this._calculateDialogPosition();
        const dx = this.dialogRect.left - oldTopLeft.x;
        const dy = this.dialogRect.top - oldTopLeft.y;
        for (const viewPair of this.views) {
            const area = viewPair.first.getViewArea();
            area.moveRight(dx);
            area.moveDown(dy);
        }
        this.cachedPortDrawingArea = resizedPort.getDrawingArea();
    }

    /**
     * Close the dialog
     * @param {boolean} cancelled - Whether the dialog was cancelled
     */
    doClose(cancelled) {
        const parent = this.parentController;
        if (!parent) return;
        // Notify parent controller that we're trying to close
        if (parent.attemptChildClose(this, cancelled)) {
            // Parent allows us to close
            this._dismissDialog();
        }
        // If parent doesn't allow us to close, we stay open
    }

    /**
     * Dismiss the dialog
     * @private
     */
    _dismissDialog() {
        const parent = this.parentController;
        if (parent) parent.removeChild(this);
        this.destroy();
        this.parentController = null;
        if (parent && !(this.flags & DialogFlags.dialog_NonModal)) {
            parent.setActive(true);
        }
    }

    /**
     * Show dialog after it was hidden
     */
    showDialog() {
        if (this.viewVisibilitySave) {
            // Restore view visibility
            for (let i = 0; i < this.views.length; i++) {
                const view = this.views[i].first;
                view.visible = this.viewVisibilitySave[i];
                if (view.visible) {
                    view.show();
                }
            }
            this.viewVisibilitySave = null;
        }
        
        this.setActive(true);
        this.redrawAll();
    }

    /**
     * Hide dialog from view but don't close it
     */
    hideDialog() {
        if (!this.viewVisibilitySave) {
            // Save current view visibility
            this.viewVisibilitySave = new Array(this.views.length);
            for (let i = 0; i < this.views.length; i++) {
                const view = this.views[i].first;
                this.viewVisibilitySave[i] = view.visible;
                view.hide();
            }
        }
        
        this.setActive(false);
    }

    /**
     * Check if dialog is visible
     * @returns {boolean} true if visible
     */
    isVisible() {
        return this.viewVisibilitySave === null;
    }

    /**
     * Set dialog position and size
     * @param {Rect} dialogRect - New dialog rectangle
     */
    setDialogRect(dialogRect) {
        this.dialogRect = new pdg.Rect(dialogRect);
        this._calculateDialogPosition();
    }

    /**
     * Get dialog position and size
     * @returns {Rect} Dialog rectangle
     */
    getDialogRect() {
        return this.dialogRect;
    }

    /**
     * Get OK button ID
     * @returns {number} OK button ID
     */
    getOkButtonId() {
        return this.okButtonId;
    }

    /**
     * Get Cancel button ID
     * @returns {number} Cancel button ID
     */
    getCancelButtonId() {
        return this.cancelButtonId;
    }

    /**
     * Get dialog flags
     * @returns {number} Dialog flags
     */
    getFlags() {
        return this.flags;
    }

    /**
     * Check if dialog is modal
     * @returns {boolean} true if modal
     */
    isModal() {
        return !(this.flags & DialogFlags.dialog_NonModal);
    }

    /**
     * Check if dialog is centered
     * @returns {boolean} true if centered
     */
    isCentered() {
        return !!(this.flags & DialogFlags.dialog_Centered);
    }

    /**
     * Handle child activation
     * @param {Controller} child - The child controller that was activated
     */
    childActivated(child) {
        // Dialog doesn't typically have children, but handle it if needed
        super.childActivated(child);
    }

    /**
     * Cleanup when dialog is destroyed
     */
    destroy() {
        // Clean up button reference
        this.buttonWithMouseDown = null;
        
        // Clean up visibility save array
        this.viewVisibilitySave = null;
        
        // Call parent cleanup
        super.destroy();
    }
}

module.exports = {
    Dialog,
    DialogBackgroundView,
    DIALOG_BACKGROUND_VIEW_ID,
    DialogResult,
    DialogFlags
};
