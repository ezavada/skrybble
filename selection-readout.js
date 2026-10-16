const {getShapeBounds}=require('./shapes');
const number=value=>String(Number(Math.abs(value).toFixed(1)));
const dimensions=bounds=>`W ${number(bounds.right-bounds.left)} × H ${number(bounds.bottom-bounds.top)} px`;

// Measurements stay in document pixels, independently of camera zoom and pan.
module.exports=function selectionReadout(shapes) {
    if(!shapes.length)return '';
    if(shapes.length>1) {
        const bounds=shapes.map(getShapeBounds);
        return `${shapes.length} entities · ${dimensions({
            left:Math.min(...bounds.map(b=>b.left)),top:Math.min(...bounds.map(b=>b.top)),
            right:Math.max(...bounds.map(b=>b.right)),bottom:Math.max(...bounds.map(b=>b.bottom))})}`;
    }
    const shape=shapes[0],type=shape.constructor.name;
    if(type==='Line')return `Line · length ${number(Math.hypot(shape.x2-shape.x,shape.y2-shape.y))} px`;
    if(type==='Circle')return `Circle · radius ${number(shape.radius)} px`;
    // Borrow geometry without changing the live shape or its retained artwork.
    const unrotated=Object.create(shape);
    unrotated.rotation=0;
    const label=shape.isQuad?'Quadrilateral':({BezierSpline:'Bezier spline',NativeDrawing:'Drawing'}[type] || type);
    return `${label} · ${dimensions(getShapeBounds(unrotated))}`;
};
