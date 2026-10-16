// Retained artwork adapters. Editor geometry remains in document coordinates.
function drawingPort(drawing, elements = null, strokeScale = 1) {
    let index = 0;
    const refs = [];
    const add = (method, args, attrs) => {
        // PDG drawDrawing keeps strokes in Port pixels; artwork uses document units.
        // Restore reusable attributes so later segments do not multiply twice.
        const thickness=attrs.getLineThickness();
        try {
            attrs.lineThickness(thickness * strokeScale);
            const element = elements ? elements[index++] : drawing[method](...args, attrs);
            if (elements) element.resetAttributes(attrs);
            refs.push(element);
            return element;
        } finally {attrs.lineThickness(thickness);}
    };
    return {
        refs,
        drawLine: (a,b,s) => add('addLine',[a,b],s),
        drawRect: (r,s) => add('addRect',[r],s),
        drawRoundedRect: (r,n,s) => add('addRect',[r],s.roundedCorners(n)),
        drawCircle: (p,n,s) => add('addEllipse',[p,n,n],s),
        drawEllipse: (p,x,y,s) => add('addEllipse',[p,x,y],s),
        drawPolygon: (p,s) => add('addPolygon',[p],s),
        drawSpline: (p,s) => add('addSpline',[p],s),
        drawQuad: (p,s) => add('addQuad',[p],s),
        drawArc: (p,x,y,a,b,s) => add('addArc',[p,x,y,a,b],s),
        drawImage: (image,r,s) => add('addImage',[r,image],s),
        drawText: (text,r,s) => add('addText',[text,r],s)
    };
}

function cameraPort(port, camera) {
    const origin = camera.worldToView(new pdg.Point(0,0));
    const zoom = camera.getZoom();
    const matrix = [zoom,0,0, 0,zoom,0, origin.x,origin.y,1];
    // Editor overlays project their positions, but keep radii and strokes in pixels.
    const point = p => camera.worldToView(new pdg.Point(p));
    const target = {
        strokeScale: zoom,
        controls: {
            drawCircle: (p,r,attrs) => port.drawCircle(point(p),r,attrs),
            drawLine: (a,b,attrs) => port.drawLine(point(a),point(b),attrs),
            drawRect: (rect,attrs) => {
                const a=point(rect.leftTop()),b=point(rect.rightBottom());
                return port.drawRect(new pdg.Rect(a.x,a.y,b.x,b.y),attrs);
            }
        }
    };
    for (const method of ['drawLine','drawRect','drawRoundedRect','drawCircle',
        'drawEllipse','drawPolygon','drawSpline','drawQuad','drawArc','drawImage','drawText']) {
        target[method] = (...args) => {
            const attrs = args.pop();
            const original = attrs.getTransform();
            // Shapes reuse attributes for multiple handles and line segments.
            // Apply the camera only for this call, so subsequent draws start
            // with the original document transform rather than accumulating it.
            try {
                attrs.setTransform(matrix).transform(original);
                return port[method](...args, attrs);
            } finally { attrs.setTransform(original); }
        };
    }
    target.drawRetained = drawing => port.drawDrawing(drawing,new pdg.Point(0,0),new pdg.Attributes().setTransform(matrix));
    return target;
}
module.exports = { drawingPort, cameraPort };
