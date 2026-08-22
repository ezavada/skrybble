// -----------------------------------------------
// TouchController.js
// 
// JavaScript port of the TouchController class
// A controller that handles touch gestures and flicking
//
// Ported from C++ by Assistant, 2024
// Original Copyright (c) 2010, Dream Rock Studios, LLC
// -----------------------------------------------

const { ModalController } = require('./ModalController');

// Flick decay configuration
const FLICK_DECAY_FACTOR = 3.0;
const FLICK_MAX_MOUSE_UNMOVED_MS = 200;
const FLICK_FRAME_RATE = 16;

/**
 * TouchController that extends ModalController
 * Provides touch gesture recognition including tap, flick, swipe, and pinch
 */
class TouchController extends ModalController {
    constructor(parentController, wantKeyUpDown = true, wantKeyPress = true, 
                wantMouseEnterLeave = true, wantAll = false) {
        
        super(parentController, wantKeyUpDown, wantKeyPress, wantMouseEnterLeave, wantAll);
        
        // Touch state
        this.mouseDown = false;
        this.lastMousePositionRecorded = false;
        this.lastMousePosition = new Point(0, 0);
        this.mouseDownInfo = null;
        
        // Flick state
        this.flickVelocity = { x: 0.0, y: 0.0 };
        this.flickView = null;
        this.snapbackView = null;
        this.flickPart = -1;
        this.flickID = -1;
        this.snapbackID = -1;
        this.snapbackPart = -1;
        this.lastMovedMs = 0;
        this.lastSnapbackMs = 0;
        this.lastMouseUpMs = 0;
        
        // Touch tracking
        this.touchStartPoint = new Point(0, 0);
        this.touchStartTime = 0;
        this.touchMovePoints = [];
        this.multiTouchPoints = [];
        this.gestureRecognized = false;
        
        // Store event handler references for cleanup
        this.eventHandlers = [];
        
        // Register for timer events for flick animation - use more JavaScript-idiomatic on*() event method
        this.eventHandlers.push(pdg.onTimer((eventData) => this.handleEvent('eventType_Timer', eventData)));
    }

    /**
     * Handle mouse down with touch behavior
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view that was clicked
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doMouseDown(mouseInfo, view, id, part) {
        this.mouseDown = true;
        this.lastMousePositionRecorded = true;
        this.lastMousePosition = new Point(mouseInfo.mousePos.x, mouseInfo.mousePos.y);
        this.mouseDownInfo = { ...mouseInfo };
        
        // Record touch start
        this.touchStartPoint = new Point(mouseInfo.mousePos.x, mouseInfo.mousePos.y);
        this.touchStartTime = Date.now();
        this.touchMovePoints = [new Point(mouseInfo.mousePos.x, mouseInfo.mousePos.y)];
        this.gestureRecognized = false;
        
        // Stop any existing flick
        this.stopFlick();
        
        // Call parent implementation
        return super.doMouseDown(mouseInfo, view, id, part);
    }

    /**
     * Handle mouse up with touch behavior
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view that was clicked
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doMouseUp(mouseInfo, view, id, part) {
        this.mouseDown = false;
        this.lastMouseUpMs = Date.now();
        
        // Determine if this was a tap or the start of a flick
        if (this.touchMovePoints.length > 0) {
            const touchDuration = Date.now() - this.touchStartTime;
            const distance = this.calculateDistance(this.touchStartPoint, mouseInfo.mousePos);
            
            if (touchDuration < FLICK_MAX_MOUSE_UNMOVED_MS && distance < 10) {
                // This was a tap
                this.handleTap(mouseInfo, view, id, part);
            } else if (distance > 5) {
                // This might be a flick - calculate velocity
                this.calculateFlickVelocity();
                if (this.isFlickGesture()) {
                    this.startFlick(mouseInfo, view, id, part);
                }
            }
        }
        
        // Call parent implementation
        const handled = super.doMouseUp(mouseInfo, view, id, part);
        
        // Reset touch state
        this.touchMovePoints = [];
        this.gestureRecognized = false;
        
        return handled;
    }

    /**
     * Handle mouse move with touch behavior
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view that was moved over
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     */
    doMouseMove(mouseInfo, view, id, part) {
        if (this.mouseDown && this.lastMousePositionRecorded) {
            // Calculate movement delta
            const delta = new Point(
                mouseInfo.mousePos.x - this.lastMousePosition.x,
                mouseInfo.mousePos.y - this.lastMousePosition.y
            );
            
            // Record touch move
            this.touchMovePoints.push(new Point(mouseInfo.mousePos.x, mouseInfo.mousePos.y));
            this.lastMovedMs = Date.now();
            
            // Handle touch move gesture
            if (delta.x !== 0 || delta.y !== 0) {
                this.handleTouchMove(delta, view, id, part);
            }
            
            // Update last position
            this.lastMousePosition = new Point(mouseInfo.mousePos.x, mouseInfo.mousePos.y);
        }
        
        // Call parent implementation
        super.doMouseMove(mouseInfo, view, id, part);
    }

