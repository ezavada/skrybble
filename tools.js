// Tool management and drawing state

const TOOLS = {
    SELECT: 'select',
    LINE: 'line',
    FREEHAND: 'freehand',
    SPLINE: 'spline',
    BEZIER: 'bezier',
    CIRCLE: 'circle',
    OVAL: 'oval',
    RECT: 'rect',
    QUAD: 'quad',
    POLY: 'poly',
    IMAGE: 'image',
    FILL_COLOR: 'fillcolor',
    LINE_COLOR: 'linecolor',
    HELP: 'help'
};

const TOOL_SHORTCUTS = {
    // Note: ESC key is handled specially in DrawingController.handleKeyPress
    'L': TOOLS.LINE,
    'S': TOOLS.SPLINE,
    'B': TOOLS.BEZIER,
    'C': TOOLS.CIRCLE,
    'O': TOOLS.OVAL,
    'R': TOOLS.RECT,
    'Q': TOOLS.QUAD,
    'P': TOOLS.POLY,
    'I': TOOLS.IMAGE,
    'F': TOOLS.FREEHAND,
    'M': TOOLS.FILL_COLOR,
    'N': TOOLS.LINE_COLOR,
    'H': TOOLS.HELP
};

class Tools {
    static TOOL_SHORTCUTS = TOOL_SHORTCUTS;
    static TOOLS = TOOLS;

    constructor(ShapeClasses) {
        this.ShapeClasses = ShapeClasses;
        this.currentTool = TOOLS.SELECT;
        this.fillColor = 'white';
        this.strokeColor = 'black';
        this.strokeWidth = 1;
        
        // Drawing state
        this.isDrawing = false;
        this.currentShape = null;
        this.startPoint = null;
        this.lastPoint = null;
        this.freehandPoints = []; // Track points for freehand drawing
    }

    setTool(tool) {
        this.currentTool = tool;
        this.finishCurrentDrawing();
    }

    getCurrentTool() {
        return this.currentTool;
    }

    setColors(fillColor, strokeColor) {
        this.fillColor = fillColor;
        this.strokeColor = strokeColor;
    }

    setStrokeWidth(width) {
        this.strokeWidth = width;
    }

    startDrawing(x, y) {
        this.isDrawing = true;
        this.startPoint = { x, y };
        this.lastPoint = { x, y };

        switch (this.currentTool) {
            case TOOLS.LINE:
                this.currentShape = new this.ShapeClasses.Line(x, y, x, y, this.strokeColor, this.strokeWidth);
                break;
            case TOOLS.CIRCLE:
                this.currentShape = new this.ShapeClasses.Circle(x, y, 0, this.fillColor, this.strokeColor, this.strokeWidth);
                break;
            case TOOLS.OVAL:
                this.currentShape = new this.ShapeClasses.Oval(x, y, 0, 0, this.fillColor, this.strokeColor, this.strokeWidth);
                break;
            case TOOLS.RECT:
                this.currentShape = new this.ShapeClasses.Rectangle(x, y, 0, 0, this.fillColor, this.strokeColor, this.strokeWidth);
                break;
            case TOOLS.SPLINE:
                // For Cardinal Spline, first click creates both control points and one endpoint at same location
                // addition point is created when click completes
                this.currentShape = new this.ShapeClasses.Spline([{ x, y }, { x, y }, { x, y }], this.fillColor, this.strokeColor, this.strokeWidth);
                this.currentShape.underConstruction = true;
                break;
            case TOOLS.BEZIER:
                this.currentShape = new this.ShapeClasses.BezierSpline([{ x, y }], this.fillColor, this.strokeColor, this.strokeWidth);
                this.currentShape.underConstruction = true;
                break;
            case TOOLS.POLY:
                this.currentShape = new this.ShapeClasses.Polygon([{ x, y }], this.fillColor, this.strokeColor, this.strokeWidth);
                this.currentShape.underConstruction = true;
                break;
            case TOOLS.QUAD:
                this.currentShape = new this.ShapeClasses.Polygon([{ x, y }], this.fillColor, this.strokeColor, this.strokeWidth);
                this.currentShape.underConstruction = true;
                this.currentShape.isQuad = true; // Mark as quad for auto-finish after 4 points
                break;
            case TOOLS.FREEHAND:
                // Start collecting points for freehand drawing
                this.freehandPoints = [{ x, y }];
                this.currentShape = new this.ShapeClasses.Spline([{ x, y }, { x, y }, { x, y }], this.fillColor, this.strokeColor, this.strokeWidth);
                this.currentShape.underConstruction = true;
                this.currentShape.freehand = true; // Mark as freehand to avoid drawing control points
                break;
        }
    }

