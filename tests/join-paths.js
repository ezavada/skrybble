// PDG_SOURCE=devel ./skrybble tests/join-paths.js
require('pdg');
const assert=require('assert'),fs=require('fs'),S=require('../shapes'),G=require('../path-editing'),join=require('../join-paths'),Controller=require('../DrawingController');
let passed=0,failed=0;
const test=(name,fn)=>{try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack);}};
const p=(x,y=0)=>({x,y}),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`),pointNear=(a,b)=>{near(a.x,b.x);near(a.y,b.y);};
const line=(a,b)=>new S.Line(a,30,b,30,'#123456',3);
const bezier=(x,y=0)=>{const s=new S.BezierSpline([p(x,y),p(x+20,y+10),p(x+40,y)],null,'blue',2);s.controlPoints=[p(x+5,y-10),p(x+15,y+10),p(x+25,y+20),p(x+35,y+15)];return s;};
const cardinal=(x,y=0)=>new S.Spline([p(x-10,y-20),p(x,y),p(x+20,y+15),p(x+40,y),p(x+50,y-20)],null,'red',2);
function withController(fn){const port=pdg.gfx.createOffscreenPort(new pdg.Rect(900,700)),c=new Controller({getEventManager:()=>pdg.evt},port);try{fn(c);}finally{c.destroy();pdg.getInputManager().feed({kind:'focusLost'});pdg.gfx.closeGraphicsPort(port);}}
function chord(c,code,modifier='MetaLeft',mask=8){const input=pdg.getInputManager();for(const [key,down,mods] of [[modifier,true,mask],[code,true,mask],[code,false,mask],[modifier,false,0]]){input.feed({kind:'key',code:key,down,modifiers:mods});if(down)c.doKeyDown({keyCode:key});else c.doKeyUp({keyCode:key});}}
const canonical=s=>['p0','p1','p2','p3'].map(k=>s[k]);
const preserved=(source,result)=>{for(const a of source)assert.ok(result.some(b=>{const direct=canonical(b),reverse=canonical(b).reverse();return [direct,reverse].some(points=>canonical(a).every((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y)<1e-7));}),'Source segment changed');};

test('straight joins reverse paths, bridge gaps and weld within 0.25 document pixels',()=>{
    const result=join([line(0,20),line(60,40),line(20.2,30)]);
    assert.ok(result instanceof S.Polyline);assert.deepStrictEqual(result.points,[p(0,30),p(20.1,30),p(30,30),p(40,30),p(60,30)]);assert.strictEqual(result.strokeColor,'#123456');
    assert.strictEqual(result.fillColor,null);assert.strictEqual(result.points.length,5);
    assert.strictEqual(join([line(0,20),line(20.251,40)]).points.length,4);
    assert.strictEqual(join([line(0,20),line(20.25,40)]).points.length,3);
});
test('exact endpoint matches produce one anchor and existing polylines join with lines',()=>{
    const a=join([line(0,20),line(20,40)]);assert.strictEqual(a.points.length,3);
    const b=join([a,line(60,40)]);assert.strictEqual(b.points.length,4);assert.deepStrictEqual(b.points,[0,20,40,60].map(x=>p(x,30)));
});
test('a straight polyline never renders or selects a closing edge',()=>{
    const shape=new S.Polyline([p(20,20),p(100,20),p(100,100)],'blue',2);assert.strictEqual(shape.contains(60,60),false);assert.strictEqual(shape.intersectsRect(55,55,65,65),false);assert.ok(shape.contains(60,20));
    const port=pdg.gfx.createOffscreenPort(new pdg.Rect(120,120));try{shape.draw(port);const image=new pdg.Image(port);assert.ok(image.getPixel(60,20).blue>.9);assert.ok(image.getPixel(60,60).alpha<.01);}finally{pdg.gfx.closeGraphicsPort(port);}
});
test('Bezier joining preserves rotated source segments exactly, including reversed controls',()=>{
    const a=bezier(20,60),b=bezier(130,60);b.rotation=Math.PI/2;const source=[...G.pathGeometry(a).segments,...G.pathGeometry(b).segments];
    const result=join([a,b]);assert.ok(result instanceof S.BezierSpline);preserved(source,G.pathGeometry(result).segments);assert.strictEqual(result.controlPoints.length,10);
    const segments=G.pathGeometry(result).segments,bridge=segments[2],left=segments[1],right=segments[3];
    const cross=(a,b)=>a.x*b.y-a.y*b.x;
    near(cross({x:bridge.p1.x-bridge.p0.x,y:bridge.p1.y-bridge.p0.y},{x:left.p3.x-left.p2.x,y:left.p3.y-left.p2.y}),0);
    near(cross({x:bridge.p3.x-bridge.p2.x,y:bridge.p3.y-bridge.p2.y},{x:right.p1.x-right.p0.x,y:right.p1.y-right.p0.y}),0);
});
test('welding Bezier endpoints translates their adjacent handles with the midpoint',()=>{
    const a=bezier(0),b=bezier(40.2),result=join([a,b]);assert.strictEqual(result.points.length,5);pointNear(result.points[2],p(40.1));
    pointNear(result.controlPoints[3],p(35.1,15));pointNear(result.controlPoints[4],p(45.1,-10));
});
test('Cardinal joining retains its type, exact existing curves and hit testing',()=>{
    const a=cardinal(30,80),b=cardinal(130,90);b.rotation=.4;
    const original=[...G.pathGeometry(a).segments,...G.pathGeometry(b).segments],result=join([a,b]);
    assert.strictEqual(result.constructor.name,'Spline');assert.ok(result.joinCorrections);preserved(original,G.pathGeometry(result).segments);
    const port=pdg.gfx.createOffscreenPort(new pdg.Rect(240,200));try{result.draw(port);const image=new pdg.Image(port);assert.ok(image.getPixel(30,80).alpha>.1);assert.ok(result.contains(30,80));assert.ok(result.intersectsRect(29,79,31,81));}finally{pdg.gfx.closeGraphicsPort(port);}
    result.rotation=.7;assert.ok(G.pathGeometry(result).segments.every(s=>['p0','p1','p2','p3'].every(k=>Number.isFinite(s[k].x))));
});
test('joined Cardinal paths can be joined again without changing existing segments',()=>{
    const a=join([cardinal(0,60),cardinal(100,70)]),before=G.pathGeometry(a).segments,b=cardinal(200,90),result=join([a,b]);preserved([...before,...G.pathGeometry(b).segments],G.pathGeometry(result).segments);
});
test('incompatible, closed and insufficient selections fail without adding undo',()=>withController(c=>{
    for(const shapes of [[line(0,20)],[line(0,20),bezier(40)],[new S.Polygon([p(0),p(20),p(20,20)]),line(40,60)]]){
        c.drawing.clearShapes();shapes.forEach(s=>{s.selected=true;c.drawing.addShape(s);});assert.strictEqual(c.joinPaths(),false);assert.strictEqual(c.undoStack.length,0);assert.strictEqual(c.drawing.getShapeCount(),shapes.length);
    }
    const closed=bezier(10);closed.points.at(-1).x=10;assert.throws(()=>join([closed,bezier(100)]),/closed/);
}));
test('joining keeps drawing order, first object style, selection, clipboard and one undo step',()=>withController(c=>{
    const behind=new S.Rectangle(0,0,10,10),a=line(20,40),middle=new S.Rectangle(0,0,20,20),b=line(60,40),front=new S.Circle(50,50,5);b.strokeColor='red';
    [behind,a,middle,b,front].forEach(s=>c.drawing.addShape(s));a.selected=b.selected=true;const before=c.drawing.exportShapes();c.clipboard=[{marker:true}];const clipboard=c.clipboard;
    chord(c,'KeyJ');assert.strictEqual(c.drawing.getShapeCount(),4);const result=c.drawing.getShapes()[1];assert.ok(result instanceof S.Polyline);assert.ok(result.selected);assert.strictEqual(result.strokeColor,'#123456');assert.strictEqual(c.clipboard,clipboard);assert.strictEqual(c.undoStack.length,1);assert.strictEqual(c.drawing.getShapes()[2],middle);
    c.undo();assert.strictEqual(c.drawing.exportShapes(),before);c.redo();assert.ok(c.drawing.getShapes()[1] instanceof S.Polyline);
}));
test('Select All works with Cmd and Ctrl; point mode stays on selected editable paths',()=>withController(c=>{
    const a=line(0,20),b=bezier(100),d=new S.Group([line(30,40)]);[a,b,d].forEach(s=>c.drawing.addShape(s));
    for(const [modifier,mask] of [['MetaLeft',8],['ControlLeft',2]]){c.drawing.clearSelection();chord(c,'KeyA',modifier,mask);assert.ok(c.drawing.getShapes().every(s=>s.selected));}
    c.drawing.clearSelection();b.selected=true;c.pointEditor.active=true;chord(c,'KeyA');assert.strictEqual(c.pointEditor.count(),7);assert.strictEqual(a.selected,false);assert.strictEqual(d.selected,false);
}));
test('Select All in text editing selects text and does not select drawing objects',()=>withController(c=>{
    const a=new S.Text(30,30,'Hello world'),b=line(0,20);c.drawing.addShape(a);c.drawing.addShape(b);c.beginTextEdit(a);c.handleTextKey({unicode:97,meta:true});assert.ok(c.textEdit.editor.hasSelection());assert.strictEqual(b.selected,false);
}));
test('polyline and Cardinal join data survive save, reopen, copy and native export',()=>withController(c=>{
    const importer=require('../pdg-drawing-import'),shapes=[join([line(0,20),line(20,40)]),join([cardinal(20,80),cardinal(120,80)])];shapes.forEach(s=>{s.selected=true;c.drawing.addShape(s);});
    const file='/tmp/skrybble-joins.skrbl';try{const before=c.drawing.exportShapes();assert.ok(c.saveAs(file));assert.ok(c.openDrawingFile(file));assert.strictEqual(c.drawing.exportShapes(),before);const copied=c.drawing.deserializeShape('Spline',c.drawing.serializeShape(shapes[1]));preserved(G.pathGeometry(shapes[1]).segments,G.pathGeometry(copied).segments);assert.ok(importer.exportBinary(c.drawing.getShapes()).length>0);}finally{if(fs.existsSync(file))fs.unlinkSync(file);}
}));
test('polyline endpoint edits, movement, point copy/cut and curve fitting stay editable',()=>withController(c=>{
    const shape=join([line(0,20),line(20,40)]);shape.selected=true;c.drawing.addShape(shape);c.updateShapeEndpoint(shape,1,25,40);pointNear(shape.points[1],p(25,40));c.drawing.moveShape(shape,10,10);pointNear(shape.points[1],p(35,50));
    const path=G.pathGeometry(shape),fragment=G.copiedFragments(path,new Set(['a:0','a:1'])).fragments[0];assert.ok(fragment instanceof S.Polyline);assert.ok(G.reconnect(path,new Set(['a:1']))[0] instanceof S.Polyline);
    assert.ok(c.pointEditor.fitCurve());assert.ok(c.drawing.getShapes()[0] instanceof S.BezierSpline);
}));
console.log(`${passed} passed, ${failed} failed`);process.exit(failed?1:0);
