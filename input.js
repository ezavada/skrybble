// Input handling for mouse and keyboard events

const pdg = require('pdg');

export class InputHandler {
    constructor(port, toolManager, shapeManager) {
        this.port = port;
        this.toolManager = toolManager;
        this.shapeManager = shapeManager;
        
        this.draggedPoint = null;
        this.selectedShape = null;
    }

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

        if (currentTool === 'select') {
            this.handleSelectMode(pos.x, pos.y);
        } else {
            this.toolManager.startDrawing(pos.x, pos.y, this.shapeManager.getShapeClasses());
        }
    }

    handleMouseMove(event) {
        const pos = this.getMousePosition(event);

        if (this.toolManager.isCurrentlyDrawing()) {
            this.toolManager.updateDrawing(pos.x, pos.y);
        } else if (this.draggedPoint) {
            this.updateDraggedPoint(pos.x, pos.y);
        }
    }

    handleMouseUp(event) {
        const pos = this.getMousePosition(event);

        if (this.toolManager.isCurrentlyDrawing()) {
            const finishedShape = this.toolManager.addPoint(pos.x, pos.y, this.shapeManager.getShapeClasses());
            if (finishedShape) {
                this.shapeManager.addShape(finishedShape);
                this.selectShape(finishedShape);
            }
        }
        
        this.draggedPoint = null;
    }

    handleSelectMode(x, y) {
        // Check if clicking on an endpoint or control point
        const shapes = this.shapeManager.getShapes();
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
        this.shapeManager.clearSelection();
        
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

    handleKeyDown(event) {
        // Get the key from PDG event
        let key = '';
        if (event && event.unicode) {
            key = event.unicode.toLowerCase();
        }

        // Tool selection
        if (key in this.toolManager.constructor.TOOL_SHORTCUTS) {
            const tool = this.toolManager.constructor.TOOL_SHORTCUTS[key];
            this.toolManager.setTool(tool);
            return;
        }

        // Special keys
        switch (key) {
            case '\u007f': // Delete key
            case '\b': // Backspace key
                if (this.selectedShape) {
                    this.shapeManager.removeShape(this.selectedShape);
                    this.selectedShape = null;
                }
                break;
            case '\u001b': // Escape key
                this.toolManager.finishCurrentDrawing();
                this.selectShape(null);
                break;
        }

        // Color selection (simple color picker)
        this.handleColorSelection(event);
    }

    handleColorSelection(event) {
        let key = '';
        if (event && event.unicode) {
            key = event.unicode.toLowerCase();
        }

        switch (key) {
            case 'r':
                this.toolManager.setColors(this.toolManager.fillColor, 'red');
                break;
            case 'g':
                this.toolManager.setColors(this.toolManager.fillColor, 'green');
                break;
            case 'b':
                this.toolManager.setColors(this.toolManager.fillColor, 'blue');
                break;
            case 'k':
                this.toolManager.setColors(this.toolManager.fillColor, 'black');
                break;
            case 'w':
                this.toolManager.setColors('white', this.toolManager.strokeColor);
                break;
        }
    }

    getSelectedShape() {
        return this.selectedShape;
    }
}
