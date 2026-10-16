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
console.log(`${passed} passed, ${failed} failed`);process.exit(failed?1:0);
