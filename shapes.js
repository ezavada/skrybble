// Base Shape class and all shape implementations

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// Base Shape class
class Shape {
    constructor(x, y, fillColor = 'white', strokeColor = 'black', strokeWidth = 1) {
        this.x = x;
        this.y = y;
        this.fillColor = fillColor;
        this.strokeColor = strokeColor;
        this.strokeWidth = strokeWidth;
        this.selected = false;
        this.rotation = 0; // Rotation angle in radians
    }

    draw(port) {
        const artwork = this.getArtwork(port.strokeScale || 1);
        if (port.drawRetained) port.drawRetained(artwork);
        else port.drawDrawing(artwork,new pdg.Point(0,0),new pdg.Attributes());
        if (!this._editing && (this.selected || (this.underConstruction && !this.freehand))) {
            if(port.drawShapeControls){port.drawShapeControls(this);return;}
            const controls=port.controls || port;
            if (this.drawEndpoints) this.drawEndpoints(controls);
            if (this.drawControlPoints) this.drawControlPoints(controls);
            this.drawRotationControl(controls);
        }
    }

    getArtwork(strokeScale = 1) {
        const geometry = JSON.stringify(Object.fromEntries(Object.entries(this).filter(([key]) =>
            !key.startsWith('_') && !['selected','rotation','fillColor','strokeColor','strokeWidth',
                'image','loadError','manuallyEditedControls','text'].includes(key) &&
            !(this.constructor.name==='Text' && ['x','y','width','height'].includes(key)))));
        const style = JSON.stringify([this.fillColor,this.strokeColor,this.strokeWidth,strokeScale]);
        if (!this._artwork || geometry !== this._geometryKey) {
            this._geometry = pdg.createDrawing();
            const recorder = require('./rendering').drawingPort(this._geometry,null,strokeScale);
            this._paintUnselected(recorder);
            this._elements = recorder.refs;
            this._artwork = pdg.createDrawing();
            this._appearance = new pdg.Attributes();
            this._rootElement = this._artwork.addDrawing(this._geometry.getBounds(), this._geometry, this._appearance);
            this._rootElement.setLiveAttributes(this._appearance);
            this._transformKey=null;
            this._geometryKey = geometry;
            this._styleKey = style;
        } else if (style !== this._styleKey) {
            this._paintUnselected(require('./rendering').drawingPort(this._geometry, this._elements,strokeScale));
            this._styleKey = style;
        }
        if (this.constructor.name==='Text' && this._textKey!==this.text) {
            this._elements[0].setText(this.text); this._textKey=this.text;
        }
        const center=this.getCenterPoint();
        const transformKey=[this.rotation,center.x,center.y].join(',');
        if (transformKey!==this._transformKey) {
            this._appearance.setTransform([1,0,0,0,1,0,0,0,1]);
            if (this.rotation) this._appearance.rotation(this.rotation,new pdg.Point(center));
            this._transformKey=transformKey;
        }
        return this._artwork;
    }

    _paintUnselected(port) {
        const selected = this.selected, rotation = this.rotation, construction=this.underConstruction;
        this.selected = false; this.rotation = 0; this.underConstruction=false;
        try { this.drawArtwork(port); }
        finally { this.selected = selected; this.rotation = rotation; this.underConstruction=construction; }
    }

    drawArtwork(port) {
        // Override in subclasses
    }

    contains(x, y) {
        // Override in subclasses
        return false;
    }

    getEndpoints() {
        // Override in subclasses
        return [];
    }

    getControlPoints() {
        // Override in subclasses
        return [];
    }

    getCenterPoint() {
        // Override in subclasses
        return { x: this.x, y: this.y };
    }

    getRotationLineLength() {
        // Override in subclasses to return appropriate length for rotation indicator
        return 30;
    }

    rotatePoint(px, py, centerX, centerY, angle) {
        // Rotate a point (px, py) around center (centerX, centerY) by angle (in radians)
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = px - centerX;
        const dy = py - centerY;
        
        return {
            x: centerX + (dx * cos - dy * sin),
            y: centerY + (dx * sin + dy * cos)
        };
    }

    drawRotationControl(port) {
        if (!this.selected) return;
        
        // Don't draw rotation control for circles (rotation-invariant)
        if (this.constructor.name === 'Circle') return;
        
        const center = this.getCenterPoint();
        const lineLength = Math.max(this.getRotationLineLength(),this._rotationGuideLength || 0);
        
        // Draw blue center point with white outline
        port.drawCircle(new pdg.Point(center.x, center.y), 5, 
            new pdg.Attributes().lineColor(new pdg.Color('white')).lineThickness(1));
        const centerAttrs = new pdg.Attributes().fillColor(new pdg.Color('blue')).fillOpacity(0.5);
        port.drawCircle(new pdg.Point(center.x, center.y), 4, centerAttrs);
        
        // Draw blue rotation line (hairline with alpha 0.5)
        // Start angle from straight north (subtract PI/2 so 0 radians = north)
        const angle = this.rotation - Math.PI / 2;
        const endX = center.x + Math.cos(angle) * lineLength;
        const endY = center.y + Math.sin(angle) * lineLength;
        const lineAttrs = new pdg.Attributes()
            .lineColor(new pdg.Color('blue'))
            .lineOpacity(0.5)
            .lineThickness(1);
        port.drawLine(new pdg.Point(center.x, center.y), new pdg.Point(endX, endY), lineAttrs);
    }

    addPoint(point) {
        // Override in subclasses where applicable
    }
}

function includePoint(bounds, point) {
    if (!point) return bounds;
    if (!bounds) {
        return { left: point.x, top: point.y, right: point.x, bottom: point.y };
    }
    bounds.left = Math.min(bounds.left, point.x);
    bounds.top = Math.min(bounds.top, point.y);
    bounds.right = Math.max(bounds.right, point.x);
    bounds.bottom = Math.max(bounds.bottom, point.y);
    return bounds;
}

function getShapeBounds(shape) {
    if (shape instanceof Group) return shape.getBounds();

    let bounds = null;
    const center = shape.getCenterPoint();
    const rotation = shape.rotation || 0;
    const addLocalPoint = point => {
        const worldPoint = rotation === 0
            ? point
            : shape.rotatePoint(point.x, point.y, center.x, center.y, rotation);
        bounds = includePoint(bounds, worldPoint);
    };

    if (shape.constructor.name === 'Text') {
        [{x:shape.x,y:shape.y},{x:shape.x+shape.width,y:shape.y},
            {x:shape.x+shape.width,y:shape.y+shape.height},{x:shape.x,y:shape.y+shape.height}].forEach(addLocalPoint);
    } else if (shape.constructor.name === 'Circle') {
        bounds = includePoint(bounds, { x: shape.x - shape.radius, y: shape.y - shape.radius });
        bounds = includePoint(bounds, { x: shape.x + shape.radius, y: shape.y + shape.radius });
    } else if (shape.constructor.name === 'Oval') {
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const extentX = Math.sqrt(shape.radiusX * shape.radiusX * cos * cos + shape.radiusY * shape.radiusY * sin * sin);
        const extentY = Math.sqrt(shape.radiusX * shape.radiusX * sin * sin + shape.radiusY * shape.radiusY * cos * cos);
        bounds = includePoint(bounds, { x: shape.x - extentX, y: shape.y - extentY });
        bounds = includePoint(bounds, { x: shape.x + extentX, y: shape.y + extentY });
    } else {
        const points = shape.getEndpoints ? shape.getEndpoints() : [];
        points.forEach(addLocalPoint);
        if (shape.getControlPoints) shape.getControlPoints().forEach(addLocalPoint);
    }

    return bounds || { left: center.x, top: center.y, right: center.x, bottom: center.y };
}

// Line Shape
class Line extends Shape {
    constructor(x1, y1, x2, y2, strokeColor = 'black', strokeWidth = 1) {
        super(x1, y1, null, strokeColor, strokeWidth);
        this.x2 = x2;
        this.y2 = y2;
    }

    drawArtwork(port) {
        let p1 = { x: this.x, y: this.y };
        let p2 = { x: this.x2, y: this.y2 };
        
        // Apply rotation if set
        if (this.rotation !== 0) {
            const center = this.getCenterPoint();
            p1 = this.rotatePoint(p1.x, p1.y, center.x, center.y, this.rotation);
            p2 = this.rotatePoint(p2.x, p2.y, center.x, center.y, this.rotation);
        }
        
        port.drawLine(new pdg.Point(p1.x, p1.y), new pdg.Point(p2.x, p2.y), 
            new pdg.Attributes().lineColor(new pdg.Color(this.strokeColor)).lineThickness(this.strokeWidth));

        if (this.selected) {
            this.drawEndpoints(port);
            this.drawRotationControl(port);
        }
    }