    /**
     * Handle touch gesture
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view that was touched
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doTouch(mouseInfo, view, id, part) {
        // This is called for general touch events
        // Override in subclasses for specific touch handling
        return false;
    }

    /**
     * Handle tap gesture
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view that was tapped
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doTap(mouseInfo, view, id, part) {
        // Override in subclasses for tap handling
        return false;
    }

    /**
     * Handle touch move gesture
     * @param {Point} delta - Movement delta
     * @param {boolean} flick - Whether this is a flick gesture
     * @param {View} view - The view being touched
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doTouchMove(delta, flick, view, id, part) {
        // Override in subclasses for touch move handling
        return false;
    }

    /**
     * Handle swipe gesture
     * @param {Point} delta - Movement delta
     * @param {View} view - The view being swiped
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doSwipeMove(delta, view, id, part) {
        // Override in subclasses for swipe handling
        return false;
    }

    /**
     * Handle pinch gesture
     * @param {Point} delta1 - First finger delta
     * @param {Point} delta2 - Second finger delta
     * @param {number} distance - Distance between fingers
     * @param {number} deltaDistance - Change in distance
     * @param {View} view - The view being pinched
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doPinchMove(delta1, delta2, distance, deltaDistance, view, id, part) {
        // Override in subclasses for pinch handling
        return false;
    }

    /**
     * Handle snapback
     * @param {number} msSinceLastSnapback - Milliseconds since last snapback
     * @param {number} msSinceMouseUp - Milliseconds since mouse up
     * @param {View} view - The view snapping back
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doSnapback(msSinceLastSnapback, msSinceMouseUp, view, id, part) {
        // Override in subclasses for snapback handling
        return false;
    }

    /**
     * Handle tap gesture
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view that was tapped
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     */
    handleTap(mouseInfo, view, id, part) {
        if (view && typeof view.doTap === 'function') {
            view.doTap(mouseInfo, id, part);
        } else {
            this.doTap(mouseInfo, view, id, part);
        }
    }

    /**
     * Handle touch move
     * @param {Point} delta - Movement delta
     * @param {View} view - The view being touched
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     */
    handleTouchMove(delta, view, id, part) {
        if (view && typeof view.doTouchMove === 'function') {
            view.doTouchMove(delta, false, id, part);
        } else {
            this.doTouchMove(delta, false, view, id, part);
        }
    }

    /**
     * Calculate distance between two points
     * @param {Point} p1 - First point
     * @param {Point} p2 - Second point
     * @returns {number} Distance
     */
    calculateDistance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculate flick velocity from touch points
     */
    calculateFlickVelocity() {
        if (this.touchMovePoints.length < 2) {
            this.flickVelocity = { x: 0.0, y: 0.0 };
            return;
        }
        
        const lastPoint = this.touchMovePoints[this.touchMovePoints.length - 1];
        const prevPoint = this.touchMovePoints[this.touchMovePoints.length - 2];
        
        const dx = lastPoint.x - prevPoint.x;
        const dy = lastPoint.y - prevPoint.y;
        const dt = 1.0 / FLICK_FRAME_RATE; // Assume frame rate timing
        
        this.flickVelocity = {
            x: dx / dt,
            y: dy / dt
        };
    }

    /**
     * Check if gesture is a flick
     * @returns {boolean} true if flick
     */
    isFlickGesture() {
        const velocity = Math.sqrt(this.flickVelocity.x * this.flickVelocity.x + 
                                  this.flickVelocity.y * this.flickVelocity.y);
        return velocity > 100; // Minimum velocity threshold
    }

