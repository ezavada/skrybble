// -----------------------------------------------
// View.js
// 
// JavaScript port of the View base class
// Base class for Views with mouse/touch/gesture handling
//
// Ported from C++ by Assistant, 2024
// Original Copyright (c) 2004-2012, Dream Rock Studios, LLC
// -----------------------------------------------

/**
 * Clickable parts IDs enumeration
 */
const ClickablePartsIDs = {
    CLICKED_PART_NONE: -1
};

/**
 * View binding flags for resizing behavior
 */
const ViewBinding = {
    bind_Top: 1 << 3,      // When port shrinks or grows keep top edge of view a fixed distance from top of port
    bind_Bottom: 1 << 4,   // When port shrinks or grows keep bottom edge of view a fixed distance from bottom of port
    bind_Left: 1 << 5,     // When port shrinks or grows keep left edge of view a fixed distance from left side of port
    bind_Right: 1 << 6,    // When port shrinks or grows keep right edge of view a fixed distance from right side of port
    grow_Horz: (1 << 5) | (1 << 6),  // Keep fixed distance from left and right of port, growing or shrinking view horizontally as needed
    grow_Vert: (1 << 3) | (1 << 4),  // Keep fixed distance from top and bottom of port, growing or shrinking view vertically as needed
    grow: (1 << 3) | (1 << 4) | (1 << 5) | (1 << 6)  // Keep fixed margins from the port edges, growing or shrinking as needed
};

/**
 * Base View class
 * Manages view area, drawing, and input handling
 */
class View {
    constructor(controller, rect, binding = 0) {        
        if (!controller) {
            throw new Error("Controller is required");
        }

        this.controller = controller;
        this.port = controller.port;
        this.visible = true;
        this.enabled = true;
        this.binding = binding;
        this.id = 0;
        
        this.setViewArea(rect);
        this.setMinSize(0, 0);
        this.setMaxSize(0, 0);

        // Clickable parts management
        this.clickableParts = [];
        
        // Drag and mouse over support
        this.isDraggable = false;
        this.wantsMouseOvers = false;
        
        // Size constraints
        this.minWidth = 0;
        this.minHeight = 0;
        this.maxWidth = 0;
        this.maxHeight = 0;

        controller.addView(this);
    }

    /**
     * Alternative constructor with explicit port
     * @param {Controller} controller 
     * @param {pdg.Port} port 
     * @param {pdg.Rect} rect 
     * @param {number} binding 
     */
    static withPort(controller, port, rect, binding = 0) {
        const view = new View(controller, rect, binding);
        view.port = port;
        return view;
    }

    /**
     * Get the controller as a specific type
     * @param {Function} type - Controller type class
     * @returns {*} Typed controller or null
     */
    getController(type) {
        return this.controller instanceof type ? this.controller : null;
    }

    /**
     * Draw the view
     * @param {pdg.Port} port - Port to draw into
     * @param {number} frameNum - Frame number
     */
    draw(port, frameNum) {
        if (this.visible) {
            const clipSave = port.getClipRect();
            let ourClip;
            
            if (!clipSave.empty()) {
                ourClip = this.viewArea.intersection(clipSave);
            } else {
                ourClip = this.viewArea;
            }
            
            if (!ourClip.empty()) {
                // Don't draw if everything is clipped
                port.setClipRect(ourClip);
                this.drawSelf(port, frameNum);
                port.setClipRect(clipSave);
            }
        }
    }

    /**
     * Abstract method to draw the view content
     * Must be implemented by subclasses
     * @param {pdg.Port} port - Port to draw into
     * @param {number} frameNum - Frame number
     */
    drawSelf(port, frameNum) {
        throw new Error("drawSelf() must be implemented by subclass");
    }

    /**
     * Hide the view
     */
    hide() {
        const wasVisible = this.visible;
        this.visible = false;
        if (wasVisible !== this.visible) {
            this.hideSelf();
        }
    }

    /**
     * Show the view
     */
    show() {
        const wasVisible = this.visible;
        this.visible = true;
        if (wasVisible !== this.visible) {
            this.showSelf();
        }
    }

    /**
     * Get view ID
     * @returns {number} View ID
     */
    getID() {
        return this.id;
    }

    /**
     * Set view ID
     * @param {number} id - View ID
     */
    setID(id) {
        this.id = id;
    }