    drawEndpoints(port) {
        let p1 = { x: this.x, y: this.y };
        let p2 = { x: this.x2, y: this.y2 };
        
        // Apply rotation if set
        if (this.rotation !== 0) {
            const center = this.getCenterPoint();
            p1 = this.rotatePoint(p1.x, p1.y, center.x, center.y, this.rotation);
            p2 = this.rotatePoint(p2.x, p2.y, center.x, center.y, this.rotation);
        }
        
        // Draw white outline first, then red fill
        port.drawCircle(new pdg.Point(p1.x, p1.y), 5, 
            new pdg.Attributes().lineColor(new pdg.Color('white')).lineThickness(1));
        port.drawCircle(new pdg.Point(p1.x, p1.y), 4, 
            new pdg.Attributes().fillColor(new pdg.Color('red')));
        port.drawCircle(new pdg.Point(p2.x, p2.y), 5, 
            new pdg.Attributes().lineColor(new pdg.Color('white')).lineThickness(1));
        port.drawCircle(new pdg.Point(p2.x, p2.y), 4, 
            new pdg.Attributes().fillColor(new pdg.Color('red')));
    }

    contains(x, y) {
        // If rotated, inverse-rotate the test point
        let testX = x, testY = y;
        if (this.rotation !== 0) {
            const center = this.getCenterPoint();
            const rotated = this.rotatePoint(x, y, center.x, center.y, -this.rotation);
            testX = rotated.x;
            testY = rotated.y;
        }
        
        const dist = this.pointToLineDistance(testX, testY, this.x, this.y, this.x2, this.y2);
        return dist < 5;
    }

    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getEndpoints() {
        return [
            { x: this.x, y: this.y },
            { x: this.x2, y: this.y2 }
        ];
    }

    getCenterPoint() {
        return {
            x: (this.x + this.x2) / 2,
            y: (this.y + this.y2) / 2
        };
    }

    getRotationLineLength() {
        const dx = this.x2 - this.x;
        const dy = this.y2 - this.y;
        const lineLength = Math.sqrt(dx * dx + dy * dy);
        return Math.min(lineLength / 2, 40);
    }

    intersectsRect(left, top, right, bottom) {
        let p1 = { x: this.x, y: this.y };
        let p2 = { x: this.x2, y: this.y2 };
        
        // Apply rotation if set
        if (this.rotation !== 0) {
            const center = this.getCenterPoint();
            p1 = this.rotatePoint(p1.x, p1.y, center.x, center.y, this.rotation);
            p2 = this.rotatePoint(p2.x, p2.y, center.x, center.y, this.rotation);
        }
        
        // Check if any endpoint is inside the rectangle
        if ((p1.x >= left && p1.x <= right && p1.y >= top && p1.y <= bottom) ||
            (p2.x >= left && p2.x <= right && p2.y >= top && p2.y <= bottom)) {
            return true;
        }
        
        // Check if line intersects any edge of the rectangle
        return this.lineIntersectsRect(p1.x, p1.y, p2.x, p2.y, left, top, right, bottom);
    }

    lineIntersectsRect(x1, y1, x2, y2, left, top, right, bottom) {
        // Check intersection with each edge of the rectangle
        const edges = [
            [left, top, right, top],     // Top edge
            [right, top, right, bottom],  // Right edge
            [right, bottom, left, bottom], // Bottom edge
            [left, bottom, left, top]     // Left edge
        ];
        
        for (let edge of edges) {
            if (this.linesIntersect(x1, y1, x2, y2, edge[0], edge[1], edge[2], edge[3])) {
                return true;
            }
        }
        return false;
    }

    linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
        if (denom === 0) return false; // Lines are parallel
        
        const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
        const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
        
        return (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1);
    }
}

// Circle Shape
class Circle extends Shape {
    constructor(x, y, radius, fillColor = 'white', strokeColor = 'black', strokeWidth = 1) {
        super(x, y, fillColor, strokeColor, strokeWidth);
        this.radius = radius;
    }

    drawArtwork(port) {
        const center = new pdg.Point(this.x, this.y);
        const attrs = new pdg.Attributes();
        
        attrs.lineColor(new pdg.Color(this.strokeColor))
             .lineThickness(this.strokeWidth)
             .lineStyle(pdg.lineStyle_Solid);
        if (this.fillColor) {
            attrs.fillColor(new pdg.Color(this.fillColor));
        }
        port.drawCircle(center, this.radius, attrs);

        if (this.selected) {
            this.drawEndpoints(port);
            this.drawRotationControl(port);
        }
    }

    drawEndpoints(port) {
        const points = [
            new pdg.Point(this.x, this.y - this.radius),
            new pdg.Point(this.x + this.radius, this.y),
            new pdg.Point(this.x, this.y + this.radius),
            new pdg.Point(this.x - this.radius, this.y)
        ];
        const fillAttrs = new pdg.Attributes().fillColor(new pdg.Color('red'));
        const outlineAttrs = new pdg.Attributes().lineColor(new pdg.Color('white')).lineThickness(1);
        
        for (const point of points) {
            port.drawCircle(point, 5, outlineAttrs);
            port.drawCircle(point, 4, fillAttrs);
        }
    }

    contains(x, y) {
        // Circles are rotation-invariant, but we still check for consistency
        const dx = x - this.x;
        const dy = y - this.y;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius;
    }

    getEndpoints() {
        return [
            { x: this.x, y: this.y - this.radius },
            { x: this.x + this.radius, y: this.y },
            { x: this.x, y: this.y + this.radius },
            { x: this.x - this.radius, y: this.y }
        ];
    }

    getCenterPoint() {
        return { x: this.x, y: this.y };
    }

    getRotationLineLength() {
        return Math.min(this.radius * 0.8, 40);
    }

    intersectsRect(left, top, right, bottom) {
        // Find the closest point on the rectangle to the circle center
        const closestX = Math.max(left, Math.min(this.x, right));
        const closestY = Math.max(top, Math.min(this.y, bottom));
        
        // Calculate distance from circle center to this closest point
        const dx = this.x - closestX;
        const dy = this.y - closestY;
        const distanceSquared = dx * dx + dy * dy;
        
        // Check if distance is less than radius (circle intersects or is inside)
        return distanceSquared <= (this.radius * this.radius);
    }
}

// Rectangle Shape
class Rectangle extends Shape {
    constructor(x, y, width, height, fillColor = 'white', strokeColor = 'black', strokeWidth = 1) {
        super(x, y, fillColor, strokeColor, strokeWidth);
        this.width = width;
        this.height = height;
    }

    drawArtwork(port) {
        const attrs = new pdg.Attributes();
        
        attrs.lineColor(new pdg.Color(this.strokeColor))
             .lineThickness(this.strokeWidth)
             .lineStyle(pdg.lineStyle_Solid);
        if (this.fillColor) {
            attrs.fillColor(new pdg.Color(this.fillColor));
        }
        
        // If rotation is applied, draw as a rotated polygon
        if (this.rotation !== 0) {
            const center = this.getCenterPoint();
            const corners = [
                { x: this.x, y: this.y },
                { x: this.x + this.width, y: this.y },
                { x: this.x + this.width, y: this.y + this.height },
                { x: this.x, y: this.y + this.height }
            ];
            
            const polygon = new pdg.Polygon();
            for (let corner of corners) {
                const rotated = this.rotatePoint(corner.x, corner.y, center.x, center.y, this.rotation);
                polygon.addPoint(new pdg.Point(rotated.x, rotated.y));
            }
            port.drawPolygon(polygon, attrs);
        } else {
            // No rotation, draw as normal rectangle
            const rect = new pdg.Rect(this.x, this.y, this.x + this.width, this.y + this.height);
            port.drawRect(rect, attrs);
        }

        if (this.selected) {
            this.drawEndpoints(port);
            this.drawRotationControl(port);
        }
    }

