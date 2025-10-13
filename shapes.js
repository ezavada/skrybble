// Base Shape class and all shape implementations

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
        const lineLength = this.getRotationLineLength();
        
        // Draw blue center point
        const centerAttrs = new pdg.Attributes().fillColor(new pdg.Color('blue')).fillOpacity(0.5);
        port.drawCircle(new pdg.Point(center.x, center.y), 4, centerAttrs);
        
        // Draw blue rotation line
        const endX = center.x + Math.cos(this.rotation) * lineLength;
        const endY = center.y + Math.sin(this.rotation) * lineLength;
        const lineAttrs = new pdg.Attributes()
            .lineColor(new pdg.Color('blue'))
            .lineOpacity(0.5)
            .lineThickness(2);
        port.drawLine(new pdg.Point(center.x, center.y), new pdg.Point(endX, endY), lineAttrs);
    }

    addPoint(point) {
        // Override in subclasses where applicable
    }
}

// Line Shape
class Line extends Shape {
    constructor(x1, y1, x2, y2, strokeColor = 'black', strokeWidth = 1) {
        super(x1, y1, null, strokeColor, strokeWidth);
        this.x2 = x2;
        this.y2 = y2;
    }

    draw(port) {
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
        
        port.drawCircle(new pdg.Point(p1.x, p1.y), 4, 
            new pdg.Attributes().fillColor(new pdg.Color('red')));
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
        // Check if line intersects with rectangle
        // First check if any endpoint is inside the rectangle
        if ((this.x >= left && this.x <= right && this.y >= top && this.y <= bottom) ||
            (this.x2 >= left && this.x2 <= right && this.y2 >= top && this.y2 <= bottom)) {
            return true;
        }
        
        // Check if line intersects any edge of the rectangle
        return this.lineIntersectsRect(this.x, this.y, this.x2, this.y2, left, top, right, bottom);
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

    draw(port) {
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
        const fillAttrs = new pdg.Attributes().fillColor(new pdg.Color('red'));
        port.drawCircle(new pdg.Point(this.x, this.y - this.radius), 4, fillAttrs);
        port.drawCircle(new pdg.Point(this.x + this.radius, this.y), 4, fillAttrs);
        port.drawCircle(new pdg.Point(this.x, this.y + this.radius), 4, fillAttrs);
        port.drawCircle(new pdg.Point(this.x - this.radius, this.y), 4, fillAttrs);
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

    draw(port) {
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
        
        if (this.rotation !== 0) {
            const center = this.getCenterPoint();
            points.forEach(point => {
                const rotated = this.rotatePoint(point.x, point.y, center.x, center.y, this.rotation);
                port.drawCircle(new pdg.Point(rotated.x, rotated.y), 4, fillAttrs);
            });
        } else {
            points.forEach(point => {
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
        // Calculate this rectangle's bounds
        const thisLeft = Math.min(this.x, this.x + this.width);
        const thisRight = Math.max(this.x, this.x + this.width);
        const thisTop = Math.min(this.y, this.y + this.height);
        const thisBottom = Math.max(this.y, this.y + this.height);
        
        // Check if rectangles overlap
        return !(thisRight < left || thisLeft > right || thisBottom < top || thisTop > bottom);
    }
}

// Cardinal Spline Shape
class Spline extends Shape {
    constructor(points, fillColor = '#ffffff', strokeColor = '#000000', strokeWidth = 1) {
        super(points[0].x, points[0].y, fillColor, strokeColor, strokeWidth);
        this.points = points;
        this.underConstruction = false; // Track if shape is still being built
    }

    draw(port) {
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
        const center = this.getCenterPoint();
        
        // For Cardinal splines, only interior points are on the curve
        // First and last points are control points
        for (let i = 1; i < this.points.length - 1; i++) {
            let point = this.points[i];
            if (this.rotation !== 0) {
                point = this.rotatePoint(point.x, point.y, center.x, center.y, this.rotation);
            }
            port.drawCircle(new pdg.Point(point.x, point.y), 4, fillAttrs);
        }
    }

    drawControlPoints(port) {
        const fillAttrs = new pdg.Attributes().fillColor(new pdg.Color('green'));
        const center = this.getCenterPoint();
        
        // First and last points are the control points for Cardinal splines
        if (this.points.length > 0) {
            let point = this.points[0];
            if (this.rotation !== 0) {
                point = this.rotatePoint(point.x, point.y, center.x, center.y, this.rotation);
            }
            port.drawCircle(new pdg.Point(point.x, point.y), 3, fillAttrs);
        }
        if (this.points.length > 1) {
            const lastIdx = this.points.length - 1;
            let point = this.points[lastIdx];
            if (this.rotation !== 0) {
                point = this.rotatePoint(point.x, point.y, center.x, center.y, this.rotation);
            }
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
        // Check if any point is inside the rectangle
        for (let point of this.points) {
            if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) {
                return true;
            }
        }
        
        // Check if spline segments intersect with rectangle edges
        // Sample points along the spline
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
            
            if (p.x >= left && p.x <= right && p.y >= top && p.y <= bottom) {
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

    draw(port) {
        // Create a PDG Spline object
        const spline = new pdg.Spline(pdg.spline_CubicBezier);
        const center = this.getCenterPoint();
        
        // Add segments to the spline, applying rotation if set
        // Each segment uses 2 control points: controls[i*2] and controls[i*2+1]
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
        attrs.lineColor(new pdg.Color(this.strokeColor))
             .lineThickness(this.strokeWidth)
             .lineStyle(pdg.lineStyle_Solid);
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
        const center = this.getCenterPoint();
        
        this.points.forEach(point => {
            let p = point;
            if (this.rotation !== 0) {
                p = this.rotatePoint(p.x, p.y, center.x, center.y, this.rotation);
            }
            port.drawCircle(new pdg.Point(p.x, p.y), 4, fillAttrs);
        });
    }

    drawControlPoints(port) {
        const fillAttrs = new pdg.Attributes().fillColor(new pdg.Color('green'));
        const center = this.getCenterPoint();
        
        this.controlPoints.forEach(point => {
            let p = point;
            if (this.rotation !== 0) {
                p = this.rotatePoint(p.x, p.y, center.x, center.y, this.rotation);
            }
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
        // Check if any endpoint is inside the rectangle
        for (let point of this.points) {
            if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) {
                return true;
            }
        }
        
        // Check if bezier curve segments intersect with rectangle
        // Sample points along the spline
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
            
            if (p.x >= left && p.x <= right && p.y >= top && p.y <= bottom) {
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

    draw(port) {
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
        const fillAttrs = new pdg.Attributes().fillColor(new pdg.Color('red'));
        port.drawCircle(new pdg.Point(this.x, this.y - this.radiusY), 4, fillAttrs);
        port.drawCircle(new pdg.Point(this.x + this.radiusX, this.y), 4, fillAttrs);
        port.drawCircle(new pdg.Point(this.x, this.y + this.radiusY), 4, fillAttrs);
        port.drawCircle(new pdg.Point(this.x - this.radiusX, this.y), 4, fillAttrs);
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
        // Find the closest point on the rectangle to the ellipse center
        const closestX = Math.max(left, Math.min(this.x, right));
        const closestY = Math.max(top, Math.min(this.y, bottom));
        
        // Calculate normalized distance from ellipse center to this closest point
        const dx = (closestX - this.x) / this.radiusX;
        const dy = (closestY - this.y) / this.radiusY;
        const distanceSquared = dx * dx + dy * dy;
        
        // Check if within ellipse
        if (distanceSquared <= 1) return true;
        
        // Also check if any corner of the rectangle is inside the ellipse
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

// Polygon Shape
class Polygon extends Shape {
    constructor(points, fillColor = '#ffffff', strokeColor = '#000000', strokeWidth = 1) {
        super(points[0].x, points[0].y, fillColor, strokeColor, strokeWidth);
        this.points = points;
        this.underConstruction = false; // Track if shape is still being built
    }

    draw(port) {
        // Create a PDG Polygon object
        const polygon = new pdg.Polygon();
        const center = this.getCenterPoint();
        
        // Add all points to the polygon, applying rotation if set
        this.points.forEach(point => {
            let p = point;
            if (this.rotation !== 0) {
                p = this.rotatePoint(p.x, p.y, center.x, center.y, this.rotation);
            }
            polygon.addPoint(new pdg.Point(p.x, p.y));
        });
        
        // Draw the polygon
        const attrs = new pdg.Attributes();
        attrs.lineColor(new pdg.Color(this.strokeColor))
             .lineThickness(this.strokeWidth)
             .lineStyle(pdg.lineStyle_Solid);
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
        const center = this.getCenterPoint();
        
        this.points.forEach(point => {
            let p = point;
            if (this.rotation !== 0) {
                p = this.rotatePoint(p.x, p.y, center.x, center.y, this.rotation);
            }
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
        // Check if any vertex is inside the rectangle
        for (let point of this.points) {
            if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) {
                return true;
            }
        }
        
        // Check if any edge of the polygon intersects with the rectangle
        for (let i = 0; i < this.points.length; i++) {
            const p1 = this.points[i];
            const p2 = this.points[(i + 1) % this.points.length];
            
            if (this.lineIntersectsRect(p1.x, p1.y, p2.x, p2.y, left, top, right, bottom)) {
                return true;
            }
        }
        
        // Check if rectangle is completely inside polygon
        // (test if center of rectangle is inside)
        const centerX = (left + right) / 2;
        const centerY = (top + bottom) / 2;
        if (this.pointInPolygon(centerX, centerY)) {
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

module.exports = {
    Shape,
    Line,
    Circle,
    Rectangle,
    Spline,
    BezierSpline,
    Oval,
    Polygon
};
