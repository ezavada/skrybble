const point=p=>({x:p.x,y:p.y});
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const unit=p=>{const length=Math.hypot(p.x,p.y);return length?{x:p.x/length,y:p.y/length}:{x:1,y:0};};
const along=(p,v,length)=>({x:p.x+v.x*length,y:p.y+v.y*length});
function evaluate(s,t) {
    const u=1-t;
    return {x:u*u*u*s.p0.x+3*u*u*t*s.p1.x+3*u*t*t*s.p2.x+t*t*t*s.p3.x,
        y:u*u*u*s.p0.y+3*u*u*t*s.p1.y+3*u*t*t*s.p2.y+t*t*t*s.p3.y};
}

// Least-squares cubic fitting with chord-length parameters. Subdivide at the
// worst sample until the fit meets the document-pixel tolerance. Shared tangent
// directions keep neighboring fitted segments smooth without moving endpoints.
module.exports=function fitCurve(input,tolerance) {
    const points=input.filter((p,i)=>!i || p.x!==input[i-1].x || p.y!==input[i-1].y).map(point);
    if(points.length<2)return [];
    const result=[];
    function fit(first,last,left,right,depth=0) {
        const start=points[first],end=points[last],count=last-first;
        const lengths=[0];
        for(let i=first+1;i<=last;i++)lengths.push(lengths.at(-1)+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
        const parameters=lengths.map(length=>length/lengths.at(-1));
        let aa=0,ab=0,bb=0,ax=0,bx=0;
        for(let i=0;i<=count;i++) {
            const t=parameters[i],u=1-t,b0=u*u*u,b1=3*u*u*t,b2=3*u*t*t,b3=t*t*t;
            const a={x:left.x*b1,y:left.y*b1},b={x:right.x*b2,y:right.y*b2};
            const residual={x:points[first+i].x-start.x*(b0+b1)-end.x*(b2+b3),
                y:points[first+i].y-start.y*(b0+b1)-end.y*(b2+b3)};
            aa+=dot(a,a);ab+=dot(a,b);bb+=dot(b,b);ax+=dot(a,residual);bx+=dot(b,residual);
        }
        const determinant=aa*bb-ab*ab,distance=Math.hypot(end.x-start.x,end.y-start.y);
        let alpha=determinant>1e-12?(ax*bb-bx*ab)/determinant:0;
        let beta=determinant>1e-12?(bx*aa-ax*ab)/determinant:0;
        if(alpha<distance*1e-6 || beta<distance*1e-6 || !Number.isFinite(alpha+beta))alpha=beta=distance/3;
        const segment={p0:point(start),p1:along(start,left,alpha),p2:along(end,right,beta),p3:point(end)};
        let error=0,split=first+Math.floor(count/2);
        for(let i=1;i<count;i++) {
            const delta=sub(evaluate(segment,parameters[i]),points[first+i]),squared=dot(delta,delta);
            if(squared>error){error=squared;split=first+i;}
        }
        if(count===1 || error<=tolerance*tolerance){result.push(segment);return;}
        // Bound stack depth even for adversarial, highly uneven point spacing.
        if(depth>=32)split=first+Math.floor(count/2);
        const tangent=unit(sub(points[split-1],points[split+1]));
        fit(first,split,left,tangent,depth+1);
        fit(split,last,{x:-tangent.x,y:-tangent.y},right,depth+1);
    }
    fit(0,points.length-1,unit(sub(points[1],points[0])),unit(sub(points.at(-2),points.at(-1))));
    return result;
};
