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
        this.lastDrawnShape = null; // Track the most recently drawn shape
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

    doKeyUp(keyUpInfo, view, id, part) {
        return this.handleKeyUp(keyUpInfo);
    }

    doKeyPress(keyPressInfo, view, id, part) {
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
            this.handleSelectMode(pos.x, pos.y);
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
        } else if (this.draggedPoint) {
            this.updateDraggedPoint(pos.x, pos.y);
        }
        return true;
    }

    handleMouseUp(event) {
        const pos = this.getMousePosition(event);
        const currentTool = this.toolManager.getCurrentTool();

        if (this.toolManager.isCurrentlyDrawing()) {
            // For single-action tools (line, circle, oval, rect), finish on mouse up
            if (currentTool === Tools.TOOLS.LINE || currentTool === Tools.TOOLS.CIRCLE || 
                currentTool === Tools.TOOLS.OVAL || currentTool === Tools.TOOLS.RECT) {
                const finishedShape = this.toolManager.getCurrentShape();
                
                // Check if the shape is valid (mouse moved more than minimum distance)
                if (finishedShape && this.toolManager.hasMinimumSize()) {
                    this.drawing.addShape(finishedShape);
                    this.lastDrawnShape = finishedShape;
                    
                    // If shift is held, stay in drawing mode. Otherwise, select and switch to SELECT
                    if (event.shift) {
                        // Don't select, stay in current tool
                        this.selectShape(null);
                    } else {
                        // Select the shape and switch to SELECT mode
                        this.selectShape(finishedShape);
                        this.toolManager.setTool(Tools.TOOLS.SELECT);
                        this.updateToolSelection(Tools.TOOLS.SELECT);
                        this.lastDrawnShape = null;
                    }
                }
                this.toolManager.finishCurrentDrawing();
            }
            // For multi-point tools, don't finish on mouse up - wait for click or double-click
        }
        
        this.draggedPoint = null;
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
                const finishedShape = this.toolManager.finishMultiPointShape();
                if (finishedShape) {
                    this.drawing.addShape(finishedShape);
                    this.lastDrawnShape = finishedShape;
                    
                    // If shift is held, stay in drawing mode. Otherwise, select and switch to SELECT
                    if (event.shift) {
                        // Don't select, stay in current tool
                        this.selectShape(null);
                    } else {
                        // Select the shape and switch to SELECT mode
                        this.selectShape(finishedShape);
                        this.toolManager.setTool(Tools.TOOLS.SELECT);
                        this.updateToolSelection(Tools.TOOLS.SELECT);
                        this.lastDrawnShape = null;
                    }
                }
            }
            return true;
        }
        
        return false;
    }

    handleSelectMode(x, y) {
        // Check if clicking on an endpoint or control point
        const shapes = this.drawing.getShapes();
        for (let shape of shapes) {
            const endpoints = shape.getEndpoints();
            const controlPoints = shape.getControlPoints();
            
            // Check control points FIRST (they're smaller and have priority)
            for (let i = 0; i < controlPoints.length; i++) {
                const cp = controlPoints[i];
                if (Math.abs(x - cp.x) < 6 && Math.abs(y - cp.y) < 6) {
                    this.draggedPoint = { shape, type: 'control', index: i };
                    return;
                }
            }
            
            // Check endpoints
            for (let i = 0; i < endpoints.length; i++) {
                const ep = endpoints[i];
                if (Math.abs(x - ep.x) < 6 && Math.abs(y - ep.y) < 6) {
                    this.draggedPoint = { shape, type: 'endpoint', index: i };
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

        // Update selection
        this.selectShape(clickedShape);
    }

    selectShape(shape) {
        // Clear previous selections
        this.drawing.clearSelection();
        
        if (shape) {
            shape.selected = true;
            this.selectedShape = shape;
        } else {
            this.selectedShape = null;
        }
    }

    updateDraggedPoint(x, y) {
        if (!this.draggedPoint) return;

        const { shape, type, index } = this.draggedPoint;

        if (type === 'endpoint') {
            const endpoints = shape.getEndpoints();
            if (endpoints[index]) {
                this.updateShapeEndpoint(shape, index, x, y);
            }
        } else if (type === 'control') {
            const controlPoints = shape.getControlPoints();
            if (controlPoints[index]) {
                if (shape.constructor.name === 'Spline') {
                    // For Cardinal splines, control points are first and last points in the array
                    if (index === 0) {
                        shape.points[0].x = x;
                        shape.points[0].y = y;
                    } else if (index === 1) {
                        const lastIdx = shape.points.length - 1;
                        shape.points[lastIdx].x = x;
                        shape.points[lastIdx].y = y;
                    }
                } else if (shape.constructor.name === 'BezierSpline') {
                    controlPoints[index].x = x;
                    controlPoints[index].y = y;
                    // Mark this control point as manually edited
                    if (shape.manuallyEditedControls) {
                        shape.manuallyEditedControls.add(index);
                    }
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
                const dx = x - shape.x;
                const dy = y - shape.y;
                shape.radius = Math.sqrt(dx * dx + dy * dy);
                break;
            case 'Oval':
                const dxOval = Math.abs(x - shape.x);
                const dyOval = Math.abs(y - shape.y);
                if (index === 0 || index === 2) { // Top or bottom
                    shape.radiusY = dyOval;
                } else { // Left or right
                    shape.radiusX = dxOval;
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

    handleKeyUp(event) {
        // When shift is released, if we have a last drawn shape, select it and switch to SELECT mode
        if (event.keyCode === pdg.keyCode_Shift || event.keyCode === pdg.keyCode_ShiftLeft || event.keyCode === pdg.keyCode_ShiftRight) {
            if (this.lastDrawnShape) {
                this.selectShape(this.lastDrawnShape);
                this.toolManager.setTool(Tools.TOOLS.SELECT);
                this.updateToolSelection(Tools.TOOLS.SELECT);
                this.lastDrawnShape = null;
            }
        }
        return false;
    }

    handleKeyPress(event) {
        // Get unicode value (used for both regular keys and arrow keys)
        const unicode = event && event.unicode;
        
        // Check for arrow keys (unicode values 28-31)
        if (unicode >= 28 && unicode <= 31) {
            if (this.selectedShape) {
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
                
                this.drawing.moveShape(this.selectedShape, dx, dy);
                return true;
            }
            return false;
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
                if (this.selectedShape) {
                    this.drawing.removeShape(this.selectedShape);
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
}

module.exports = DrawingController;