    updateDrawing(x, y) {
        if (!this.currentShape) return;

        switch (this.currentTool) {
            case TOOLS.LINE:
                this.currentShape.x2 = x;
                this.currentShape.y2 = y;
                break;
            case TOOLS.CIRCLE:
                const dx = x - this.startPoint.x;
                const dy = y - this.startPoint.y;
                this.currentShape.radius = Math.sqrt(dx * dx + dy * dy);
                break;
            case TOOLS.OVAL:
                const dxOval = Math.abs(x - this.startPoint.x);
                const dyOval = Math.abs(y - this.startPoint.y);
                this.currentShape.radiusX = dxOval;
                this.currentShape.radiusY = dyOval;
                break;
            case TOOLS.RECT:
                this.currentShape.width = x - this.startPoint.x;
                this.currentShape.height = y - this.startPoint.y;
                break;
            case TOOLS.SPLINE:
                // Cardinal Spline starts with 3 points (control, 2 endpoints, control)
                const numPointsSpline = this.currentShape.points.length;
                if (numPointsSpline >= 2) {
                    // Update the last (temporary) point and control point
                    this.currentShape.points[numPointsSpline - 2] = { x, y };
                    this.currentShape.points[numPointsSpline - 1] = { x, y };
                }
                break;
            case TOOLS.BEZIER:
            case TOOLS.POLY:
            case TOOLS.QUAD:
                const numPoints = this.currentShape.points.length;
                if (numPoints > 0) {
                    // Update or add a temporary preview point
                    if (numPoints === 1) {
                        // Only one point so far, add temporary second point for preview
                        this.currentShape.points.push({ x, y });
                    } else {
                        // Update the last (temporary) point
                        this.currentShape.points[numPoints - 1] = { x, y };
                    }
                    // Regenerate control points for preview
                    if (this.currentShape.generateControlPoints) {
                        this.currentShape.controlPoints = this.currentShape.generateControlPoints();
                    }
                }
                break;
            case TOOLS.FREEHAND:
                // Only add point if it's more than 2px from the last point
                if (this.freehandPoints.length > 0) {
                    const lastPoint = this.freehandPoints[this.freehandPoints.length - 1];
                    const dx = x - lastPoint.x;
                    const dy = y - lastPoint.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance >= 2) {
                        this.freehandPoints.push({ x, y });
                        
                        // Update the spline with all collected points
                        // For Cardinal spline, we need control points at start and end
                        if (this.freehandPoints.length >= 2) {
                            const points = [...this.freehandPoints];
                            // Add control point at beginning
                            points.unshift({ ...points[0] });
                            // Add control point at end
                            points.push({ ...points[points.length - 1] });
                            this.currentShape.points = points;
                        }
                    }
                }
                break;
        }
    }

    finishCurrentDrawing() {
        this.isDrawing = false;
        this.currentShape = null;
        this.lastPoint = null;
        this.freehandPoints = [];
    }

    addPointToShape(x, y) {
        if (!this.currentShape) return;
        
        const point = { x, y };
        
        switch (this.currentTool) {
            case TOOLS.SPLINE:
                if (this.currentShape.points) {
                    // Replace the last (preview) point with the clicked point
                    // This "confirms" the preview point as a real point
                    const numPoints = this.currentShape.points.length;
                    if (numPoints >= 2) {
                        this.currentShape.points[numPoints - 2] = point;
                        this.currentShape.points[numPoints - 1] = point;
                    }
                    // Add a new control point at the same location
                    this.currentShape.points.push({ ...point });
                    // Regenerate control points
                    if (this.currentShape.generateControlPoints) {
                        this.currentShape.controlPoints = this.currentShape.generateControlPoints(true);
                    }
                }
                break;
            case TOOLS.BEZIER:
                if (this.currentShape.points) {
                    // Replace the last (preview) point with the clicked point
                    // This "confirms" the preview point as a real point
                    const numPoints = this.currentShape.points.length;
                    if (numPoints > 0) {
                        if (this.currentTool === TOOLS.SPLINE) {
                            // for cardinal spline, make sure the endpoint is the same as the control point
                            this.currentShape.points[numPoints - 2] = point;
                        }
                        this.currentShape.points[numPoints - 1] = point;
                    }
                    // Add a new preview point at the same location
                    this.currentShape.points.push({ ...point });
                    // Regenerate control points
                    if (this.currentShape.generateControlPoints) {
                        this.currentShape.controlPoints = this.currentShape.generateControlPoints(true);
                    }
                }
                break;
            case TOOLS.POLY:
                if (this.currentShape.points) {
                    // Same logic for polygons
                    const numPoints = this.currentShape.points.length;
                    if (numPoints > 0) {
                        this.currentShape.points[numPoints - 1] = point;
                    }
                    this.currentShape.points.push({ ...point });
                }
                break;
            case TOOLS.QUAD:
                if (this.currentShape.points) {
                    // Same logic as polygons
                    const numPoints = this.currentShape.points.length;
                    if (numPoints > 0) {
                        this.currentShape.points[numPoints - 1] = point;
                    }
                    this.currentShape.points.push({ ...point });
                }
                break;
        }
    }

    removeLastPoint() {
        if (!this.currentShape) return;
        
        switch (this.currentTool) {
            case TOOLS.SPLINE:
                // For cardinal spline: [control, endpoint1, ..., endpointN, control]
                // At 4 points (control, endpoint, endpoint/preview, control), delete entirely
                // At 5+ points, remove last endpoint
                if (this.currentShape.points && this.currentShape.points.length <= 4) {
                    // Delete the entire shape
                    this.finishCurrentDrawing();
                } else if (this.currentShape.points && this.currentShape.points.length > 4) {
                    this.currentShape.points.pop();
                }
                break;
            case TOOLS.BEZIER:
            case TOOLS.POLY:
            case TOOLS.QUAD:
                if (this.currentShape.points && this.currentShape.points.length > 2) {
                    this.currentShape.points.pop();
                    // For splines, regenerate control points
                    if (this.currentShape.generateControlPoints) {
                        this.currentShape.controlPoints = this.currentShape.generateControlPoints();
                    }
                } else if (this.currentShape.points && this.currentShape.points.length <= 2) {
                    // If only 2 or fewer points left, cancel the drawing
                    this.finishCurrentDrawing();
                }
                break;
        }
    }

    finishMultiPointShape(isDoubleClick = false) {
        if (!this.currentShape) return null;
        
        const shape = this.currentShape;
        
        // Check if we have enough points to make a valid shape
        let minPoints = 2;
        if (this.currentTool === TOOLS.POLY) {
            minPoints = 3;
        }
        if (this.currentTool === TOOLS.QUAD) {
            minPoints = 4; // Quad needs exactly 4 points
        }
        if (this.currentTool === TOOLS.SPLINE) {
            // For double-click: need initial control, one endpoint, extra from double-click, preview = 4
            // For right-click: need initial control, one endpoint, preview = 3
            minPoints = isDoubleClick ? 4 : 3;
        }
        
        if (shape.points && shape.points.length >= minPoints) {
            // Remove the last preview point (it's just following the mouse)
            shape.points.pop();
            
            // For Cardinal Spline, handle final control point
            if (this.currentTool === TOOLS.SPLINE && shape.points.length >= 2) {
                if (isDoubleClick) {
                    // Remove the extra point added by the first click of the double-click
                    shape.points.pop();
                }
                const lastPoint = shape.points[shape.points.length - 1];
                // Add final control point at same location as last endpoint
                shape.points.push({ x: lastPoint.x, y: lastPoint.y });
            }
            
            // Regenerate control points one final time after removing preview
            if (shape.generateControlPoints) {
                shape.controlPoints = shape.generateControlPoints(true);
            }
            
            // Mark shape as no longer under construction
            if (shape.underConstruction !== undefined) {
                shape.underConstruction = false;
            }
            this.finishCurrentDrawing();
            return shape;
        }
        
        // Not enough points, cancel
        this.finishCurrentDrawing();
        return null;
    }

    getCurrentShape() {
        return this.currentShape;
    }

    isCurrentlyDrawing() {
        return this.isDrawing;
    }

    hasMinimumSize() {
        // Minimum distance threshold in pixels
        const MIN_SIZE = 3;
        
        if (!this.currentShape || !this.startPoint) {
            return false;
        }
        
        // Check based on tool type
        switch (this.currentTool) {
            case TOOLS.LINE:
                const dx = this.currentShape.x2 - this.currentShape.x;
                const dy = this.currentShape.y2 - this.currentShape.y;
                return Math.sqrt(dx * dx + dy * dy) >= MIN_SIZE;
            
            case TOOLS.CIRCLE:
                return this.currentShape.radius >= MIN_SIZE;
            
            case TOOLS.OVAL:
                return this.currentShape.radiusX >= MIN_SIZE || this.currentShape.radiusY >= MIN_SIZE;
            
            case TOOLS.RECT:
                return Math.abs(this.currentShape.width) >= MIN_SIZE || 
                       Math.abs(this.currentShape.height) >= MIN_SIZE;
            
            default:
                return true;
        }
    }
    
    isQuadReady() {
        // Check if quad has 4 points (excluding the preview point)
        if (!this.currentShape || !this.currentShape.isQuad) {
            return false;
        }
        // Points array has: point1, point2, point3, point4, preview
        // So when length is 5, we have 4 actual points + 1 preview = ready to finish
        return this.currentShape.points && this.currentShape.points.length >= 5;
    }
}

module.exports = Tools;
