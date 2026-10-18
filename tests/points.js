// Run with PDG_SOURCE=devel ./skrybble tests/points.js.
require('pdg');
const assert=require('assert');
const Shapes=require('../shapes'),Geometry=require('../path-editing'),DrawingController=require('../DrawingController');
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
function withController(fn){
    const port=pdg.gfx.createOffscreenPort(new pdg.Rect(900,700));
    const c=new DrawingController({getEventManager:()=>pdg.evt},port);
    try{fn(c);}finally{c.destroy();pdg.getInputManager().feed({kind:'focusLost'});pdg.gfx.closeGraphicsPort(port);}
}
const polygon=()=>new Shapes.Polygon([{x:100,y:100},{x:200,y:100},{x:200,y:200},{x:100,y:200}],'red','blue',3);
function select(c,shape,ids){shape.selected=true;c.drawing.addShape(shape);c.pointEditor.active=true;c.pointEditor.selection.set(shape,new Set(ids));}
function bezier(){return new Shapes.BezierSpline([{x:100,y:100},{x:200,y:180},{x:300,y:100},{x:400,y:180}],null,'blue',2);}
function cubic(s,t){const u=1-t;return {x:u*u*u*s.p0.x+3*u*u*t*s.p1.x+3*u*t*t*s.p2.x+t*t*t*s.p3.x,
    y:u*u*u*s.p0.y+3*u*u*t*s.p1.y+3*u*t*t*s.p2.y+t*t*t*s.p3.y};}
function sameSegment(a,b){for(const t of [0,.1,.5,.9,1]){const p=cubic(a,t),q=cubic(b,t);near(p.x,q.x);near(p.y,q.y);}}