    drawEndpoints(port) {
        const points = this.getEndpoints();
        const fillAttrs = new pdg.Attributes().fillColor(new pdg.Color('red'));
        const outlineAttrs = new pdg.Attributes().lineColor(new pdg.Color('white')).lineThickness(1);
        
        if (this.rotation !== 0) {
            const center = this.getCenterPoint();
            points.forEach(point => {
                const rotated = this.rotatePoint(point.x, point.y, center.x, center.y, this.rotation);
                port.drawCircle(new pdg.Point(rotated.x, rotated.y), 5, outlineAttrs);
                port.drawCircle(new pdg.Point(rotated.x, rotated.y), 4, fillAttrs);
            });
        } else {
            points.forEach(point => {
                port.drawCircle(new pdg.Point(point.x, point.y), 5, outlineAttrs);
                port.drawCircle(new pdg.Point(point.x, point.y), 4, fillAttrs);
            });
        }
    }

    contains(x, y) {
        // If rotated, inverse-rotate the test point
        let testX = x, testY = y;
        if (this.rotation !== 0) {
            const center = this.getCenterPoint();
            const rotated = this.rotatePoint(x, y, center.x, center.y, -this.rotation);
            testX = rotated.x;
            testY = rotated.y;
        }
        
        return testX >= this.x && testX <= this.x + this.width && 
               testY >= this.y && testY <= this.y + this.height;
    }

    getEndpoints() {
        return [
            { x: this.x, y: this.y },
            { x: this.x + this.width, y: this.y },
            { x: this.x + this.width, y: this.y + this.height },
            { x: this.x, y: this.y + this.height }
        ];
    }

    getCenterPoint() {
        return {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2
        };
    }

    getRotationLineLength() {
        const size = Math.min(Math.abs(this.width), Math.abs(this.height));
        return Math.min(size * 0.4, 40);
    }

    intersectsRect(left, top, right, bottom) {
        if (this.rotation !== 0) {
            // For rotated rectangles, check if any rotated corner is inside the selection rect
            const center = this.getCenterPoint();
            const corners = [
                { x: this.x, y: this.y },
                { x: this.x + this.width, y: this.y },
                { x: this.x + this.width, y: this.y + this.height },
                { x: this.x, y: this.y + this.height }
            ];
            
            for (let corner of corners) {
                const rotated = this.rotatePoint(corner.x, corner.y, center.x, center.y, this.rotation);
                if (rotated.x >= left && rotated.x <= right && rotated.y >= top && rotated.y <= bottom) {
                    return true;
                }
            }
            
            // Also check if any edge of the rotated rectangle intersects the selection rectangle
            for (let i = 0; i < corners.length; i++) {
                const p1 = this.rotatePoint(corners[i].x, corners[i].y, center.x, center.y, this.rotation);
                const p2 = this.rotatePoint(corners[(i + 1) % 4].x, corners[(i + 1) % 4].y, center.x, center.y, this.rotation);
                
                const edges = [
                    [left, top, right, top],
                    [right, top, right, bottom],
                    [right, bottom, left, bottom],
                    [left, bottom, left, top]
                ];
                
                for (let edge of edges) {
                    if (this.linesIntersect(p1.x, p1.y, p2.x, p2.y, edge[0], edge[1], edge[2], edge[3])) {
                        return true;
                    }
                }
            }
            
            return false;
        } else {
            // Not rotated, use simple bounds check
            const thisLeft = Math.min(this.x, this.x + this.width);
            const thisRight = Math.max(this.x, this.x + this.width);
            const thisTop = Math.min(this.y, this.y + this.height);
            const thisBottom = Math.max(this.y, this.y + this.height);
            
            return !(thisRight < left || thisLeft > right || thisBottom < top || thisTop > bottom);
        }
    }

    linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
        if (denom === 0) return false;
        
        const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
        const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
        
        return (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1);
    }
}

// Cardinal Spline Shape
class Spline extends Shape {
    constructor(points, fillColor = '#ffffff', strokeColor = '#000000', strokeWidth = 1) {
        super(points[0].x, points[0].y, fillColor, strokeColor, strokeWidth);
        this.points = points;
        this.underConstruction = false; // Track if shape is still being built
    }

    drawArtwork(port) {
        // Need at least 2 points to draw a spline
        if (this.points.length < 2) return;
        
        // Create a PDG Spline object
        const spline = new pdg.Spline(pdg.spline_Cardinal);
        
        // Add ALL points to the spline (including last one), applying rotation if set
        const center = this.getCenterPoint();
        for (let i = 0; i < this.points.length; i++) {
            let point = this.points[i];
            if (this.rotation !== 0) {
                point = this.rotatePoint(point.x, point.y, center.x, center.y, this.rotation);
            }
            spline.addPoint(new pdg.Point(point.x, point.y));
        }
        
        // Draw the spline
        const attrs = new pdg.Attributes();
        attrs.lineColor(new pdg.Color(this.strokeColor))
             .lineThickness(this.strokeWidth)
             .lineStyle(pdg.lineStyle_Solid);
        if (this.fillColor) {
            attrs.fillColor(new pdg.Color(this.fillColor));
        }
        port.drawSpline(spline, attrs);

        // Don't draw control points/endpoints for freehand shapes during construction
        if (this.selected || (this.underConstruction && !this.freehand)) {
            this.drawEndpoints(port);
            this.drawControlPoints(port);
        }
        
        if (this.selected) {
            this.drawRotationControl(port);
        }
    }

    drawEndpoints(port) {
        const fillAttrs = new pdg.Attributes().fillColor(new pdg.Color('red'));
        const outlineAttrs = new pdg.Attributes().lineColor(new pdg.Color('white')).lineThickness(1);
        const center = this.getCenterPoint();
        
        // For Cardinal splines, only interior points are on the curve
        // First and last points are control points
        for (let i = 1; i < this.points.length - 1; i++) {
            let point = this.points[i];
            if (this.rotation !== 0) {
                point = this.rotatePoint(point.x, point.y, center.x, center.y, this.rotation);
            }
            port.drawCircle(new pdg.Point(point.x, point.y), 5, outlineAttrs);
            port.drawCircle(new pdg.Point(point.x, point.y), 4, fillAttrs);
        }
    }

    drawControlPoints(port) {
        const fillAttrs = new pdg.Attributes().fillColor(new pdg.Color('green'));
        const outlineAttrs = new pdg.Attributes().lineColor(new pdg.Color('white')).lineThickness(1);
        const center = this.getCenterPoint();
        
        // First and last points are the control points for Cardinal splines
        if (this.points.length > 0) {
            let point = this.points[0];
            if (this.rotation !== 0) {
                point = this.rotatePoint(point.x, point.y, center.x, center.y, this.rotation);
            }
            port.drawCircle(new pdg.Point(point.x, point.y), 4, outlineAttrs);
            port.drawCircle(new pdg.Point(point.x, point.y), 3, fillAttrs);
        }
        if (this.points.length > 1) {
            const lastIdx = this.points.length - 1;
            let point = this.points[lastIdx];
            if (this.rotation !== 0) {
                point = this.rotatePoint(point.x, point.y, center.x, center.y, this.rotation);
            }
            port.drawCircle(new pdg.Point(point.x, point.y), 4, outlineAttrs);
            port.drawCircle(new pdg.Point(point.x, point.y), 3, fillAttrs);
        }
    }

    getEndpoints() {
        // Return only the interior points (actual curve points)
        return this.points.slice(1, -1);
    }

    getControlPoints() {
        // First and last points are control points
        const controls = [];
        if (this.points.length > 0) {
            controls.push(this.points[0]);
        }
        if (this.points.length > 1) {
            controls.push(this.points[this.points.length - 1]);
        }
        return controls;
    }

    getCenterPoint() {
        if (this.points.length === 0) return { x: 0, y: 0 };
        
        let sumX = 0, sumY = 0;
        for (let point of this.points) {
            sumX += point.x;
            sumY += point.y;
        }
        return {
            x: sumX / this.points.length,
            y: sumY / this.points.length
        };
    }

    getRotationLineLength() {
        if (this.points.length < 2) return 30;
        
        // Calculate approximate size from bounding box
        let minX = this.points[0].x, maxX = this.points[0].x;
        let minY = this.points[0].y, maxY = this.points[0].y;
        
        for (let point of this.points) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }
        
