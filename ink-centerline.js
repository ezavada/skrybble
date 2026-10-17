// Recover stroke centerlines from even-odd filled polygon ribbons. This module
// uses document coordinates only; neither viewport zoom nor PDG affects tracing.
const median=values=>{const sorted=values.slice().sort((a,b)=>a-b);return sorted.length?sorted[Math.floor(sorted.length/2)]:0;};
const length=points=>points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);

function rasterize(points) {
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity,area=0,perimeter=0;
    for(let i=0;i<points.length;i++) {
        const a=points[i],b=points[(i+1)%points.length];
        if(!Number.isFinite(a.x+a.y))return null;
        left=Math.min(left,a.x);top=Math.min(top,a.y);right=Math.max(right,a.x);bottom=Math.max(bottom,a.y);
        area+=a.x*b.y-b.x*a.y;perimeter+=Math.hypot(a.x-b.x,a.y-b.y);
    }
    area=Math.abs(area)/2;
    const dx=right-left,dy=bottom-top,span=Math.max(dx,dy),narrow=Math.min(dx,dy);
    if(!area || !perimeter || !narrow || span<8)return null;
    const width=2*area/perimeter;
    // Reject compact filled regions before allocating a raster. A ribbon can
    // be straight and narrow, or curl/branch across a much wider bounding box.
    if(span/narrow<6 && width/narrow>.08)return null;
    if(span/width<8)return null;
    const scale=Math.min(4,Math.sqrt(8000000/((dx+4)*(dy+4))));
    if(scale<1)return null;
    const ox=Math.floor(left*scale)/scale-2/scale,oy=Math.floor(top*scale)/scale-2/scale;
    const w=Math.ceil((right-ox)*scale)+3,h=Math.ceil((bottom-oy)*scale)+3;
    const mask=new Uint8Array(w*h),pixels=[];
    const edges=points.map((a,i)=>({a,b:points[(i+1)%points.length]})).filter(({a,b})=>a.y!==b.y);
    for(let row=1;row<h-1;row++) {
        const y=oy+(row+.5)/scale,crossings=[];
        for(const {a,b} of edges)if((a.y>y)!==(b.y>y))crossings.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));
        crossings.sort((a,b)=>a-b);
        for(let i=0;i+1<crossings.length;i+=2) {
            const start=Math.max(1,Math.ceil((crossings[i]-ox)*scale-.5));
            const end=Math.min(w-1,Math.ceil((crossings[i+1]-ox)*scale-.5));
            mask.fill(1,row*w+start,row*w+end);
            for(let x=start;x<end;x++)pixels.push(row*w+x);
        }
    }
    return {mask,pixels,w,h,ox,oy,scale,span};
}

function thin(mask,pixels,w) {
    // Zhang-Suen thinning preserves connected branches and enclosed holes.
    const tables=[new Uint8Array(256),new Uint8Array(256)],remove=[];
    for(let bits=0;bits<256;bits++) {
        const p=Array.from({length:8},(_,i)=>(bits>>i)&1),count=p.reduce((a,b)=>a+b,0);
        let transitions=0;for(let j=0;j<8;j++)if(!p[j] && p[(j+1)%8])transitions++;
        if(count<2 || count>6 || transitions!==1)continue;
        tables[0][bits]=!(p[0]*p[2]*p[4] || p[2]*p[4]*p[6]);
        tables[1][bits]=!(p[0]*p[2]*p[6] || p[0]*p[4]*p[6]);
    }
    let changed=true;
    while(changed) {
        changed=false;
        for(let phase=0;phase<2;phase++) {
            remove.length=0;
            for(const i of pixels) {
                if(!mask[i])continue;
                const bits=mask[i-w] | mask[i-w+1]<<1 | mask[i+1]<<2 | mask[i+w+1]<<3 |
                    mask[i+w]<<4 | mask[i+w-1]<<5 | mask[i-1]<<6 | mask[i-w-1]<<7;
                if(tables[phase][bits])remove.push(i);
            }
            if(remove.length)changed=true;
            for(const i of remove)mask[i]=0;
        }
    }
}

