// -----------------------------------------------
// ModalController.js
// 
// JavaScript port of the ModalController class
// A controller that provides modal behavior
//
// Ported from C++ by Assistant, 2024
// Original Copyright (c) 2004-2012, Dream Rock Studios, LLC
// -----------------------------------------------

const { Controller } = require('./Controller');

/**
 * ModalController that extends Controller
 * Provides modal behavior where the controller captures all events
 * and prevents other controllers from receiving them
 * 
 * @param {Controller} parentController - The parent controller (all modal controllers must have a parent)
 * @param {boolean} wantKeyUpDown - Whether to want key up down events
 * @param {boolean} wantKeyPress - Whether to want key press events
 * @param {boolean} wantMouseEnterLeave - Whether to want mouse enter leave events
 * @param {boolean} wantAll - Whether to want all events
 */
class ModalController extends Controller {
    constructor(parentController, wantKeyUpDown = true, wantKeyPress = true, 
                wantMouseEnterLeave = true, wantAll = false) {
        
        if (!parentController) {
            throw new Error("Parent controller is required");
        }

        // Call parent constructor with drawInactive = false for modal behavior
        super(parentController, null, null, wantKeyUpDown, wantKeyPress, wantMouseEnterLeave, wantAll, false);
        
        this.modal = true;
        this.modalActive = true;
    }

    /**
     * Handle events with modal behavior
     * @param {string} eventType - Event type
     * @param {*} eventData - Event data
     * @returns {boolean} true if handled
     */
    handleEvent(eventType, eventData) {
        // Modal controllers always try to handle events first
        // before delegating to parent
        const handled = super.handleEvent(eventType, eventData);
        
        // If we handled the event, don't let it propagate
        if (handled) {
            return true;
        }
        
        // For modal controllers, we might want to handle some events
        // even if our views didn't handle them
        if (this.handleModalEvents(eventType, eventData)) {
            return true;
        }
        
        // Don't let events propagate to parent controllers
        // This is the key modal behavior
        return false;
    }

    /**
     * Handle modal-specific events
     * @param {string} eventType - Event type
     * @param {*} eventData - Event data
     * @returns {boolean} true if handled
     */
    handleModalEvents(eventType, eventData) {
        // Handle escape key to close modal
        if (eventType === 'eventType_KeyPress' && 
            (eventData.keyCode === 27 || eventData.key === 'Escape')) {
            this.handleEscapeKey();
            return true;
        }
        
        // Handle click outside modal area
        if (eventType === 'eventType_MouseUp') {
            const mousePoint = eventData.mousePos;
            if (!this.isPointInModalArea(mousePoint)) {
                this.handleClickOutside();
                return true;
            }
        }
        
        return false;
    }

    /**
     * Handle escape key press
     * Override to customize behavior
     */
    handleEscapeKey() {
        console.log('ModalController: Escape key pressed');
        // Default behavior - could close modal or do nothing
        // Subclasses should override this method
    }

    /**
     * Handle click outside modal area
     * Override to customize behavior
     */
    handleClickOutside() {
        console.log('ModalController: Clicked outside modal area');
        // Default behavior - could close modal or do nothing
        // Subclasses should override this method
    }