        const width = maxX - minX;
        const height = maxY - minY;
        const size = Math.min(width, height);
        return Math.min(size * 0.3, 40);
    }

    contains(x, y) {
        // If rotated, inverse-rotate the test point
        let testX = x, testY = y;
        if (this.rotation !== 0) {
            const center = this.getCenterPoint();
            const rotated = this.rotatePoint(x, y, center.x, center.y, -this.rotation);
            testX = rotated.x;
            testY = rotated.y;
        }
        
        // Sample points along the spline and check distance to each segment
        if (this.points.length < 2) return false;
        
        // Create a temporary PDG spline to sample points
        const spline = new pdg.Spline(pdg.spline_Cardinal);
        for (let i = 0; i < this.points.length; i++) {
            spline.addPoint(new pdg.Point(this.points[i].x, this.points[i].y));
        }
        
        const maxU = spline.getMaxU();
        const samples = 50; // Number of samples to check
        const threshold = 5; // Distance threshold in pixels
        
        for (let i = 0; i < samples; i++) {
            const u1 = (maxU * i) / samples;
            const u2 = (maxU * (i + 1)) / samples;
            const p1 = spline.getFirstOrder(u1);
            const p2 = spline.getFirstOrder(u2);
            
            // Check distance to this segment
            const dist = this.pointToLineSegmentDistance(testX, testY, p1.x, p1.y, p2.x, p2.y);
            if (dist < threshold) {
                return true;
            }
        }
        
        return false;
    }

    pointToLineSegmentDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    addPoint(point) {
        this.points.push(point);
    }

    intersectsRect(left, top, right, bottom) {
        const rotation = this.rotation || 0;
        const center = this.getCenterPoint();
        
        // Check if any point is inside the rectangle (accounting for rotation)
        for (let point of this.points) {
            let checkPoint = point;
            if (rotation !== 0) {
                checkPoint = this.rotatePoint(point.x, point.y, center.x, center.y, rotation);
            }
            if (checkPoint.x >= left && checkPoint.x <= right && checkPoint.y >= top && checkPoint.y <= bottom) {
                return true;
            }
        }
        
        // Sample points along the spline and check if any are in the rectangle
        if (this.points.length < 2) return false;
        
        const spline = new pdg.Spline(pdg.spline_Cardinal);
        for (let i = 0; i < this.points.length; i++) {
            spline.addPoint(new pdg.Point(this.points[i].x, this.points[i].y));
        }
        
        const maxU = spline.getMaxU();
        const samples = 30;
        
        for (let i = 0; i < samples; i++) {
            const u = (maxU * i) / samples;
            const p = spline.getFirstOrder(u);
            
            let checkPoint = { x: p.x, y: p.y };
            if (rotation !== 0) {
                checkPoint = this.rotatePoint(p.x, p.y, center.x, center.y, rotation);
            }
            
            if (checkPoint.x >= left && checkPoint.x <= right && checkPoint.y >= top && checkPoint.y <= bottom) {
                return true;
            }
        }
        
        return false;
    }
}

// Bezier Spline Shape
class BezierSpline extends Shape {
    constructor(points, fillColor = '#ffffff', strokeColor = '#000000', strokeWidth = 1) {
        super(points[0].x, points[0].y, fillColor, strokeColor, strokeWidth);
        this.points = points;
        this.controlPoints = this.generateControlPoints();
        this.manuallyEditedControls = new Set(); // Track which control points were manually edited
        this.underConstruction = false; // Track if shape is still being built
    }

    closedOutline() {
        const first=this.points[0],last=this.points.at(-1);
        if(this.points.length<3 || first.x!==last.x || first.y!==last.y)return null;
        const {flatten}=require('./path-editing');
        return this.points.slice(0,-1).flatMap((p0,i)=>flatten({p0,p1:this.controlPoints[2*i] || p0,
            p2:this.controlPoints[2*i+1] || this.points[i+1],p3:this.points[i+1]},.25).slice(0,-1));
    }

    generateControlPoints(preserveManualEdits = false) {
        // For a Bezier spline with N points, we need 2*(N-1) control points
        // Each segment between two endpoints needs 2 control points
        const controls = [];
        
        if (this.points.length < 2) return controls;
        
        // For each segment between consecutive endpoints
        for (let i = 0; i < this.points.length - 1; i++) {
            const current = this.points[i];
            const next = this.points[i + 1];
            
            // Check if these control points were manually edited
            const ctrl1Index = i * 2;
            const ctrl2Index = i * 2 + 1;
            
            // If preserving manual edits and these were edited, keep them
            if (preserveManualEdits && this.manuallyEditedControls && 
                this.manuallyEditedControls.has(ctrl1Index) && 
                this.controlPoints && this.controlPoints[ctrl1Index]) {
                controls.push(this.controlPoints[ctrl1Index]);
            } else {
                // Calculate tangent direction for smooth curve
                let tangentStart;
                if (i === 0) {
                    // First segment: use direction to next point
                    tangentStart = { x: next.x - current.x, y: next.y - current.y };
                } else {
                    // Interior point: use average of directions to neighbors
                    const prev = this.points[i - 1];
                    tangentStart = { 
                        x: (next.x - prev.x) / 2, 
                        y: (next.y - prev.y) / 2 
                    };
                }
                
                // Control points are placed 1/3 of the way along the tangents
                const ctrlDist = 0.33;
                
                // First control point (leaving current point)
                controls.push({
                    x: current.x + tangentStart.x * ctrlDist,
                    y: current.y + tangentStart.y * ctrlDist
                });
            }
            
            // Second control point
            if (preserveManualEdits && this.manuallyEditedControls && 
                this.manuallyEditedControls.has(ctrl2Index) && 
                this.controlPoints && this.controlPoints[ctrl2Index]) {
                controls.push(this.controlPoints[ctrl2Index]);
            } else {
                let tangentEnd;
                if (i === this.points.length - 2) {
                    // Last segment: use direction from previous point
                    tangentEnd = { x: next.x - current.x, y: next.y - current.y };
                } else {
                    // Interior point: use average of directions to neighbors
                    const nextNext = this.points[i + 2];
                    tangentEnd = { 
                        x: (nextNext.x - current.x) / 2, 
                        y: (nextNext.y - current.y) / 2 
                    };
                }
                
                const ctrlDist = 0.33;
                
                // Second control point (arriving at next point)
                controls.push({
                    x: next.x - tangentEnd.x * ctrlDist,
                    y: next.y - tangentEnd.y * ctrlDist
                });
            }
        }
        
        return controls;
    }

    drawArtwork(port) {
        // Create a PDG Spline object
        const spline = new pdg.Spline(pdg.spline_CubicBezier);
        const center = this.getCenterPoint();
        
        // Add segments to the spline, applying rotation if set
        // Each segment uses 2 control points: controls[i*2] and controls[i*2+1]
        const outline=this.closedOutline();
        if(outline) {
            const vertices=outline.map(p=>this.rotation?this.rotatePoint(p.x,p.y,center.x,center.y,this.rotation):p);
            // Splines draw strokes only. Keep a separate retained fill element
            // even when transparent so style edits retain the element layout.
            port.drawPolygon(new pdg.Polygon(vertices.map(p=>new pdg.Point(p))),new pdg.Attributes()
                .fillColor(this.fillColor || 'white').fillOpacity(this.fillColor?1:0).lineStyle(pdg.lineStyle_None));
        }
        for (let i = 0; i < this.points.length - 1; i++) {
            let p1 = this.points[i];
            let p4 = this.points[i + 1];
            let p2 = this.controlPoints[i * 2] || p1;
            let p3 = this.controlPoints[i * 2 + 1] || p4;
            
            if (this.rotation !== 0) {
                p1 = this.rotatePoint(p1.x, p1.y, center.x, center.y, this.rotation);
                p2 = this.rotatePoint(p2.x, p2.y, center.x, center.y, this.rotation);
                p3 = this.rotatePoint(p3.x, p3.y, center.x, center.y, this.rotation);
                p4 = this.rotatePoint(p4.x, p4.y, center.x, center.y, this.rotation);
            }
            
            spline.addSegment(
                new pdg.Point(p1.x, p1.y),
                new pdg.Point(p2.x, p2.y),
                new pdg.Point(p3.x, p3.y),
                new pdg.Point(p4.x, p4.y)
            );
        }
        
        // Draw the spline
        const attrs = new pdg.Attributes();
        if(this.strokeColor && this.strokeWidth>0)attrs.lineColor(new pdg.Color(this.strokeColor))
             .lineThickness(this.strokeWidth).lineStyle(pdg.lineStyle_Solid);
        else attrs.lineStyle(pdg.lineStyle_None);
        if (this.fillColor) {
            attrs.fillColor(new pdg.Color(this.fillColor));
        }
        port.drawSpline(spline, attrs);

        if (this.selected || this.underConstruction) {
            this.drawEndpoints(port);
            this.drawControlPoints(port);
        }
        
        if (this.selected) {
            this.drawRotationControl(port);
        }
    }

