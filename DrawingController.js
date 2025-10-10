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
        this.toolManager = new Tools();
        this.drawing = new Drawing();
        
        // Input handling state
        this.draggedPoint = null;
        this.selectedShape = null;
    }
    
    setupViews() {
        const drawingArea = this.port.getDrawingArea();
        
        // Create tool palette at the top
        const paletteHeight = 50;
        const paletteRect = new pdg.Rect(drawingArea);
        paletteRect.setHeight(paletteHeight);
        this.toolPaletteView = new ToolPaletteView(this, paletteRect, ViewBinding.grow_Horiz + ViewBinding.bind_Top);
        
        // Create drawing surface below the palette
        const surfaceRect = new pdg.Rect(drawingArea);
        surfaceRect.top = paletteHeight;
        surfaceRect.setHeight(drawingArea.height() - paletteHeight);
        this.backgroundView = new DrawingSurfaceView(this, surfaceRect, ViewBinding.grow);

        console.log('DrawingController::setupViews, paletteRect', paletteRect);
        console.log('DrawingController::setupViews, surfaceRect', surfaceRect);
    }

    // ============================ Event Handling Overrides ============================

    doMouseDown(mouseInfo, view, id, part) {
        // Only handle mouse events on the drawing surface
        if (view === this.backgroundView) {
            return this.handleMouseDown(mouseInfo);
        }
        if (view === this.toolPaletteView) {
            // TODO: Handle tool selection from tool palette
        }
        return false;
    }

    doMouseUp(mouseInfo, view, id, part) {
        // Only handle mouse events on the drawing surface
        if (view === this.backgroundView) {
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
        } else {
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

        if (this.toolManager.isCurrentlyDrawing()) {
            const currentTool = this.toolManager.getCurrentTool();
            
            // For single-click tools (line, circle, oval, rect), finish on mouse up
            if (currentTool === Tools.TOOLS.LINE || currentTool === Tools.TOOLS.CIRCLE || 
                currentTool === Tools.TOOLS.OVAL || currentTool === Tools.TOOLS.RECT) {
                const finishedShape = this.toolManager.getCurrentShape();
                
                // Check if the shape is valid (mouse moved more than minimum distance)
                if (finishedShape && this.toolManager.hasMinimumSize()) {
                    this.drawing.addShape(finishedShape);
                    this.selectShape(finishedShape);
                }
                this.toolManager.finishCurrentDrawing();
            } else {
                // For multi-click tools (spline, poly), handle via addPoint
                const finishedShape = this.toolManager.addPoint(pos.x, pos.y, this.drawing.getShapeClasses());
                if (finishedShape) {
                    this.drawing.addShape(finishedShape);
                    this.selectShape(finishedShape);
                }
            }
        }
        
        this.draggedPoint = null;
        return true;
    }

    handleSelectMode(x, y) {
        // Check if clicking on an endpoint or control point
        const shapes = this.drawing.getShapes();
        for (let shape of shapes) {
            const endpoints = shape.getEndpoints();
            const controlPoints = shape.getControlPoints();
            
            // Check endpoints
            for (let i = 0; i < endpoints.length; i++) {
                const ep = endpoints[i];
                if (Math.abs(x - ep.x) < 6 && Math.abs(y - ep.y) < 6) {
                    this.draggedPoint = { shape, type: 'endpoint', index: i };
                    return;
                }
            }
            
            // Check control points
            for (let i = 0; i < controlPoints.length; i++) {
                const cp = controlPoints[i];
                if (Math.abs(x - cp.x) < 6 && Math.abs(y - cp.y) < 6) {
                    this.draggedPoint = { shape, type: 'control', index: i };
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
            if (controlPoints[index] && shape.constructor.name === 'Spline') {
                controlPoints[index].x = x;
                controlPoints[index].y = y;
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
            case 'Spline':
                shape.points[index].x = x;
                shape.points[index].y = y;
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

    handleKeyPress(event) {
        // Handle key press events for color selection
        let key = '';
        if (event && event.unicode) {
            key = String.fromCharCode(event.unicode).toUpperCase();
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
            case '\u007f': // Delete key
            case '\b': // Backspace key
                if (this.selectedShape) {
                    this.drawing.removeShape(this.selectedShape);
                    this.selectedShape = null;
                }
                return true;
            case '\u001b': // Escape key
                this.toolManager.finishCurrentDrawing();
                this.selectShape(null);
                // Switch to SELECT tool
                this.toolManager.setTool(Tools.TOOLS.SELECT);
                this.updateToolSelection(Tools.TOOLS.SELECT);
                return true;
        }
        return true;
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
