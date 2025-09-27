// Tool management and drawing state

const TOOLS = {
    SELECT: 'select',
    LINE: 'line',
    SPLINE: 'spline',
    CIRCLE: 'circle',
    OVAL: 'oval',
    RECT: 'rect',
    QUAD: 'quad',
    POLY: 'poly',
    IMAGE: 'image'
};

const TOOL_SHORTCUTS = {
    'esc': TOOLS.SELECT,
    'L': TOOLS.LINE,
    'S': TOOLS.SPLINE,
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

    constructor() {
        this.currentTool = TOOLS.SELECT;
        this.fillColor = 'white';
        this.strokeColor = 'black';
        this.strokeWidth = 1;
        
        // Drawing state
        this.isDrawing = false;
        this.currentShape = null;
        this.startPoint = null;
        this.tempPoints = [];
        this.polygonPoints = [];
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

    startDrawing(x, y, ShapeClasses) {
        this.isDrawing = true;
        this.startPoint = { x, y };
        this.tempPoints = [{ x, y }];

        switch (this.currentTool) {
            case TOOLS.LINE:
                this.currentShape = new ShapeClasses.Line(x, y, x, y, this.strokeColor, this.strokeWidth);
                break;
            case TOOLS.CIRCLE:
                this.currentShape = new ShapeClasses.Circle(x, y, 0, this.fillColor, this.strokeColor, this.strokeWidth);
                break;
            case TOOLS.OVAL:
                this.currentShape = new ShapeClasses.Oval(x, y, 0, 0, this.fillColor, this.strokeColor, this.strokeWidth);
                break;
            case TOOLS.RECT:
                this.currentShape = new ShapeClasses.Rectangle(x, y, 0, 0, this.fillColor, this.strokeColor, this.strokeWidth);
                break;
            case TOOLS.SPLINE:
            case TOOLS.POLY:
                // These will be handled differently - no immediate shape creation
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
        }
    }

    addPoint(x, y, ShapeClasses) {
        if (this.currentTool === TOOLS.SPLINE) {
            this.tempPoints.push({ x, y });
            if (this.tempPoints.length >= 2) {
                this.currentShape = new ShapeClasses.Spline([...this.tempPoints], this.fillColor, this.strokeColor, this.strokeWidth);
                return this.currentShape;
            }
        } else if (this.currentTool === TOOLS.POLY) {
            this.polygonPoints.push({ x, y });
            if (this.polygonPoints.length >= 3) {
                this.currentShape = new ShapeClasses.Polygon([...this.polygonPoints], this.fillColor, this.strokeColor, this.strokeWidth);
                return this.currentShape;
            }
        }
        return null;
    }

    finishCurrentDrawing() {
        this.isDrawing = false;
        this.currentShape = null;
        this.tempPoints = [];
        this.polygonPoints = [];
    }

    getCurrentShape() {
        return this.currentShape;
    }

    isCurrentlyDrawing() {
        return this.isDrawing;
    }

    getDrawingState() {
        return {
            isDrawing: this.isDrawing,
            currentShape: this.currentShape,
            startPoint: this.startPoint,
            tempPoints: this.tempPoints,
            polygonPoints: this.polygonPoints
        };
    }
}

module.exports = Tools;