    drawEndpoints(port) {
        const fillAttrs = new pdg.Attributes().fillColor(new pdg.Color('red'));
        const outlineAttrs = new pdg.Attributes().lineColor(new pdg.Color('white')).lineThickness(1);
        const center = this.getCenterPoint();
        
        this.points.forEach(point => {
            let p = point;
            if (this.rotation !== 0) {
                p = this.rotatePoint(p.x, p.y, center.x, center.y, this.rotation);
            }
            port.drawCircle(new pdg.Point(p.x, p.y), 5, outlineAttrs);
            port.drawCircle(new pdg.Point(p.x, p.y), 4, fillAttrs);
        });
    }

    drawControlPoints(port) {
        const fillAttrs = new pdg.Attributes().fillColor(new pdg.Color('green'));
        const outlineAttrs = new pdg.Attributes().lineColor(new pdg.Color('white')).lineThickness(1);
        const center = this.getCenterPoint();
        
        this.controlPoints.forEach(point => {
            let p = point;
            if (this.rotation !== 0) {
                p = this.rotatePoint(p.x, p.y, center.x, center.y, this.rotation);
            }
            port.drawCircle(new pdg.Point(p.x, p.y), 4, outlineAttrs);
            port.drawCircle(new pdg.Point(p.x, p.y), 3, fillAttrs);
        });
    }

    getEndpoints() {
        return [...this.points];
    }

    getControlPoints() {
        return [...this.controlPoints];
    }

    getCenterPoint() {
        if (this.points.length === 0) return { x: 0, y: 0 };
        
        let sumX = 0, sumY = 0;
        for (let point of this.points) {
            sumX += point.x;
            sumY += point.y;
        }
        return {
            x: sumX / this.points.length,
            y: sumY / this.points.length
        };
    }

    getRotationLineLength() {
        if (this.points.length < 2) return 30;
        
        // Calculate approximate size from bounding box
        let minX = this.points[0].x, maxX = this.points[0].x;
        let minY = this.points[0].y, maxY = this.points[0].y;
        
        for (let point of this.points) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }
        
        const width = maxX - minX;
        const height = maxY - minY;
        const size = Math.min(width, height);
        return Math.min(size * 0.3, 40);
    }

    contains(x, y) {
        // If rotated, inverse-rotate the test point
        let testX = x, testY = y;
        if (this.rotation !== 0) {
            const center = this.getCenterPoint();
            const rotated = this.rotatePoint(x, y, center.x, center.y, -this.rotation);
            testX = rotated.x;
            testY = rotated.y;
        }
        
        // Sample points along the Bezier spline and check distance to each segment
        if (this.points.length < 2) return false;
        const outline=this.fillColor && this.closedOutline();
        if(outline && new pdg.Polygon(outline.map(p=>new pdg.Point(p))).contains(new pdg.Point(testX,testY)))return true;
        
        // Create a temporary PDG spline to sample points
        const spline = new pdg.Spline(pdg.spline_CubicBezier);
        for (let i = 0; i < this.points.length - 1; i++) {
            const p1 = this.points[i];
            const p4 = this.points[i + 1];
            const p2 = this.controlPoints[i * 2] || p1;
            const p3 = this.controlPoints[i * 2 + 1] || p4;
            
            spline.addSegment(
                new pdg.Point(p1.x, p1.y),
                new pdg.Point(p2.x, p2.y),
                new pdg.Point(p3.x, p3.y),
                new pdg.Point(p4.x, p4.y)
            );
        }
        
        const maxU = spline.getMaxU();
        const samples = 50;
        const threshold = 5;
        
        for (let i = 0; i < samples; i++) {
            const u1 = (maxU * i) / samples;
            const u2 = (maxU * (i + 1)) / samples;
            const p1 = spline.getFirstOrder(u1);
            const p2 = spline.getFirstOrder(u2);
            
            const dist = this.pointToLineSegmentDistance(testX, testY, p1.x, p1.y, p2.x, p2.y);
            if (dist < threshold) {
                return true;
            }
        }
        
        return false;
    }

    pointToLineSegmentDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    addPoint(point) {
        this.points.push(point);
        // Regenerate all control points to maintain smooth curves
        // Preserve any manually edited control points
        this.controlPoints = this.generateControlPoints(true);
    }

    intersectsRect(left, top, right, bottom) {
        const rotation = this.rotation || 0;
        const center = this.getCenterPoint();
        
        // Check if any endpoint is inside the rectangle (accounting for rotation)
        for (let point of this.points) {
            let checkPoint = point;
            if (rotation !== 0) {
                checkPoint = this.rotatePoint(point.x, point.y, center.x, center.y, rotation);
            }
            if (checkPoint.x >= left && checkPoint.x <= right && checkPoint.y >= top && checkPoint.y <= bottom) {
                return true;
            }
        }
        
        // Sample points along the bezier curve and check if any are in the rectangle
        if (this.points.length < 2) return false;
        
        const spline = new pdg.Spline(pdg.spline_CubicBezier);
        for (let i = 0; i < this.points.length - 1; i++) {
            const p1 = this.points[i];
            const p4 = this.points[i + 1];
            const p2 = this.controlPoints[i * 2] || p1;
            const p3 = this.controlPoints[i * 2 + 1] || p4;
            
            spline.addSegment(
                new pdg.Point(p1.x, p1.y),
                new pdg.Point(p2.x, p2.y),
                new pdg.Point(p3.x, p3.y),
                new pdg.Point(p4.x, p4.y)
            );
        }
        
        const maxU = spline.getMaxU();
        const samples = 30;
        
        for (let i = 0; i < samples; i++) {
            const u = (maxU * i) / samples;
            const p = spline.getFirstOrder(u);
            
            let checkPoint = { x: p.x, y: p.y };
            if (rotation !== 0) {
                checkPoint = this.rotatePoint(p.x, p.y, center.x, center.y, rotation);
            }
            
            if (checkPoint.x >= left && checkPoint.x <= right && checkPoint.y >= top && checkPoint.y <= bottom) {
                return true;
            }
        }
        
        return false;
    }
}

// Oval Shape (ellipse)
class Oval extends Shape {
    constructor(x, y, radiusX, radiusY, fillColor = 'white', strokeColor = 'black', strokeWidth = 1) {
        super(x, y, fillColor, strokeColor, strokeWidth);
        this.radiusX = radiusX;
        this.radiusY = radiusY;
    }

    drawArtwork(port) {
        const center = new pdg.Point(this.x, this.y);
        const attrs = new pdg.Attributes();
        
        attrs.lineColor(new pdg.Color(this.strokeColor))
             .lineThickness(this.strokeWidth)
             .lineStyle(pdg.lineStyle_Solid);
        if (this.fillColor) {
            attrs.fillColor(new pdg.Color(this.fillColor));
        }
        port.drawEllipse(center, this.radiusX, this.radiusY, attrs);

        if (this.selected) {
            this.drawEndpoints(port);
            this.drawRotationControl(port);
        }
    }

    drawEndpoints(port) {
        const points = [
            new pdg.Point(this.x, this.y - this.radiusY),
            new pdg.Point(this.x + this.radiusX, this.y),
            new pdg.Point(this.x, this.y + this.radiusY),
            new pdg.Point(this.x - this.radiusX, this.y)
        ];
        const fillAttrs = new pdg.Attributes().fillColor(new pdg.Color('red'));
        const outlineAttrs = new pdg.Attributes().lineColor(new pdg.Color('white')).lineThickness(1);
        
        for (const point of points) {
            port.drawCircle(point, 5, outlineAttrs);
            port.drawCircle(point, 4, fillAttrs);
        }
    }

    contains(x, y) {
        // If rotated, inverse-rotate the test point
        let testX = x, testY = y;
        if (this.rotation !== 0) {
            const center = this.getCenterPoint();
            const rotated = this.rotatePoint(x, y, center.x, center.y, -this.rotation);
            testX = rotated.x;
            testY = rotated.y;
        }
        
        const dx = (testX - this.x) / this.radiusX;
        const dy = (testY - this.y) / this.radiusY;
        return dx * dx + dy * dy <= 1;
    }

    getEndpoints() {
        return [
            { x: this.x, y: this.y - this.radiusY },
            { x: this.x + this.radiusX, y: this.y },
            { x: this.x, y: this.y + this.radiusY },
            { x: this.x - this.radiusX, y: this.y }
        ];
    }

    getCenterPoint() {
        return { x: this.x, y: this.y };
    }

    getRotationLineLength() {
        const avgRadius = (this.radiusX + this.radiusY) / 2;
        return Math.min(avgRadius * 0.8, 40);
    }