function trace(raster,skeleton) {
    const {w,pixels}=raster,neighbors=new Map();
    for(const i of pixels)if(skeleton[i]) {
        const list=[];
        for(const [dx,dy] of [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]]) {
            const next=i+dy*w+dx;
            // Avoid graph triangles where diagonal pixels already connect by
            // an orthogonal neighbor. Real diagonal-only chains stay connected.
            if(skeleton[next] && !(dx && dy && (skeleton[i+dx] || skeleton[i+dy*w])))list.push(next);
        }
        neighbors.set(i,list);
    }
    const nodeAt=new Map(),nodes=[];
    for(const [i,list] of neighbors)if(list.length!==2 && !nodeAt.has(i)) {
        const members=[i],id=nodes.length;nodeAt.set(i,id);
        for(let k=0;k<members.length;k++)for(const next of neighbors.get(members[k])) {
            if(neighbors.get(next).length!==2 && !nodeAt.has(next)){nodeAt.set(next,id);members.push(next);}
        }
        const center=members.reduce((p,index)=>({x:p.x+index%w+.5,y:p.y+Math.floor(index/w)+.5}),{x:0,y:0});
        nodes.push({members,point:{x:center.x/members.length,y:center.y/members.length}});
    }
    const visited=new Set(),runs=[];
    const edge=(a,b)=>a<b?a+':'+b:b+':'+a;
    const at=i=>({x:i%w+.5,y:Math.floor(i/w)+.5});
    function walk(start,next) {
        const source=nodeAt.get(start),points=[source===undefined?at(start):nodes[source].point];
        let previous=start,current=next,target;
        visited.add(edge(start,next));
        for(;;) {
            target=nodeAt.get(current);
            if(target!==undefined){points.push(nodes[target].point);break;}
            points.push(at(current));
            const after=neighbors.get(current).find(i=>i!==previous && !visited.has(edge(current,i)));
            if(after===undefined)break;
            visited.add(edge(current,after));previous=current;current=after;
            if(current===start){points.push(points[0]);break;}
        }
        if(points.length>=2)runs.push({points,source,target,closed:current===start || source!==undefined && source===target});
    }
    for(let id=0;id<nodes.length;id++)for(const start of nodes[id].members)for(const next of neighbors.get(start)) {
        if(nodeAt.get(next)===id){visited.add(edge(start,next));continue;}
        if(!visited.has(edge(start,next)))walk(start,next);
    }
    // Every remaining edge belongs to a loop with no junction or endpoint.
    for(const [i,list] of neighbors)for(const next of list)if(!visited.has(edge(i,next)))walk(i,next);
    return {runs,nodes};
}

function strokeWidth(points,raster) {
    const {mask,w,h,scale}=raster,widths=[];
    const inside=(x,y)=>x>=0 && y>=0 && x<w && y<h && mask[Math.floor(y)*w+Math.floor(x)];
    const stride=Math.max(1,Math.floor(points.length/100));
    for(let i=0;i<points.length;i+=stride) {
        const a=points[Math.max(0,i-3)],b=points[Math.min(points.length-1,i+3)],d=Math.hypot(b.x-a.x,b.y-a.y);
        if(!d)continue;
        const nx=-(b.y-a.y)/d,ny=(b.x-a.x)/d,p=points[i];
        if(!inside(p.x,p.y))continue;
        let total=0;
        for(const sign of [-1,1]) {
            let distance=.25;
            const limit=Math.max(w,h);
            while(distance<limit && inside(p.x+sign*nx*distance,p.y+sign*ny*distance))distance+=.25;
            total+=distance-.125;
        }
        widths.push(total/scale);
    }
    return median(widths);
}

function analyze(points) {
    const raster=rasterize(points);if(!raster || !raster.pixels.length)return null;
    const skeleton=raster.mask.slice();thin(skeleton,raster.pixels,raster.w);
    const {runs,nodes}=trace(raster,skeleton);
    for(const run of runs){run.width=strokeWidth(run.points,raster);run.length=length(run.points)/raster.scale;}
    const weighted=runs.filter(run=>run.width>0).slice().sort((a,b)=>a.width-b.width);
    const total=runs.reduce((sum,run)=>sum+run.length,0);
    const quantile=fraction=>{let sum=0;for(const run of weighted){sum+=run.length;if(sum>=total*fraction)return run.width;}return 0;};
    const typical=quantile(.5);
    if(!typical || total<Math.max(8,typical*6) || typical>raster.span/8)return null;
    // Mixed broad tone regions are not confidently a stroke network, even if
    // their boundary is long. Ignore the small junctions when measuring spread.
    if(quantile(.9)>typical*3)return null;
    const degrees=new Array(nodes.length).fill(0);
    const adjacent=nodes.map(()=>[]);
    for(const run of runs){if(run.source!==undefined)degrees[run.source]++;if(run.target!==undefined)degrees[run.target]++;}
    for(const run of runs)if(run.length>run.width*3)for(const id of [run.source,run.target]) {
        if(id!==undefined)adjacent[id].push(run.width);
    }
    const result=[];
    for(const run of runs) {
        if(!run.width || run.length<.5/raster.scale)continue;
        if(run.length<run.width*3)run.width=median([typical,...(adjacent[run.source] || []),...(adjacent[run.target] || [])]);
        // Ignore tiny terminal skeleton spurs from uneven outline pixels, but
        // retain junction-to-junction edges and loops regardless of length.
        const terminal=run.source!==undefined && degrees[run.source]===1 || run.target!==undefined && degrees[run.target]===1;
        if(terminal && run.length<Math.max(1/raster.scale,run.width*.75))continue;
        result.push({points:run.points.map(p=>({x:raster.ox+p.x/raster.scale,y:raster.oy+p.y/raster.scale})),
            width:run.width,closed:run.closed});
    }
    return result.length?{raster,lines:result}:null;
}

