const Shapes=require('./shapes');
const copy=p=>({x:p.x,y:p.y});
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const supported=shape=>['Polygon','Spline','BezierSpline'].includes(shape.constructor.name);

// All geometry is in document coordinates. Cubics preserve existing Cardinal
// and Bezier curves exactly; flattening is used only for scissors hit testing.
function pathGeometry(shape) {
    if(!supported(shape))return null;
    const center=shape.getCenterPoint(),rotation=shape.rotation || 0;
    const world=p=>rotation?shape.rotatePoint(p.x,p.y,center.x,center.y,rotation):copy(p);
    const type=shape.constructor.name,closed=type==='Polygon';
    const source=shape.points.map(world),anchors=type==='Spline'?source.slice(1,-1):source;
    const segments=[];
    for(let i=0;i<anchors.length-(closed?0:1);i++) {
        const next=(i+1)%anchors.length,p0=anchors[i],p3=anchors[next];
        let p1=mix(p0,p3,1/3),p2=mix(p0,p3,2/3);
        if(type==='BezierSpline') {
            p1=world(shape.controlPoints[2*i] || shape.points[i]);
            p2=world(shape.controlPoints[2*i+1] || shape.points[next]);
        } else if(type==='Spline') {
            const before=source[i],after=source[i+3];
            if(!after)continue;
            p1={x:p0.x+(p3.x-before.x)/6,y:p0.y+(p3.y-before.y)/6};
            p2={x:p3.x-(after.x-p0.x)/6,y:p3.y-(after.y-p0.y)/6};
        }
        segments.push({index:i,start:i,end:next,p0,p1,p2,p3});
    }
    const controls=type==='Spline'?[source[0],source.at(-1)]:type==='BezierSpline'?shape.controlPoints.map(world):[];
    return {shape,type,closed,anchors,controls,segments};
}
function segmentRuns(path,indices) {
    if(!indices.size)return [];
    const count=path.segments.length,runs=[];
    let start=0;
    if(path.closed && indices.size<count) {
        while(start<count && !(indices.has(start) && !indices.has((start+count-1)%count)))start++;
    }
    let run=[];
    for(let step=0;step<count;step++) {
        const i=(start+step)%count;
        if(indices.has(i))run.push(path.segments[i]);
        else if(run.length){runs.push(run);run=[];}
    }
    if(run.length)runs.push(run);
    return runs;
}
function curveFragment(shape,segments) {
    const points=[copy(segments[0].p0),...segments.map(s=>copy(s.p3))];
    const result=new Shapes.BezierSpline(points,null,shape.strokeColor,shape.strokeWidth);
    result.controlPoints=segments.flatMap(s=>[copy(s.p1),copy(s.p2)]);
    result.manuallyEditedControls=new Set(result.controlPoints.map((_,i)=>i));
    return result;
}
function copiedFragments(path,selected,closePolygon=false) {
    const anchors=new Set([...selected].filter(key=>key.startsWith('a:')).map(key=>Number(key.slice(2))));
    const included=new Set(path.segments.filter(s=>anchors.has(s.start)&&anchors.has(s.end)).map(s=>s.index));
    const removed=new Set(),fragments=[];
    for(const run of segmentRuns(path,included)) {
        const ids=[run[0].start,...run.map(s=>s.end)];
        const unique=[...new Set(ids)];
        const closed=path.closed && (closePolygon || unique.length===path.anchors.length);
        if(closed && unique.length<3)continue;
        const fragment=closed?new Shapes.Polygon(unique.map(i=>copy(path.anchors[i])),path.shape.fillColor,path.shape.strokeColor,path.shape.strokeWidth)
            :curveFragment(path.shape,run);
        unique.forEach(i=>removed.add(i));fragments.push(fragment);
    }
    return {fragments,removed};
}
function reconnect(path,removed) {
    const ids=path.anchors.map((_,i)=>i).filter(i=>!removed.has(i));
    if(ids.length<(path.closed?3:2))return [];
    if(path.closed)return [new Shapes.Polygon(ids.map(i=>copy(path.anchors[i])),path.shape.fillColor,path.shape.strokeColor,path.shape.strokeWidth)];
    const result=new Shapes.BezierSpline(ids.map(i=>copy(path.anchors[i])),null,path.shape.strokeColor,path.shape.strokeWidth);
    // Keep exact controls on untouched segments; new connections use generated handles.
    ids.slice(0,-1).forEach((id,i)=>{
        const old=path.segments.find(s=>s.start===id && s.end===ids[i+1]);
        if(old){result.controlPoints[2*i]=copy(old.p1);result.controlPoints[2*i+1]=copy(old.p2);}
    });
    result.manuallyEditedControls=new Set(result.controlPoints.map((_,i)=>i));
    return [result];
}
function fitSelected(path,selected,tolerance) {
    const included=new Set(path.segments.filter(s=>selected.has('a:'+s.start)&&selected.has('a:'+s.end)).map(s=>s.index));
    const runs=segmentRuns(path,included),replacements=new Map();
    for(const run of runs) {
        const fitted=require('./curve-fit')([run[0].p0,...run.map(s=>s.p3)],tolerance);
        if(fitted.length)replacements.set(run[0].index,fitted);
    }
    if(!replacements.size)return null;
    // A selected run can cross a polygon's closing edge. Begin at that run so
    // its replacement remains contiguous, without fitting across unselected gaps.
    const wrap=runs.find(run=>run.some((s,i)=>i && s.index<run[i-1].index));
    const start=wrap?wrap[0].index:0,segments=[],keys=new Set();
    for(let i=0;i<path.segments.length;i++) {
        const index=(start+i)%path.segments.length,fitted=replacements.get(index);
        if(fitted) {
            keys.add('a:'+segments.length);
            for(const segment of fitted){segments.push(segment);keys.add('a:'+segments.length);}
        } else if(!included.has(index))segments.push(path.segments[index]);
    }
    const shape=curveFragment(path.shape,segments);
    shape.fillColor=path.shape.fillColor;
    return {shape,keys};
}
function distance(p,a,b) {
    const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
    const t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len)):0;
    return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
function flatten(s,tolerance,depth=0) {
    if(depth>=14 || Math.max(distance(s.p1,s.p0,s.p3),distance(s.p2,s.p0,s.p3))<=tolerance)return [s.p0,s.p3];
    const a=mix(s.p0,s.p1,.5),b=mix(s.p1,s.p2,.5),c=mix(s.p2,s.p3,.5),d=mix(a,b,.5),e=mix(b,c,.5),m=mix(d,e,.5);
    return [...flatten({p0:s.p0,p1:a,p2:d,p3:m},tolerance,depth+1).slice(0,-1),
        ...flatten({p0:m,p1:e,p2:c,p3:s.p3},tolerance,depth+1)];
}
function crosses(a,b,c,d) {
    const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
    const p=cross(a,b,c),q=cross(a,b,d),r=cross(c,d,a),s=cross(c,d,b),epsilon=1e-8;
    if(Math.abs(p)<epsilon && distance(c,a,b)<epsilon || Math.abs(q)<epsilon && distance(d,a,b)<epsilon ||
        Math.abs(r)<epsilon && distance(a,c,d)<epsilon || Math.abs(s)<epsilon && distance(b,c,d)<epsilon)return true;
    return (p>0)!==(q>0) && (r>0)!==(s>0);
}
module.exports={supported,pathGeometry,segmentRuns,curveFragment,copiedFragments,reconnect,fitSelected,distance,flatten,crosses};