    /**
     * Set enabled state
     * @param {boolean} enabled 
     */
    setEnabled(enabled) {
        const wasEnabled = this.enabled;
        this.enabled = enabled;
    }

    /**
     * Set draggable state
     * @param {boolean} isDraggable 
     */
    setDraggable(isDraggable) {
        this.isDraggable = isDraggable;
    }

    /**
     * Set wants mouse overs
     * @param {boolean} wantsMouseOvers 
     */
    setWantsMouseOvers(wantsMouseOvers) {
        this.wantsMouseOvers = wantsMouseOvers;
    }

    /**
     * Called when view becomes visible
     * Override to customize behavior
     */
    showSelf() {
        // Override to do something when made visible
    }

    /**
     * Called when view is hidden
     * Override to customize behavior
     */
    hideSelf() {
        // Override to do something when hidden
    }

    // ============================ Mouse Primitives ============================

    /**
     * Handle mouse down event
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doMouseDown(mouseInfo, id, part) {
        return false;
    }

    /**
     * Handle mouse up event
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doMouseUp(mouseInfo, id, part) {
        return false;
    }

    /**
     * Handle mouse move event
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     */
    doMouseMove(mouseInfo, id, part) {
        // Override to do something useful
    }

    /**
     * Handle mouse enter event
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     */
    doMouseEnter(mouseInfo, id, part) {
        // Override to do something useful
    }

    /**
     * Handle mouse leave event
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     */
    doMouseLeave(mouseInfo, id, part) {
        // Override to do something useful
    }

    // ============================ Mouse Actions ============================

    /**
     * Handle left click
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doLeftClick(mouseInfo, id, part) {
        return false;
    }

    /**
     * Handle right click
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doRightClick(mouseInfo, id, part) {
        return false;
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
        return false;
    }

    // ============================ Gestures ============================

    /**
     * Handle tap gesture
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doTap(mouseInfo, id, part) {
        return false;
    }

    /**
     * Handle touch move gesture
     * @param {pdg.Offset} delta - Movement delta
     * @param {boolean} flick - Whether this is a flick gesture
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doTouchMove(delta, flick, id, part) {
        return false;
    }

    /**
     * Handle swipe move gesture
     * @param {pdg.Offset} delta - Movement delta
     * @param {number} fingerCount - Number of fingers
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doSwipeMove(delta, fingerCount, id, part) {
        return false;
    }

    /**
     * Handle pinch move gesture
     * @param {pdg.Offset} delta1 - First finger delta
     * @param {pdg.Offset} delta2 - Second finger delta
     * @param {number} distance - Distance between fingers
     * @param {number} deltaDistance - Change in distance
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doPinchMove(delta1, delta2, distance, deltaDistance, id, part) {
        return false;
    }

    // ============================ Drag Actions ============================

    /**
     * Handle drag move
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doDragMove(mouseInfo, id, part) {
        return false;
    }

    /**
     * Handle drag in
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @param {View} targetView - Target view
     * @param {number} targetId - Target ID
     * @param {number} targetPart - Target part
     * @returns {boolean} true if handled
     */
    doDragIn(mouseInfo, id, part, targetView, targetId, targetPart) {
        return false;
    }

    /**
     * Handle drag out
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @param {View} targetView - Target view
     * @param {number} targetId - Target ID
     * @param {number} targetPart - Target part
     * @returns {boolean} true if handled
     */
    doDragOut(mouseInfo, id, part, targetView, targetId, targetPart) {
        return false;
    }

    /**
     * Handle start being drag target
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @param {View} draggedView - Dragged view
     * @param {number} draggedId - Dragged ID
     * @param {number} draggedPart - Dragged part
     * @returns {boolean} true if handled
     */
    startBeingDragTarget(mouseInfo, id, part, draggedView, draggedId, draggedPart) {
        return false;
    }

    /**
     * Handle stop being drag target
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @param {View} draggedView - Dragged view
     * @param {number} draggedId - Dragged ID
     * @param {number} draggedPart - Dragged part
     * @returns {boolean} true if handled
     */
    stopBeingDragTarget(mouseInfo, id, part, draggedView, draggedId, draggedPart) {
        return false;
    }