    intersectsRect(left, top, right, bottom) {
        if (this.rotation !== 0) {
            // For rotated ovals, sample points around the ellipse and check if any are in the rect
            const center = this.getCenterPoint();
            const samples = 16;
            
            for (let i = 0; i < samples; i++) {
                const angle = (i / samples) * Math.PI * 2;
                const localX = this.x + Math.cos(angle) * this.radiusX;
                const localY = this.y + Math.sin(angle) * this.radiusY;
                const rotated = this.rotatePoint(localX, localY, center.x, center.y, this.rotation);
                
                if (rotated.x >= left && rotated.x <= right && rotated.y >= top && rotated.y <= bottom) {
                    return true;
                }
            }
            
            // Also check if selection rect center is inside the rotated oval
            const rectCenterX = (left + right) / 2;
            const rectCenterY = (top + bottom) / 2;
            if (this.contains(rectCenterX, rectCenterY)) {
                return true;
            }
            
            return false;
        } else {
            // Not rotated, use original logic
            const closestX = Math.max(left, Math.min(this.x, right));
            const closestY = Math.max(top, Math.min(this.y, bottom));
            
            const dx = (closestX - this.x) / this.radiusX;
            const dy = (closestY - this.y) / this.radiusY;
            const distanceSquared = dx * dx + dy * dy;
            
            if (distanceSquared <= 1) return true;
            
            const corners = [
                [left, top], [right, top], [right, bottom], [left, bottom]
            ];
            
            for (let [cx, cy] of corners) {
                const ndx = (cx - this.x) / this.radiusX;
                const ndy = (cy - this.y) / this.radiusY;
                if (ndx * ndx + ndy * ndy <= 1) {
                    return true;
                }
            }
            
            return false;
        }
    }
}

// Polygon Shape
class Polygon extends Shape {
    constructor(points, fillColor = '#ffffff', strokeColor = '#000000', strokeWidth = 1) {
        super(points[0].x, points[0].y, fillColor, strokeColor, strokeWidth);
        this.points = points;
        this.underConstruction = false; // Track if shape is still being built
    }

    drawArtwork(port) {
        // Create a PDG Polygon object
        const center = this.getCenterPoint();
        
        // Add all points to the polygon, applying rotation if set
        const vertices = this.points.map(point => {
            let p = point;
            if (this.rotation !== 0) {
                p = this.rotatePoint(p.x, p.y, center.x, center.y, this.rotation);
            }
            return new pdg.Point(p.x, p.y);
        });
        // addPoint drops adjacent subpixel vertices. The array constructor
        // retains thin imported ink and the doubled bridges around holes.
        const polygon = new pdg.Polygon(vertices);
        
        // Draw the polygon
        const attrs = new pdg.Attributes();
        if (this.strokeColor && this.strokeWidth > 0) {
            attrs.lineColor(new pdg.Color(this.strokeColor))
                .lineThickness(this.strokeWidth).lineStyle(pdg.lineStyle_Solid);
        } else attrs.lineStyle(pdg.lineStyle_None);
        if (this.fillColor) {
            attrs.fillColor(new pdg.Color(this.fillColor));
        }
        port.drawPolygon(polygon, attrs);

        if (this.selected || this.underConstruction) {
            this.drawEndpoints(port);
        }
        
        if (this.selected) {
            this.drawRotationControl(port);
        }
    }

    drawEndpoints(port) {
        const fillAttrs = new pdg.Attributes().fillColor(new pdg.Color('red'));
        const outlineAttrs = new pdg.Attributes().lineColor(new pdg.Color('white')).lineThickness(1);
        const center = this.getCenterPoint();
        
        this.points.forEach(point => {
            let p = point;
            if (this.rotation !== 0) {
                p = this.rotatePoint(p.x, p.y, center.x, center.y, this.rotation);
            }
            port.drawCircle(new pdg.Point(p.x, p.y), 5, outlineAttrs);
            port.drawCircle(new pdg.Point(p.x, p.y), 4, fillAttrs);
        });
    }

    contains(x, y) {
        // If rotated, inverse-rotate the test point
        let testX = x, testY = y;
        if (this.rotation !== 0) {
            const center = this.getCenterPoint();
            const rotated = this.rotatePoint(x, y, center.x, center.y, -this.rotation);
            testX = rotated.x;
            testY = rotated.y;
        }
        
        // First check if near any edge
        const threshold = 5;
        for (let i = 0; i < this.points.length; i++) {
            const p1 = this.points[i];
            const p2 = this.points[(i + 1) % this.points.length]; // Wrap around to first point
            const dist = this.pointToLineSegmentDistance(testX, testY, p1.x, p1.y, p2.x, p2.y);
            if (dist < threshold) {
                return true;
            }
        }
        
        // Then check if inside using ray casting algorithm for point-in-polygon
        let inside = false;
        for (let i = 0, j = this.points.length - 1; i < this.points.length; j = i++) {
            if (((this.points[i].y > testY) !== (this.points[j].y > testY)) &&
                (testX < (this.points[j].x - this.points[i].x) * (testY - this.points[i].y) / (this.points[j].y - this.points[i].y) + this.points[i].x)) {
                inside = !inside;
            }
        }
        return inside;
    }

    pointToLineSegmentDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getEndpoints() {
        return [...this.points];
    }

    getCenterPoint() {
        if (this.points.length === 0) return { x: 0, y: 0 };
        
        let sumX = 0, sumY = 0;
        for (let point of this.points) {
            sumX += point.x;
            sumY += point.y;
        }
        return {
            x: sumX / this.points.length,
            y: sumY / this.points.length
        };
    }

    getRotationLineLength() {
        if (this.points.length < 2) return 30;
        
        // Calculate approximate size from bounding box
        let minX = this.points[0].x, maxX = this.points[0].x;
        let minY = this.points[0].y, maxY = this.points[0].y;
        
        for (let point of this.points) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }
        
        const width = maxX - minX;
        const height = maxY - minY;
        const size = Math.min(width, height);
        return Math.min(size * 0.3, 40);
    }

    intersectsRect(left, top, right, bottom) {
        const rotation = this.rotation || 0;
        const center = this.getCenterPoint();
        
        // Check if any vertex is inside the rectangle (accounting for rotation)
        for (let point of this.points) {
            let checkPoint = point;
            if (rotation !== 0) {
                checkPoint = this.rotatePoint(point.x, point.y, center.x, center.y, rotation);
            }
            if (checkPoint.x >= left && checkPoint.x <= right && checkPoint.y >= top && checkPoint.y <= bottom) {
                return true;
            }
        }
        
        // Check if any edge of the polygon intersects with the rectangle (accounting for rotation)
        for (let i = 0; i < this.points.length; i++) {
            let p1 = this.points[i];
            let p2 = this.points[(i + 1) % this.points.length];
            
            if (rotation !== 0) {
                p1 = this.rotatePoint(p1.x, p1.y, center.x, center.y, rotation);
                p2 = this.rotatePoint(p2.x, p2.y, center.x, center.y, rotation);
            }
            
            if (this.lineIntersectsRect(p1.x, p1.y, p2.x, p2.y, left, top, right, bottom)) {
                return true;
            }
        }
        
        // Check if rectangle center is inside the polygon
        const centerX = (left + right) / 2;
        const centerY = (top + bottom) / 2;
        if (this.contains(centerX, centerY)) {
            return true;
        }
        
        return false;
    }

    lineIntersectsRect(x1, y1, x2, y2, left, top, right, bottom) {
        // Check intersection with each edge of the rectangle
        const edges = [
            [left, top, right, top],     // Top edge
            [right, top, right, bottom],  // Right edge
            [right, bottom, left, bottom], // Bottom edge
            [left, bottom, left, top]     // Left edge
        ];
        
        for (let edge of edges) {
            if (this.linesIntersect(x1, y1, x2, y2, edge[0], edge[1], edge[2], edge[3])) {
                return true;
            }
        }
        return false;
    }

    linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
        if (denom === 0) return false; // Lines are parallel
        
        const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
        const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
        
        return (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1);
    }

    pointInPolygon(x, y) {
        let inside = false;
        for (let i = 0, j = this.points.length - 1; i < this.points.length; j = i++) {
            if (((this.points[i].y > y) !== (this.points[j].y > y)) &&
                (x < (this.points[j].x - this.points[i].x) * (y - this.points[i].y) / (this.points[j].y - this.points[i].y) + this.points[i].x)) {
                inside = !inside;
            }
        }
        return inside;
    }
}

