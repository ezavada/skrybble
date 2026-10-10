// Run with ./skrybble tests/pdg-drawing.js using a GUI-enabled PDG runtime.
require('pdg');
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os');
const importer=require('../pdg-drawing-import');
const Shape=require('../shapes'),Drawing=require('../drawing'),Controller=require('../DrawingController');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'skrybble-pdg-drawing-'));
const surface=pdg.gfx.createOffscreenPort(new pdg.Rect(900,700));
const controller=new Controller({getEventManager:()=>pdg.evt},surface);
let passed=0,failed=0;
function test(name,fn) {try {fn();passed++;console.log('PASS '+name);} catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}
const record={format:'pdg-polygon-drawing',version:1,canvas:[1086,1448],
    layers:['light','midtone','shadow','ink'].map((name,i)=>({name,color:['#ffffff','#dedede','#b0b0b0','#202020'][i],
        polygons:[[[2,2],[40,2],[40,40],[2,40],[2,2],[10,10],[10,30],[30,30],[30,10],[10,10],[2,2]]]}))};
record.layers[3].polygons=[[[4,4],[4.5,4],[4.5,20],[4,20]]];
const file=path.join(dir,'pose.drawing.json');fs.writeFileSync(file,JSON.stringify(record));
test('Open preserves canvas, layer order, subpixel points and no-stroke fills',()=>{
    assert.ok(controller.openDrawingFile(file));assert.strictEqual(controller.drawing.getShapeCount(),4);
    assert.strictEqual(controller.navigation.height,1448);assert.ok(controller.navigation.contains({x:1086,y:1448}));
    assert.strictEqual(controller.currentFilename,path.join(dir,'pose.skrbl'));
    assert.deepStrictEqual(controller.drawing.getShapes().map(p=>p.fillColor),record.layers.map(l=>l.color));
    const ink=controller.drawing.getShapes()[3],art=ink.getArtwork();
    const polygon=art.getElement(0); // shape artwork holds the editable geometry as a child Drawing
    let captured;
    ink.drawArtwork({drawPolygon:(p,a)=>captured={points:p.getPointCount(),style:a.getLineStyle()}});
    assert.strictEqual(captured.points,4);assert.strictEqual(captured.style,pdg.lineStyle_None);
    assert.strictEqual(ink.points[1].x,4.5);assert.ok(polygon);
    const hole=controller.drawing.getShapes()[0];
    let geometry;hole.drawArtwork({drawPolygon:p=>geometry=p});
    assert.strictEqual(geometry.contains(new pdg.Point(20,20)),false);
});
test('Save As writes a genuine native snapshot and reopens edited geometry',()=>{
    controller.drawing.getShapes()[3].points[1].x=4.75;
    const target=path.join(dir,'edited.pdgdrawing');assert.ok(controller.saveAs(target));
    assert.strictEqual(fs.readFileSync(target).subarray(0,6).toString(),'pdgobj');
    const doc=importer.fromBinary(fs.readFileSync(target));assert.strictEqual(doc.shapes[3].data.points[1].x,4.75);
    assert.ok(controller.openDrawingFile(target));assert.strictEqual(controller.drawing.getShapes()[3].points[1].x,4.75);
    assert.ok(controller.saveAs(path.join(dir,'edited.skrbl')));
    const saved=JSON.parse(fs.readFileSync(path.join(dir,'edited.skrbl'),'utf8'));
    assert.strictEqual(saved.canvas[1],40);assert.ok(controller.loadFile(path.join(dir,'edited.skrbl')));
    assert.strictEqual(controller.drawing.getShapes()[3].points[1].x,4.75);
});
test('Polygon group export bakes translation and rotation without changing layer order',()=>{
    const child=new Shape.Polygon([{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],'#ffffff',null,0);
    const group=new Shape.Group([child]);group.x=20;group.y=30;group.rotation=Math.PI/2;
    const shapes=importer.fromBinary(importer.exportBinary([group])).shapes;
    const points=shapes[0].data.points;
    assert.ok(Math.abs(points[0].x-30)<.001 && Math.abs(points[0].y-30)<.001);
    assert.ok(Math.abs(points[1].x-30)<.001 && Math.abs(points[1].y-40)<.001);
});
test('Edited fill colors and fractional solid strokes survive native export',()=>{
    const shape=new Shape.Polygon([{x:2,y:2},{x:40,y:2},{x:40,y:40}], 'blue', 'red',3.5);
    const doc=importer.fromBinary(importer.exportBinary([shape]));
    assert.strictEqual(doc.shapes[0].data.fillColor,'#0000ff');
    assert.strictEqual(doc.shapes[0].data.strokeColor,'#ff0000');
    assert.strictEqual(doc.shapes[0].data.strokeWidth,3.5);
    assert.deepStrictEqual(doc.canvas,[42,42]);
});
test('Placement creates an editable polygon group',()=>{
    assert.ok(controller.activateImageTool(file));
    const group=controller.toolManager.importedGroupFactory();
    assert.ok(group instanceof Shape.Group);assert.strictEqual(group.children.length,4);
    assert.strictEqual(group.children[3].points[1].x,4.5);
});
test('Malformed imports and failed exports preserve documents and existing files',()=>{
    const invalid=path.join(dir,'bad.pdgdrawing');fs.writeFileSync(invalid,new Uint8Array([1,2,3]));
    const before=controller.drawing.getShapes().slice(),name=controller.currentFilename;
    assert.strictEqual(controller.loadFile(invalid),false);assert.deepStrictEqual(controller.drawing.getShapes(),before);
    const target=path.join(dir,'protected.pdgdrawing');fs.writeFileSync(target,'unchanged');
    controller.drawing.addShape({getArtwork:()=>{throw new Error('Invalid artwork');},getCenterPoint:()=>({x:0,y:0})});
    assert.strictEqual(controller.saveAs(target),false);
    assert.strictEqual(fs.readFileSync(target,'utf8'),'unchanged');assert.strictEqual(controller.currentFilename,name);
    assert.throws(()=>importer.fromJSON({...record,version:99}),/Unsupported/);
    assert.throws(()=>importer.fromBinary(new Uint8Array([0x70,0x64,0x67])),/Truncated|insufficient data|codec/);
});
test('All peer pose binaries and JSON files decode and export identically',()=>{
    const root=process.env.PDG_POSE_DIR || path.resolve(__dirname,'../../v5-pose-library/drawings');
    if (!fs.existsSync(root)) {console.log('Peer pose assets unavailable; corpus check skipped');return;}
    for (const name of fs.readdirSync(root).filter(n=>n.endsWith('.pdgdrawing'))) {
        const bytes=fs.readFileSync(path.join(root,name));
        const binary=importer.fromBinary(bytes),json=importer.readDocument(path.join(root,name.replace('.pdgdrawing','.drawing.json')));
        assert.deepStrictEqual(binary.shapes,json.shapes,name);
        const model=new Drawing();const shapes=model.deserializeDocument(binary);
        assert.ok(Buffer.from(importer.exportBinary(shapes)).equals(bytes),name);
    }
});
if (typeof pdg.Serializer.prototype.serializeDrawing==='function') {
    test('Native codec preserves Unicode text styling, images and wrapper lifetime',()=>{
        const art=pdg.createDrawing(),attrs=new pdg.Attributes().font(pdg.gfx.createFont('Arial')).textSize(18).fillColor('red');
        art.addText('Café 世界',new pdg.Rect(4,4,90,28),attrs);
        const imagePort=pdg.gfx.createOffscreenPort(new pdg.Rect(8,8));
        try {
            imagePort.drawRect(new pdg.Rect(8,8),new pdg.Attributes().fillColor('blue').lineStyle(pdg.lineStyle_None));
            art.addImage(new pdg.Rect(10,40,30,60),new pdg.Image(imagePort),new pdg.Attributes().fitType(pdg.fit_Fill));
            const bytes=importer.encodeNative(art),restored=importer.decodeNative(bytes);
            assert.strictEqual(restored.getElement(0).getText(),'Café 世界');
            assert.strictEqual(restored.getElement(0).getAttributes().getTextSize(),18);
            assert.strictEqual(restored.getElement(1).type(),pdg.type_Image);
            const port=pdg.gfx.createOffscreenPort(new pdg.Rect(96,72));
            try {
                port.drawDrawing(art,new pdg.Point(0,0),new pdg.Attributes());const before=new pdg.Image(port);
                port.clear();port.drawDrawing(restored,new pdg.Point(0,0),new pdg.Attributes());const after=new pdg.Image(port);
                for(let y=0;y<72;y++) for(let x=0;x<96;x++) {
                    const a=before.getPixel(x,y),b=after.getPixel(x,y);
                    for(const key of ['red','green','blue','alpha']) assert.ok(Math.abs(a[key]-b[key])<.01,key+' at '+x+','+y);
                }
                assert.ok(after.getPixel(20,50).blue>.9);
            } finally {pdg.gfx.closeGraphicsPort(port);}
        } finally {pdg.gfx.closeGraphicsPort(imagePort);}
    });
    test('General Save As preserves mixed shapes and text, then reopens in both formats',()=>{
        const model=new Drawing(),group=new Shape.Group([new Shape.Rectangle(4,4,20,20,'red',null,0),new Shape.Text(20,35,'Saved text')]);
        group.x=10;group.y=5;group.rotation=.15;model.addShape(group);controller.drawing=model;
        const file=path.join(dir,'mixed.pdgdrawing');assert.ok(controller.saveAs(file));
        assert.ok(controller.loadFile(file));const retained=controller.drawing.getShapes()[0];
        assert.ok(retained instanceof Shape.NativeDrawing);
        const before=retained.getCenterPoint();controller.drawing.moveShape(retained,10,20);
        const after=retained.getCenterPoint();assert.strictEqual(after.x,before.x+10);assert.strictEqual(after.y,before.y+20);
        assert.ok(controller.saveAs(path.join(dir,'mixed.skrbl')));assert.ok(controller.loadFile(path.join(dir,'mixed.skrbl')));
        assert.strictEqual(controller.drawing.getShapes()[0].x,10);
        assert.ok(controller.saveAs(path.join(dir,'mixed-again.pdgdrawing')));
        assert.ok(controller.loadFile(path.join(dir,'mixed-again.pdgdrawing')));
    });
}
controller.destroy();pdg.gfx.closeGraphicsPort(surface);fs.rmSync(dir,{recursive:true,force:true});
console.log(`${passed} passed, ${failed} failed`);process.exit(failed ? 1 : 0);
