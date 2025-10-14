// -----------------------------------------------
// DrawingController.js
// 
// Drawing Application using the PDG JavaScript MVC Framework
//
// (c) 2025, Ed Zavada
// -----------------------------------------------

const ViewBinding = require('./index').ViewBinding;
const Controller = require('./index').Controller;
const Tools = require('./index').Tools;
const Drawing = require('./index').Drawing;

const DrawingSurfaceView = require('./DrawingSurfaceView.js');
const ToolPaletteView = require('./ToolPaletteView.js');
const ColorPickerController = require('./ColorPickerController.js');

const fs = require('fs');

// -----------------------------------------------
// Drawing Controller class
// -----------------------------------------------

class DrawingController extends Controller {
    constructor(app, port) {
        // super calls setupViews()
        // this is the top level controller, so we give it app and port rather than a parent
        super(null, app, port, true, true, true, false, true);
        this.drawing = new Drawing();
        this.toolManager = new Tools(this.drawing.getShapeClasses());
        
        // Input handling state
        this.draggedPoint = null;
        this.selectedShape = null;
        this.rotatingShape = null; // Track if we're rotating a shape
        this.rotationStartAngle = 0; // Initial angle when rotation started
        this.shapeStartRotation = 0; // Shape's rotation when rotation started
        this.dragReferencePointIndex = null; // Index of a non-dragged point to use as reference
        this.dragReferencePointWorld = null; // Original world position of reference point
        
        // Rubber-band selection state
        this.rubberBandStart = null;
        this.rubberBandEnd = null;
        this.rubberBandActive = false;
        this.rubberBandPending = false; // True when mouse is down but hasn't moved minimum distance
        this.rubberBandColorToggle = false;
        this.rubberBandTimer = null;
        this.rubberBandModifiers = null; // Store modifier keys (shift, ctrl, etc.) for selection
        this.rubberBandInitialStates = null; // Store initial selection states for toggle mode
        
        // Clipboard for cut/copy/paste
        this.clipboard = null;
        this.pasteCount = 0; // Track how many times current clipboard has been pasted
        
        // Undo/Redo history
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoLevels = 50;
        this.isNudging = false; // Track if we're in a nudge sequence
        this.nudgeTimer = null; // Timer to finalize nudge after inactivity
        this.isReordering = false; // Track if we're in a reorder sequence
        this.reorderTimer = null; // Timer to finalize reorder after inactivity
        
        // File handling
        this.currentFilename = null;
        
        // Help display state
        this.showHelp = false;
        
        // Color picker state
        this.colorPickerController = null;
        this.recentColors = []; // Track recently used colors
        this.maxRecentColors = 10;
    }
    
    setupViews() {
        const drawingArea = this.port.getDrawingArea();
        
        const paletteHeight = 50;         

        // Create drawing surface below the palette
        const surfaceRect = new pdg.Rect(drawingArea);
        surfaceRect.top = paletteHeight;
        surfaceRect.setHeight(drawingArea.height() - paletteHeight);
        this.backgroundView = new DrawingSurfaceView(this, surfaceRect, ViewBinding.grow);

        // Create tool palette at the top (but drawn after the drawing surface)
        const paletteRect = new pdg.Rect(drawingArea);
        paletteRect.setHeight(paletteHeight);
        this.toolPaletteView = new ToolPaletteView(this, paletteRect, ViewBinding.grow_Horiz + ViewBinding.bind_Top);

        console.log('DrawingController::setupViews, paletteRect', paletteRect);
        console.log('DrawingController::setupViews, surfaceRect', surfaceRect);
    }

    // ============================ Event Handling Overrides ============================

    doMouseDown(mouseInfo, view, id, part) {
        if (view === this.toolPaletteView) {
            // Handle tool selection from tool palette
            // Part numbers correspond to tool indices (1-based)
            if (part > 0) {
                const toolNames = Object.values(Tools.TOOLS);
                const selectedTool = toolNames[part - 1];
                if (selectedTool) {
                    // Special handling for HELP tool - just toggle help, don't switch tools
                    if (selectedTool === Tools.TOOLS.HELP) {
                        this.toggleHelp();
                        return true;
                    }
                    // Special handling for color picker tools
                    if (selectedTool === Tools.TOOLS.FILL_COLOR || selectedTool === Tools.TOOLS.LINE_COLOR) {
                        this.openColorPicker(selectedTool);
                        return true;
                    }
                    this.toolManager.setTool(selectedTool);
                    this.updateToolSelection(selectedTool);
                    return true;
                }
            }
            return false;
        }
        
        if (view === this.backgroundView) {
            const currentTool = this.toolManager.getCurrentTool();
            // For multi-point tools, don't fully handle mouseDown - let it generate clicks
            if (currentTool === Tools.TOOLS.SPLINE || currentTool === Tools.TOOLS.BEZIER || currentTool === Tools.TOOLS.POLY) {
                this.handleMouseDown(mouseInfo);
                return false; // Allow click events to be generated
            }
            // For other tools, fully handle the event
            return this.handleMouseDown(mouseInfo);
        }
        return false;
    }

    doMouseUp(mouseInfo, view, id, part) {
        // Only handle mouse events on the drawing surface
        if (view === this.backgroundView) {
            const currentTool = this.toolManager.getCurrentTool();
            // For multi-point tools, don't fully handle mouseUp - let it generate clicks
            if (currentTool === Tools.TOOLS.SPLINE || currentTool === Tools.TOOLS.BEZIER || currentTool === Tools.TOOLS.POLY) {
                this.handleMouseUp(mouseInfo);
                return false; // Allow click events to be generated
            }
            // For other tools, fully handle the event
            return this.handleMouseUp(mouseInfo);
        }
        return false;
    }

    doMouseMove(mouseInfo, view, id, part) {
        // Only handle mouse events on the drawing surface
        if (view === this.backgroundView) {
            return this.handleMouseMove(mouseInfo);
        }
        return false;
    }

    doLeftClick(mouseInfo, view, id, part) {
        // Handle single clicks on the drawing surface
        if (view === this.backgroundView) {
            return this.handleMouseClick(mouseInfo);
        }
        return false;
    }

