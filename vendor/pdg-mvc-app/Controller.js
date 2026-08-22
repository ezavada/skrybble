// -----------------------------------------------
// Controller.js
// 
// JavaScript port of the Controller base class
// Manages views and handles keyboard and mouse events
//
// Ported from C++ by Assistant, 2024
// Original Copyright (c) 2004-2012, Dream Rock Studios, LLC
// -----------------------------------------------

/**
 * Controller event preferences
 */
const ControllerPreferences = {
    kDrawWhileInactive: true,
    kDontDrawWhileInactive: false,
    kWantKeyUpDownEvents: true,
    kDontWantKeyUpDownEvents: false,
    kWantKeyPressEvents: true,
    kDontWantKeyPressEvents: false,
    kWantMouseEnterLeaveEvents: true,
    kDontWantMouseEnterLeaveEvents: false,
    kWantAllEvents: true,
    kDontWantAllEvents: false
};

const DBL_CLICK_TIME = 250; // Milliseconds allowed between clicks of a double-click
const { ControlAttributes } = require('./ControlAttributes');

/**
 * Base Controller class that manages views and handles events
 * @param {Controller} parent - The parent controller (leave null if no parent)
 * @param {Application} app - The application (only if no parent)
 * @param {pdg.Port} port - The port (only if no parent)
 * @param {boolean} wantKeyUpDown - Whether to want key up down events
 * @param {boolean} wantKeyPress - Whether to want key press events
 * @param {boolean} wantMouseEnterLeave - Whether to want mouse enter leave events
 * @param {boolean} wantAll - Whether to want all events
 * @param {boolean} drawInactive - Whether to draw when inactive
 */
class Controller {
    constructor(parent, app, port, wantKeyUpDown = true, wantKeyPress = true, 
                wantMouseEnterLeave = true, wantAll = false, drawInactive = true) {
        if (parent) {
            this.parent = parent;
            if (app || port) {
                throw new Error("Application and Port cannot be provided if parent is provided");
            }
            this.app = parent.app;
            this.port = parent.port;
            parent.addChild(this); // make sure our parent knows about us
        } else {
            if (!app) {
                throw new Error("Application is required if no parent is provided");
            }
            if (!port) {
                throw new Error("Port is required if no parent is provided");
            }
            this.parent = null;
            this.app = app;
            this.port = port;
        }

        this.views = [];
        this.children = [];
        this.lastClicked = null;
        this.clickCount = 0;
        this.rightClick = false;
        this.active = true;
        this.drawing = false;
        this.wantsAllEvents = wantAll;
        this.drawInactive = drawInactive;
        this.viewOnLastMouseMoved = null;
        this.lastHitViewID = -1;
        this.lastHitViewPart = -1;
        
        // Store event handler references for cleanup
        this.mouseUpHandler = null;
        this.mouseDownHandler = null;
        this.mouseMoveHandler = null;
        this.keyUpHandler = null;
        this.keyDownHandler = null;
        this.keyPressHandler = null;
        this.mouseEnterHandler = null;
        this.mouseLeaveHandler = null;
        this.portDrawHandler = null;
        this.portResizedHandler = null;

        // Register event handlers
        this._registerEventHandlers(wantKeyUpDown, wantKeyPress, wantMouseEnterLeave, wantAll);

        if (this.port) {
            this.cachedPortDrawingArea = this.port.getDrawingArea();
        }

        this.setupViews();
    }

    /**
     * Setup views for the controller
     */
    setupViews() {
        // Override to setup views for the controller
    }