// Partition foreground pixels by their nearest skeleton branch. Rejected seeds
// win ties at shared junctions, keeping those junctions as filled artwork.
function residualMask(raster,lines,decisions) {
    const {mask,w,h,pixels,ox,oy,scale}=raster,owner=new Uint8Array(mask.length),queue=new Int32Array(pixels.length);
    let tail=0;
    for(const accepted of [false,true])for(let k=0;k<lines.length;k++)if(Boolean(decisions[k])===accepted) {
        for(const p of lines[k].points) {
            const x=Math.floor((p.x-ox)*scale),y=Math.floor((p.y-oy)*scale),i=y*w+x;
            if(x<0 || y<0 || x>=w || y>=h || !mask[i] || owner[i])continue;
            owner[i]=accepted?1:2;queue[tail++]=i;
        }
    }
    for(let head=0;head<tail;head++) {
        const i=queue[head];
        for(const offset of [-w-1,-w,-w+1,-1,1,w-1,w,w+1]) {
            const next=i+offset;
            if(mask[next] && !owner[next]){owner[next]=owner[i];queue[tail++]=next;}
        }
    }
    return {mask:Uint8Array.from(mask,(value,i)=>value && owner[i]!==1?1:0),raster};
}

function filledPolygons({mask,raster}) {
    const {w,pixels,ox,oy,scale}=raster,stride=w+1,edges=new Map();
    const edge=(a,b)=>{if(!edges.has(a))edges.set(a,[]);edges.get(a).push(b);};
    for(const i of pixels)if(mask[i]) {
        const x=i%w,y=Math.floor(i/w),a=y*stride+x;
        if(!mask[i-w])edge(a,a+1);
        if(!mask[i+1])edge(a+1,a+stride+1);
        if(!mask[i+w])edge(a+stride+1,a+stride);
        if(!mask[i-1])edge(a+stride,a);
    }
    const direction=(a,b)=>b-a===1?0:b-a===stride?1:b-a===-1?2:3;
    const loops=[];
    for(const [start,outgoing] of edges)while(outgoing.length) {
        const vertices=[start];let current=start,previousDirection=null;
        do {
            const candidates=edges.get(current);
            if(!candidates?.length)break;
            let choice=0;
            if(previousDirection!==null && candidates.length>1) {
                const priority=[1,0,3,2];
                choice=candidates.reduce((best,next,i)=>priority.indexOf((direction(current,next)-previousDirection+4)%4)<
                    priority.indexOf((direction(current,candidates[best])-previousDirection+4)%4)?i:best,0);
            }
            const next=candidates.splice(choice,1)[0],dir=direction(current,next);
            if(previousDirection!==null && dir!==previousDirection)vertices.push(current);
            previousDirection=dir;current=next;
        } while(current!==start);
        if(current!==start || vertices.length<3)continue;
        const points=vertices.map(i=>({x:ox+(i%stride)/scale,y:oy+Math.floor(i/stride)/scale}));
        let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a.x*b.y-a.y*b.x;}
        if(area)loops.push({points,area});
    }
    const outers=loops.filter(loop=>loop.area>0),holes=loops.filter(loop=>loop.area<0);
    const contains=(points,p)=>{let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++) {
        const a=points[i],b=points[j];if((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    }return inside;};
    for(const hole of holes) {
        const outer=outers.filter(o=>contains(o.points,hole.points[0])).sort((a,b)=>a.area-b.area)[0];
        if(outer){
            // Doubled bridges cancel under even-odd filling, matching the
            // polygon representation used by the v5 image converter.
            outer.points.push(outer.points[0],...hole.points,hole.points[0],outer.points[0]);
        }
    }
    return outers.map(loop=>loop.points);
}

function centerlines(points){return analyze(points)?.lines || null;}
centerlines.partition=function(points,classify) {
    const analysis=analyze(points);if(!analysis)return null;
    const decisions=analysis.lines.map(classify),accepted=decisions.filter(Boolean);
    if(!accepted.length)return {accepted,residual:[points]};
    return {accepted,residual:filledPolygons(residualMask(analysis.raster,analysis.lines,decisions))};
};
module.exports=centerlines;
