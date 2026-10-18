'use strict';
const {toColor}=require('./colors');
function bounds(points) {
    const b={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};
    for(const p of points){b.left=Math.min(b.left,p.x);b.top=Math.min(b.top,p.y);b.right=Math.max(b.right,p.x);b.bottom=Math.max(b.bottom,p.y);}
    b.width=Math.max(1e-9,b.right-b.left);b.height=Math.max(1e-9,b.bottom-b.top);return b;
}
function shapeBounds(shape) {
    if(shape.constructor.name==='Text'){const r=shape.textRect();return {left:r.left,top:r.top,width:r.width(),height:r.height()};}
    return bounds([...(shape.points||shape.getEndpoints()),...(shape.controlPoints||[])]);
}
function pathBounds(segments) {
    const points=[];
    for(const s of segments) {
        points.push(s.p0,s.p3);
        for(const axis of ['x','y']) {
            const a=-s.p0[axis]+3*s.p1[axis]-3*s.p2[axis]+s.p3[axis],b=2*(s.p0[axis]-2*s.p1[axis]+s.p2[axis]),c=s.p1[axis]-s.p0[axis];
            const roots=Math.abs(a)<1e-12?(Math.abs(b)<1e-12?[]:[-c/b]):b*b-4*a*c<0?[]:[(-b+Math.sqrt(b*b-4*a*c))/(2*a),(-b-Math.sqrt(b*b-4*a*c))/(2*a)];
            for(const t of roots)if(t>0&&t<1){const u=1-t;points.push({x:u*u*u*s.p0.x+3*u*u*t*s.p1.x+3*u*t*t*s.p2.x+t*t*t*s.p3.x,y:u*u*u*s.p0.y+3*u*u*t*s.p1.y+3*u*t*t*s.p2.y+t*t*t*s.p3.y});}
        }
    }
    return bounds(points);
}
function apply(attrs,shape) {
    if(shape.blendMode)attrs.blendMode(pdg['blendMode_'+shape.blendMode]);
    const g=shape.fillGradient;
    if(!g||!shape.fillColor||shape.fillColor!==g.baseColor)return attrs;
    const b=shapeBounds(shape),p=v=>new pdg.Point(b.left+v.x*b.width,b.top+v.y*b.height);
    if(g.type==='linear')attrs.fillGradient(p(g.start),toColor(g.startColor),p(g.end),toColor(g.endColor));
    else attrs.fillRadialGradient(p(g.center),toColor(g.startColor),g.radius*Math.max(b.width,b.height),toColor(g.endColor));
    return attrs;
}
function copy(source,target) {
    if(source.blendMode)target.blendMode=source.blendMode;
    if(!source.fillGradient)return target;
    const a=shapeBounds(source),b=shapeBounds(target),g=JSON.parse(JSON.stringify(source.fillGradient));
    const center=source.getCenterPoint(),angle=source.rotation||0,c=Math.cos(angle),s=Math.sin(angle);
    for(const key of ['start','end','center'])if(g[key]) {
        const x=a.left+g[key].x*a.width-center.x,y=a.top+g[key].y*a.height-center.y;
        g[key]={x:(center.x+c*x-s*y-b.left)/b.width,y:(center.y+s*x+c*y-b.top)/b.height};
    }
    if(g.radius!==undefined)g.radius*=Math.max(a.width,a.height)/Math.max(b.width,b.height);
    target.fillGradient=g;return target;
}
module.exports={bounds,pathBounds,apply,copy};