class Image extends Shape {
    constructor(x, y, width, height, imageData, imageExtension = '.png', sourceName = '') {
        super(x, y, null, null, 0);
        this.imageData = imageData;
        this.imageExtension = Image.normalizeExtension(imageExtension);
        this.sourceName = sourceName;
        this.image = null;
        this.loadError = null;
        this.loadImage();

        this.width = width === undefined || width === null
            ? (this.image ? this.image.getWidth() : 100)
            : width;
        this.height = height === undefined || height === null
            ? (this.image ? this.image.getHeight() : 100)
            : height;
    }

    static normalizeExtension(extension) {
        const normalized = String(extension || '.png').toLowerCase();
        return /^\.(png|jpe?g|gif|bmp)$/.test(normalized) ? normalized : '.img';
    }

    static fromFile(filename, x = 0, y = 0) {
        const data = fs.readFileSync(filename).toString('base64');
        return new Image(x, y, null, null, data, path.extname(filename), path.basename(filename));
    }

    getMaterializedPath() {
        if (!this.imageData) return null;
        const digest = crypto.createHash('sha256').update(this.imageData).digest('hex');
        const directory = path.join(os.tmpdir(), 'skrybble-images');
        const filename = path.join(directory, `${digest}${this.imageExtension}`);
        if (!fs.existsSync(filename)) {
            fs.mkdirSync(directory, { recursive: true });
            fs.writeFileSync(filename, Buffer.from(this.imageData, 'base64'));
        }
        return filename;
    }

    loadImage() {
        if (typeof pdg === 'undefined' || !pdg.Image) return;
        try {
            const filename = this.getMaterializedPath();
            if (!filename) throw new Error('Image data is missing');
            this.image = new pdg.Image(filename);
            if (this.image.getWidth() <= 0 || this.image.getHeight() <= 0) {
                throw new Error('Unsupported or invalid image data');
            }
            this.loadError = null;
        } catch (error) {
            this.image = null;
            this.loadError = error.message;
        }
    }

    getNormalizedBounds() {
        return {
            left: Math.min(this.x, this.x + this.width),
            top: Math.min(this.y, this.y + this.height),
            right: Math.max(this.x, this.x + this.width),
            bottom: Math.max(this.y, this.y + this.height)
        };
    }

    drawArtwork(port) {
        const bounds = this.getNormalizedBounds();
        const rect = new pdg.Rect(bounds.left, bounds.top, bounds.right, bounds.bottom);
        const center = this.getCenterPoint();
        const attrs = new pdg.Attributes().fitType(pdg.fit_Fill);
        if (this.rotation) {
            attrs.rotation(this.rotation, new pdg.Point(center.x, center.y));
        }

        if (this.image) {
            port.drawImage(this.image, rect, attrs);
        } else {
            const errorAttrs = new pdg.Attributes()
                .lineColor(new pdg.Color('red'))
                .lineThickness(2);
            port.drawRect(rect, errorAttrs);
            port.drawLine(new pdg.Point(bounds.left, bounds.top),
                new pdg.Point(bounds.right, bounds.bottom), errorAttrs);
            port.drawLine(new pdg.Point(bounds.right, bounds.top),
                new pdg.Point(bounds.left, bounds.bottom), errorAttrs);
        }

        if (this.selected) {
            this.drawEndpoints(port);
            this.drawRotationControl(port);
        }
    }

    drawEndpoints(port) {
        const center = this.getCenterPoint();
        const fillAttrs = new pdg.Attributes().fillColor(new pdg.Color('red'));
        const outlineAttrs = new pdg.Attributes().lineColor(new pdg.Color('white')).lineThickness(1);
        for (let point of this.getEndpoints()) {
            if (this.rotation) {
                point = this.rotatePoint(point.x, point.y, center.x, center.y, this.rotation);
            }
            const pdgPoint = new pdg.Point(point.x, point.y);
            port.drawCircle(pdgPoint, 5, outlineAttrs);
            port.drawCircle(pdgPoint, 4, fillAttrs);
        }
    }

    contains(x, y) {
        const center = this.getCenterPoint();
        let point = { x, y };
        if (this.rotation) {
            point = this.rotatePoint(x, y, center.x, center.y, -this.rotation);
        }
        const bounds = this.getNormalizedBounds();
        return point.x >= bounds.left && point.x <= bounds.right &&
            point.y >= bounds.top && point.y <= bounds.bottom;
    }

    getEndpoints() {
        return [
            { x: this.x, y: this.y },
            { x: this.x + this.width, y: this.y },
            { x: this.x + this.width, y: this.y + this.height },
            { x: this.x, y: this.y + this.height }
        ];
    }

    getCenterPoint() {
        return { x: this.x + this.width / 2, y: this.y + this.height / 2 };
    }

    getRotationLineLength() {
        return Math.min(Math.min(Math.abs(this.width), Math.abs(this.height)) * 0.4, 40);
    }

    intersectsRect(left, top, right, bottom) {
        const center = this.getCenterPoint();
        const corners = this.getEndpoints().map(point => this.rotation
            ? this.rotatePoint(point.x, point.y, center.x, center.y, this.rotation)
            : point);
        const imageLeft = Math.min(...corners.map(point => point.x));
        const imageTop = Math.min(...corners.map(point => point.y));
        const imageRight = Math.max(...corners.map(point => point.x));
        const imageBottom = Math.max(...corners.map(point => point.y));
        return imageLeft <= right && imageRight >= left && imageTop <= bottom && imageBottom >= top;
    }
}

// UTF-8 text is semantic document data; native Drawing owns rendering.
class Text extends Shape {
    constructor(x,y,text='Text',color='black',fontSize=24,width=72,height=32,fontName='Arial',textStyle=0) {
        super(x,y,color,color,0);
        this.text=text;this.fontSize=fontSize;this.width=width;this.height=height;
        this.fontName=fontName;this.textStyle=textStyle;
    }
    getFont() {
        if(this._fontName!==this.fontName) {this._font=pdg.gfx.createFont(this.fontName);this._fontName=this.fontName;}
        return this._font;
    }
    measure(port,text=this.text) {
        const old=port.getCurrentFont(this.textStyle);
        try {port.setFontForStyle(this.textStyle,this.getFont());return port.getTextWidth(text,this.fontSize,this.textStyle);}
        finally {port.setFontForStyle(this.textStyle,old);}
    }
    layout(port=pdg.gfx.getMainPort()) {
        // x/y are the box's top-left for persistence and hit testing. Resizing
        // its natural text metrics must preserve the rotation/selection pivot.
        const center=this.getCenterPoint();
        if(port)this._layoutPort=port;
        port ||= this._layoutPort;
        const font=this.getFont();
        this._ascent=Math.ceil(font.getFontAscent(this.fontSize,this.textStyle));
        this._descent=Math.ceil(font.getFontDescent(this.fontSize,this.textStyle));
        this._textWidth=port?this.measure(port):Array.from(this.text).length*this.fontSize*.6;
        const minimum=port?this.measure(port,'MMM'):this.fontSize*2.5;
        this.width=Math.max(minimum,this._textWidth)+8;
        this.height=this._ascent+this._descent+8;
        this.x=center.x-this.width/2;
        this.y=center.y-this.height/2;
    }
    textRect() {
        return new pdg.Rect(this.x+4,this.y+4,this.x+4+Math.max(1,this._textWidth),this.y+4+this._ascent+this._descent);
    }
    draw(port) {this.layout(this._layoutPort || pdg.gfx.getMainPort());super.draw(port);}
    drawArtwork(port) {
        this.layout();
        port.drawText(this.text,this.textRect(),new pdg.Attributes().font(this.getFont())
            .textStyle(this.textStyle).textSize(this.fontSize).fillColor(new pdg.Color(this.fillColor)));
    }
    getArtwork(strokeScale = 1) {
        this.layout();
        const art=super.getArtwork(strokeScale),rect=this.textRect();
        // Changing text changes natural ink bounds, without fitting it into
        // the editing box or replacing the retained text element.
        const points=[rect.leftTop(),rect.rightTop(),rect.rightBottom(),rect.leftBottom()];
        const key=[rect.left,rect.top,rect.right,rect.bottom].join(',');
        if(key!==this._inkKey) {
            points.forEach((point,index)=>this._elements[0].changeControlPoint(index,point));
            const bounds=this._geometry.getBounds();
            [bounds.leftTop(),bounds.rightTop(),bounds.rightBottom(),bounds.leftBottom()]
                .forEach((point,index)=>this._rootElement.changeControlPoint(index,point));
            this._inkKey=key;
        }
        return art;
    }
    getCenterPoint() { return {x:this.x+this.width/2,y:this.y+this.height/2}; }
    getEndpoints() { return []; }
    contains(x,y) {
        const c=this.getCenterPoint();
        const p=this.rotatePoint(x,y,c.x,c.y,-this.rotation);
        return p.x>=this.x && p.x<=this.x+this.width && p.y>=this.y && p.y<=this.y+this.height;
    }
    intersectsRect(left,top,right,bottom) {
        const c=this.getCenterPoint();
        const points=[{x:this.x,y:this.y},{x:this.x+this.width,y:this.y},
            {x:this.x+this.width,y:this.y+this.height},{x:this.x,y:this.y+this.height}]
            .map(p=>this.rotatePoint(p.x,p.y,c.x,c.y,this.rotation));
        return Math.min(...points.map(p=>p.x))<=right && Math.max(...points.map(p=>p.x))>=left &&
            Math.min(...points.map(p=>p.y))<=bottom && Math.max(...points.map(p=>p.y))>=top;
    }
}