    doDoubleClick(mouseInfo, view, id, part, clickCount) {
        // Handle double clicks on the drawing surface
        if (view === this.backgroundView) {
            return this.handleMouseDoubleClick(mouseInfo);
        }
        return false;
    }

    doRightClick(mouseInfo, view, id, part) {
        // Handle right clicks on the drawing surface
        // Right-click finishes multi-point shapes without adding an extra point
        if (view === this.backgroundView) {
            return this.handleMouseRightClick(mouseInfo);
        }
        return false;
    }

    doKeyUp(keyUpInfo, view, id, part) {
        return this.handleKeyUp(keyUpInfo);
    }

    doKeyPress(keyPressInfo, view, id, part) {
        // If color picker is open, let it handle keys first
        if (this.colorPickerController) {
            const handled = this.colorPickerController.doKeyPress(keyPressInfo, view, id, part);
            if (handled) {
                return true;
            }
        }
        return this.handleKeyPress(keyPressInfo);
    }

    // ============================ Input Handler Methods ============================

    getMousePosition(event) {
        if (event && event.mousePos) {
            return {
                x: event.mousePos.x,
                y: event.mousePos.y
            };
        }
        return { x: 0, y: 0 };
    }

    handleMouseDown(event) {
        const pos = this.getMousePosition(event);
        const currentTool = this.toolManager.getCurrentTool();

        if (currentTool === Tools.TOOLS.SELECT) {
            this.handleSelectMode(pos.x, pos.y, event);
        } else if (currentTool === Tools.TOOLS.SPLINE || currentTool === Tools.TOOLS.BEZIER || currentTool === Tools.TOOLS.POLY) {
            // For multi-point tools, start drawing but wait for clicks to add points
            if (!this.toolManager.isCurrentlyDrawing()) {
                // Deselect any previously selected shape
                this.selectShape(null);
                this.toolManager.startDrawing(pos.x, pos.y, this.drawing.getShapeClasses());
            }
        } else {
            // For single-action tools, start drawing on mouse down
            this.toolManager.startDrawing(pos.x, pos.y, this.drawing.getShapeClasses());
        }
        return true;
    }