    /**
     * Handle drag complete
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doDragComplete(mouseInfo, id, part) {
        return false;
    }

    /**
     * Set view area
     * @param {pdg.Rect} rect - New view area in global/port coordinates
     */
    setViewArea(rect) {
        // Match the C++ value semantics: a View owns its rectangle rather than
        // retaining and later mutating the caller's Rect object.
        this.viewArea = new pdg.Rect(rect);
    }

    /**
     * Get view area
     * @returns {pdg.Rect} View area in global/port coordinates
     */
    getViewArea() {
        return this.viewArea;
    }

    /**
     * Check if point is in view visible area
     * @param {pdg.Point} screenPoint - Point in global/port coordinates
     * @returns {boolean} true if point is in view
     */
    pointInViewVisibleArea(screenPoint) {
        return this.viewArea.contains(screenPoint);
    }

    /**
     * Check if point is in view area
     * @param {pdg.Point} screenPoint - Point in global/port coordinates
     * @returns {boolean} true if point is in view
     */
    pointInViewArea(screenPoint) {
        return this.viewArea.contains(screenPoint);
    }

    /**
     * Get part clicked at point
     * @param {pdg.Point} screenPoint - Point in global/port coordinates
     * @returns {number} Part ID or CLICKED_PART_NONE
     */
    getPartClicked(screenPoint) {
        const localPoint = this.globalToLocal(screenPoint);
        let clickedPartID = ClickablePartsIDs.CLICKED_PART_NONE;

        // Check clickable parts in reverse order (most recently added first)
        for (let i = this.clickableParts.length - 1; i >= 0; i--) {
            const part = this.clickableParts[i];
            if (part.first.contains(localPoint)) {
                clickedPartID = part.second;
                break;
            }
        }

        return clickedPartID;
    }

    /**
     * Get clickable rect from ID
     * @param {number} id - Part ID
     * @returns {pdg.Rect} Clickable rect or false if not found
     */
    getClickableRectFromID(id) {
        for (let i = this.clickableParts.length - 1; i >= 0; i--) {
            const part = this.clickableParts[i];
            if (id === part.second) {
                return part.first;
            }
        }
        return false;
    }

    /**
     * Add clickable part
     * @param {pdg.Rect} rect - Clickable area
     * @param {number} id - Part ID
     */
    addClickablePart(rect, id) {
        this.clickableParts.push({ first: new pdg.Rect(rect), second: id });
    }

    /**
     * Remove clickable part
     * @param {number} id - Part ID to remove
     */
    removeClickablePart(id) {
        for (let i = 0; i < this.clickableParts.length; i++) {
            if (this.clickableParts[i].second === id) {
                this.clickableParts.splice(i, 1);
                break;
            }
        }
    }

    /**
     * Draw clickable parts (for debugging)
     */
    drawClickableParts() {
        // Used for debug purposes
        for (let i = this.clickableParts.length - 1; i >= 0; i--) {
            const part = this.clickableParts[i];
            const localArea = part.first;
            const globalArea = this.localToGlobalRect(localArea);
            const id = part.second;

            let greenColor = new pdg.Color(0.0, 1.0, 0.0, 1.0);
            var debugAttrs = new pdg.Attributes().lineColor(greenColor).lineThickness(1);
            this.port.drawRect(globalArea, debugAttrs);
            this.port.drawText(`${id}`, globalArea.leftBottom(), 12, pdg.textStyle_Plain, greenColor);
        }
        
        var overlayAttrs = new pdg.Attributes().fillColor(new pdg.Color(1.0, 1.0, 1.0, 0.25));
        this.port.drawRect(this.viewArea, overlayAttrs);
    }