// A first-class shape whose children render through one pdg.Drawing. Keeping
// the child objects intact makes ungrouping and serialization lossless.
class Group extends Shape {
    constructor(children = []) {
        const first = children[0];
        super(0, 0, first ? first.fillColor : null,
            first ? first.strokeColor : 'black', first ? first.strokeWidth : 1);
        this.children = children;
        this.children.forEach(child => child.selected = false);
        this.rebuildDrawing();
    }

    rebuildDrawing() {
        this._artwork = null;
        return null;
    }

    getArtwork(strokeScale = 1) {
        const children = this.children.map(child => child.getArtwork(strokeScale));
        if (!this._artwork || children.some((drawing,i) => drawing !== this._childArtwork[i])) {
            this._artwork = pdg.createDrawing();
            this._appearance = new pdg.Attributes();
            this._childElements = children.map(drawing => {
                const element = this._artwork.addDrawing(drawing.getBounds(),drawing,this._appearance);
                element.setLiveAttributes(this._appearance);
                return element;
            });
            this._childArtwork = children;
            this._childBounds=[];
            this._translationKey=null;
        }
        children.forEach((drawing,i) => {
            const b=drawing.getBounds();
            const key=[b.left,b.top,b.right,b.bottom].join(',');
            if (!this._childBounds) this._childBounds=[];
            if (this._childBounds[i]!==key) {
                const q=new pdg.Quad(b);
                for (let j=0;j<4;j++) this._childElements[i].changeControlPoint(j,q.points[j]);
                this._childBounds[i]=key;
            }
        });
        const center=this.getCenterPoint();
        const translationKey=[this.x,this.y,this.rotation,center.x,center.y].join(',');
        if (translationKey!==this._translationKey) {
            const c=Math.cos(this.rotation),s=Math.sin(this.rotation);
            this._appearance.setTransform([c,s,0,-s,c,0,
                center.x+c*(this.x-center.x)-s*(this.y-center.y),
                center.y+s*(this.x-center.x)+c*(this.y-center.y),1]);
            this._translationKey=translationKey;
        }
        return this._artwork;
    }

    draw(port) {
        const artwork = this.getArtwork(port.strokeScale || 1);
        if (port.drawRetained) port.drawRetained(artwork);
        else port.drawDrawing(artwork,new pdg.Point(0,0),new pdg.Attributes());
        if (this.selected) {
            const controls=port.controls || port;
            this.drawSelectionBounds(controls);this.drawRotationControl(controls);
        }
    }

    drawSelectionBounds(port) {
        const bounds = this.getBounds();
        const attrs = new pdg.Attributes()
            .lineColor(new pdg.Color('blue'))
            .lineOpacity(0.65)
            .lineThickness(1);
        port.drawRect(new pdg.Rect(bounds.left, bounds.top, bounds.right, bounds.bottom), attrs);
    }

    contains(x, y) {
        const center=this.getCenterPoint(),point=this.rotatePoint(x,y,center.x,center.y,-this.rotation);
        x=point.x;y=point.y;
        for (let i = this.children.length - 1; i >= 0; i--) {
            if (this.children[i].contains(x - this.x, y - this.y)) return true;
        }
        return false;
    }

    intersectsRect(left, top, right, bottom) {
        if(this.rotation) {
            const b=this.getBounds();return b.left<=right && b.right>=left && b.top<=bottom && b.bottom>=top;
        }
        return this.children.some(child =>
            child.intersectsRect && child.intersectsRect(left-this.x, top-this.y, right-this.x, bottom-this.y));
    }

    getBaseBounds() {
        let bounds = null;
        for (const child of this.children) {
            const childBounds = getShapeBounds(child);
            bounds = includePoint(bounds, { x: childBounds.left, y: childBounds.top });
            bounds = includePoint(bounds, { x: childBounds.right, y: childBounds.bottom });
        }
        bounds = bounds || { left: 0, top: 0, right: 0, bottom: 0 };
        return {left:bounds.left+this.x,top:bounds.top+this.y,
            right:bounds.right+this.x,bottom:bounds.bottom+this.y};
    }

    getBounds() {
        const b=this.getBaseBounds(),center=this.getCenterPoint();
        if(!this.rotation)return b;
        const points=[{x:b.left,y:b.top},{x:b.right,y:b.top},{x:b.right,y:b.bottom},{x:b.left,y:b.bottom}]
            .map(p=>this.rotatePoint(p.x,p.y,center.x,center.y,this.rotation));
        return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),
            top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};
    }

    getCenterPoint() {
        const bounds = this.getBaseBounds();
        return { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
    }

    getEndpoints() { return []; }
    getControlPoints() { return []; }

    moveBy(dx, dy) {
        this.x += dx;
        this.y += dy;
    }

    set fillColor(value) {
        this._fillColor = value;
        if (this.children) {
            this.children.forEach(child => child.fillColor = value);
        }
    }
    get fillColor() { return this._fillColor; }

    set strokeColor(value) {
        this._strokeColor = value;
        if (this.children) {
            this.children.forEach(child => child.strokeColor = value);
        }
    }
    get strokeColor() { return this._strokeColor; }

    set strokeWidth(value) {
        this._strokeWidth = value;
        if (this.children) {
            this.children.forEach(child => child.strokeWidth = value);
        }
    }
    get strokeWidth() { return this._strokeWidth; }
}

// Arbitrary native drawings retain text, images, curves and their attributes.
// The editor can move, rotate, duplicate and group this artwork as a unit.
class NativeDrawing extends Shape {
    constructor(stream) {
        super(0,0,null,null,0);
        const codec=require('./pdg-drawing-import');
        this._drawing=codec.decodeNative(codec.fromBase64(stream));
        this.stream=stream;
    }
    getArtwork() {
        const bounds=this._drawing.getBounds(),center=this.getCenterPoint();
        if (!this._artwork) {
            this._appearance=new pdg.Attributes();this._artwork=pdg.createDrawing();
            this._rootElement=this._artwork.addDrawing(bounds,this._drawing,this._appearance);
            this._rootElement.setLiveAttributes(this._appearance);
        }
        const c=Math.cos(this.rotation),s=Math.sin(this.rotation);
        this._appearance.setTransform([c,s,0,-s,c,0,
            center.x+c*(this.x-center.x)-s*(this.y-center.y),
            center.y+s*(this.x-center.x)+c*(this.y-center.y),1]);
        return this._artwork;
    }
    getEndpoints() {
        const b=this._drawing.getBounds();
        return [{x:b.left+this.x,y:b.top+this.y},{x:b.right+this.x,y:b.top+this.y},
            {x:b.right+this.x,y:b.bottom+this.y},{x:b.left+this.x,y:b.bottom+this.y}];
    }
    getCenterPoint() {
        const b=this._drawing.getBounds();
        return {x:(b.left+b.right)/2+this.x,y:(b.top+b.bottom)/2+this.y};
    }
    contains(x,y) {
        const c=this.getCenterPoint(),p=this.rotatePoint(x,y,c.x,c.y,-this.rotation);
        const b=this._drawing.getBounds();
        return p.x-this.x>=b.left && p.x-this.x<=b.right && p.y-this.y>=b.top && p.y-this.y<=b.bottom;
    }
}

module.exports = {
    getShapeBounds,
    Shape,
    NativeDrawing,
    Text,
    Line,
    Circle,
    Rectangle,
    Spline,
    BezierSpline,
    Oval,
    Polygon,
    Image,
    Group
};