    /**
     * Register event handlers with the event manager
     * @private
     */
    _registerEventHandlers(wantKeyUpDown, wantKeyPress, wantMouseEnterLeave, wantAll) {
        this.mouseUpHandler = pdg.onMouseUp((eventData) => { return this.onMouseUp(eventData); });
        this.mouseDownHandler = pdg.onMouseDown((eventData) => { return this.onMouseDown(eventData); });
        this.mouseMoveHandler = pdg.onMouseMove((eventData) => { return this.onMouseMove(eventData); });
        
        if (wantKeyUpDown) {
            this.keyUpHandler = pdg.onKeyUp((eventData) => { return this.onKeyUp(eventData); });
            this.keyDownHandler = pdg.onKeyDown((eventData) => { return this.onKeyDown(eventData); });
        }
        
        if (wantKeyPress) {
            this.keyPressHandler = pdg.onKeyPress((eventData) => { return this.onKeyPress(eventData); });
        }

        if (wantMouseEnterLeave && typeof pdg.onMouseEnter === 'function' && typeof pdg.onMouseLeave === 'function') {
            this.mouseEnterHandler = pdg.onMouseEnter((eventData) => { return this.onMouseEnter(eventData); });
            this.mouseLeaveHandler = pdg.onMouseLeave((eventData) => { return this.onMouseLeave(eventData); });
        }
            
        if (wantAll) {
            this.app.getEventManager().addHandler(this); // handle all events
        }

        // if we have no parent, we handle port draw events ourselves
        if (!this.parent) {
            this.portDrawHandler = pdg.on(pdg.eventType_PortDraw, (eventData) => { this.onPortDraw(eventData); return false;});
            this.portResizedHandler = pdg.on(pdg.eventType_PortResized, (eventData) => { this.onPortResized(eventData); return false;});
        }
    }

    /**
     * Unregister event handlers from the event manager
     * @private
     */
    _unregisterEventHandlers() {
        const eventManager = this.app.getEventManager();
        const cancel = (property, eventType) => {
            const handler = this[property];
            if (!handler) return;
            if (typeof handler.cancel === 'function') handler.cancel();
            else eventManager.removeHandler(handler, eventType);
            this[property] = null;
        };

        cancel('mouseUpHandler', pdg.eventType_MouseUp);
        cancel('mouseDownHandler', pdg.eventType_MouseDown);
        cancel('mouseMoveHandler', pdg.eventType_MouseMove);
        cancel('keyUpHandler', pdg.eventType_KeyUp);
        cancel('keyDownHandler', pdg.eventType_KeyDown);
        cancel('keyPressHandler', pdg.eventType_KeyPress);
        cancel('mouseEnterHandler', pdg.eventType_MouseEnter);
        cancel('mouseLeaveHandler', pdg.eventType_MouseLeave);
        cancel('portDrawHandler', pdg.eventType_PortDraw);
        cancel('portResizedHandler', pdg.eventType_PortResized);
        
        if (this.wantsAllEvents) {
            eventManager.removeHandler(this, pdg.all_events);
        }
    }

    /**
     * Add a view to this controller
     * @param {View} view - The view to add
     * @param {number} id - Optional ID for the view
     */
    addView(view, id = -1) {
        if (!view) {
            throw new Error("Cannot add null view");
        }

        // Check for duplicate adds in debug mode
        if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
            if (id !== 0 && this.getUntypedView(id)) {
                console.warn("ERROR: Controller adding duplicate view id!");
            }
            
            for (const existingView of this.views) {
                if (existingView.first === view) {
                    console.warn("ERROR: Controller adding duplicate view object!");
                    break;
                }
            }
        }

