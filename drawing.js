// Shape management and rendering

const ShapeClasses = require('./shapes');


class Drawing {
    constructor() {
        this.shapes = [];
        this.selectedShape = null;
    }

    addShape(shape) {
        this.shapes.push(shape);
    }

    insertShape(index, shape) {
        const safeIndex = Math.max(0, Math.min(index, this.shapes.length));
        this.shapes.splice(safeIndex, 0, shape);
    }

    removeShape(shape) {
        const index = this.shapes.indexOf(shape);
        if (index > -1) {
            this.shapes.splice(index, 1);

        }
    }

    getShapes() {
        return this.shapes;
    }

    clearShapes() {
        this.shapes = [];
        this.selectedShape = null;
    }

    clearSelection() {
        this.shapes.forEach(shape => shape.selected = false);
        this.selectedShape = null;
    }

    setSelectedShape(shape) {
        this.clearSelection();
        if (shape) {
            shape.selected = true;
            this.selectedShape = shape;
        }
    }

    getSelectedShape() {
        return this.selectedShape;
    }

    getShapeClasses() {
        return ShapeClasses;
    }

    render(ctx) {
        // Draw all shapes
        this.shapes.forEach(shape => shape.draw(ctx));
    }

    findShapeAt(x, y) {
        // Return the topmost shape at the given coordinates
        for (let i = this.shapes.length - 1; i >= 0; i--) {
            if (this.shapes[i].contains(x, y)) {
                return this.shapes[i];
            }
        }
        return null;
    }

    getShapeCount() {
        return this.shapes.length;
    }

    // Utility methods for shape manipulation
    moveShape(shape, dx, dy) {
        if (!shape) return;

        switch (shape.constructor.name) {
            case 'Group':
                shape.moveBy(dx, dy);
                break;
            case 'Line':
                shape.x += dx;
                shape.y += dy;
                shape.x2 += dx;
                shape.y2 += dy;
                break;
            case 'Circle':
                shape.x += dx;
                shape.y += dy;
                break;
            case 'Oval':
                shape.x += dx;
                shape.y += dy;
                break;
            case 'Rectangle':
                shape.x += dx;
                shape.y += dy;
                break;
            case 'Polygon':
            case 'Spline':
            case 'BezierSpline':
                shape.points.forEach(point => {
                    point.x += dx;
                    point.y += dy;
                });
                if (shape.controlPoints) {
                    shape.controlPoints.forEach(point => {
                        point.x += dx;
                        point.y += dy;
                    });
                }
                break;
        }
    }

    groupShapes(shapes) {
        const selected = this.shapes.filter(shape => shapes.includes(shape));
        if (selected.length < 2) return null;

        const selectedSet = new Set(selected);
        const frontmostIndex = Math.max(...selected.map(shape => this.shapes.indexOf(shape)));
        const insertionIndex = this.shapes
            .slice(0, frontmostIndex + 1)
            .filter(shape => !selectedSet.has(shape)).length;

        this.shapes = this.shapes.filter(shape => !selectedSet.has(shape));
        const group = new ShapeClasses.Group(selected);
        group.selected = true;
        this.insertShape(insertionIndex, group);
        this.selectedShape = group;
        return group;
    }

    ungroupShapes(groups) {
        const groupSet = new Set(groups.filter(shape => shape instanceof ShapeClasses.Group));
        if (groupSet.size === 0) return [];

        const ungrouped = [];
        const replacement = [];
        for (const shape of this.shapes) {
            if (!groupSet.has(shape)) {
                replacement.push(shape);
                continue;
            }
            for (const child of shape.children) {
                child.selected = true;
                replacement.push(child);
                ungrouped.push(child);
            }
        }
        this.shapes = replacement;
        this.selectedShape = ungrouped.length === 1 ? ungrouped[0] : null;
        return ungrouped;
    }

