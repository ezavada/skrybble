// Tool management and drawing state

const TOOLS = {
    SELECT: 'select',
    LINE: 'line',
    SPLINE: 'spline',
    BEZIER: 'bezier',
    CIRCLE: 'circle',
    OVAL: 'oval',
    RECT: 'rect',
    QUAD: 'quad',
    POLY: 'poly',
    IMAGE: 'image'
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
    'I': TOOLS.IMAGE
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
                this.currentShape = new this.ShapeClasses.Spline([{ x, y }, { x, y }], this.fillColor, this.strokeColor, this.strokeWidth);
                this.currentShape.underConstruction = true;
                this.selected = true;
                break;
            case TOOLS.BEZIER:
                console.log('created bezier spline');
                this.currentShape = new this.ShapeClasses.BezierSpline([{ x, y }, { x, y }], this.fillColor, this.strokeColor, this.strokeWidth);
                this.currentShape.underConstruction = true;
                this.selected = true;
                break;
            case TOOLS.POLY:
                this.currentShape = new this.ShapeClasses.Polygon([{ x, y }, { x, y }], this.fillColor, this.strokeColor, this.strokeWidth);
                this.currentShape.underConstruction = true;
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
            case TOOLS.BEZIER:
            case TOOLS.POLY:
                const numPoints = this.currentShape.points.length;
                if (numPoints > 1) {
                    this.currentShape.points[numPoints - 1] = { x, y };
                }
                break;
        }
    }

    finishCurrentDrawing() {
        this.isDrawing = false;
        this.currentShape = null;
        this.lastPoint = null;
    }

    addPointToShape(x, y) {
        if (!this.currentShape) return;
        
        const point = { x, y };
        
        switch (this.currentTool) {
            case TOOLS.SPLINE:
            case TOOLS.BEZIER:
                if (this.currentShape.addPoint) {
                    this.currentShape.addPoint(point);
                }
                break;
            case TOOLS.POLY:
                if (this.currentShape.points) {
                    this.currentShape.points.push(point);
                }
                break;
        }
    }

    removeLastPoint() {
        if (!this.currentShape) return;
        
        switch (this.currentTool) {
            case TOOLS.SPLINE:
            case TOOLS.BEZIER:
            case TOOLS.POLY:
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

    finishMultiPointShape() {
        if (!this.currentShape) return null;
        
        const shape = this.currentShape;
        
        // Check if we have enough points to make a valid shape
        let minPoints = 2;
        if (this.currentTool === TOOLS.POLY) {
            minPoints = 3;
        }
        
        if (shape.points && shape.points.length >= minPoints) {
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
}

module.exports = Tools;
