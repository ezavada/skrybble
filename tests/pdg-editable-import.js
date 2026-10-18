// PDG_SOURCE=devel ./skrybble tests/pdg-editable-import.js
require('pdg');
const assert=require('assert'),fs=require('fs'),path=require('path'),importer=require('../pdg-drawing-import'),Drawing=require('../drawing'),Shapes=require('../shapes'),Controller=require('../DrawingController');
let passed=0,failed=0;
const test=(name,fn)=>{try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack);}};
const fixture=name=>path.join(__dirname,'fixtures',name);
const leaves=shapes=>shapes.flatMap(s=>s instanceof Shapes.Group?leaves(s.children):[s]);
function withController(fn){const port=pdg.gfx.createOffscreenPort(new pdg.Rect(900,700)),c=new Controller({getEventManager:()=>pdg.evt},port);try{fn(c);}finally{c.destroy();pdg.getInputManager().feed({kind:'focusLost'});pdg.gfx.closeGraphicsPort(port);}}
test('r2 full and ink snapshots become editable groups with polygons and exact Bezier controls',()=>{
    for(const [name,count] of [['r2-figure.pdgdrawing',1025],['r2-figure.ink.pdgdrawing',315]]) {
        const doc=importer.readDocument(fixture(name)),model=new Drawing(),shapes=model.deserializeDocument(doc);
        assert.strictEqual(shapes.length,1);assert.ok(shapes[0] instanceof Shapes.Group);assert.strictEqual(shapes[0].children.length,count);
        const artwork=leaves(shapes);assert.ok(artwork.some(s=>s instanceof Shapes.BezierSpline));assert.ok(artwork.every(s=>s instanceof Shapes.Polygon||s instanceof Shapes.BezierSpline));
        for(const s of artwork.filter(s=>s instanceof Shapes.BezierSpline)){assert.strictEqual(s.controlPoints.length,2*(s.points.length-1));assert.strictEqual(s.manuallyEditedControls.size,s.controlPoints.length);}
        const source=importer.decodeNative(fs.readFileSync(fixture(name))).getBounds();assert.deepStrictEqual(doc.canvas,[Math.ceil(source.right),Math.ceil(source.bottom)]);
    }
});
test('native r2 rendering and editable geometry agree at native scale',()=>{
    for(const name of ['r2-figure.pdgdrawing','r2-figure.ink.pdgdrawing']) {
        const bytes=fs.readFileSync(fixture(name)),native=importer.decodeNative(bytes),doc=importer.fromBinary(bytes),shapes=new Drawing().deserializeDocument(doc);
        const port=pdg.gfx.createOffscreenPort(new pdg.Rect(doc.canvas[0],doc.canvas[1]));
        try {
            port.drawDrawing(native,new pdg.Point(0,0),new pdg.Attributes());const before=new pdg.Image(port,pdg.CopyPixels);port.clear();for(const s of shapes)s.draw(port);const after=new pdg.Image(port,pdg.CopyPixels);
            let samples=0,different=0,max=0;
            for(let y=0;y<doc.canvas[1];y+=4)for(let x=0;x<doc.canvas[0];x+=4){const a=before.getPixel(x,y),b=after.getPixel(x,y);samples++;let d=0;for(const k of ['red','green','blue'])d=Math.max(d,Math.abs(a[k]*a.alpha-b[k]*b.alpha));d=Math.max(d,Math.abs(a.alpha-b.alpha));max=Math.max(max,d);if(d>.03)different++;}
            console.log(name+': '+different+'/'+samples+' differing sampled pixels, max '+max);assert.ok(different/samples<.003,'Native rendering changed');
        }finally{pdg.gfx.closeGraphicsPort(port);}
    }
});
test('Cmd/Ctrl+Shift+G ungroups imported r2 artwork, with undo, point edits and save/reopen',()=>withController(c=>{
    assert.ok(c.openDrawingFile(fixture('r2-figure.ink.pdgdrawing')));c.selectAll();
    const input=pdg.getInputManager(),press=(code,down,modifiers)=>{input.feed({kind:'key',code,down,modifiers});if(down)c.doKeyDown({keyCode:code});else c.doKeyUp({keyCode:code});};
    press('MetaLeft',true,8);press('ShiftLeft',true,9);press('KeyG',true,9);press('KeyG',false,9);press('ShiftLeft',false,8);press('MetaLeft',false,0);
    assert.strictEqual(c.drawing.getShapeCount(),315);assert.strictEqual(c.undoStack.length,1);c.undo();assert.strictEqual(c.drawing.getShapeCount(),1);c.redo();assert.strictEqual(c.drawing.getShapeCount(),315);
    while(c.drawing.getShapes().some(s=>s instanceof Shapes.Group)){c.selectAll();assert.ok(c.ungroupSelectedShapes());}
    const curve=c.drawing.getShapes().find(s=>s instanceof Shapes.BezierSpline);assert.ok(curve);const x=curve.points[0].x;c.updateShapeEndpoint(curve,0,x+.5,curve.points[0].y);assert.strictEqual(curve.points[0].x,x+.5);
    const file='/tmp/skrybble-r2-editable.skrbl';try{const before=c.drawing.exportShapes();assert.ok(c.saveAs(file));assert.ok(c.openDrawingFile(file));assert.strictEqual(c.drawing.exportShapes(),before);}finally{if(fs.existsSync(file))fs.unlinkSync(file);}
}));
test('nested destination rectangles, transforms, opacity and shared drawing references are independent',()=>{
    const child=pdg.createDrawing();child.addPolygon(new pdg.Polygon([new pdg.Point(0,0),new pdg.Point(20,0),new pdg.Point(20,20)]),new pdg.Attributes().fillColor('red').lineStyle(pdg.lineStyle_None));
    const root=pdg.createDrawing();root.addDrawing(new pdg.Rect(10,20,50,60),child,new pdg.Attributes().fillOpacity(.5).translation(new pdg.Offset(5,0)));root.addDrawing(new pdg.Rect(80,20,100,40),child,new pdg.Attributes());
    const doc=importer.fromBinary(importer.encodeNative(root)),shapes=leaves(new Drawing().deserializeDocument(doc));assert.strictEqual(shapes.length,2);assert.deepStrictEqual(shapes[0].points[0],{x:15,y:20});assert.deepStrictEqual(shapes[0].points[1],{x:55,y:20});assert.strictEqual(shapes[0].fillColor,'#ff000080');assert.strictEqual(shapes[1].fillColor,'#ff0000');
    shapes[0].points[0].x=500;assert.strictEqual(shapes[1].points[0].x,80);
});
test('unsupported native content retains the original snapshot instead of losing artwork',()=>{
    const root=pdg.createDrawing();root.addText('Keep native text',new pdg.Rect(10,10,150,40),new pdg.Attributes().textSize(20));
    const bytes=importer.encodeNative(root),doc=importer.fromBinary(bytes);assert.strictEqual(doc.shapes[0].type,'NativeDrawing');assert.strictEqual(doc.shapes[0].data.stream,importer.toBase64(bytes));
});
test('native save/reopen keeps editable paths and does not add redundant root groups',()=>{
    const model=new Drawing(),shapes=model.deserializeDocument(importer.readDocument(fixture('r2-figure.ink.pdgdrawing')));
    const doc=importer.fromBinary(importer.exportBinary(shapes)),again=model.deserializeDocument(doc);assert.ok(again[0] instanceof Shapes.Group);assert.strictEqual(again[0].children.length,315);assert.ok(leaves(again).some(s=>s instanceof Shapes.BezierSpline));assert.ok(leaves(again).every(s=>!(s instanceof Shapes.NativeDrawing)));
});
test('transformed gradients, quads and invisible stroke-only elements preserve native appearance',()=>{
    const root=pdg.createDrawing(),q=new pdg.Quad();q.points=[new pdg.Point(10,10),new pdg.Point(55,15),new pdg.Point(60,55),new pdg.Point(15,50)];
    root.addQuad(q,new pdg.Attributes().fillColor('red').lineStyle(pdg.lineStyle_None));
    root.addPolygon(new pdg.Polygon([new pdg.Point(20,20),new pdg.Point(50,25),new pdg.Point(50,60)]),new pdg.Attributes().fillGradient(new pdg.Point(-100,-100),new pdg.Color('red'),new pdg.Point(200,200),new pdg.Color('blue')).lineStyle(pdg.lineStyle_None).setTransform([1.2,.1,0,.2,.8,0,5,5,1]));
    root.addLine(new pdg.Point(0,0),new pdg.Point(90,90),new pdg.Attributes().lineStyle(pdg.lineStyle_None));
    const spline=new pdg.Spline(pdg.spline_Cardinal);[[-10,60],[0,80],[40,60],[80,80]].forEach(([x,y])=>spline.addPoint(new pdg.Point(x,y)));root.addSpline(spline,new pdg.Attributes().lineStyle(pdg.lineStyle_None));
    const shapes=new Drawing().deserializeDocument(importer.fromBinary(importer.encodeNative(root)));assert.ok(shapes[0] instanceof Shapes.Group);
    const port=pdg.gfx.createOffscreenPort(new pdg.Rect(110,110));
    try{port.drawDrawing(root,new pdg.Point(0,0),new pdg.Attributes());const before=new pdg.Image(port,pdg.CopyPixels);port.clear();for(const s of shapes)s.draw(port);const after=new pdg.Image(port,pdg.CopyPixels);
        for(let y=0;y<110;y+=3)for(let x=0;x<110;x+=3){const a=before.getPixel(x,y),b=after.getPixel(x,y);for(const k of ['red','green','blue'])assert.ok(Math.abs(a[k]*a.alpha-b[k]*b.alpha)<.03,`${k} at ${x},${y}`);assert.ok(Math.abs(a.alpha-b.alpha)<.03);}
    }finally{pdg.gfx.closeGraphicsPort(port);}
});
test('all available peer r2 snapshots import without retained NativeDrawing fallbacks',()=>{
    const root=process.env.PDG_R2_DIR||path.resolve(__dirname,'../../v5-pose-library/r2');if(!fs.existsSync(root)){console.log('Peer r2 corpus unavailable; using committed fixtures');return;}
    const files=fs.readdirSync(root).filter(s=>s.endsWith('.pdgdrawing'));assert.ok(files.length);
    for(const file of files){const shapes=new Drawing().deserializeDocument(importer.readDocument(path.join(root,file)));assert.ok(shapes[0] instanceof Shapes.Group,file);assert.ok(leaves(shapes).every(s=>!(s instanceof Shapes.NativeDrawing)),file);}
    console.log(files.length+' r2 drawings imported as editable groups');
});
console.log(`${passed} passed, ${failed} failed`);process.exit(failed?1:0);