    // Draw order manipulation methods
    moveShapeForward(shape, steps = 1) {
        const index = this.shapes.indexOf(shape);
        if (index === -1 || index >= this.shapes.length - steps) return;
        
        // Remove shape from current position
        this.shapes.splice(index, 1);
        // Insert at new position (further forward in draw order)
        this.shapes.splice(index + steps, 0, shape);
    }

    moveShapeBackward(shape, steps = 1) {
        const index = this.shapes.indexOf(shape);
        if (index === -1 || index < steps) return;
        
        // Remove shape from current position
        this.shapes.splice(index, 1);
        // Insert at new position (further back in draw order)
        this.shapes.splice(index - steps, 0, shape);
    }

    moveShapeToFront(shape) {
        const index = this.shapes.indexOf(shape);
        if (index === -1 || index === this.shapes.length - 1) return;
        
        // Remove shape from current position
        this.shapes.splice(index, 1);
        // Add to end of array (drawn last, appears on top)
        this.shapes.push(shape);
    }

    moveShapeToBack(shape) {
        const index = this.shapes.indexOf(shape);
        if (index === -1 || index === 0) return;
        
        // Remove shape from current position
        this.shapes.splice(index, 1);
        // Insert at beginning of array (drawn first, appears at bottom)
        this.shapes.unshift(shape);
    }

    duplicateShape(shape) {
        if (!shape) return null;

        let newShape;
        switch (shape.constructor.name) {
            case 'Line':
                newShape = new ShapeClasses.Line(
                    shape.x + 10, shape.y + 10, 
                    shape.x2 + 10, shape.y2 + 10,
                    shape.strokeColor, shape.strokeWidth
                );
                break;
            case 'Circle':
                newShape = new ShapeClasses.Circle(
                    shape.x + 10, shape.y + 10,
                    shape.radius,
                    shape.fillColor, shape.strokeColor, shape.strokeWidth
                );
                break;
            case 'Oval':
                newShape = new ShapeClasses.Oval(
                    shape.x + 10, shape.y + 10,
                    shape.radiusX, shape.radiusY,
                    shape.fillColor, shape.strokeColor, shape.strokeWidth
                );
                break;
            case 'Rectangle':
                newShape = new ShapeClasses.Rectangle(
                    shape.x + 10, shape.y + 10,
                    shape.width, shape.height,
                    shape.fillColor, shape.strokeColor, shape.strokeWidth
                );
                break;
            case 'Polygon':
                const newPoints = shape.points.map(p => ({ x: p.x + 10, y: p.y + 10 }));
                newShape = new ShapeClasses.Polygon(
                    newPoints,
                    shape.fillColor, shape.strokeColor, shape.strokeWidth
                );
                break;
            case 'Spline':
                const newSplinePoints = shape.points.map(p => ({ x: p.x + 10, y: p.y + 10 }));
                newShape = new ShapeClasses.Spline(
                    newSplinePoints,
                    shape.fillColor, shape.strokeColor, shape.strokeWidth
                );
                break;
            default:
                return null;
        }

        this.addShape(newShape);
        return newShape;
    }

    // Export/Import functionality
    exportShapes() {
        return JSON.stringify(this.shapes.map(shape => ({
            type: shape.constructor.name,
            data: this.serializeShape(shape)
        })));
    }

    importShapes(jsonData) {
        try {
            const shapesData = JSON.parse(jsonData);
            this.clearShapes();
            
            shapesData.forEach(shapeData => {
                const shape = this.deserializeShape(shapeData.type, shapeData.data);
                if (shape) {
                    this.addShape(shape);
                }
            });
        } catch (error) {
            console.error('Failed to import shapes:', error);
        }
    }

