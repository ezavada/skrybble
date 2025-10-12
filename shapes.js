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
        port.drawLine(new pdg.Point(this.x, this.y), new pdg.Point(this.x2, this.y2), 
            new pdg.Attributes().lineColor(new pdg.Color(this.strokeColor)).lineThickness(this.strokeWidth));

        if (this.selected) {
            this.drawEndpoints(port);
        }
    }

    drawEndpoints(port) {
        port.drawCircle(new pdg.Point(this.x, this.y), 4, 
            new pdg.Attributes().fillColor(new pdg.Color('red')));
        port.drawCircle(new pdg.Point(this.x2, this.y2), 4, 
            new pdg.Attributes().fillColor(new pdg.Color('red')));
    }

    contains(x, y) {
        const dist = this.pointToLineDistance(x, y, this.x, this.y, this.x2, this.y2);
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
        const rect = new pdg.Rect(this.x, this.y, this.x + this.width, this.y + this.height);
        const attrs = new pdg.Attributes();
        
        attrs.lineColor(new pdg.Color(this.strokeColor))
             .lineThickness(this.strokeWidth)
             .lineStyle(pdg.lineStyle_Solid);
        if (this.fillColor) {
            attrs.fillColor(new pdg.Color(this.fillColor));
        }
        port.drawRect(rect, attrs);

        if (this.selected) {
            this.drawEndpoints(port);
        }
    }

    drawEndpoints(port) {
        const points = this.getEndpoints();
        const fillAttrs = new pdg.Attributes().fillColor(new pdg.Color('red'));
        points.forEach(point => {
            port.drawCircle(new pdg.Point(point.x, point.y), 4, fillAttrs);
        });
    }

    contains(x, y) {
        return x >= this.x && x <= this.x + this.width && 
               y >= this.y && y <= this.y + this.height;
    }

    getEndpoints() {
        return [
            { x: this.x, y: this.y },
            { x: this.x + this.width, y: this.y },
            { x: this.x + this.width, y: this.y + this.height },
            { x: this.x, y: this.y + this.height }
        ];
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
        
        // Add ALL points to the spline (including last one)
        for (let i = 0; i < this.points.length; i++) {
            spline.addPoint(new pdg.Point(this.points[i].x, this.points[i].y));
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
    }

    drawEndpoints(port) {
        const fillAttrs = new pdg.Attributes().fillColor(new pdg.Color('red'));
        // For Cardinal splines, only interior points are on the curve
        // First and last points are control points
        for (let i = 1; i < this.points.length - 1; i++) {
            const point = this.points[i];
            port.drawCircle(new pdg.Point(point.x, point.y), 4, fillAttrs);
        }
    }

    drawControlPoints(port) {
        const fillAttrs = new pdg.Attributes().fillColor(new pdg.Color('green'));
        // First and last points are the control points for Cardinal splines
        if (this.points.length > 0) {
            port.drawCircle(new pdg.Point(this.points[0].x, this.points[0].y), 3, fillAttrs);
        }
        if (this.points.length > 1) {
            const lastIdx = this.points.length - 1;
            port.drawCircle(new pdg.Point(this.points[lastIdx].x, this.points[lastIdx].y), 3, fillAttrs);
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

    contains(x, y) {
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
            const dist = this.pointToLineSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y);
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
        
        // Add segments to the spline
        // Each segment uses 2 control points: controls[i*2] and controls[i*2+1]
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
    }

    drawEndpoints(port) {
        const fillAttrs = new pdg.Attributes().fillColor(new pdg.Color('red'));
        this.points.forEach(point => {
            port.drawCircle(new pdg.Point(point.x, point.y), 4, fillAttrs);
        });
    }

    drawControlPoints(port) {
        const fillAttrs = new pdg.Attributes().fillColor(new pdg.Color('green'));
        this.controlPoints.forEach(point => {
            port.drawCircle(new pdg.Point(point.x, point.y), 3, fillAttrs);
        });
    }

    getEndpoints() {
        return [...this.points];
    }

    getControlPoints() {
        return [...this.controlPoints];
    }

    contains(x, y) {
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
            
            const dist = this.pointToLineSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y);
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
        const dx = (x - this.x) / this.radiusX;
        const dy = (y - this.y) / this.radiusY;
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
        
        // Add all points to the polygon
        this.points.forEach(point => {
            polygon.addPoint(new pdg.Point(point.x, point.y));
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
    }

    drawEndpoints(port) {
        const fillAttrs = new pdg.Attributes().fillColor(new pdg.Color('red'));
        this.points.forEach(point => {
            port.drawCircle(new pdg.Point(point.x, point.y), 4, fillAttrs);
        });
    }

    contains(x, y) {
        // First check if near any edge
        const threshold = 5;
        for (let i = 0; i < this.points.length; i++) {
            const p1 = this.points[i];
            const p2 = this.points[(i + 1) % this.points.length]; // Wrap around to first point
            const dist = this.pointToLineSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y);
            if (dist < threshold) {
                return true;
            }
        }
        
        // Then check if inside using ray casting algorithm for point-in-polygon
        let inside = false;
        for (let i = 0, j = this.points.length - 1; i < this.points.length; j = i++) {
            if (((this.points[i].y > y) !== (this.points[j].y > y)) &&
                (x < (this.points[j].x - this.points[i].x) * (y - this.points[i].y) / (this.points[j].y - this.points[i].y) + this.points[i].x)) {
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
