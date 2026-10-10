// Tool management and drawing state

const TOOLS = {
    SELECT: 'select',
    PAN: 'pan',
    ZOOM: 'zoom',
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
    TEXT: 'text',
    FONT: 'font',
    FILL_COLOR: 'fillcolor',
    LINE_COLOR: 'linecolor',
    LINE_WIDTH: 'linewidth',
    SMOOTHNESS: 'smoothness',
    HELP: 'help'
};

const TOOL_SHORTCUTS = {
    'V': TOOLS.SELECT,
    'H': TOOLS.PAN,
    '\\': TOOLS.LINE,
    'N': TOOLS.FREEHAND,
    'S': TOOLS.SPLINE,
    'P': TOOLS.BEZIER,
    'Shift+L': TOOLS.CIRCLE,
    'L': TOOLS.OVAL,
    'M': TOOLS.RECT,
    'Q': TOOLS.QUAD,
    'Shift+P': TOOLS.POLY,
    'Shift+I': TOOLS.IMAGE,
    'T': TOOLS.TEXT,
    'Shift+T': TOOLS.FONT,
    'F': TOOLS.FILL_COLOR,
    'Shift+F': TOOLS.LINE_COLOR,
    'Shift+W': TOOLS.LINE_WIDTH,
    'U': TOOLS.SMOOTHNESS,
    '?': TOOLS.HELP
};

class Tools {
    static TOOL_SHORTCUTS = TOOL_SHORTCUTS;
    static TOOLS = TOOLS;
    static TOOL_NAMES = {
        select:'Select',pan:'Pan',zoom:'Magnifier',line:'Line',freehand:'Freehand',spline:'Cardinal Spline',
        bezier:'Pen',circle:'Circle',oval:'Ellipse',rect:'Rectangle',quad:'Quad',poly:'Polygon',image:'Import image or drawing',
        text:'Text',font:'Font & style',fillcolor:'Fill color',linecolor:'Stroke color',linewidth:'Line width',smoothness:'Smoothness',help:'Help'
    };

    constructor(ShapeClasses) {
        this.ShapeClasses = ShapeClasses;
        this.currentTool = TOOLS.SELECT;
        this.fillColor = 'white';
        this.strokeColor = 'black';
        this.strokeWidth = 1;
        this.smoothnessLevel = 2; // Default smoothness level (0-4, maps to distances [2, 3, 5, 8, 13])
        
        // Drawing state
        this.isDrawing = false;
        this.currentShape = null;
        this.startPoint = null;
        this.lastPoint = null;
        this.freehandPoints = []; // Track points for freehand drawing
        this.imageSource = null;
        this.importedGroupFactory = null;
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

    setSmoothnessLevel(level) {
        // Level is 0-4, representing distances [2, 3, 5, 8, 13]
        this.smoothnessLevel = Math.max(0, Math.min(4, level));
    }

    setImageSource(imageSource) {
        this.imageSource = imageSource;
        this.importedGroupFactory = null;
    }

    setImportedGroupFactory(factory) {
        this.importedGroupFactory = factory;
        this.imageSource = null;
    }

    getSmoothnessDistance() {
        const distances = [2, 3, 5, 8, 13];
        return distances[this.smoothnessLevel];
    }

    applySmoothingToPoints(points, smoothnessLevel = null) {
        // Use provided level or default
        const level = smoothnessLevel !== null ? smoothnessLevel : this.smoothnessLevel;
        const distances = [2, 3, 5, 8, 13];
        const targetDistance = distances[level];
        
        if (points.length <= 2) return points;
        
        const smoothedPoints = [points[0]]; // Always keep first point
        
        for (let i = 1; i < points.length - 1; i++) {
            const lastKept = smoothedPoints[smoothedPoints.length - 1];
            const current = points[i];
            const dx = current.x - lastKept.x;
            const dy = current.y - lastKept.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Keep point if it's at least targetDistance away from last kept point
            if (distance >= targetDistance) {
                smoothedPoints.push(current);
            }
        }
        
        // Always keep last point
        smoothedPoints.push(points[points.length - 1]);
        
        // If we removed too many points (only 2 left), try a lower threshold
        if (smoothedPoints.length <= 2 && level > 0) {
            return this.applySmoothingToPoints(points, level - 1);
        }
        
        return smoothedPoints;
    }

    startDrawing(x, y) {
        this.isDrawing = true;this._axisConstraint=null;
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
            case TOOLS.IMAGE:
                if (this.importedGroupFactory) {
                    this.currentShape = this.importedGroupFactory();
                    const center = this.currentShape.getCenterPoint();
                    this.currentShape.moveBy(x - center.x, y - center.y);
                    break;
                }
                if (!this.imageSource) {
                    this.finishCurrentDrawing();
                    break;
                }
                this.currentShape = new this.ShapeClasses.Image(
                    x, y, null, null,
                    this.imageSource.imageData,
                    this.imageSource.imageExtension,
                    this.imageSource.sourceName
                );
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

    updateDrawing(x, y, shift=false) {
        if (!this.currentShape) return;

        if(shift) {
            const origin=this.startPoint;
            if(this.currentTool===TOOLS.RECT || this.currentTool===TOOLS.OVAL) {
                const size=Math.max(Math.abs(x-origin.x),Math.abs(y-origin.y));
                x=origin.x+Math.sign(x-origin.x || 1)*size;y=origin.y+Math.sign(y-origin.y || 1)*size;
            } else if(this.currentTool===TOOLS.LINE) {
                const point=require('./GestureConstraints').linePoint(origin,{x,y});x=point.x;y=point.y;
            } else if([TOOLS.POLY,TOOLS.QUAD,TOOLS.BEZIER,TOOLS.SPLINE].includes(this.currentTool)) {
                const points=this.currentShape.points;
                const anchor=points[Math.max(0,points.length-(this.currentTool===TOOLS.SPLINE?3:2))] || origin;
                const point=require('./GestureConstraints').linePoint(anchor,{x,y});x=point.x;y=point.y;
            } else if(this.currentTool===TOOLS.FREEHAND) {
                this._axisConstraint ||= {};
                const point=require('./GestureConstraints').axisPoint(origin,{x,y},this._axisConstraint,true);
                x=point.x;y=point.y;
            }
        } else this._axisConstraint=null;
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
            case TOOLS.IMAGE:
                if (this.currentShape.constructor.name === 'Group') {
                    const center = this.currentShape.getCenterPoint();
                    this.currentShape.moveBy(x - center.x, y - center.y);
                    break;
                }
                if (Math.abs(x - this.startPoint.x) >= 3 || Math.abs(y - this.startPoint.y) >= 3) {
                    this.currentShape.width = x - this.startPoint.x;
                    this.currentShape.height = y - this.startPoint.y;
                }
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
                        
                        // Update the spline with smoothed points
                        // For Cardinal spline, we need control points at start and end
                        if (this.freehandPoints.length >= 2) {
                            // Apply smoothing to collected points
                            const smoothedPoints = this.applySmoothingToPoints(this.freehandPoints);
                            const points = [...smoothedPoints];
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
            minPoints = 4; // Three confirmed vertices plus the temporary preview.
        }
        if (this.currentTool === TOOLS.QUAD) {
            minPoints = 5; // Four confirmed vertices plus the temporary preview.
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

            case TOOLS.IMAGE:
                if (this.currentShape.constructor.name === 'Group') {
                    return this.currentShape.children.length > 0;
                }
                return !!this.currentShape.image && Math.abs(this.currentShape.width) >= MIN_SIZE &&
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
