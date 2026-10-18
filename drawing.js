// Shape management and rendering

const ShapeClasses = require('./shapes');


class Drawing {
    constructor() {
        this.shapes = [];
        this.selectedShape = null;
        this.boneEditor = new (require('./BoneEditor'))(this);
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
        this.boneEditor = new (require('./BoneEditor'))(this);
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
            case 'NativeDrawing':
            case 'Text':
            case 'Rectangle':
            case 'Image':
                shape.x += dx;
                shape.y += dy;
                break;
            case 'Polygon':
            case 'Polyline':
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
        const binding=selected[0].rigBone;
        if(binding && selected.every(shape=>shape.rigBone===binding))group.rigBone=binding;
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
            const groupCenter=shape.getCenterPoint();
            for (const child of shape.children) {
                this.moveShape(child,shape.x,shape.y);
                if(shape.rotation) {
                    const center=groupCenter,childCenter=child.getCenterPoint();
                    const rotated=shape.rotatePoint(childCenter.x,childCenter.y,center.x,center.y,shape.rotation);
                    this.moveShape(child,rotated.x-childCenter.x,rotated.y-childCenter.y);
                    child.rotation=(child.rotation || 0)+shape.rotation;
                }
                if(shape.rigBone)child.rigBone=shape.rigBone;
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
        const copy=this.deserializeShape(shape.constructor.name,this.serializeShape(shape));
        if (!copy) return null;
        this.moveShape(copy,10,10);
        this.addShape(copy);
        return copy;
    }

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

    createImageRegistry() {
        return {
            nextId: 1,
            idByData: new Map(),
            entries: []
        };
    }

    deserializeDocument(data) {
        if (!data || !['skrbl-v0.0.3','skrbl-v0.0.4','skrbl-v0.0.5'].includes(data.fileFormat) ||
            !Array.isArray(data.imageData) || !Array.isArray(data.shapes)) {
            throw new Error('Unsupported or invalid file format');
        }

        const imageDataById = new Map();
        for (const imageData of data.imageData) {
            if (!Number.isInteger(imageData.id) || imageDataById.has(imageData.id) ||
                typeof imageData.data !== 'string') {
                throw new Error('Invalid imageData entry');
            }
            imageDataById.set(imageData.id, imageData);
        }

        return data.shapes.map(shapeInfo => {
            const shape = this.deserializeShape(shapeInfo.type, shapeInfo.data, imageDataById);
            if (!shape) throw new Error(`Unknown shape type ${shapeInfo.type}`);
            return shape;
        });
    }

    serializeShape(shape, imageRegistry = null) {
        const typeName = shape.constructor.name;
        let data;
        
        switch (typeName) {
            case 'NativeDrawing':
                data={stream:shape.stream,x:shape.x,y:shape.y,rotation:shape.rotation};
                break;
            case 'Text':
                data = {x:shape.x,y:shape.y,text:shape.text,fontSize:shape.fontSize,fontName:shape.fontName,textStyle:shape.textStyle,
                    width:shape.width,height:shape.height,fillColor:shape.fillColor,rotation:shape.rotation};
                break;
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
            case 'Image':
                data = {
                    x: shape.x, y: shape.y,
                    width: shape.width, height: shape.height,
                    rotation: shape.rotation || 0
                };
                if (imageRegistry) {
                    let imageId = imageRegistry.idByData.get(shape.imageData);
                    if (imageId === undefined) {
                        imageId = imageRegistry.nextId++;
                        imageRegistry.idByData.set(shape.imageData, imageId);
                        imageRegistry.entries.push({
                            id: imageId,
                            sourceName: shape.sourceName,
                            imageExtension: shape.imageExtension,
                            data: shape.imageData
                        });
                    }
                    data.imageId = imageId;
                } else {
                    // Undo/redo and the in-memory clipboard use self-contained
                    // snapshots rather than the normalized document format.
                    data.imageData = shape.imageData;
                    data.imageExtension = shape.imageExtension;
                    data.sourceName = shape.sourceName;
                }
                break;
            case 'Polygon':
            case 'Polyline':
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
                    x: shape.x, y: shape.y,rotation:shape.rotation,
                    children: shape.children.map(child => this.serializeShape(child, imageRegistry))
                };
                break;
            default:
                return null;
        }
        
        return { type: typeName, ...data, ...(shape.rigBone ? {rigBone:shape.rigBone} : {}),
            ...(shape.joinCorrections ? {joinCorrections:JSON.parse(JSON.stringify(shape.joinCorrections))} : {}),
            ...(shape.fillGradient ? {fillGradient:JSON.parse(JSON.stringify(shape.fillGradient))} : {}),
            ...(shape.blendMode ? {blendMode:shape.blendMode} : {}) };
    }

    deserializeShape(type, data, imageDataById = null) {
        let shape = null;
        
        switch (type) {
            case 'NativeDrawing':
                shape=new ShapeClasses.NativeDrawing(data.stream);
                shape.x=data.x || 0;shape.y=data.y || 0;
                break;
            case 'Text':
                shape = new ShapeClasses.Text(data.x,data.y,data.text,data.fillColor,
                    data.fontSize,data.width,data.height,data.fontName,data.textStyle);
                break;
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
            case 'Image':
                const imageData = imageDataById
                    ? imageDataById.get(data.imageId)
                    : {
                        data: data.imageData,
                        imageExtension: data.imageExtension,
                        sourceName: data.sourceName
                    };
                if (!imageData) {
                    throw new Error(`Image shape references missing imageData id ${data.imageId}`);
                }
                shape = new ShapeClasses.Image(
                    data.x, data.y, data.width, data.height,
                    imageData.data, imageData.imageExtension, imageData.sourceName
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
            case 'Polyline':
                shape = new ShapeClasses.Polyline(data.points,data.strokeColor,data.strokeWidth);
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
                    this.deserializeShape(childData.type, childData, imageDataById)).filter(Boolean));
                break;
            default:
                return null;
        }
        if (type === 'Group') { shape.x=data.x || 0; shape.y=data.y || 0; }
        
        // Restore rotation if present
        if (shape && data.rotation !== undefined) {
            shape.rotation = data.rotation;
        }
        
        if(shape && typeof data.rigBone==='string')shape.rigBone=data.rigBone;
        if(shape && type==='Spline' && data.joinCorrections)shape.joinCorrections=JSON.parse(JSON.stringify(data.joinCorrections));
        if(shape && data.fillGradient)shape.fillGradient=JSON.parse(JSON.stringify(data.fillGradient));
        if(shape && ['Multiply','Screen'].includes(data.blendMode))shape.blendMode=data.blendMode;
        return shape;
    }
}

module.exports = Drawing;
