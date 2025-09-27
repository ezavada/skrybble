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
}

// Line Shape
class Line extends Shape {
    constructor(x1, y1, x2, y2, strokeColor = 'black', strokeWidth = 1) {
        super(x1, y1, null, strokeColor, strokeWidth);
        this.x2 = x2;
        this.y2 = y2;
    }

    draw(port) {
        port.drawLine(new pdg.Point(this.x, this.y), new pdg.Point(this.x2, this.y2), this.strokeColor);

        if (this.selected) {
            this.drawEndpoints(port);
        }
    }

    drawEndpoints(port) {
        port.fillCircle(new pdg.Point(this.x, this.y), 4, 'red');
        port.fillCircle(new pdg.Point(this.x2, this.y2), 4, 'red');
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
}

// Circle Shape
class Circle extends Shape {
    constructor(x, y, radius, fillColor = 'white', strokeColor = 'black', strokeWidth = 1) {
        super(x, y, fillColor, strokeColor, strokeWidth);
        this.radius = radius;
    }

    draw(port) {
        if (this.fillColor) {
            port.fillCircle(new pdg.Point(this.x, this.y), this.radius, this.fillColor);
        }
        port.frameCircle(new pdg.Point(this.x, this.y), this.radius, this.strokeColor);

        if (this.selected) {
            this.drawEndpoints(port);
        }
    }

    drawEndpoints(port) {
        port.fillCircle(new pdg.Point(this.x, this.y - this.radius), 4, 'red');
        port.fillCircle(new pdg.Point(this.x + this.radius, this.y), 4, 'red');
        port.fillCircle(new pdg.Point(this.x, this.y + this.radius), 4, 'red');
        port.fillCircle(new pdg.Point(this.x - this.radius, this.y), 4, 'red');
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
}

// Rectangle Shape
class Rectangle extends Shape {
    constructor(x, y, width, height, fillColor = 'white', strokeColor = 'black', strokeWidth = 1) {
        super(x, y, fillColor, strokeColor, strokeWidth);
        this.width = width;
        this.height = height;
    }

    draw(port) {
        const rect = new pdg.Rect(this.x, this.y, this.width, this.height);
        
        if (this.fillColor) {
            port.fillRect(rect, this.fillColor);
        }
        port.frameRect(rect, this.strokeColor);

        if (this.selected) {
            this.drawEndpoints(port);
        }
    }

    drawEndpoints(port) {
        const points = this.getEndpoints();
        points.forEach(point => {
            port.fillCircle(new pdg.Point(point.x, point.y), 4, 'red');
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
}

// Spline Shape
class Spline extends Shape {
    constructor(points, fillColor = '#ffffff', strokeColor = '#000000', strokeWidth = 1) {
        super(points[0].x, points[0].y, fillColor, strokeColor, strokeWidth);
        this.points = points;
        this.controlPoints = this.generateControlPoints();
    }

    generateControlPoints() {
        const controls = [];
        for (let i = 0; i < this.points.length - 1; i++) {
            const current = this.points[i];
            const next = this.points[i + 1];
            controls.push({
                x: (current.x + next.x) / 2,
                y: (current.y + next.y) / 2
            });
        }
        return controls;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        
        for (let i = 0; i < this.points.length - 1; i++) {
            const cp1 = this.controlPoints[i] || this.points[i];
            const cp2 = this.controlPoints[i] || this.points[i + 1];
            ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, this.points[i + 1].x, this.points[i + 1].y);
        }
        
        if (this.fillColor) {
            ctx.fillStyle = this.fillColor;
            ctx.fill();
        }
        
        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;
        ctx.stroke();

        if (this.selected) {
            this.drawEndpoints(ctx);
            this.drawControlPoints(ctx);
        }
    }

    drawEndpoints(ctx) {
        ctx.fillStyle = '#ff0000';
        this.points.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    drawControlPoints(ctx) {
        ctx.fillStyle = '#00ff00';
        this.controlPoints.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    getEndpoints() {
        return [...this.points];
    }

    getControlPoints() {
        return [...this.controlPoints];
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
        if (this.fillColor) {
            port.fillOval(new pdg.Point(this.x, this.y), this.radiusX, this.radiusY, this.fillColor);
        }
        port.frameOval(new pdg.Point(this.x, this.y), this.radiusX, this.radiusY, this.strokeColor);

        if (this.selected) {
            this.drawEndpoints(port);
        }
    }

    drawEndpoints(port) {
        port.fillCircle(new pdg.Point(this.x, this.y - this.radiusY), 4, 'red');
        port.fillCircle(new pdg.Point(this.x + this.radiusX, this.y), 4, 'red');
        port.fillCircle(new pdg.Point(this.x, this.y + this.radiusY), 4, 'red');
        port.fillCircle(new pdg.Point(this.x - this.radiusX, this.y), 4, 'red');
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
}

// Polygon Shape
class Polygon extends Shape {
    constructor(points, fillColor = '#ffffff', strokeColor = '#000000', strokeWidth = 1) {
        super(points[0].x, points[0].y, fillColor, strokeColor, strokeWidth);
        this.points = points;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.closePath();
        
        if (this.fillColor) {
            ctx.fillStyle = this.fillColor;
            ctx.fill();
        }
        
        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;
        ctx.stroke();

        if (this.selected) {
            this.drawEndpoints(ctx);
        }
    }

    drawEndpoints(ctx) {
        ctx.fillStyle = '#ff0000';
        this.points.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    contains(x, y) {
        // Ray casting algorithm for point-in-polygon
        let inside = false;
        for (let i = 0, j = this.points.length - 1; i < this.points.length; j = i++) {
            if (((this.points[i].y > y) !== (this.points[j].y > y)) &&
                (x < (this.points[j].x - this.points[i].x) * (y - this.points[i].y) / (this.points[j].y - this.points[i].y) + this.points[i].x)) {
                inside = !inside;
            }
        }
        return inside;
    }

    getEndpoints() {
        return [...this.points];
    }
}

module.exports = {
    Shape,
    Line,
    Circle,
    Rectangle,
    Spline,
    Oval,
    Polygon
};