    /**
     * Start flick animation
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view flicking
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     */
    startFlick(mouseInfo, view, id, part) {
        this.flickView = view;
        this.flickPart = part;
        this.flickID = id;
        
        // Start flick timer
        this.app.getTimerManager().startTimer('FLICK_TIMER', FLICK_FRAME_RATE, true); // oneShot = true
        
        console.log('TouchController: Started flick animation');
    }

    /**
     * Stop flick animation
     */
    stopFlick() {
        this.app.getTimerManager().cancelTimer('FLICK_TIMER');
        this.flickView = null;
        this.flickPart = -1;
        this.flickID = -1;
        this.flickVelocity = { x: 0.0, y: 0.0 };
    }

    /**
     * Update flick animation
     */
    updateFlick() {
        if (!this.flickView || this.flickVelocity.x === 0 && this.flickVelocity.y === 0) {
            this.stopFlick();
            return;
        }
        
        // Apply flick to view
        const delta = new Point(this.flickVelocity.x * FLICK_FRAME_RATE / 1000.0, 
                               this.flickVelocity.y * FLICK_FRAME_RATE / 1000.0);
        
        if (this.flickView.doTouchMove) {
            this.flickView.doTouchMove(delta, true, this.flickID, this.flickPart);
        } else {
            this.doTouchMove(delta, true, this.flickView, this.flickID, this.flickPart);
        }
        
        // Apply decay to velocity
        this.flickVelocity.x *= (1.0 - FLICK_DECAY_FACTOR * FLICK_FRAME_RATE / 1000.0);
        this.flickVelocity.y *= (1.0 - FLICK_DECAY_FACTOR * FLICK_FRAME_RATE / 1000.0);
        
        // Stop if velocity is too low
        const velocity = Math.sqrt(this.flickVelocity.x * this.flickVelocity.x + 
                                  this.flickVelocity.y * this.flickVelocity.y);
        if (velocity < 1.0) {
            this.stopFlick();
        }
    }

    /**
     * Handle events
     * @param {string} eventType - Event type
     * @param {*} eventData - Event data
     * @returns {boolean} true if handled
     */
    handleEvent(eventType, eventData) {
        if (eventType === 'eventType_Timer') {
            if (eventData.id === 'FLICK_TIMER') {
                this.updateFlick();
                return true;
            }
        }
        
        return super.handleEvent(eventType, eventData);
    }

    /**
     * Remove view with touch cleanup
     * @param {View} view - View to remove
     */
    removeView(view) {
        // If this view is being flicked, stop the flick
        if (this.flickView === view) {
            this.stopFlick();
        }
        
        // Call parent implementation
        super.removeView(view);
    }

    /**
     * Get flick velocity
     * @returns {Object} Flick velocity {x, y}
     */
    getFlickVelocity() {
        return { ...this.flickVelocity };
    }

    /**
     * Set flick velocity
     * @param {number} x - X velocity
     * @param {number} y - Y velocity
     */
    setFlickVelocity(x, y) {
        this.flickVelocity = { x, y };
    }

    /**
     * Get touch start point
     * @returns {Point} Touch start point
     */
    getTouchStartPoint() {
        return new Point(this.touchStartPoint.x, this.touchStartPoint.y);
    }

    /**
     * Get touch move points
     * @returns {Point[]} Array of touch move points
     */
    getTouchMovePoints() {
        return this.touchMovePoints.map(p => new Point(p.x, p.y));
    }

    /**
     * Check if touch is active
     * @returns {boolean} true if touch is active
     */
    isTouchActive() {
        return this.mouseDown;
    }

    /**
     * Get touch duration
     * @returns {number} Touch duration in milliseconds
     */
    getTouchDuration() {
        return Date.now() - this.touchStartTime;
    }

    /**
     * Cleanup when touch controller is destroyed
     */
    destroy() {
        // Stop flick animation
        this.stopFlick();
        
        // Unregister timer events
        for (const handler of this.eventHandlers) {
            if (typeof handler.cancel === 'function') handler.cancel();
            else this.app.getEventManager().removeHandler(handler, pdg.eventType_Timer);
        }
        this.eventHandlers = [];
        
        // Call parent cleanup
        super.destroy();
    }
}

module.exports = {
    TouchController,
    FLICK_DECAY_FACTOR,
    FLICK_MAX_MOUSE_UNMOVED_MS,
    FLICK_FRAME_RATE
};