    serializeShape(shape) {
        const typeName = shape.constructor.name;
        let data;
        
        switch (typeName) {
            case 'Line':
                data = {
                    x: shape.x, y: shape.y,
                    x2: shape.x2, y2: shape.y2,
                    strokeColor: shape.strokeColor,
                    strokeWidth: shape.strokeWidth,
                    rotation: shape.rotation || 0
                };
                break;
            case 'Circle':
                data = {
                    x: shape.x, y: shape.y, radius: shape.radius,
                    fillColor: shape.fillColor,
                    strokeColor: shape.strokeColor,
                    strokeWidth: shape.strokeWidth,
                    rotation: shape.rotation || 0
                };
                break;
            case 'Oval':
                data = {
                    x: shape.x, y: shape.y,
                    radiusX: shape.radiusX, radiusY: shape.radiusY,
                    fillColor: shape.fillColor,
                    strokeColor: shape.strokeColor,
                    strokeWidth: shape.strokeWidth,
                    rotation: shape.rotation || 0
                };
                break;
            case 'Rectangle':
                data = {
                    x: shape.x, y: shape.y,
                    width: shape.width, height: shape.height,
                    fillColor: shape.fillColor,
                    strokeColor: shape.strokeColor,
                    strokeWidth: shape.strokeWidth,
                    rotation: shape.rotation || 0
                };
                break;
            case 'Polygon':
            case 'Spline':
                data = {
                    points: shape.points.map(point => ({ x: point.x, y: point.y })),
                    fillColor: shape.fillColor,
                    strokeColor: shape.strokeColor,
                    strokeWidth: shape.strokeWidth,
                    rotation: shape.rotation || 0
                };
                break;
            case 'BezierSpline':
                data = {
                    points: shape.points.map(point => ({ x: point.x, y: point.y })),
                    controlPoints: shape.controlPoints.map(point => ({ x: point.x, y: point.y })),
                    manuallyEditedControls: shape.manuallyEditedControls ? Array.from(shape.manuallyEditedControls) : [],
                    fillColor: shape.fillColor,
                    strokeColor: shape.strokeColor,
                    strokeWidth: shape.strokeWidth,
                    rotation: shape.rotation || 0
                };
                break;
            case 'Group':
                data = {
                    children: shape.children.map(child => this.serializeShape(child))
                };
                break;
            default:
                return null;
        }
        
        return { type: typeName, ...data };
    }

    deserializeShape(type, data) {
        let shape = null;
        
        switch (type) {
            case 'Line':
                shape = new ShapeClasses.Line(
                    data.x, data.y, data.x2, data.y2,
                    data.strokeColor, data.strokeWidth
                );
                break;
            case 'Circle':
                shape = new ShapeClasses.Circle(
                    data.x, data.y, data.radius,
                    data.fillColor, data.strokeColor, data.strokeWidth
                );
                break;
            case 'Oval':
                shape = new ShapeClasses.Oval(
                    data.x, data.y, data.radiusX, data.radiusY,
                    data.fillColor, data.strokeColor, data.strokeWidth
                );
                break;
            case 'Rectangle':
                shape = new ShapeClasses.Rectangle(
                    data.x, data.y, data.width, data.height,
                    data.fillColor, data.strokeColor, data.strokeWidth
                );
                break;
            case 'Polygon':
                shape = new ShapeClasses.Polygon(
                    data.points,
                    data.fillColor, data.strokeColor, data.strokeWidth
                );
                break;
            case 'Spline':
                shape = new ShapeClasses.Spline(
                    data.points,
                    data.fillColor, data.strokeColor, data.strokeWidth
                );
                break;
            case 'BezierSpline':
                shape = new ShapeClasses.BezierSpline(
                    data.points,
                    data.fillColor, data.strokeColor, data.strokeWidth
                );
                // Restore saved control points if available
                if (data.controlPoints) {
                    shape.controlPoints = data.controlPoints;
                }
                // Restore manually edited control points set
                if (data.manuallyEditedControls) {
                    shape.manuallyEditedControls = new Set(data.manuallyEditedControls);
                }
                break;
            case 'Group':
                shape = new ShapeClasses.Group((data.children || []).map(childData =>
                    this.deserializeShape(childData.type, childData)).filter(Boolean));
                break;
            default:
                return null;
        }
        
        // Restore rotation if present
        if (shape && data.rotation !== undefined) {
            shape.rotation = data.rotation;
        }
        
        return shape;
    }
}

module.exports = Drawing;