    /**
     * Handle port resize
     * @param {pdg.Rect} oldDrawingArea - Old drawing area
     * @param {pdg.Rect} newDrawingArea - New drawing area
     */
    portResized(oldDrawingArea, newDrawingArea) {
        if (this.binding === 0) {
            return; // Short circuit
        }
        
        const newViewArea = new pdg.Rect(this.viewArea);
        
        if (this.binding & ViewBinding.bind_Left) {
            // Bound to left, always change left to keep distance from left boundary
            newViewArea.left = newDrawingArea.left + (this.viewArea.left - oldDrawingArea.left);
            if (this.binding & ViewBinding.bind_Right) {
                // Also bound to right, need to shrink or grow
                newViewArea.right = newDrawingArea.right - (oldDrawingArea.right - this.viewArea.right);
                // Make sure we are within our min and max sizes
                if (this.maxWidth && this.viewArea.width() > this.maxWidth) {
                    newViewArea.setWidth(this.maxWidth);
                }
                if (this.viewArea.width() < this.minWidth) {
                    newViewArea.setWidth(this.minWidth);
                }
            }
        } else if (this.binding & ViewBinding.bind_Right) {
            // Bound to right but not left, maintain width but move with right boundary
            newViewArea.right = newDrawingArea.right - (oldDrawingArea.right - this.viewArea.right);
            newViewArea.left = newViewArea.right - this.viewArea.width();
        }
        
        if (this.binding & ViewBinding.bind_Top) {
            // Bound to top, always change top to keep distance from top boundary
            newViewArea.top = newDrawingArea.top + (this.viewArea.top - oldDrawingArea.top);
            if (this.binding & ViewBinding.bind_Bottom) {
                // Also bound to bottom, need to shrink or grow
                newViewArea.bottom = newDrawingArea.bottom - (oldDrawingArea.bottom - this.viewArea.bottom);
                // Make sure we are within our min and max sizes
                if (this.maxHeight && this.viewArea.height() > this.maxHeight) {
                    newViewArea.setHeight(this.maxHeight);
                }
                if (this.viewArea.height() < this.minHeight) {
                    newViewArea.setHeight(this.minHeight);
                }
            }
        } else if (this.binding & ViewBinding.bind_Bottom) {
            // Bound to bottom but not top, maintain height but move with bottom boundary
            newViewArea.bottom = newDrawingArea.bottom - (oldDrawingArea.bottom - this.viewArea.bottom);
            newViewArea.top = newViewArea.bottom - this.viewArea.height();
        }
        
        this.viewArea = newViewArea;
    }

    // Coordinate transforms

    /**
     * Convert local view coords to global drawing coords
     * @param {pdg.Point} inPt - Local point
     * @returns {pdg.Point} Global point
     */
    localToGlobal(inPt) {
        return new pdg.Point(inPt.x + this.viewArea.left, inPt.y + this.viewArea.top);
    }

    /**
     * Convert local view rect to global drawing rect
     * @param {pdg.Rect} inRect - Local rect
     * @returns {pdg.Rect} Global rect
     */
    localToGlobalRect(inRect) {
        return new pdg.Rect(inRect).add(this.viewArea.leftTop());
    }

    /**
     * Convert global drawing coords to local view coords
     * @param {pdg.Point} inPt - Global point
     * @returns {pdg.Point} Local point
     */
    globalToLocal(inPt) {
        return new pdg.Point(inPt.x - this.viewArea.left, inPt.y - this.viewArea.top);
    }

    /**
     * Convert global drawing rect to local view rect
     * @param {pdg.Rect} inRect - Global rect
     * @returns {pdg.Rect} Local rect
     */
    globalToLocalRect(inRect) {
        return new pdg.Rect(inRect).sub(this.viewArea.leftTop());
    }

    // Getters for state
    isVisible() {
        return this.visible;
    }

    isEnabled() {
        return this.enabled;
    }

    isDraggable() {
        return this.isDraggable;
    }

    wantsMouseOvers() {
        return this.wantsMouseOvers;
    }

    /**
     * Get the drawing port
     * @returns {pdg.Port} The port
     */
    getPort() {
        return this.port;
    }

    /**
     * Set the drawing port
     * @param {pdg.Port} newPort - New port
     * @returns {pdg.Port} Previous port
     */
    setPort(newPort) {
        const port = this.port;
        this.port = newPort;
        return port;
    }

    /**
     * Set minimum size constraints
     * @param {number} minWidth - Minimum width
     * @param {number} minHeight - Minimum height
     */
    setMinSize(minWidth, minHeight) {
        this.minWidth = minWidth;
        this.minHeight = minHeight;
    }

    /**
     * Set maximum size constraints
     * @param {number} maxWidth - Maximum width
     * @param {number} maxHeight - Maximum height
     */
    setMaxSize(maxWidth, maxHeight) {
        this.maxWidth = maxWidth;
        this.maxHeight = maxHeight;
    }
}

module.exports = {
    View,
    ClickablePartsIDs,
    ViewBinding
};
