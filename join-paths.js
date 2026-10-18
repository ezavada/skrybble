'use strict';
const Shapes=require('./shapes'),Geometry=require('./path-editing');
const copy=p=>({x:p.x,y:p.y}),add=(p,v)=>({x:p.x+v.x,y:p.y+v.y}),sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const reverse=segments=>segments.slice().reverse().map(s=>({p0:s.p3,p1:s.p2,p2:s.p1,p3:s.p0}));
function segments(shape) {
    if(shape.constructor.name==='Line') {
        const c=shape.getCenterPoint(),world=p=>shape.rotation?shape.rotatePoint(p.x,p.y,c.x,c.y,shape.rotation):p;
        const a=world({x:shape.x,y:shape.y}),b=world({x:shape.x2,y:shape.y2});
        return [{p0:a,p1:a,p2:b,p3:b}];
    }
    return Geometry.pathGeometry(shape).segments.map(s=>Object.fromEntries(['p0','p1','p2','p3'].map(k=>[k,copy(s[k])])));
}
function join(shapes) {
    if(shapes.length<2)throw Error('Select at least two matching open lines or splines to join');
    const family=s=>['Line','Polyline'].includes(s.constructor.name)?'Line':s.constructor.name;
    const type=family(shapes[0]);
    if(!['Line','Spline','BezierSpline'].includes(type)||shapes.some(s=>family(s)!==type))throw Error('Join requires matching open path types; lines and polylines can join each other');
    const chains=shapes.map(segments);
    if(chains.some(s=>!s.length||distance(s[0].p0,s.at(-1).p3)<1e-9))throw Error('Join requires open paths; closed paths and polygons cannot be joined');
    // Merge globally closest free endpoints; ties use drawing order.
    while(chains.length>1) {
        let best=null;
        for(let i=0;i<chains.length;i++)for(let j=i+1;j<chains.length;j++)for(let a=0;a<2;a++)for(let b=0;b<2;b++) {
            const p=a?chains[i].at(-1).p3:chains[i][0].p0,q=b?chains[j].at(-1).p3:chains[j][0].p0,d=distance(p,q);
            if(!best||d<best.d)best={i,j,a,b,d};
        }
        const left=best.a?chains[best.i]:reverse(chains[best.i]),right=best.b?reverse(chains[best.j]):chains[best.j];
        const end=left.at(-1),start=right[0];
        if(best.d<=.25) {
            const midpoint={x:(end.p3.x+start.p0.x)/2,y:(end.p3.y+start.p0.y)/2},a=sub(midpoint,end.p3),b=sub(midpoint,start.p0);
            end.p3=midpoint;end.p2=add(end.p2,a);start.p0=midpoint;start.p1=add(start.p1,b);
        } else {
            const p0=end.p3,p3=start.p0,length=distance(p0,p3)/3;
            const tangent=(v,fallback)=>{const n=Math.hypot(v.x,v.y);return n>1e-9?{x:v.x/n*length,y:v.y/n*length}:fallback;};
            const straight={x:(p3.x-p0.x)/3,y:(p3.y-p0.y)/3};
            const a=type==='Line'?straight:tangent(sub(p0,end.p2),straight),b=type==='Line'?straight:tangent(sub(start.p1,p3),straight);
            left.push({p0,p1:add(p0,a),p2:sub(p3,b),p3});
        }
        chains[best.i]=left.concat(right);chains.splice(best.j,1);
    }
    const joined=chains[0],anchors=[joined[0].p0,...joined.map(s=>s.p3)],source=shapes[0];let result;
    if(type==='Line')result=new Shapes.Polyline(anchors.map(copy),source.strokeColor,source.strokeWidth);
    else if(type==='BezierSpline') {
        result=new Shapes.BezierSpline(anchors.map(copy),null,source.strokeColor,source.strokeWidth);
        result.controlPoints=joined.flatMap(s=>[copy(s.p1),copy(s.p2)]);result.manuallyEditedControls=new Set(result.controlPoints.map((_,i)=>i));
    } else {
        const first=joined[0],last=joined.at(-1),before={x:first.p3.x-6*(first.p1.x-first.p0.x),y:first.p3.y-6*(first.p1.y-first.p0.y)},after={x:last.p0.x+6*(last.p3.x-last.p2.x),y:last.p0.y+6*(last.p3.y-last.p2.y)};
        result=new Shapes.Spline([before,...anchors.map(copy),after],null,source.strokeColor,source.strokeWidth);
        const natural=Geometry.pathGeometry(result).segments;
        // Chord-relative tangent corrections preserve the source curves while
        // retaining Cardinal editing and following movement and rotation.
        result.joinCorrections=joined.map((s,i)=>{
            const dx=s.p3.x-s.p0.x,dy=s.p3.y-s.p0.y,n=dx*dx+dy*dy;
            return ['p1','p2'].map(k=>{const v=sub(s[k],natural[i][k]);return n>1e-18?{x:(v.x*dx+v.y*dy)/n,y:(v.y*dx-v.x*dy)/n}:{...v,absolute:true};});
        });
    }
    if(source.rigBone)result.rigBone=source.rigBone;if(source.blendMode)result.blendMode=source.blendMode;
    return result;
}
module.exports=join;