        this.views.push({ first: view, second: id });
    }

    /**
     * Add a view behind all other views
     * @param {View} view - The view to add
     * @param {number} id - Optional ID for the view
     */
    addViewBehind(view, id = -1) {
        if (!view) {
            throw new Error("Cannot add null view");
        }

        // Check for duplicate adds in debug mode
        if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
            if (id !== 0 && this.getUntypedView(id)) {
                console.warn("ERROR: Controller adding duplicate view id!");
            }
            
            for (const existingView of this.views) {
                if (existingView.first === view) {
                    console.warn("ERROR: Controller adding duplicate view object!");
                    break;
                }
            }
        }

        this.views.unshift({ first: view, second: id }); // Add behind all other views
    }

    /**
     * Remove a view from this controller
     * @param {View} view - The view to remove
     */
    removeView(view) {
        for (let i = 0; i < this.views.length; i++) {
            if (this.views[i].first === view) {
                this.views.splice(i, 1);
                return;
            }
        }
    }

    /**
     * Remove view by ID
     * @param {number} id - View ID
     */
    removeViewById(id) {
        this.removeView(this.getUntypedView(id));
    }

    /**
     * Remove all views from the controller
     */
    removeAllViews() {
        this.views.length = 0;
    }

    /**
     * Get an untyped view by ID
     * @param {number} id - View ID
     * @returns {View|null} The view or null if not found
     */
    getUntypedView(id) {
        for (const viewPair of this.views) {
            if (viewPair.second === id) {
                return viewPair.first;
            }
        }
        return null;
    }

    /**
     * Get a typed view by ID
     * @param {Function} type - View type class
     * @param {number} id - View ID
     * @returns {*} Typed view or null if not found
     */
    getView(type, id) {
        const view = this.getUntypedView(id);
        return view instanceof type ? view : null;
    }

    /**
     * Get the view at the specified location (hit testing)
     * @param {pdg.Point} screenPoint - Screen location to test
     * @returns {View} View at location or null if none
     */
    getHitView(screenPoint) {     
        // Check views in reverse order (most recently added first, so they appear on top)
        for (let i = this.views.length - 1; i >= 0; i--) {
            const viewPair = this.views[i];
            const view = viewPair.first;
            if (view.isVisible() && view.pointInViewVisibleArea(screenPoint)) {
                return view;
            }
        }
        return null;
    }

    /**
     * Get the application
     * @returns {Application} The application
     */
    getApplication() {
        if (!this.app) {
            throw new Error("no_manager");
        }
        return this.app;
    }

    /**
     * Set the port for this controller
     * @param {pdg.Port} newPort - The new port
     */
    setPort(newPort) {
        this.port = newPort;
        if (this.port) {
            this.cachedPortDrawingArea = this.port.getDrawingArea();
        }
    }

    /**
     * Get the top controller in the hierarchy
     * @returns {Controller} The top controller
     */
    getTopController() {
        if (this.parent) {
            return this.parent.getTopController();
        } else {
            return this;
        }
    }

    /**
     * Return application-wide attributes for a control. Top-level application
     * controllers override this to provide a theme to all child controllers.
     */
    getControlAttributes(type, styleId = -1) {
        return new ControlAttributes();
    }

     /**
     * Draw all the views, then call drawViews for active children
     * @param {pdg.Port} port - Port to draw into
     * @param {number} frameNum - Frame number
     */
    drawViews(port, frameNum) {
        if (!this.drawInactive && !this.active) {
            return; // Don't draw if we are inactive unless we draw while inactive
        }
        
        // Draw back to front, so most recently added overlays oldest
        for (const viewPair of this.views) {
            const view = viewPair.first;
            view.draw(port, frameNum);
        }

        // Draw all active children
        for (const child of this.children) {
            child.drawViews(port, frameNum);
        }
     }

    // ============================ Event Handlers ============================

    /**
     * Handle port draw events
     * @param {Object} eventData - Event data
     * @returns {boolean} true if handled
     */
    onPortDraw(eventData) {
        if (!this.parent) {
            // the top level controller handles port draw events
            // but this keeps us safe if a subclass overrides it
            // and calls super to do some additional drawing
            this.drawViews(eventData.port, eventData.frameNum);
        }
        return false; // always propagate port draw events as much as possible
    }

    /**
     * Handle port resized events
     * @param {Object} eventData - Event data
     * @returns {boolean} true if handled
     */
    onPortResized(eventData) {
        this.portWasResized(eventData.port);
    }

    /**
     * Handle mouse down events
     * @param {Object} eventData - Event data
     * @returns {boolean} true if handled
     */
    onMouseDown(eventData) {
        if (!this.active) return false;
        const hitView = this.getHitView(eventData.mousePos);
        const hitViewID = hitView ? hitView.getID() : -1;
        const hitViewPart = hitView ? hitView.getPartClicked(eventData.mousePos) : -1;
        if ((hitView == this.lastClicked) && (eventData.lastClickElapsed <= DBL_CLICK_TIME)) {
            this.clickCount++;
        } else {
            this.clickCount = 1;
            this.lastClicked = hitView;
            this.rightClick = eventData.rightButton;
        }
        let handled = this.doMouseDown(eventData, hitView, hitViewID, hitViewPart);
        // handling for non-modal dialogs and other types of nested controllers
        if (!handled && this.parent && hitView == null) {
            handled = this.parent.onMouseDown(eventData);
        }
        return handled;
    }

    /**
     * Handle mouse up events
     * @param {Object} eventData - Event data
     * @returns {boolean} true if handled
     */
    onMouseUp(eventData) {
        if (!this.active) return false;
        const hitView = this.getHitView(eventData.mousePos);
        const hitViewID = hitView ? hitView.getID() : -1;
        const hitViewPart = hitView ? hitView.getPartClicked(eventData.mousePos) : -1;
        let handled = this.doMouseUp(eventData, hitView, hitViewID, hitViewPart);
        if (!handled) {
            // after doMouseUp, do a click method if this was a complete click,
            // that is, the mouse was released over the same view that was clicked
            if (hitView == this.lastClicked) {
                if (this.rightClick) {
                    handled = this.doRightClick(eventData, hitView, hitViewID, hitViewPart);
                } else if (this.clickCount > 1) {
                    handled = this.doDoubleClick(eventData, hitView, hitViewID, hitViewPart, this.clickCount);
                } else {
                    handled = this.doLeftClick(eventData, hitView, hitViewID, hitViewPart);
                }
            }
        }
        // handling for non-modal dialogs and other types of nested controllers
        if (!handled && this.parent && hitView == null) {
            handled = this.parent.onMouseUp(eventData);
        }
        return handled;
    }

    /**
     * Handle mouse move events
     * @param {Object} eventData - Event data
     * @returns {boolean} true if handled
     */
    onMouseMove(eventData) {
        if (!this.active) return false;
        // this generates synthetic mouse enter and leave events to views
        const hitView = this.getHitView(eventData.mousePos);
        const hitViewID = hitView ? hitView.getID() : -1;
        const hitViewPart = hitView ? hitView.getPartClicked(eventData.mousePos) : -1;
        if ((hitView != this.viewOnLastMouseMoved) ||   // check if any part, ID, or view has changed
            (hitViewID != this.lastHitViewID) || 
            (hitViewPart != this.lastHitViewPart)) {
            if (this.viewOnLastMouseMoved) {  // if changed, call the leave for last place
                this.doMouseLeave(eventData, this.viewOnLastMouseMoved, this.lastHitViewID, this.lastHitViewPart);
            }
            if (hitView && (hitViewID > -1)) {
                // if new view is valid, enter it
                this.doMouseEnter(eventData, hitView, hitViewID, hitViewPart);
            }
            this.viewOnLastMouseMoved = hitView;
            this.lastHitViewID = hitViewID;
            this.lastHitViewPart = hitViewPart;
        } else if (hitView && (hitViewID > -1)) { 
            // still in same valid view, do mouse move
            this.doMouseMove(eventData, hitView, hitViewID, hitViewPart);
        }

        // handling for non-modal dialogs and other types of nested controllers
        if (this.parent && hitView == null) {
            this.parent.onMouseMove(eventData);
        }
        return false; // always propagate mouse moves as much as possible
    }

    /**
     * Handle mouse enter events
     * @param {Object} eventData - Event data
     * @returns {boolean} true if handled
     */
    onMouseEnter(eventData) {
        if (!this.active) return false;
        // these are real mouse enter events from the engine
        // which must have been set up though mouse tracking calls
        const hitView = this.getHitView(eventData.mousePos);
        const hitViewID = hitView ? hitView.getID() : -1;
        const hitViewPart = hitView ? hitView.getPartClicked(eventData.mousePos) : -1;
        return this.doMouseEnter(eventData, hitView, hitViewID, hitViewPart, eventData.trackingRef);
    }

    /**
     * Handle mouse leave events
     * @param {Object} eventData - Event data
     * @returns {boolean} true if handled
     */
    onMouseLeave(eventData) {
        if (!this.active) return false;
        // these are real mouse leave events from the engine
        // which must have been set up though mouse tracking calls
        const hitView = this.getHitView(eventData.mousePos);
        const hitViewID = hitView ? hitView.getID() : -1;
        const hitViewPart = hitView ? hitView.getPartClicked(eventData.mousePos) : -1;
        return this.doMouseLeave(eventData, hitView, hitViewID, hitViewPart, eventData.trackingRef);
    }

    /**
     * Handle key down events
     * @param {Object} eventData - Event data
     * @returns {boolean} true if handled
     */
    onKeyDown(eventData) {
        if (!this.active) return false;
        const mousePos = pdg.gfx.getMouse();
        const hitView = this.getHitView(mousePos);
        const hitViewID = hitView ? hitView.getID() : -1;
        const hitViewPart = hitView ? hitView.getPartClicked(mousePos) : -1;
        return this.doKeyDown(eventData, hitView, hitViewID, hitViewPart);
    }

    /**
     * Handle key up events
     * @param {Object} eventData - Event data
     * @returns {boolean} true if handled
     */
    onKeyUp(eventData) {
        if (!this.active) return false;
        const mousePos = pdg.gfx.getMouse();
        const hitView = this.getHitView(mousePos);
        const hitViewID = hitView ? hitView.getID() : -1;
        console.log('eventData', eventData);
        const hitViewPart = hitView ? hitView.getPartClicked(mousePos) : -1;
        return this.doKeyUp(eventData, hitView, hitViewID, hitViewPart);
    }

    /**
     * Handle key press events
     * @param {Object} eventData - Event data
     * @returns {boolean} true if handled
     */
    onKeyPress(eventData) {
        if (!this.active) return false;
        const mousePos = pdg.gfx.getMouse();
        const hitView = this.getHitView(mousePos);
        const hitViewID = hitView ? hitView.getID() : -1;
        const hitViewPart = hitView ? hitView.getPartClicked(mousePos) : -1;
        return this.doKeyPress(eventData, hitView, hitViewID, hitViewPart);
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
        return view ? view.doMouseDown(mouseInfo, id, part) : false;
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
        return view ? view.doMouseUp(mouseInfo, id, part) : false;
    }

    /**
     * Handle mouse enter event
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view that was entered
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @param {number} trackingRef - Tracking reference (not for synthetic events)
     */
    doMouseEnter(mouseInfo, view, id, part, trackingRef) {
        if (view) view.doMouseEnter(mouseInfo, id, part);
    }

    /**
     * Handle mouse leave event
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view that was left
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @param {number} trackingRef - Tracking reference (not for synthetic events)
     */
    doMouseLeave(mouseInfo, view, id, part, trackingRef) {
        if (view) view.doMouseLeave(mouseInfo, id, part);
    }

    /**
     * Handle mouse move event
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view that was moved over
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     */
    doMouseMove(mouseInfo, view, id, part) {
        if (view) view.doMouseMove(mouseInfo, id, part);
    }

    /**
     * Handle left click
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view that was clicked
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doLeftClick(mouseInfo, view, id, part) {
        return view ? view.doLeftClick(mouseInfo, id, part) : false;
    }

    /**
     * Handle right click
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view that was clicked
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doRightClick(mouseInfo, view, id, part) {
        return view ? view.doRightClick(mouseInfo, id, part) : false;
    }

    /**
     * Handle double click
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view that was clicked
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @param {number} clickCount - Number of clicks
     * @returns {boolean} true if handled
     */
    doDoubleClick(mouseInfo, view, id, part, clickCount) {
        // Treat double clicks as single clicks unless you override this function to handle them.
        return this.doLeftClick(mouseInfo, view, id, part);
    }

    /**
     * Handle drag move
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view being dragged
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doDragMove(mouseInfo, view, id, part) {
        if (view) {
            return view.doDragMove(mouseInfo, id, part);
        } else {
            return false;
        }
    }

    /**
     * Handle drag in
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view being dragged
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @param {View} targetView - Target view
     * @param {number} targetId - Target ID
     * @param {number} targetPart - Target part
     * @returns {boolean} true if handled
     */
    doDragIn(mouseInfo, view, id, part, targetView, targetId, targetPart) {
        if (view) {
            return view.doDragIn(mouseInfo, id, part, targetView, targetId, targetPart);
        } else {
            return false;
        }
    }

    /**
     * Handle drag out
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view being dragged
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @param {View} targetView - Target view
     * @param {number} targetId - Target ID
     * @param {number} targetPart - Target part
     * @returns {boolean} true if handled
     */
    doDragOut(mouseInfo, view, id, part, targetView, targetId, targetPart) {
        if (view) {
            return view.doDragOut(mouseInfo, id, part, targetView, targetId, targetPart);
        } else {
            return false;
        }
    }

    /**
     * Handle start being drag target
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view becoming a drag target
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @param {View} draggedView - Dragged view
     * @param {number} draggedId - Dragged ID
     * @param {number} draggedPart - Dragged part
     * @returns {boolean} true if handled
     */
    startBeingDragTarget(mouseInfo, view, id, part, draggedView, draggedId, draggedPart) {
        if (view) {
            return view.startBeingDragTarget(mouseInfo, id, part, draggedView, draggedId, draggedPart);
        } else {
            return false;
        }
    }

    /**
     * Handle stop being drag target
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view stopping being a drag target
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @param {View} draggedView - Dragged view
     * @param {number} draggedId - Dragged ID
     * @param {number} draggedPart - Dragged part
     * @returns {boolean} true if handled
     */
    stopBeingDragTarget(mouseInfo, view, id, part, draggedView, draggedId, draggedPart) {
        if (view) {
            return view.stopBeingDragTarget(mouseInfo, id, part, draggedView, draggedId, draggedPart);
        } else {
            return false;
        }
    }

    /**
     * Handle drag complete
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view that was dragged
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doDragComplete(mouseInfo, view, id, part) {
        if (view) {
            return view.doDragComplete(mouseInfo, id, part);
        } else {
            return false;
        }
    }

    /**
     * Handle key down event
     * @param {Object} keyInfo - Key information
     * @param {View} view - The view that has focus
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doKeyDown(keyInfo, view, id, part) {
        return false;
    }

    /**
     * Handle key up event
     * @param {Object} keyInfo - Key information
     * @param {View} view - The view that has focus
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doKeyUp(keyInfo, view, id, part) {
        return false;
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
        return false;
    }

    // ============================ Child Management ============================

    /**
     * Attempt to close a child controller
     * @param {Controller} child - The child controller trying to close
     * @param {boolean} cancelled - Whether the close was cancelled
     * @returns {boolean} true if the child is allowed to close
     */
    attemptChildClose(child, cancelled) {
        // Override to do something when a child controller is closed
        return true; // If we return false the child will not be allowed to close
    }

    /**
     * Handle child activation
     * @param {Controller} child - The child controller that was activated
     */
    childActivated(child) {
        // Override to do something when a child controller is activated
    }

    /**
     * Add a child controller
     * @param {Controller} child - The child controller to add
     */
    addChild(child) {
        if (!child) {
            throw new Error("Cannot add null child");
        }

        // Check for duplicates in debug mode
        if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
            for (const existingChild of this.children) {
                if (existingChild === child) {
                    console.error("ERROR: Controller attempt to add duplicate child");
                    return;
                }
            }
        }

        this.children.push(child);
        child.setParent(this);
    }

    /**
     * Remove a child controller
     * @param {Controller} child - The child controller to remove
     */
    removeChild(child) {
        for (let i = 0; i < this.children.length; i++) {
            if (this.children[i] === child) {
                this.children.splice(i, 1);
                child.setParent(null);
                return;
            }
        }

        if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
            console.error("ERROR: Controller attempt to remove non-child");
        }
    }

    /**
     * Set the parent controller (private method)
     * @param {Controller} parent - The parent controller
     */
    setParent(parent) {
        this.parent = parent;
    }

    /**
     * Set active state
     * @param {boolean} active - Whether the controller is active
     */
    setActive(active) {
        this.active = active;
    }

    /**
     * Check if controller is active
     * @returns {boolean} true if active
     */
    isActive() {
        return this.active;
    }

    /**
     * Handle port resize
     * @param {Port} resizedPort - The port that was resized
     */
    portWasResized(resizedPort) {
        const oldDrawingArea = this.cachedPortDrawingArea;
        const newDrawingArea = resizedPort.getDrawingArea();
        
        // Give all our views a chance to adapt
        for (const viewPair of this.views) {
            const view = viewPair.first;
            view.portResized(oldDrawingArea, newDrawingArea);
        }
        
        this.cachedPortDrawingArea = newDrawingArea;

        // All our children need to know about the resize
        for (const child of this.children) {
            child.portWasResized(resizedPort);
        }
    }

    /**
     * Handle events from the event manager
     * @param {int} eventType - Type of event
     * @param {*} eventData - Event data
     * @returns {boolean} true if handled
     */
    handleEvent(eventType, eventData) {
        // We handle port resized events even when we are inactive
        if (eventType === pdg.eventType_PortResized) {
            this.portWasResized(eventData.port);
            return false; // We never handle a resized event completely ourselves, others must be informed of it
        }

        // Don't handle any events if controller is inactive
        if (!this.active) {
            return false;
        }

        if (eventType = pdg.eventType_PortDraw && this.port == eventData.port) {
            this.drawViews(); // don't return true, others may want to draw in this port
        }

        return false; // We didn't handle this event
    }

    /**
     * Cleanup when controller is destroyed
     */
    destroy() {
        // Make sure our parent doesn't reference us anymore
        if (this.parent) {
            this.parent.removeChild(this);
        }
        
        // Make sure our children don't reference us anymore
        for (const child of this.children) {
            child.setParent(null);
        }
        
        this._unregisterEventHandlers();
        this.removeAllViews();
    }
}

module.exports = {
    Controller,
    ControllerPreferences
};