test('Option selects points before object handles, persists after release, and normal click exits point mode',()=>withController(c=>{
    const shape=polygon();shape.selected=true;c.drawing.addShape(shape);
    c.handleSelectMode(100,100,{alt:true});assert.ok(c.pointEditor.selection.get(shape).has('a:0'));
    assert.strictEqual(c.draggedPoint,null);c.handleMouseUp({mousePos:c.navigation.toView({x:100,y:100})});
    assert.ok(c.pointEditor.active);assert.strictEqual(c.pointEditor.count(),1);assert.ok(shape.selected);
    c.handleSelectMode(150,120,{});assert.ok(!c.pointEditor.active);
}));
test('Option marquee, Shift+Option add and Control+Option toggle only selected objects points',()=>withController(c=>{
    const shape=polygon();shape.selected=true;c.drawing.addShape(shape);
    c.drawing.addShape(new Shapes.Polygon([{x:120,y:100},{x:160,y:100},{x:140,y:150}]));
    c.handleMouseDown({mousePos:c.navigation.toView({x:80,y:80}),alt:true});
    c.handleMouseMove({mousePos:c.navigation.toView({x:210,y:110})});
    c.handleMouseUp({mousePos:c.navigation.toView({x:210,y:110})});
    assert.deepStrictEqual([...c.pointEditor.selection.get(shape)].sort(),['a:0','a:1']);
    c.handleSelectMode(200,200,{alt:true,shift:true});assert.strictEqual(c.pointEditor.count(),3);
    c.handleSelectMode(100,100,{alt:true,ctrl:true,shift:true});assert.strictEqual(c.pointEditor.count(),2);
    assert.strictEqual(c.pointEditor.selection.size,1);
}));
test('point marquee selection uses document coordinates after pan, zoom and rotation',()=>withController(c=>{
    const shape=polygon();shape.rotation=Math.PI/3;shape.selected=true;c.drawing.addShape(shape);
    c.navigation.camera.setZoom(2);c.navigation.pan(30,40);
    const point=Geometry.pathGeometry(shape).anchors[0];
    c.handleMouseDown({mousePos:c.navigation.toView({x:point.x-2,y:point.y-2}),alt:true});
    c.handleMouseMove({mousePos:c.navigation.toView({x:point.x+2,y:point.y+2})});
    c.handleMouseUp({mousePos:c.navigation.toView({x:point.x+2,y:point.y+2})});
    assert.ok(c.pointEditor.selection.get(shape).has('a:0'));
}));
test('partial polygon copy creates an open fragment; all vertices or Option-command copy preserves a closed polygon',()=>withController(c=>{
    const shape=polygon();select(c,shape,['a:0','a:1']);c.copySelectedShapes();
    assert.strictEqual(c.clipboard[0].type,'BezierSpline');assert.strictEqual(c.clipboard[0].fillColor,null);
    const source=JSON.stringify(shape.points);c.pasteShapes();assert.strictEqual(c.drawing.getShapes().length,2);
    const pasted=c.drawing.getShapes()[1];near(pasted.points[0].x,110);assert.strictEqual(JSON.stringify(shape.points),source);
    pasted.selected=false;shape.selected=true;c.pointEditor.active=true;
    c.pointEditor.selection.set(shape,new Set(['a:0','a:1','a:2']));c.copySelectedShapes(true);
    assert.strictEqual(c.clipboard[0].type,'Polygon');assert.strictEqual(c.clipboard[0].points.length,3);
    c.pointEditor.selection.set(shape,new Set(['a:0','a:1','a:2','a:3']));c.copySelectedShapes();
    assert.strictEqual(c.clipboard[0].type,'Polygon');assert.strictEqual(c.clipboard[0].fillColor,'red');
}));
test('disconnected polygon selections copy separate runs, including a run across the closing edge',()=>{
    const shape=new Shapes.Polygon([{x:0,y:0},{x:10,y:0},{x:20,y:0},{x:30,y:10},{x:20,y:20},{x:10,y:20},{x:0,y:20},{x:-10,y:10}]);
    const result=Geometry.copiedFragments(Geometry.pathGeometry(shape),new Set(['a:7','a:0','a:2','a:3']));
    assert.strictEqual(result.fragments.length,2);assert.strictEqual(result.removed.size,4);
    assert.ok(result.fragments.some(s=>s.points[0].x===-10 && s.points[1].x===0));
});
test('isolated anchors and tangent-only Copy/Cut leave both source and clipboard unchanged',()=>withController(c=>{
    const shape=bezier();select(c,shape,['a:0','c:0']);c.clipboard=[{existing:true}];
    const before=JSON.stringify(c.drawing.serializeShape(shape));c.cutSelectedShapes();
    assert.strictEqual(JSON.stringify(c.drawing.serializeShape(shape)),before);assert.deepStrictEqual(c.clipboard,[{existing:true}]);
    assert.strictEqual(c.undoStack.length,0);assert.ok(c.getSaveMessage().includes('two adjacent'));
}));
test('copied Bezier and Cardinal segments retain exact curve geometry and world placement under rotation',()=>{
    for(const shape of [bezier(),new Shapes.Spline([{x:50,y:80},{x:100,y:100},{x:200,y:170},{x:300,y:100},{x:400,y:170},{x:450,y:130}],null,'blue',2)]){
        shape.rotation=.7;const path=Geometry.pathGeometry(shape);
        const copied=Geometry.copiedFragments(path,new Set(['a:1','a:2'])).fragments[0];
        sameSegment(path.segments[1],Geometry.pathGeometry(copied).segments[0]);near(copied.rotation,0);
    }
});
test('Cardinal-to-cubic conversion matches PDG spline samples',()=>{
    const shape=new Shapes.Spline([{x:20,y:40},{x:100,y:100},{x:200,y:170},{x:300,y:100},{x:400,y:170}]);
    const spline=new pdg.Spline(pdg.spline_Cardinal);shape.points.forEach(p=>spline.addPoint(new pdg.Point(p)));
    for(const segment of Geometry.pathGeometry(shape).segments)for(const t of [0,.25,.5,.75]){
        const native=spline.getFirstOrder(segment.index+t),point=cubic(segment,t);near(native.x,point.x);near(native.y,point.y);
    }
});
test('point Cut reconnects survivors, preserves untouched curves, and undo/redo restore exact documents',()=>withController(c=>{
    const shape=new Shapes.BezierSpline(Array.from({length:6},(_,i)=>({x:100+i*80,y:100+(i%2)*80})),null,'blue',2);
    shape.rotation=.5;const path=Geometry.pathGeometry(shape),before=JSON.stringify(c.drawing.serializeShape(shape));
    select(c,shape,['a:2','a:3']);c.cutSelectedShapes();
    const result=c.drawing.getShapes()[0];assert.strictEqual(result.points.length,4);assert.strictEqual(c.undoStack.length,1);
    sameSegment(path.segments[0],Geometry.pathGeometry(result).segments[0]);sameSegment(path.segments[4],Geometry.pathGeometry(result).segments[2]);
    c.undo();assert.strictEqual(JSON.stringify(c.drawing.serializeShape(c.drawing.getShapes()[0])),before);
    c.redo();assert.strictEqual(c.drawing.getShapes()[0].points.length,4);
}));
test('point Cut deletes a source that has too few anchors remaining and preserves unrelated objects',()=>withController(c=>{
    const shape=polygon();select(c,shape,['a:0','a:1']);const other=new Shapes.Circle(300,300,20);c.drawing.addShape(other);
    c.cutSelectedShapes();assert.deepStrictEqual(c.drawing.getShapes(),[other]);assert.strictEqual(c.clipboard.length,1);
}));
test('scissors click removes exactly one curved segment and preserves the exact surviving runs',()=>withController(c=>{
    const shape=bezier();shape.rotation=.4;shape.selected=true;c.drawing.addShape(shape);
    const path=Geometry.pathGeometry(shape),point=cubic(path.segments[1],.5);
    c.pointEditor.scissor(point,point);assert.strictEqual(c.drawing.getShapes().length,2);
    sameSegment(path.segments[0],Geometry.pathGeometry(c.drawing.getShapes()[0]).segments[0]);
    sameSegment(path.segments[2],Geometry.pathGeometry(c.drawing.getShapes()[1]).segments[0]);
    assert.strictEqual(c.undoStack.length,1);c.undo();assert.strictEqual(c.drawing.getShapes()[0].constructor.name,'BezierSpline');
}));
test('scissors drag removes crossed polygon edges, including collinear overlaps, in one undo step',()=>withController(c=>{
    const shape=polygon();shape.selected=true;c.drawing.addShape(shape);
    c.pointEditor.scissor({x:150,y:80},{x:150,y:220});assert.strictEqual(c.drawing.getShapes().length,2);
    assert.ok(c.drawing.getShapes().every(s=>s.constructor.name==='BezierSpline' && s.points.length===2 && s.fillColor===null));
    assert.strictEqual(c.undoStack.length,1);
    assert.ok(Geometry.crosses({x:0,y:0},{x:10,y:0},{x:3,y:0},{x:7,y:0}));
    assert.ok(!Geometry.crosses({x:0,y:0},{x:1,y:0},{x:3,y:0},{x:7,y:0}));
}));
test('scissors drag repairs polygon fragments with fill and stroke, with or without Option, and preserves undo',()=>withController(c=>{
    for(const alt of [false,true]) {
        c.drawing.clearShapes();c.undoStack=[];c.redoStack=[];
        const shape=new Shapes.Polygon([{x:100,y:100},{x:200,y:100},{x:300,y:100},
            {x:300,y:250},{x:200,y:250},{x:100,y:250}],'red','blue',3);
        shape.rotation=.2;shape.selected=true;c.drawing.addShape(shape);
        const before=JSON.stringify(c.drawing.serializeShape(shape)),center=shape.getCenterPoint();
        const rotate=p=>shape.rotatePoint(p.x,p.y,center.x,center.y,shape.rotation);
        const start=rotate({x:250,y:60}),end=rotate({x:250,y:290});
        c.toolManager.setTool('scissors');
        c.handleMouseDown({mousePos:c.navigation.toView(start),alt});
        c.handleMouseMove({mousePos:c.navigation.toView(end),alt});
        c.handleMouseUp({mousePos:c.navigation.toView(end),alt});
        const fragments=c.drawing.getShapes();assert.strictEqual(fragments.length,2);
        const repaired=fragments.find(s=>s.constructor.name==='Polygon');assert.ok(repaired);
        assert.strictEqual(repaired.points.length,4);assert.strictEqual(repaired.fillColor,'red');
        assert.strictEqual(repaired.strokeColor,'blue');assert.strictEqual(repaired.strokeWidth,3);
        assert.ok(fragments.some(s=>s.constructor.name==='BezierSpline' && s.points.length===2));
        near(repaired.rotation,0);assert.strictEqual(c.undoStack.length,1);
        c.undo();assert.strictEqual(JSON.stringify(c.drawing.serializeShape(c.drawing.getShapes()[0])),before);
        c.redo();assert.ok(c.drawing.getShapes().some(s=>s.constructor.name==='Polygon'));
    }
}));
test('scissors and partial-point operations exclude two-point Line objects and primitives',()=>withController(c=>{
    const line=new Shapes.Line(100,100,200,100),rect=new Shapes.Rectangle(100,150,100,50);
    for(const shape of [line,rect]){shape.selected=true;c.drawing.addShape(shape);}
    c.handleSelectMode(100,100,{alt:true});assert.strictEqual(c.pointEditor.count(),0);
    c.pointEditor.scissor({x:150,y:80},{x:150,y:220});assert.deepStrictEqual(c.drawing.getShapes(),[line,rect]);assert.strictEqual(c.undoStack.length,0);
}));
test('selected tangent handles and anchors nudge without moving unrelated geometry and Delete never deletes whole sources accidentally',()=>withController(c=>{
    const shape=bezier();select(c,shape,['c:0']);const anchor={...shape.points[0]},handle={...shape.controlPoints[0]};
    c.nudgeSelection([1,0],true);near(shape.controlPoints[0].x,handle.x+1);near(shape.points[0].x,anchor.x);
    const clipboard=c.clipboard;c.deleteSelectionOrPoint();assert.strictEqual(c.drawing.getShapes()[0],shape);assert.strictEqual(c.clipboard,clipboard);
}));
test('C selects scissors while Option+Command+C keeps command precedence and requests closed fragments',()=>withController(c=>{
    const input=c.shortcuts;
    assert.deepStrictEqual(input.shortcut('KeyC',{meta:false,control:false,alt:false,shift:false}),['tool','scissors']);
    const shortcut=input.shortcut('KeyC',{meta:true,alt:true});assert.strictEqual(shortcut[0],'copy');assert.ok(shortcut[1].closePolygon);
    const shape=polygon();select(c,shape,['a:0','a:1','a:2']);c.executeShortcut(...shortcut);assert.strictEqual(c.clipboard[0].type,'Polygon');
}));
test('curve fitting follows smoothness, preserves endpoints, and approximates dense sampled points',()=>{
    const fit=require('../curve-fit');
    const points=Array.from({length:81},(_,i)=>({x:100+i*2,y:150+30*Math.sin(i/9)+2*Math.sin(i*2)}));
    const fine=fit(points,2),smooth=fit(points,13);
    assert.ok(smooth.length<fine.length);assert.ok(smooth.length<points.length/4);
    for(const [segments,tolerance] of [[fine,2],[smooth,13]]) {
        assert.deepStrictEqual(segments[0].p0,points[0]);assert.deepStrictEqual(segments.at(-1).p3,points.at(-1));
        const polyline=segments.flatMap(s=>Geometry.flatten(s,.05));
        for(const point of points) {
            let distance=Infinity;
            for(let i=1;i<polyline.length;i++)distance=Math.min(distance,Geometry.distance(point,polyline[i-1],polyline[i]));
            assert.ok(distance<=tolerance+.1,`Distance ${distance} exceeds ${tolerance}`);
        }
    }
    assert.deepStrictEqual(fit([{x:1,y:1},{x:1,y:1}],5),[]);
});
test('fitting disconnected rotated curve runs preserves intervening segments, style, clipboard and undo',()=>withController(c=>{
    const shape=new Shapes.BezierSpline(Array.from({length:8},(_,i)=>({x:100+i*30,y:160+20*Math.sin(i)})),'red','blue',3);
    shape.rotation=.4;select(c,shape,['a:0','a:1','a:2','a:5','a:6','a:7']);
    const original=c.drawing.serializeShape(shape),path=Geometry.pathGeometry(shape),clipboard=[{untouched:true}];c.clipboard=clipboard;
    const undo=c.undoStack.length;assert.ok(c.pointEditor.fitCurve());
    const result=c.drawing.getShapes()[0],after=Geometry.pathGeometry(result);
    assert.ok(result instanceof Shapes.BezierSpline);assert.strictEqual(result.fillColor,'red');
    assert.strictEqual(result.strokeColor,'blue');assert.strictEqual(result.strokeWidth,3);assert.strictEqual(result.rotation,0);
    for(const i of [2,3,4]) {
        const preserved=after.segments.find(s=>Math.hypot(s.p0.x-path.segments[i].p0.x,s.p0.y-path.segments[i].p0.y)<1e-6);
        assert.ok(preserved);sameSegment(preserved,path.segments[i]);
    }
    assert.strictEqual(c.clipboard,clipboard);assert.strictEqual(c.undoStack.length,undo+1);assert.ok(c.pointEditor.active);
    const serialized=c.drawing.serializeShape(result);
    const restored=c.drawing.deserializeShape(serialized.type,serialized);
    assert.deepStrictEqual(c.drawing.serializeShape(restored),serialized);
    c.undo();assert.deepStrictEqual(c.drawing.serializeShape(c.drawing.getShapes()[0]),original);
    c.redo();assert.deepStrictEqual(c.drawing.serializeShape(c.drawing.getShapes()[0]),serialized);
}));
test('whole-polygon fitting preserves closure and fill',()=>withController(c=>{
    const points=[{x:100,y:100},{x:180,y:90},{x:250,y:120},{x:280,y:200},{x:220,y:250},{x:130,y:240}];
    for(const ids of [[0,1,2,3,4,5]]) {
        c.drawing.clearShapes();c.pointEditor.clear();const shape=new Shapes.Polygon(points.map(p=>({...p})),'red','blue',3);
        select(c,shape,ids.map(i=>'a:'+i));
        assert.ok(c.pointEditor.fitCurve());const result=c.drawing.getShapes()[0];
        assert.deepStrictEqual(result.points[0],result.points.at(-1));assert.strictEqual(result.fillColor,'red');
        assert.ok(result.contains(190,170));
        const surface=pdg.gfx.createOffscreenPort(new pdg.Rect(400,350));
        try {result.selected=false;result.draw(surface);const image=new pdg.Image(surface);assert.ok(image.getPixel(190,170).red>.9);}
        finally {pdg.gfx.closeGraphicsPort(surface);}
    }
}));
test('Cmd/Ctrl+L fits point runs and falls back to the whole path without a selected run',()=>withController(c=>{
    const shape=bezier();select(c,shape,['c:0','a:1']);const before=c.drawing.serializeShape(shape),undo=c.undoStack.length;
    assert.ok(c.pointEditor.fitCurve());assert.strictEqual(c.undoStack.length,undo+1);
    c.undo();assert.deepStrictEqual(c.drawing.serializeShape(c.drawing.getShapes()[0]),before);
    for(const [modifier,mask] of [['MetaLeft',8],['ControlLeft',2]]) {
        const current=c.drawing.getShapes()[0];current.selected=true;c.pointEditor.active=true;
        c.pointEditor.selection.set(current,new Set(['a:0','a:1','a:2']));
        const input=pdg.getInputManager();
        for(const [code,down,modifiers] of [[modifier,true,mask],['KeyL',true,mask],['KeyL',false,mask],[modifier,false,0]]) {
            input.feed({kind:'key',code,down,modifiers});if(down)c.doKeyDown({keyCode:code});else c.doKeyUp({keyCode:code});
        }
        assert.notStrictEqual(c.drawing.getShapes()[0],current);
    }
}));
test('without a selected run, all selected paths are replaced, including isolated or tangent-only point selections',()=>withController(c=>{
    for(const mode of ['objects','isolated','tangent']) {
        c.drawing.clearShapes();c.pointEditor.clear();
        const a=polygon(),b=bezier();a.selected=b.selected=true;c.drawing.addShape(a);c.drawing.addShape(b);
        if(mode!=='objects'){c.pointEditor.active=true;c.pointEditor.selection.set(b,new Set([mode==='isolated'?'a:1':'c:0']));}
        const before=c.drawing.getShapes().map(s=>c.drawing.serializeShape(s)),undo=c.undoStack.length;
        assert.ok(c.pointEditor.fitCurve());assert.strictEqual(c.undoStack.length,undo+1);
        const shapes=c.drawing.getShapes();assert.strictEqual(shapes.length,2);
        assert.ok(shapes.every(s=>s instanceof Shapes.BezierSpline));assert.ok(!shapes.includes(a) && !shapes.includes(b));
        assert.deepStrictEqual(shapes[0].points[0],shapes[0].points.at(-1));assert.strictEqual(shapes[0].fillColor,'red');
        c.undo();assert.deepStrictEqual(c.drawing.getShapes().map(s=>c.drawing.serializeShape(s)),before);
    }
}));
test('a partial polygon run is removed and patched while its fitted curve becomes a separate object in place',()=>withController(c=>{
    const points=[{x:100,y:100},{x:180,y:90},{x:250,y:120},{x:280,y:200},{x:220,y:250},{x:130,y:240}];
    const shape=new Shapes.Polygon(points,'red','blue',3);shape.rotation=.3;
    select(c,shape,['a:5','a:0','a:1']);const original=c.drawing.serializeShape(shape),world=Geometry.pathGeometry(shape);
    const other=polygon();other.selected=true;c.drawing.addShape(other);
    const clipboard=[{preserved:true}];c.clipboard=clipboard;const undo=c.undoStack.length;
    assert.ok(c.pointEditor.fitCurve());const [patched,curve,untouched]=c.drawing.getShapes();
    assert.ok(patched instanceof Shapes.Polygon);assert.strictEqual(patched.points.length,3);
    assert.deepStrictEqual(patched.points,[2,3,4].map(i=>world.anchors[i]));assert.strictEqual(patched.fillColor,'red');
    assert.ok(curve instanceof Shapes.BezierSpline);assert.strictEqual(curve.fillColor,null);
    assert.strictEqual(curve.strokeColor,'blue');assert.strictEqual(curve.strokeWidth,3);
    assert.deepStrictEqual(curve.points[0],world.anchors[5]);assert.deepStrictEqual(curve.points.at(-1),world.anchors[1]);
    assert.strictEqual(untouched,other);assert.ok(curve.selected && !patched.selected);
    assert.strictEqual(c.clipboard,clipboard);assert.strictEqual(c.undoStack.length,undo+1);
    const after=c.drawing.getShapes().map(s=>c.drawing.serializeShape(s));
    c.undo();assert.deepStrictEqual(c.drawing.serializeShape(c.drawing.getShapes()[0]),original);
    c.redo();assert.deepStrictEqual(c.drawing.getShapes().map(s=>c.drawing.serializeShape(s)),after);
}));
test('disconnected polygon runs become independent curves and remove only their anchors',()=>withController(c=>{
    const shape=new Shapes.Polygon(Array.from({length:9},(_,i)=>({x:200+80*Math.cos(i*2*Math.PI/9),y:200+80*Math.sin(i*2*Math.PI/9)})),'red','blue',3);
    select(c,shape,['a:0','a:1','a:3','a:4','a:7']); // Isolated anchor 7 must survive.
    assert.ok(c.pointEditor.fitCurve());const [patched,...curves]=c.drawing.getShapes();
    assert.deepStrictEqual(patched.points,[2,5,6,7,8].map(i=>shape.points[i]));assert.strictEqual(curves.length,2);
    assert.ok(curves.every(s=>s instanceof Shapes.BezierSpline && !s.fillColor));
}));
test('partial freehand runs detach, and sources with too few survivors are removed',()=>withController(c=>{
    const anchors=Array.from({length:6},(_,i)=>({x:100+i*30,y:150+20*Math.sin(i)}));
    const shape=new Shapes.Spline([anchors[0],...anchors,anchors.at(-1)],null,'blue',2);
    select(c,shape,['a:2','a:3']);const original=Geometry.pathGeometry(shape);
    assert.ok(c.pointEditor.fitCurve());const [patched,curve]=c.drawing.getShapes();
    assert.strictEqual(patched.points.length,4);assert.deepStrictEqual(curve.points[0],anchors[2]);
    assert.deepStrictEqual(curve.points.at(-1),anchors[3]);
    sameSegment(Geometry.pathGeometry(patched).segments[0],original.segments[0]);
    c.drawing.clearShapes();c.pointEditor.clear();const poly=polygon();select(c,poly,['a:0','a:1','a:2']);
    assert.ok(c.pointEditor.fitCurve());assert.strictEqual(c.drawing.getShapeCount(),1);
    assert.ok(c.drawing.getShapes()[0] instanceof Shapes.BezierSpline);assert.strictEqual(c.drawing.getShapes()[0].fillColor,null);
}));
console.log(`${passed} passed, ${failed} failed`);process.exit(failed?1:0);