    /**
     * Check if point is in modal area
     * @param {Point} point - Point to check
     * @returns {boolean} true if point is in modal area
     */
    isPointInModalArea(point) {
        // Check if any of our views contain the point
        for (const viewPair of this.views) {
            const view = viewPair.first;
            if (view.isVisible() && view.pointInViewVisibleArea(point)) {
                return true;
            }
        }
        
        // Check if any child controllers contain the point
        for (const child of this.children) {
            if (child.isPointInModalArea && child.isPointInModalArea(point)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Set modal state
     * @param {boolean} modal - Whether controller is modal
     */
    setModal(modal) {
        this.modal = modal;
        this.modalActive = modal;
    }

    /**
     * Check if controller is modal
     * @returns {boolean} true if modal
     */
    isModal() {
        return this.modal;
    }

    /**
     * Check if modal is active
     * @returns {boolean} true if active
     */
    isModalActive() {
        return this.modalActive;
    }

    /**
     * Activate modal
     */
    activateModal() {
        this.modalActive = true;
        this.setActive(true);
        
        // Modal controllers should be on top of the controller hierarchy
        // This might involve removing from parent and adding as top-level
        console.log('ModalController: Activated modal');
    }

    /**
     * Deactivate modal
     */
    deactivateModal() {
        this.modalActive = false;
        this.setActive(false);
        
        console.log('ModalController: Deactivated modal');
    }

    /**
     * Close modal
     * This should be called to properly close a modal controller
     */
    closeModal() {
        this.deactivateModal();
        
        // Notify parent that modal is closing
        if (this.parent) {
            this.parent.attemptChildClose(this, false);
        }
        
        // Clean up
        this.destroy();
    }

    /**
     * Show modal
     * This should be called to show a modal controller
     */
    showModal() {
        this.activateModal();
    }

    /**
     * Hide modal
     * This should be called to hide a modal controller
     */
    hideModal() {
        this.deactivateModal();
    }

    /**
     * Handle mouse down with modal behavior
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view that was clicked
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doMouseDown(mouseInfo, view, id, part) {
        // Modal controllers handle all mouse events
        return super.doMouseDown(mouseInfo, view, id, part);
    }

    /**
     * Handle mouse up with modal behavior
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view that was clicked
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doMouseUp(mouseInfo, view, id, part) {
        // Modal controllers handle all mouse events
        return super.doMouseUp(mouseInfo, view, id, part);
    }

    /**
     * Handle key down with modal behavior
     * @param {Object} keyInfo - Key information
     * @param {View} view - The view that has focus
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doKeyDown(keyInfo, view, id, part) {
        // Modal controllers handle all keyboard events
        return super.doKeyDown(keyInfo, view, id, part);
    }

    /**
     * Handle key up with modal behavior
     * @param {Object} keyInfo - Key information
     * @param {View} view - The view that has focus
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doKeyUp(keyInfo, view, id, part) {
        // Modal controllers handle all keyboard events
        return super.doKeyUp(keyInfo, view, id, part);
    }

    /**
     * Handle key press with modal behavior
     * @param {Object} keyPressInfo - Key press information
     * @param {View} view - The view that has focus
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doKeyPress(keyPressInfo, view, id, part) {
        // Modal controllers handle all keyboard events
        return super.doKeyPress(keyPressInfo, view, id, part);
    }

    /**
     * Handle child close attempt with modal behavior
     * @param {Controller} child - The child controller trying to close
     * @param {boolean} cancelled - Whether the close was cancelled
     * @returns {boolean} true if the child is allowed to close
     */
    attemptChildClose(child, cancelled) {
        // Modal controllers might have special behavior for child closing
        const allowed = super.attemptChildClose(child, cancelled);
        
        if (allowed && child === this) {
            // If we're closing ourselves, deactivate modal
            this.deactivateModal();
        }
        
        return allowed;
    }

    /**
     * Add child controller with modal behavior
     * @param {Controller} child - The child controller to add
     */
    addChild(child) {
        super.addChild(child);
        
        // Child controllers of modal controllers should also be modal
        if (child.setModal && typeof child.setModal === 'function') {
            child.setModal(true);
        }
    }

    /**
     * Remove child controller with modal behavior
     * @param {Controller} child - The child controller to remove
     */
    removeChild(child) {
        super.removeChild(child);
        
        // When removing child, it's no longer modal
        if (child.setModal && typeof child.setModal === 'function') {
            child.setModal(false);
        }
    }

    /**
     * Get modal controller stack
     * @returns {ModalController[]} Array of modal controllers in order
     */
    getModalStack() {
        const stack = [];
        
        if (this.modal) {
            stack.push(this);
        }
        
        for (const child of this.children) {
            if (child.getModalStack && typeof child.getModalStack === 'function') {
                stack.push(...child.getModalStack());
            }
        }
        
        return stack;
    }

    /**
     * Check if this is the top modal controller
     * @returns {boolean} true if this is the top modal
     */
    isTopModal() {
        const stack = this.getModalStack();
        return stack.length > 0 && stack[stack.length - 1] === this;
    }

    /**
     * Cleanup when modal controller is destroyed
     */
    destroy() {
        // Deactivate modal before destroying
        this.deactivateModal();
        
        // Call parent cleanup
        super.destroy();
    }
}

module.exports = {
    ModalController
};
