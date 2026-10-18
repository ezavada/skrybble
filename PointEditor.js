const Geometry=require('./path-editing');
const {Polygon}=require('./shapes');
const cloneSelection=selection=>new Map([...selection].map(([shape,keys])=>[shape,new Set(keys)]));

class PointEditor {
    constructor(controller){this.controller=controller;this.clear();}
    clear(){this.active=false;this.selection=new Map();this.gesture=null;this.cutter=null;}
    paths(){return this.controller.drawing.getShapes().filter(s=>s.selected && Geometry.supported(s)).map(Geometry.pathGeometry);}
    points(path){return [...path.controls.map((point,i)=>({point,key:'c:'+i})),...path.anchors.map((point,i)=>({point,key:'a:'+i}))];}
    prune(){for(const shape of this.selection.keys())if(!shape.selected || !this.controller.drawing.getShapes().includes(shape))this.selection.delete(shape);}
    count(){this.prune();return [...this.selection.values()].reduce((sum,keys)=>sum+keys.size,0);}
    begin(point,event){
        this.prune();this.active=true;
        const initial=cloneSelection(this.selection),mode=event.ctrl?'toggle':event.shift?'add':'replace';
        this.gesture={start:point,end:point,initial,mode,marquee:false};
        let hit=null,best=6/this.controller.navigation.camera.getZoom();
        // Topmost selected path wins; anchors win coincident tangent-handle ties.
        for(const path of this.paths().reverse()) {
            for(const ref of this.points(path)) {
                const distance=Math.hypot(point.x-ref.point.x,point.y-ref.point.y);
                if(distance<=best){best=distance;hit={shape:path.shape,key:ref.key};}
            }
            if(hit)break;
        }
        this.apply(hit?[hit]:[],initial,mode);
    }
    apply(refs,initial,mode){
        this.selection=mode==='replace'?new Map():cloneSelection(initial);
        for(const {shape,key} of refs){
            if(!this.selection.has(shape))this.selection.set(shape,new Set());
            const keys=this.selection.get(shape);
            if(mode==='toggle' && keys.has(key))keys.delete(key);else keys.add(key);
        }
    }
    move(point){
        if(this.cutter){this.cutter.end=point;return true;}
        const gesture=this.gesture;if(!gesture)return false;
        gesture.end=point;
        if(Math.hypot(point.x-gesture.start.x,point.y-gesture.start.y)*this.controller.navigation.camera.getZoom()<3 && !gesture.marquee)return true;
        gesture.marquee=true;
        const left=Math.min(point.x,gesture.start.x),right=Math.max(point.x,gesture.start.x),top=Math.min(point.y,gesture.start.y),bottom=Math.max(point.y,gesture.start.y);
        const refs=[];
        for(const path of this.paths())for(const ref of this.points(path)) {
            if(ref.point.x>=left && ref.point.x<=right && ref.point.y>=top && ref.point.y<=bottom)refs.push({shape:path.shape,key:ref.key});
        }
        this.apply(refs,gesture.initial,gesture.mode);return true;
    }
    end(point){
        if(this.cutter){const {start}=this.cutter;this.cutter=null;this.scissor(start,point);return true;}
        if(!this.gesture)return false;
        this.move(point);this.gesture=null;return true;
    }
    replace(shape,replacements){
        const shapes=this.controller.drawing.getShapes(),index=shapes.indexOf(shape);
        replacements.forEach(s=>s.selected=true);
        if(index>=0)shapes.splice(index,1,...replacements);
        this.selection.delete(shape);
        this.controller.selectedShape=replacements.at(-1) || null;
    }
    copy(cut,closePolygon,storeClipboard=true){
        this.prune();
        const eligible=this.paths().map(path=>({path,...Geometry.copiedFragments(path,this.selection.get(path.shape)||new Set(),closePolygon)}))
            .filter(entry=>entry.fragments.length);
        if(!eligible.length){this.controller.showErrorMessage(closePolygon?'Select at least three adjacent polygon anchors to close a fragment':'Select at least two adjacent anchors to copy or cut a fragment');return false;}
        if(storeClipboard){
            this.controller.clipboard=eligible.flatMap(entry=>entry.fragments).map(shape=>this.controller.drawing.serializeShape(shape));
            this.controller.pasteCount=0;
        }
        if(cut){
            this.controller.saveUndoState('cut points');
            for(const {path,removed} of eligible)this.replace(path.shape,Geometry.reconnect(path,removed));
        }
        return true;
    }
    fitCurve(){
        this.prune();
        const paths=this.paths(),tolerance=this.controller.toolManager.getSmoothnessDistance();
        const keys=path=>this.active && this.selection.get(path.shape) || new Set();
        const hasRun=paths.some(path=>path.segments.some(s=>keys(path).has('a:'+s.start)&&keys(path).has('a:'+s.end)));
        const changes=[];
        let rejectedInk=false;
        for(const path of paths) {
            const selected=hasRun?keys(path):new Set(path.anchors.map((_,i)=>'a:'+i));
            const whole=!hasRun || path.anchors.every((_,i)=>selected.has('a:'+i));
            if(whole && path.type==='Polygon' && path.shape.fillColor && !path.shape.fillGradient && (!path.shape.strokeColor || path.shape.strokeWidth<=0)) {
                const ink=require('./ink-centerline').partition(path.anchors,line=>{
                    // A document-sized smoothing error can erase the bends in
                    // narrow ink. Bound it by the inferred stroke width.
                    const segments=require('./curve-fit')(line.points,Math.min(tolerance,line.width));
                    if(!segments.length)return null;
                    let length=0;
                    for(const segment of segments) {
                        const points=Geometry.flatten(segment,Math.min(.05,line.width/20));
                        for(let i=1;i<points.length;i++)length+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
                    }
                    if(length<5*line.width)return null;
                    const shape=Geometry.curveFragment({strokeColor:path.shape.fillColor,strokeWidth:line.width},segments);
                    if(path.shape.rigBone)shape.rigBone=path.shape.rigBone;
                    return shape;
                });
                if(ink) {
                    const curves=ink.accepted;
                    if(!curves.length)rejectedInk=true;
                    if(curves.length) {
                        const survivors=ink.residual.map(points=>{
                            const shape=new Polygon(points,path.shape.fillColor,null,0);
                            if(path.shape.rigBone)shape.rigBone=path.shape.rigBone;
                            return shape;
                        });
                        changes.push({path,curves,selections:curves.map(shape=>new Set(shape.points.map((_,i)=>'a:'+i))),survivors});
                    }
                    continue;
                }
            }
            if(!hasRun || path.type==='BezierSpline') {
                const result=Geometry.fitSelected(path,selected,tolerance);
                if(result)changes.push({path,curves:[result.shape],selections:[result.keys],survivors:[]});
            } else {
                const {fragments,removed}=Geometry.fitFragments(path,selected,tolerance);
                if(fragments.length)changes.push({path,curves:fragments,
                    selections:fragments.map(shape=>new Set(shape.points.map((_,i)=>'a:'+i))),
                    survivors:Geometry.reconnect(path,removed)});
            }
        }
        if(!changes.length){this.controller.showErrorMessage(rejectedInk
            ?'No ink curves meet the limit: length at least 5× width'
            :'Select an editable path to fit a curve');return false;}
        this.controller.saveUndoState('fit curve');
        for(const {path,curves,selections,survivors} of changes){
            this.replace(path.shape,[...survivors,...curves]);
            survivors.forEach(shape=>shape.selected=false);
            curves.forEach((shape,i)=>this.selection.set(shape,selections[i]));
        }
        this.active=true;return true;
    }
    nudge(dx,dy){
        this.prune();if(!this.count())return false;
        if(!this.controller.isNudging){this.controller.saveUndoState('move points');this.controller.isNudging=true;}
        if(this.controller.nudgeTimer)clearTimeout(this.controller.nudgeTimer);
        for(const path of this.paths()) {
            const keys=this.selection.get(path.shape);if(!keys?.size)continue;
            const shape=path.shape,center=shape.getCenterPoint();
            const world=p=>shape.rotation?shape.rotatePoint(p.x,p.y,center.x,center.y,shape.rotation):{...p};
            shape.points=shape.points.map(world);
            if(path.type==='BezierSpline')shape.controlPoints=shape.controlPoints.map(world);
            shape.rotation=0;
            const points=new Set(),controls=new Set();
            for(const key of keys){
                const index=Number(key.slice(2));
                if(key.startsWith('a:')) {
                    points.add(path.type==='Spline'?index+1:index);
                    if(path.type==='BezierSpline') {
                        if(index>0)controls.add(2*index-1);
                        if(index<path.anchors.length-1)controls.add(2*index);
                    }
                } else if(path.type==='Spline')points.add(index===0?0:shape.points.length-1);
                else if(path.type==='BezierSpline')controls.add(index);
            }
            for(const index of points){shape.points[index].x+=dx;shape.points[index].y+=dy;}
            for(const index of controls){shape.controlPoints[index].x+=dx;shape.controlPoints[index].y+=dy;shape.manuallyEditedControls.add(index);}
            shape.x=shape.points[0].x;shape.y=shape.points[0].y;
        }
        this.controller.nudgeTimer=setTimeout(()=>{this.controller.isNudging=false;this.controller.nudgeTimer=null;},500);
        return true;
    }
    scissor(start,end){
        const zoom=this.controller.navigation.camera.getZoom(),drag=Math.hypot(start.x-end.x,start.y-end.y)*zoom>=3;
        const changes=[];
        let best=null,bestDistance=6/zoom;
        for(const path of this.paths().reverse()) {
            const removed=new Set();
            for(const segment of path.segments){
                const points=Geometry.flatten(segment,.35/zoom);
                for(let i=1;i<points.length;i++) {
                    if(drag){if(Geometry.crosses(start,end,points[i-1],points[i]))removed.add(segment.index);}
                    else {
                        const d=Geometry.distance(end,points[i-1],points[i]);
                        if(d<bestDistance){bestDistance=d;best={path,index:segment.index};}
                    }
                }
            }
            if(removed.size)changes.push({path,removed});
        }
        if(!drag && best)changes.push({path:best.path,removed:new Set([best.index])});
        if(!changes.length)return;
        this.controller.saveUndoState('scissors');
        for(const {path,removed} of changes){
            const kept=new Set(path.segments.filter(s=>!removed.has(s.index)).map(s=>s.index));
            this.replace(path.shape,Geometry.segmentRuns(path,kept).map(run=>{
                if(drag && path.closed && run.length>=2) {
                    const points=[run[0].p0,...run.map(segment=>segment.p3)].map(point=>({x:point.x,y:point.y}));
                    return require('./fill-style').copy(path.shape,new Polygon(points,path.shape.fillColor,path.shape.strokeColor,path.shape.strokeWidth));
                }
                return Geometry.curveFragment(path.shape,run);
            }));
        }
        this.selection.clear();this.active=false;
    }
    drawHighlights(controls){
        this.prune();
        for(const [shape,keys] of this.selection){
            if(!keys.size)continue;
            const path=Geometry.pathGeometry(shape);if(!path)continue;
            const attrs=new pdg.Attributes().fillColor(new pdg.Color('#2563eb')).lineColor(new pdg.Color('white')).lineThickness(1);
            for(const ref of this.points(path))if(keys.has(ref.key))controls.drawCircle(ref.point,5,attrs);
        }
    }
    draw(canvas,skipHighlights=false){
        const controls=canvas.controls;
        if(!skipHighlights)this.drawHighlights(controls);
        if(this.gesture?.marquee){
            const {start,end}=this.gesture;
            canvas.drawRect(new pdg.Rect(Math.min(start.x,end.x),Math.min(start.y,end.y),Math.max(start.x,end.x),Math.max(start.y,end.y)),
                new pdg.Attributes().lineColor(new pdg.Color('#2563eb')).lineThickness(1));
        }
        if(this.cutter)controls.drawLine(this.cutter.start,this.cutter.end,
            new pdg.Attributes().lineColor(new pdg.Color('#9333ea')).lineThickness(1));
    }
}
module.exports=PointEditor;