    handleMouseMove(event) {
        const pos = this.getMousePosition(event);

        if (this.toolManager.isCurrentlyDrawing()) {
            this.toolManager.updateDrawing(pos.x, pos.y);
        } else if (this.rotatingShape) {
            // Update rotation based on mouse position
            const center = this.rotatingShape.getCenterPoint();
            const dx = pos.x - center.x;
            const dy = pos.y - center.y;
            const currentAngle = Math.atan2(dy, dx);
            const angleDelta = currentAngle - this.rotationStartAngle;
            this.rotatingShape.rotation = this.shapeStartRotation + angleDelta;
        } else if (this.rubberBandPending) {
            // Check if we've moved enough to activate rubber-band selection
            const MIN_DISTANCE = 3;
            const dx = pos.x - this.rubberBandStart.x;
            const dy = pos.y - this.rubberBandStart.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance >= MIN_DISTANCE) {
                // Activate rubber-band selection
                this.activateRubberBandSelection();
                this.updateRubberBandSelection(pos.x, pos.y);
            }
        } else if (this.rubberBandActive) {
            this.updateRubberBandSelection(pos.x, pos.y);
        } else if (this.draggedPoint) {
            this.updateDraggedPoint(pos.x, pos.y);
        }
        return true;
    }

    handleMouseUp(event) {
        const pos = this.getMousePosition(event);
        const currentTool = this.toolManager.getCurrentTool();

        if (this.rubberBandActive) {
            this.finishRubberBandSelection();
        } else if (this.rubberBandPending) {
            // Mouse up before moving minimum distance - cancel rubber-band
            this.rubberBandPending = false;
            this.rubberBandStart = null;
            this.rubberBandModifiers = null;
            this.rubberBandInitialStates = null;
        } else if (this.toolManager.isCurrentlyDrawing()) {
            // For single-action tools (line, circle, oval, rect, freehand), finish on mouse up
            if (currentTool === Tools.TOOLS.LINE || currentTool === Tools.TOOLS.CIRCLE || 
                currentTool === Tools.TOOLS.OVAL || currentTool === Tools.TOOLS.RECT) {
                const finishedShape = this.toolManager.getCurrentShape();
                
                // Check if the shape is valid (mouse moved more than minimum distance)
                if (finishedShape && this.toolManager.hasMinimumSize()) {
                    this.saveUndoState('add shape');
                    this.drawing.addShape(finishedShape);
                    this.selectShape(null);
                }
                this.toolManager.finishCurrentDrawing();
            } else if (currentTool === Tools.TOOLS.FREEHAND) {
                const finishedShape = this.toolManager.getCurrentShape();
                
                // Check if we have enough points (at least 2)
                if (finishedShape && this.toolManager.freehandPoints.length >= 2) {
                    // Mark shape as no longer under construction or freehand
                    finishedShape.underConstruction = false;
                    finishedShape.freehand = false;
                    this.saveUndoState('add shape');
                    this.drawing.addShape(finishedShape);
                    this.selectShape(null);
                }
                this.toolManager.finishCurrentDrawing();
            }
            // For multi-point tools, don't finish on mouse up - wait for click or double-click
        }
        
        this.draggedPoint = null;
        this.rotatingShape = null;
        this.dragReferencePointIndex = null;
        this.dragReferencePointWorld = null;
        return true;
    }

    handleMouseClick(event) {
        const pos = this.getMousePosition(event);
        const currentTool = this.toolManager.getCurrentTool();

        console.log('handleMouseClick: tool=', currentTool, 'isDrawing=', this.toolManager.isCurrentlyDrawing());

        // For multi-point tools (spline, poly, bezier), add a point on click
        if (currentTool === Tools.TOOLS.SPLINE || currentTool === Tools.TOOLS.BEZIER || currentTool === Tools.TOOLS.POLY) {
            if (this.toolManager.isCurrentlyDrawing()) {
                console.log('Adding point at', pos.x, pos.y);
                this.toolManager.addPointToShape(pos.x, pos.y);
            }
            return true;
        }
        
        return false;
    }

    handleMouseDoubleClick(event) {
        const pos = this.getMousePosition(event);
        const currentTool = this.toolManager.getCurrentTool();

        // For multi-point tools, finish the shape on double-click
        if (currentTool === Tools.TOOLS.SPLINE || currentTool === Tools.TOOLS.BEZIER || currentTool === Tools.TOOLS.POLY) {
            if (this.toolManager.isCurrentlyDrawing()) {
                const finishedShape = this.toolManager.finishMultiPointShape(true); // true = isDoubleClick
                if (finishedShape) {
                    this.saveUndoState('add shape');
                    this.drawing.addShape(finishedShape);
                    this.selectShape(null);
                }
            }
            return true;
        }
        
        return false;
    }

    handleMouseRightClick(event) {
        const pos = this.getMousePosition(event);
        const currentTool = this.toolManager.getCurrentTool();

        // For multi-point tools, finish the shape on right-click
        if (currentTool === Tools.TOOLS.SPLINE || currentTool === Tools.TOOLS.BEZIER || currentTool === Tools.TOOLS.POLY) {
            if (this.toolManager.isCurrentlyDrawing()) {
                const finishedShape = this.toolManager.finishMultiPointShape(false); // false = not doubleClick
                if (finishedShape) {
                    this.saveUndoState('add shape');
                    this.drawing.addShape(finishedShape);
                    this.selectShape(null);
                }
            }
            return true;
        }
        
        return false;
    }

    handleSelectMode(x, y, event) {
        const shiftKey = event && event.shift;
        const toggleKey = event && (event.ctrl || event.alt || event.command);
        
        // Check if clicking on an endpoint or control point
        const shapes = this.drawing.getShapes();
        for (let shape of shapes) {
            // Check rotation center point FIRST (highest priority)
            // Skip circles - they can't be rotated (rotation-invariant)
            if (shape.selected && shape.constructor.name !== 'Circle') {
                const center = shape.getCenterPoint();
                if (Math.abs(x - center.x) < 7 && Math.abs(y - center.y) < 7) {
                    // Start rotation
                    this.rotatingShape = shape;
                    this.shapeStartRotation = shape.rotation || 0;
                    // Calculate initial angle from center to mouse
                    const dx = x - center.x;
                    const dy = y - center.y;
                    this.rotationStartAngle = Math.atan2(dy, dx);
                    // Save undo state for rotation
                    this.saveUndoState('rotate');
                    return;
                }
            }
            
            const endpoints = shape.getEndpoints();
            const controlPoints = shape.getControlPoints();
            const center = shape.getCenterPoint();
            const rotation = shape.rotation || 0;
            
            // Check control points FIRST (they're smaller and have priority)
            for (let i = 0; i < controlPoints.length; i++) {
                let cp = controlPoints[i];
                
                // If shape is rotated, get the rotated position of the control point
                if (rotation !== 0) {
                    cp = shape.rotatePoint(cp.x, cp.y, center.x, center.y, rotation);
                }
                
                if (Math.abs(x - cp.x) < 6 && Math.abs(y - cp.y) < 6) {
                    this.draggedPoint = { shape, type: 'control', index: i };
                    
                    // For rotated multi-point shapes, pick a reference point
                    if (rotation !== 0 && shape.points && shape.points.length > 1) {
                        // Pick the first point that isn't the one being dragged
                        let refIdx = 0;
                        if (shape.constructor.name === 'Spline') {
                            // For splines, control points are at index 0 and last
                            if (i === 0) refIdx = 1;
                        }
                        const refPoint = shape.points[refIdx];
                        this.dragReferencePointIndex = refIdx;
                        this.dragReferencePointWorld = shape.rotatePoint(refPoint.x, refPoint.y, center.x, center.y, rotation);
                    }
                    
                    // Save undo state before dragging
                    this.saveUndoState('drag control point');
                    // Select the shape if it's not already selected
                    if (!shape.selected) {
                        this.selectShape(shape, false, false); // Normal selection for dragging
                    }
                    return;
                }
            }
            
            // Check endpoints
            for (let i = 0; i < endpoints.length; i++) {
                let ep = endpoints[i];
                
                // If shape is rotated, get the rotated position of the endpoint
                if (rotation !== 0) {
                    ep = shape.rotatePoint(ep.x, ep.y, center.x, center.y, rotation);
                }
                
                if (Math.abs(x - ep.x) < 6 && Math.abs(y - ep.y) < 6) {
                    this.draggedPoint = { shape, type: 'endpoint', index: i };
                    
                    // For rotated multi-point shapes, pick a reference point
                    if (rotation !== 0 && shape.points && shape.points.length > 1) {
                        // Pick a point that isn't the one being dragged
                        let refIdx = (i === 0) ? 1 : 0;
                        if (shape.constructor.name === 'Spline') {
                            // For splines, endpoints are indices 1 to length-2, so adjust
                            refIdx = (i === 0) ? 2 : 1;
                        }
                        const refPoint = shape.points[refIdx];
                        this.dragReferencePointIndex = refIdx;
                        this.dragReferencePointWorld = shape.rotatePoint(refPoint.x, refPoint.y, center.x, center.y, rotation);
                    }
                    
                    // Save undo state before dragging
                    this.saveUndoState('drag endpoint');
                    // Select the shape if it's not already selected
                    if (!shape.selected) {
                        this.selectShape(shape, false, false); // Normal selection for dragging
                    }
                    return;
                }
            }
        }

        // Check if clicking on a shape
        let clickedShape = null;
        for (let i = shapes.length - 1; i >= 0; i--) {
            if (shapes[i].contains(x, y)) {
                clickedShape = shapes[i];
                break;
            }
        }

        if (clickedShape) {
            // Update selection with modifier keys
            if (toggleKey) {
                // Toggle selection state
                clickedShape.selected = !clickedShape.selected;
            } else if (shiftKey) {
                // Add to selection
                clickedShape.selected = true;
            } else {
                // Normal selection - clear others
                this.selectShape(clickedShape, false, false);
            }
        } else {
            // Clicked on background - prepare for rubber-band selection
            // (will only activate if mouse moves minimum distance)
            this.rubberBandStart = { x, y };
            this.rubberBandPending = true;
            this.rubberBandModifiers = { shift: shiftKey, toggle: toggleKey };
            
            if (!shiftKey && !toggleKey) {
                // Clear selection only if not using modifiers
                this.selectShape(null, false, false);
            }
        }
    }

    selectShape(shape, additive = false, toggle = false) {
        if (!additive && !toggle) {
            // Clear previous selections for normal selection
            this.drawing.clearSelection();
        }
        
        if (shape) {
            if (toggle) {
                shape.selected = !shape.selected;
            } else {
                shape.selected = true;
            }
            this.selectedShape = shape;
        } else if (!additive && !toggle) {
            this.selectedShape = null;
        }
    }

    activateRubberBandSelection() {
        // rubberBandStart is already set when pending was set
        this.rubberBandEnd = { ...this.rubberBandStart };
        this.rubberBandActive = true;
        this.rubberBandPending = false;
        this.rubberBandColorToggle = false;
        
        // Store initial selection states for all shapes (for toggle mode)
        const shapes = this.drawing.getShapes();
        this.rubberBandInitialStates = new Map();
        for (let shape of shapes) {
            this.rubberBandInitialStates.set(shape, shape.selected);
        }
        
        // Clear any existing selection only if not using modifiers
        if (!this.rubberBandModifiers || (!this.rubberBandModifiers.shift && !this.rubberBandModifiers.toggle)) {
            this.drawing.clearSelection();
        }
        
        // Start timer to alternate colors every 125ms
        this.rubberBandTimer = setInterval(() => {
            this.rubberBandColorToggle = !this.rubberBandColorToggle;
        }, 125);
    }

    updateRubberBandSelection(x, y) {
        if (!this.rubberBandActive) return;
        this.rubberBandEnd = { x, y };
        
        // Dynamically update selection based on current rectangle
        const left = Math.min(this.rubberBandStart.x, this.rubberBandEnd.x);
        const right = Math.max(this.rubberBandStart.x, this.rubberBandEnd.x);
        const top = Math.min(this.rubberBandStart.y, this.rubberBandEnd.y);
        const bottom = Math.max(this.rubberBandStart.y, this.rubberBandEnd.y);
        
        const shiftMode = this.rubberBandModifiers && this.rubberBandModifiers.shift;
        const toggleMode = this.rubberBandModifiers && this.rubberBandModifiers.toggle;
        
        // Update selection for all shapes
        const shapes = this.drawing.getShapes();
        for (let shape of shapes) {
            const intersects = shape.intersectsRect && shape.intersectsRect(left, top, right, bottom);
            const initialState = this.rubberBandInitialStates.get(shape);
            
            if (toggleMode) {
                // Toggle mode: flip selection for intersecting shapes from their initial state
                if (intersects) {
                    shape.selected = !initialState;
                } else {
                    shape.selected = initialState;
                }
            } else if (shiftMode) {
                // Shift mode: add to selection, preserve non-intersecting shapes
                if (intersects) {
                    shape.selected = true;
                } else {
                    shape.selected = initialState;
                }
            } else {
                // Normal mode: only select intersecting shapes
                shape.selected = intersects;
            }
        }
    }

    finishRubberBandSelection() {
        if (!this.rubberBandActive) return;
        
        // Stop the color toggle timer
        if (this.rubberBandTimer) {
            clearInterval(this.rubberBandTimer);
            this.rubberBandTimer = null;
        }
        
        // Selection is already up-to-date from updateRubberBandSelection()
        // Just reset rubber-band state
        this.rubberBandActive = false;
        this.rubberBandPending = false;
        this.rubberBandStart = null;
        this.rubberBandEnd = null;
        this.rubberBandModifiers = null;
        this.rubberBandInitialStates = null;
    }

    updateDraggedPoint(x, y) {
        if (!this.draggedPoint) return;

        const { shape, type, index } = this.draggedPoint;
        const rotation = shape.rotation || 0;
        
        // Step 1: Update the dragged point in local space
        let localX = x, localY = y;
        if (rotation !== 0) {
            const center = shape.getCenterPoint();
            const rotated = shape.rotatePoint(x, y, center.x, center.y, -rotation);
            localX = rotated.x;
            localY = rotated.y;
        }

        // Step 2: Apply the change to the shape
        if (type === 'endpoint') {
            const endpoints = shape.getEndpoints();
            if (endpoints[index]) {
                this.updateShapeEndpoint(shape, index, localX, localY);
            }
        } else if (type === 'control') {
            const controlPoints = shape.getControlPoints();
            if (controlPoints[index]) {
                if (shape.constructor.name === 'Spline') {
                    // For Cardinal splines, control points are first and last points in the array
                    if (index === 0) {
                        shape.points[0].x = localX;
                        shape.points[0].y = localY;
                    } else if (index === 1) {
                        const lastIdx = shape.points.length - 1;
                        shape.points[lastIdx].x = localX;
                        shape.points[lastIdx].y = localY;
                    }
                } else if (shape.constructor.name === 'BezierSpline') {
                    controlPoints[index].x = localX;
                    controlPoints[index].y = localY;
                    // Mark this control point as manually edited
                    if (shape.manuallyEditedControls) {
                        shape.manuallyEditedControls.add(index);
                    }
                }
            }
        }
        
        // Step 3: For rotated multi-point shapes, compensate to keep reference point stable
        if (rotation !== 0 && this.dragReferencePointIndex !== null && this.dragReferencePointWorld && shape.points) {
            const refPoint = shape.points[this.dragReferencePointIndex];
            const newCenter = shape.getCenterPoint();
            
            // Calculate where the reference point would be now
            const newRefWorld = shape.rotatePoint(refPoint.x, refPoint.y, newCenter.x, newCenter.y, rotation);
            
            // Calculate the delta (how much it moved)
            const deltaX = this.dragReferencePointWorld.x - newRefWorld.x;
            const deltaY = this.dragReferencePointWorld.y - newRefWorld.y;
            
            // Apply the delta to all points to compensate
            for (let point of shape.points) {
                point.x += deltaX;
                point.y += deltaY;
            }
            
            // Also apply to control points if they exist
            if (shape.controlPoints) {
                for (let cp of shape.controlPoints) {
                    cp.x += deltaX;
                    cp.y += deltaY;
                }
            }
        }
    }

    updateShapeEndpoint(shape, index, x, y) {
        switch (shape.constructor.name) {
            case 'Line':
                if (index === 0) {
                    shape.x = x;
                    shape.y = y;
                } else {
                    shape.x2 = x;
                    shape.y2 = y;
                }
                break;
            case 'Circle':
                // Circles keep their center at shape.x, shape.y regardless of rotation
                const dx = x - shape.x;
                const dy = y - shape.y;
                shape.radius = Math.sqrt(dx * dx + dy * dy);
                break;
            case 'Oval':
                const rotation = shape.rotation || 0;
                
                if (rotation !== 0) {
                    // For rotated ovals, keep center fixed and resize from center
                    const center = shape.getCenterPoint();
                    const dxOval = Math.abs(x - center.x);
                    const dyOval = Math.abs(y - center.y);
                    
                    if (index === 0 || index === 2) { // Top or bottom
                        shape.radiusY = dyOval;
                    } else { // Left or right
                        shape.radiusX = dxOval;
                    }
                } else {
                    // Not rotated, use distance from current position
                    const dxOval = Math.abs(x - shape.x);
                    const dyOval = Math.abs(y - shape.y);
                    if (index === 0 || index === 2) { // Top or bottom
                        shape.radiusY = dyOval;
                    } else { // Left or right
                        shape.radiusX = dxOval;
                    }
                }
                break;
            case 'Rectangle':
                this.updateRectangleCorner(shape, index, x, y);
                break;
            case 'Polygon':
                shape.points[index].x = x;
                shape.points[index].y = y;
                break;
            case 'Spline':
                // For Cardinal splines, endpoints are the interior points (index 1 onwards)
                // So endpoint[0] maps to points[1], endpoint[1] maps to points[2], etc.
                shape.points[index + 1].x = x;
                shape.points[index + 1].y = y;
                break;
            case 'BezierSpline':
                // For Bezier splines, all points in the array are endpoints
                shape.points[index].x = x;
                shape.points[index].y = y;
                // Regenerate control points when endpoints move, but preserve manual edits
                if (shape.generateControlPoints) {
                    shape.controlPoints = shape.generateControlPoints(true);
                }
                break;
        }
    }

    updateRectangleCorner(shape, index, x, y) {
        const rotation = shape.rotation || 0;
        
        // If rotated, we need to keep the center fixed
        if (rotation !== 0) {
            const center = shape.getCenterPoint();
            
            // Calculate the vector from center to new corner position
            const dx = x - center.x;
            const dy = y - center.y;
            
            // The opposite corner moves the same distance in opposite direction
            const oppositeIndex = (index + 2) % 4;
            
            // Update position and size based on which corner is being dragged
            // We calculate new width and height from the center distances
            if (index === 0 || index === 2) {
                // Top-left or bottom-right: affects both x and y
                const newHalfWidth = Math.abs(dx);
                const newHalfHeight = Math.abs(dy);
                shape.width = newHalfWidth * 2;
                shape.height = newHalfHeight * 2;
                shape.x = center.x - newHalfWidth;
                shape.y = center.y - newHalfHeight;
            } else {
                // Top-right or bottom-left: affects x and y differently
                const newHalfWidth = Math.abs(dx);
                const newHalfHeight = Math.abs(dy);
                shape.width = newHalfWidth * 2;
                shape.height = newHalfHeight * 2;
                shape.x = center.x - newHalfWidth;
                shape.y = center.y - newHalfHeight;
            }
        } else {
            // Not rotated, use original logic
            const endpoints = shape.getEndpoints();
            const ep = endpoints[index];
            
            switch (index) {
                case 0: // Top-left
                    shape.width += shape.x - x;
                    shape.height += shape.y - y;
                    shape.x = x;
                    shape.y = y;
                    break;
                case 1: // Top-right
                    shape.width = x - shape.x;
                    shape.height += shape.y - y;
                    shape.y = y;
                    break;
                case 2: // Bottom-right
                    shape.width = x - shape.x;
                    shape.height = y - shape.y;
                    break;
                case 3: // Bottom-left
                    shape.width += shape.x - x;
                    shape.height = y - shape.y;
                    shape.x = x;
                    break;
            }
        }
    }

    handleKeyUp(event) {
        // No automatic tool switching on key release
        return false;
    }

    handleKeyPress(event) {
        // Get unicode value (used for both regular keys and arrow keys)
        const unicode = event && event.unicode;
   
        // Check for keyboard shortcuts with Cmd/Ctrl modifiers
        const cmdOrCtrl = event && (event.meta || event.ctrl);
        
        if (cmdOrCtrl && unicode) {
            const key = String.fromCharCode(unicode).toUpperCase();
            
            switch (key) {
                case 'C': // Copy
                    this.copySelectedShapes();
                    return true;
                case 'X': // Cut
                    this.cutSelectedShapes();
                    return true;
                case 'V': // Paste
                    this.pasteShapes();
                    return true;
                case 'Z': // Undo or Redo
                    if (event.shift) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                    return true;
                case 'S': // Save
                    this.saveFile();
                    return true;
            }
        }
        
        // Check for arrow keys (unicode values 28-31)
        if (unicode >= 28 && unicode <= 31) {
            // Get all selected shapes
            const selectedShapes = this.drawing.getShapes().filter(shape => shape.selected);
            
            if (selectedShapes.length > 0) {
                const moveAmount = event.shift ? 1 : 10;
                let dx = 0, dy = 0;
                
                switch (unicode) {
                    case 28: // Left arrow (pdg.key_LeftArrow)
                        dx = -moveAmount;
                        break;
                    case 29: // Right arrow (pdg.key_RightArrow)
                        dx = moveAmount;
                        break;
                    case 30: // Up arrow (pdg.key_UpArrow)
                        dy = -moveAmount;
                        break;
                    case 31: // Down arrow (pdg.key_DownArrow)
                        dy = moveAmount;
                        break;
                }
                
                // Save undo state only at the start of a nudge sequence
                if (!this.isNudging) {
                    this.saveUndoState('move');
                    this.isNudging = true;
                }
                
                // Clear existing nudge timer
                if (this.nudgeTimer) {
                    clearTimeout(this.nudgeTimer);
                }
                
                // Move all selected shapes
                for (let shape of selectedShapes) {
                    this.drawing.moveShape(shape, dx, dy);
                }
                
                // Set timer to finalize nudge after 500ms of inactivity
                this.nudgeTimer = setTimeout(() => {
                    this.isNudging = false;
                    this.nudgeTimer = null;
                }, 500);
                
                return true;
            }
            return false;
        }
        
        // Check for draw order keys (+/- to move forward/backward, Ctrl/Cmd +/- to move to front/back)
        if (unicode) {
            const key = String.fromCharCode(unicode);
            const selectedShapes = this.drawing.getShapes().filter(shape => shape.selected);
            
            // Handle + (plus) or = (as synonym for plus) to move forward
            if ((key === '+' || key === '=') && selectedShapes.length > 0) {
                // Save undo state only at the start of a reorder sequence
                if (!this.isReordering) {
                    this.saveUndoState('reorder');
                    this.isReordering = true;
                }
                
                // Clear existing reorder timer
                if (this.reorderTimer) {
                    clearTimeout(this.reorderTimer);
                }
                
                if (cmdOrCtrl) {
                    // Ctrl/Cmd + Plus: move to front
                    for (let shape of selectedShapes) {
                        this.drawing.moveShapeToFront(shape);
                    }
                } else {
                    // Plus alone: move forward by 1
                    for (let shape of selectedShapes) {
                        this.drawing.moveShapeForward(shape, 1);
                    }
                }
                
                // Set timer to finalize reorder after 500ms of inactivity
                this.reorderTimer = setTimeout(() => {
                    this.isReordering = false;
                    this.reorderTimer = null;
                }, 500);
                
                return true;
            }
            
            // Handle - (minus) to move backward
            if (key === '-' && selectedShapes.length > 0) {
                // Save undo state only at the start of a reorder sequence
                if (!this.isReordering) {
                    this.saveUndoState('reorder');
                    this.isReordering = true;
                }
                
                // Clear existing reorder timer
                if (this.reorderTimer) {
                    clearTimeout(this.reorderTimer);
                }
                
                if (cmdOrCtrl) {
                    // Ctrl/Cmd + Minus: move to back
                    for (let shape of selectedShapes) {
                        this.drawing.moveShapeToBack(shape);
                    }
                } else {
                    // Minus alone: move backward by 1
                    for (let shape of selectedShapes) {
                        this.drawing.moveShapeBackward(shape, 1);
                    }
                }
                
                // Set timer to finalize reorder after 500ms of inactivity
                this.reorderTimer = setTimeout(() => {
                    this.isReordering = false;
                    this.reorderTimer = null;
                }, 500);
                
                return true;
            }
        }
        
        // Handle key press events for color and tool selection
        let key = '';
        if (unicode) {
            key = String.fromCharCode(unicode).toUpperCase();
        }

        // Tool selection
        if (key in Tools.TOOL_SHORTCUTS) {
            console.log("handleKeyPress", key, Tools.TOOL_SHORTCUTS[key]);
            const tool = Tools.TOOL_SHORTCUTS[key];
            
            // Special handling for HELP - just toggle help, don't switch tools
            if (tool === Tools.TOOLS.HELP) {
                this.toggleHelp();
                return true;
            }
            
            // Special handling for color picker tools
            if (tool === Tools.TOOLS.FILL_COLOR || tool === Tools.TOOLS.LINE_COLOR) {
                this.openColorPicker(tool);
                return true;
            }
            
            this.toolManager.setTool(tool);
            this.updateToolSelection(tool);
            return true;
        }

        switch (key) {
            case '\t': // Tab key
                // Check if shift is pressed for reverse direction
                const shiftPressed = event && event.shift;
                this.selectNextShape(shiftPressed);
                // Switch to SELECT mode when using TAB to navigate shapes
                this.toolManager.setTool(Tools.TOOLS.SELECT);
                this.updateToolSelection(Tools.TOOLS.SELECT);
                return true;
            case '\u007f': // Delete key
            case '\b': // Backspace key
                // Delete all selected shapes
                const selectedShapes = this.drawing.getShapes().filter(shape => shape.selected);
                if (selectedShapes.length > 0) {
                    this.saveUndoState('delete');
                    for (let shape of selectedShapes) {
                        this.drawing.removeShape(shape);
                    }
                    this.selectedShape = null;
                }
                return true;
            case '\u001b': // Escape key
                const currentTool = this.toolManager.getCurrentTool();
                // For multi-point tools, remove last point instead of canceling
                if ((currentTool === Tools.TOOLS.SPLINE || currentTool === Tools.TOOLS.BEZIER || currentTool === Tools.TOOLS.POLY) 
                    && this.toolManager.isCurrentlyDrawing()) {
                    this.toolManager.removeLastPoint();
                } else {
                    // For other tools or when not drawing, finish and switch to SELECT
                    this.toolManager.finishCurrentDrawing();
                    this.selectShape(null);
                    this.toolManager.setTool(Tools.TOOLS.SELECT);
                    this.updateToolSelection(Tools.TOOLS.SELECT);
                }
                return true;
        }
        return true;
    }

    selectNextShape(reverse = false) {
        const shapes = this.drawing.getShapes();
        if (shapes.length === 0) return;

        let newIndex = -1;

        if (!this.selectedShape) {
            // Nothing selected - select most recent (last) if forward, first if reverse
            newIndex = reverse ? 0 : shapes.length - 1;
        } else {
            // Find current selection
            const currentIndex = shapes.indexOf(this.selectedShape);
            if (currentIndex === -1) {
                // Current selection not found, select most recent
                newIndex = shapes.length - 1;
            } else {
                // Move to next/previous
                if (reverse) {
                    // SHIFT-TAB: forward in drawing order (newer shapes)
                    newIndex = (currentIndex + 1) % shapes.length;
                } else {
                    // TAB: backward in drawing order (older shapes)
                    newIndex = (currentIndex - 1 + shapes.length) % shapes.length;
                }
            }
        }

        this.selectShape(shapes[newIndex]);
    }


    // ============================ Button Handling ============================

    buttonClicked(buttonID, button) {
        // Handle tool selection from button clicks
        if (this.toolPaletteView && this.toolPaletteView.toolButtons) {
            const toolButton = this.toolPaletteView.toolButtons.find(tb => tb.toolId === buttonID);
            if (toolButton) {
                this.toolManager.setTool(buttonID);
                this.updateToolSelection(buttonID);
            }
        }
    }

    updateToolSelection(selectedToolId) {
        console.log("updateToolSelection", selectedToolId);
        if (this.toolPaletteView) {
            this.toolPaletteView.updateToolSelection(selectedToolId);
        }
    }

    // ============================ Utility Methods ============================

    getSelectedShape() {
        return this.selectedShape;
    }

    getToolManager() {
        return this.toolManager;
    }

    getDrawing() {
        return this.drawing;
    }

    toggleHelp() {
        this.showHelp = !this.showHelp;
    }

    getShowHelp() {
        return this.showHelp;
    }

    openColorPicker(toolType) {
        // Get selected shape (if any)
        const selectedShapes = this.drawing.getShapes().filter(shape => shape.selected);
        let targetShape = null;
        let initialColor;
        const colorType = toolType === Tools.TOOLS.FILL_COLOR ? 'fill' : 'stroke';
        
        if (selectedShapes.length > 0) {
            // Use the first selected shape
            targetShape = selectedShapes[0];
            initialColor = colorType === 'fill' ? targetShape.fillColor : targetShape.strokeColor;
        } else {
            // No shape selected - use default colors
            initialColor = colorType === 'fill' ? this.toolManager.fillColor : this.toolManager.strokeColor;
        }
        
        // Save state for undo before opening color picker
        this.colorPickerInitialState = {
            shape: targetShape,
            colorType: colorType,
            initialColor: initialColor
        };
        
        // Create color picker controller
        this.colorPickerController = new ColorPickerController(
            this,
            initialColor,
            colorType,
            targetShape,
            (finalColor) => this.onColorPickerAccept(finalColor),
            () => this.onColorPickerCancel(),
            this.recentColors
        );
    }

    closeColorPicker() {
        // Just clear the reference - the controller calls destroy() on itself
        this.colorPickerController = null;
    }

    onColorPickerAccept(finalColor) {
        // Only save undo state if a shape was modified
        if (this.colorPickerInitialState && this.colorPickerInitialState.shape) {
            this.saveUndoState('change color');
        }
        
        // Add to recent colors
        this.addRecentColor(finalColor);
        
        // Color is already applied to the shape or default colors, just close the picker
        this.colorPickerInitialState = null;
    }

    onColorPickerCancel() {
        // Undo state is handled by the ColorPickerController (restores initial color)
        this.colorPickerInitialState = null;
    }

    addRecentColor(colorStr) {
        // Remove if already exists
        const index = this.recentColors.indexOf(colorStr);
        if (index > -1) {
            this.recentColors.splice(index, 1);
        }
        
        // Add to front
        this.recentColors.unshift(colorStr);
        
        // Limit to max
        if (this.recentColors.length > this.maxRecentColors) {
            this.recentColors = this.recentColors.slice(0, this.maxRecentColors);
        }
    }

    getRecentColors() {
        return this.recentColors;
    }

    // ============================ Clipboard Operations ============================

    copySelectedShapes() {
        const selectedShapes = this.drawing.getShapes().filter(shape => shape.selected);
        if (selectedShapes.length === 0) return;
        
        // Serialize selected shapes to clipboard
        this.clipboard = selectedShapes.map(shape => this.drawing.serializeShape(shape));
        // Reset paste count for new clipboard content
        this.pasteCount = 0;
    }

    cutSelectedShapes() {
        const selectedShapes = this.drawing.getShapes().filter(shape => shape.selected);
        if (selectedShapes.length === 0) return;
        
        // Copy to clipboard
        this.copySelectedShapes();
        
        // Save state for undo
        this.saveUndoState('cut');
        
        // Delete selected shapes
        for (let shape of selectedShapes) {
            this.drawing.removeShape(shape);
        }
        this.selectedShape = null;
    }

    pasteShapes() {
        if (!this.clipboard || this.clipboard.length === 0) return;
        
        // Save state for undo
        this.saveUndoState('paste');
        
        // Increment paste count for cumulative offset
        this.pasteCount++;
        
        // Clear current selection
        this.drawing.clearSelection();
        
        // Paste shapes with cumulative offset (10 pixels per paste)
        const offset = 10 * this.pasteCount;
        for (let shapeData of this.clipboard) {
            // Deserialize the shape
            const shape = this.deserializeShapeWithOffset(shapeData, offset);
            if (shape) {
                this.drawing.addShape(shape);
                shape.selected = true;
            }
        }
    }

    deserializeShapeWithOffset(shapeData, offset) {
        const ShapeClasses = this.drawing.getShapeClasses();
        const type = shapeData.type;
        
        switch (type) {
            case 'Line':
                return new ShapeClasses.Line(
                    shapeData.x + offset, shapeData.y + offset,
                    shapeData.x2 + offset, shapeData.y2 + offset,
                    shapeData.strokeColor, shapeData.strokeWidth
                );
            case 'Circle':
                return new ShapeClasses.Circle(
                    shapeData.x + offset, shapeData.y + offset,
                    shapeData.radius,
                    shapeData.fillColor, shapeData.strokeColor, shapeData.strokeWidth
                );
            case 'Oval':
                return new ShapeClasses.Oval(
                    shapeData.x + offset, shapeData.y + offset,
                    shapeData.radiusX, shapeData.radiusY,
                    shapeData.fillColor, shapeData.strokeColor, shapeData.strokeWidth
                );
            case 'Rectangle':
                return new ShapeClasses.Rectangle(
                    shapeData.x + offset, shapeData.y + offset,
                    shapeData.width, shapeData.height,
                    shapeData.fillColor, shapeData.strokeColor, shapeData.strokeWidth
                );
            case 'Polygon':
                const polyPoints = shapeData.points.map(p => ({ x: p.x + offset, y: p.y + offset }));
                return new ShapeClasses.Polygon(
                    polyPoints,
                    shapeData.fillColor, shapeData.strokeColor, shapeData.strokeWidth
                );
            case 'Spline':
                const splinePoints = shapeData.points.map(p => ({ x: p.x + offset, y: p.y + offset }));
                return new ShapeClasses.Spline(
                    splinePoints,
                    shapeData.fillColor, shapeData.strokeColor, shapeData.strokeWidth
                );
            case 'BezierSpline':
                const bezierPoints = shapeData.points.map(p => ({ x: p.x + offset, y: p.y + offset }));
                const bezierSpline = new ShapeClasses.BezierSpline(
                    bezierPoints,
                    shapeData.fillColor, shapeData.strokeColor, shapeData.strokeWidth
                );
                // Restore control points with offset if available
                if (shapeData.controlPoints) {
                    bezierSpline.controlPoints = shapeData.controlPoints.map(p => ({ x: p.x + offset, y: p.y + offset }));
                }
                // Restore manually edited control points set
                if (shapeData.manuallyEditedControls) {
                    bezierSpline.manuallyEditedControls = new Set(shapeData.manuallyEditedControls);
                }
                return bezierSpline;
            default:
                return null;
        }
    }

    // ============================ Undo Operations ============================

    saveUndoState(action) {
        // Finalize any ongoing nudge sequence before saving new state
        if (this.isNudging && action !== 'move') {
            this.finalizeNudge();
        }
        
        // Finalize any ongoing reorder sequence before saving new state
        if (this.isReordering && action !== 'reorder') {
            this.finalizeReorder();
        }
        
        const state = {
            action: action,
            shapes: this.drawing.getShapes().map(shape => {
                const serialized = this.drawing.serializeShape(shape);
                return {
                    data: serialized,
                    type: serialized.type
                };
            })
        };
        
        this.undoStack.push(state);
        
        // Clear redo stack when a new action is performed
        this.redoStack = [];
        
        // Limit undo stack size
        if (this.undoStack.length > this.maxUndoLevels) {
            this.undoStack.shift();
        }
    }

    finalizeNudge() {
        if (this.nudgeTimer) {
            clearTimeout(this.nudgeTimer);
            this.nudgeTimer = null;
        }
        this.isNudging = false;
    }

    finalizeReorder() {
        if (this.reorderTimer) {
            clearTimeout(this.reorderTimer);
            this.reorderTimer = null;
        }
        this.isReordering = false;
    }

    undo() {
        if (this.undoStack.length === 0) return;
        
        // Finalize any ongoing nudge sequence
        this.finalizeNudge();
        
        // Finalize any ongoing reorder sequence
        this.finalizeReorder();
        
        // Save current state to redo stack
        const currentState = {
            action: 'undo',
            shapes: this.drawing.getShapes().map(shape => {
                const serialized = this.drawing.serializeShape(shape);
                return {
                    data: serialized,
                    type: serialized.type
                };
            })
        };
        this.redoStack.push(currentState);
        
        // Get and restore previous state
        const previousState = this.undoStack.pop();
        
        // Clear current shapes
        this.drawing.clearShapes();
        
        // Restore previous shapes
        for (let shapeInfo of previousState.shapes) {
            const shape = this.drawing.deserializeShape(shapeInfo.type, shapeInfo.data);
            if (shape) {
                this.drawing.addShape(shape);
            }
        }
        
        this.selectedShape = null;
    }

    redo() {
        if (this.redoStack.length === 0) return;
        
        // Finalize any ongoing nudge sequence
        this.finalizeNudge();
        
        // Finalize any ongoing reorder sequence
        this.finalizeReorder();
        
        // Save current state to undo stack
        const currentState = {
            action: 'redo',
            shapes: this.drawing.getShapes().map(shape => {
                const serialized = this.drawing.serializeShape(shape);
                return {
                    data: serialized,
                    type: serialized.type
                };
            })
        };
        this.undoStack.push(currentState);
        
        // Get and restore redo state
        const redoState = this.redoStack.pop();
        
        // Clear current shapes
        this.drawing.clearShapes();
        
        // Restore redo shapes
        for (let shapeInfo of redoState.shapes) {
            const shape = this.drawing.deserializeShape(shapeInfo.type, shapeInfo.data);
            if (shape) {
                this.drawing.addShape(shape);
            }
        }
        
        this.selectedShape = null;
    }

    // ============================ File Operations ============================

    setFilename(filename) {
        this.currentFilename = filename;
    }

    loadFile(filename) {
        try {
            const fileData = fs.readFileSync(filename, 'utf8');
            const data = JSON.parse(fileData);
            
            // Verify file format
            if (!data.fileFormat || !data.fileFormat.startsWith('skrbl-v')) {
                console.error('Invalid file format');
                return false;
            }
            
            // Clear current drawing
            this.drawing.clearShapes();
            
            // Load shapes
            if (data.shapes) {
                for (let shapeInfo of data.shapes) {
                    const shape = this.drawing.deserializeShape(shapeInfo.type, shapeInfo.data);
                    if (shape) {
                        this.drawing.addShape(shape);
                    }
                }
            }
            
            // Load recent colors if available
            if (data.recentColors) {
                this.recentColors = data.recentColors;
            }
            
            this.currentFilename = filename;
            console.log('Loaded file:', filename);
            return true;
        } catch (error) {
            console.error('Failed to load file:', error);
            return false;
        }
    }

    saveFile() {
        // Generate filename if not set
        if (!this.currentFilename) {
            const now = new Date();
            const dateStr = now.toISOString().replace(/[:.]/g, '-').split('T')[0];
            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
            this.currentFilename = `drawing-${dateStr}-${timeStr}.skrbl`;
        }
        
        try {
            const data = {
                fileFormat: 'skrbl-v0.0.1',
                shapes: this.drawing.getShapes().map(shape => {
                    const serialized = this.drawing.serializeShape(shape);
                    return {
                        type: serialized.type,
                        data: serialized
                    };
                }),
                recentColors: this.recentColors
            };
            
            const jsonData = JSON.stringify(data, null, 2);
            fs.writeFileSync(this.currentFilename, jsonData, 'utf8');
            console.log('Saved file:', this.currentFilename);
            return true;
        } catch (error) {
            console.error('Failed to save file:', error);
            return false;
        }
    }
}

module.exports = DrawingController;
