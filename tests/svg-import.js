// PDG_SOURCE=devel ./skrybble tests/svg-import.js
require('pdg');
const assert=require('assert'),fs=require('fs'),path=require('path');
const {fromSVG}=require('../svg-import'),importer=require('../pdg-drawing-import'),Shapes=require('../shapes');
const Controller=require('../DrawingController'),{cameraPort}=require('../rendering');
let passed=0,failed=0;
const test=(name,fn)=>{try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack);}};
const svg=(body,attrs='')=>fromSVG(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" ${attrs}>${body}</svg>`);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const fixture=name=>path.join(__dirname,'fixtures',name);
function withController(fn){const port=pdg.gfx.createOffscreenPort(new pdg.Rect(900,700)),c=new Controller({getEventManager:()=>pdg.evt},port);try{fn(c);}finally{c.destroy();pdg.getInputManager().feed({kind:'focusLost'});pdg.gfx.closeGraphicsPort(port);}}

test('t-pose full drawing and ink SVG retain exact editable vertices, canvas, paint and ordering',()=>{
    const info=require('./fixtures/t-pose.fixture.json');
    const hash=name=>require('crypto').createHash('sha256').update(fs.readFileSync(fixture(name))).digest('hex');
    assert.strictEqual(hash(info.name+'.svg'),info.sha256.svg);
    assert.strictEqual(hash(info.name+'.ink.svg'),info.sha256.inkSvg);
    const full=importer.readDocument(fixture('t-pose.svg')),ink=importer.readDocument(fixture('t-pose.ink.svg'));
    const network=JSON.parse(fs.readFileSync(fixture('t-pose.ink-network.json'),'utf8'));
    assert.deepStrictEqual(full.canvas,[1086,1448]);assert.deepStrictEqual(ink.canvas,full.canvas);
    assert.deepStrictEqual(full.importWarnings,[]);assert.deepStrictEqual(ink.importWarnings,[]);
    assert.strictEqual(ink.shapes.length,25);assert.ok(full.shapes.length>ink.shapes.length);
    assert.deepStrictEqual(full.shapes.slice(-ink.shapes.length),ink.shapes);
    const largest=ink.shapes.reduce((a,b)=>a.data.points.length>b.data.points.length?a:b);
    assert.strictEqual(largest.type,'Polygon');assert.deepStrictEqual(largest.data.points,network.points.map(([x,y])=>({x,y})));
    assert.ok(ink.shapes.every(s=>s.type==='Polygon'&&s.data.fillColor==='#202020'&&s.data.strokeColor===null));
});
test('viewBox meet, none, origin and nested transforms are baked into editable geometry',()=>{
    const d=svg('<g transform="translate(10 2) scale(2)"><polygon points="10,10 20,10 20,20"/></g>','viewBox="10 10 100 100"');
    assert.deepStrictEqual(d.shapes[0].data.points,[{x:70,y:12},{x:90,y:12},{x:90,y:32}]);
    const stretched=svg('<path d="M0 0L100 100L0 100Z"/>','viewBox="0 0 100 100" preserveAspectRatio="none"');
    assert.deepStrictEqual(stretched.shapes[0].data.points[1],{x:200,y:100});
    const rotated=svg('<g transform="rotate(90 10 10)"><path d="M10 10H20V20Z"/></g>').shapes[0].data;
    near(rotated.points[1].x,10);near(rotated.points[1].y,20);
});
test('relative, implicit and smooth path commands preserve cubic and quadratic tangents',()=>{
    const d=svg('<path fill="none" stroke="red" d="m10 20 5 0 h5 v5 c0 5 5 5 10 0 s5-5 10 0 q5 10 10 0 t10 0"/>').shapes[0].data;
    assert.deepStrictEqual(d.points,[{x:10,y:20},{x:15,y:20},{x:20,y:20},{x:20,y:25},{x:30,y:25},{x:40,y:25},{x:50,y:25},{x:60,y:25}]);
    assert.deepStrictEqual(d.controlPoints[8],{x:35,y:20});
    near(d.controlPoints[12].x,50+10/3);near(d.controlPoints[12].y,25-20/3);
    assert.strictEqual(d.manuallyEditedControls.length,14);
});
test('arc flags may be adjacent; arcs and primitive shapes become editable paths',()=>{
    const d=svg('<path fill="none" stroke="blue" d="M10 10a10 10 0 0110 10"/><rect x="2" y="3" width="20" height="30"/><rect width="20" height="30" rx="4"/><circle cx="50" cy="40" r="10"/><ellipse cx="80" cy="40" rx="20" ry="10"/><line x1="10" y1="10" x2="40" y2="40" stroke="red" fill="none"/><polyline points="1 2 3 4 5 6" fill="none" stroke="red"/>');
    assert.strictEqual(d.shapes.length,7);assert.strictEqual(d.shapes[1].type,'Polygon');
    assert.deepStrictEqual(d.shapes[0].data.points.at(-1),{x:20,y:20});
    for(const s of d.shapes)assert.ok(s.data.points.length>=2);
    assert.deepStrictEqual(d.shapes[3].data.points[0],d.shapes[3].data.points.at(-1));
});
test('inherited styles, currentColor, inline precedence, opacity, hidden content and physical units',()=>{
    const d=svg('<g fill="red" color="#123" fill-opacity="50%"><polygon points="0 0 10 0 10 10" style="fill:currentColor;stroke:rgb(0, 50%, 255);stroke-width:2" opacity=".5"/><g display="none"><rect width="20" height="20"/></g><rect width="1in" height="10pt" visibility="hidden"/></g>');
    assert.strictEqual(d.shapes.length,1);assert.strictEqual(d.shapes[0].data.fillColor,'#11223340');
    assert.strictEqual(d.shapes[0].data.strokeColor,'#0080ff80');
    const units=fromSVG('<svg width="1in" height="2.54cm"><rect width="72pt" height="6pc"/></svg>');
    assert.deepStrictEqual(units.canvas,[96,96]);near(units.shapes[0].data.points[2].x,96);
});
test('compound even-odd holes stay open and bridge edges are not stroked',()=>withController(c=>{
    const data=svg('<path fill="red" stroke="blue" fill-rule="evenodd" d="M10 10H90V90H10Z M30 30H70V70H30Z"/>');
    assert.deepStrictEqual(data.importWarnings,[]);assert.strictEqual(data.shapes.length,3);
    const shapes=c.drawing.deserializeDocument(data),port=pdg.gfx.createOffscreenPort(new pdg.Rect(100,100));
    try{for(const s of shapes)s.draw(port);const image=new pdg.Image(port);assert.ok(image.getPixel(20,20).alpha>.9);assert.ok(image.getPixel(50,50).alpha<.01);assert.ok(image.getPixel(20,20).blue<.1);}finally{pdg.gfx.closeGraphicsPort(port);}
}));
test('open paths close their fill without closing their editable stroke',()=>{
    const d=svg('<path d="M10 10 C20 0 40 0 50 10 L30 30" fill="red" stroke="blue"/>');
    assert.strictEqual(d.shapes.length,2);const [fill,stroke]=d.shapes.map(s=>s.data);
    assert.deepStrictEqual(fill.points[0],fill.points.at(-1));assert.notDeepStrictEqual(stroke.points[0],stroke.points.at(-1));
    assert.strictEqual(fill.strokeColor,null);assert.strictEqual(stroke.fillColor,null);
});
test('linear and radial gradients render, move, and survive editing snapshots and native export',()=>withController(c=>{
    const data=svg('<defs><linearGradient id="linear"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient><radialGradient id="radial"><stop stop-color="white"/><stop offset="100%" stop-color="black"/></radialGradient></defs><rect x="10" y="10" width="80" height="80" fill="url(#linear)"/><circle cx="150" cy="50" r="40" fill="url(#radial)"/>');
    assert.deepStrictEqual(data.importWarnings,[]);const shapes=c.drawing.deserializeDocument(data);shapes.forEach(s=>c.drawing.addShape(s));
    const port=pdg.gfx.createOffscreenPort(new pdg.Rect(220,120));
    try {
        const capture=()=>{port.clear();for(const s of c.drawing.getShapes())s.draw(port);return new pdg.Image(port,pdg.CopyPixels);};
        let image=capture();assert.ok(image.getPixel(20,50).red>.75);assert.ok(image.getPixel(80,50).blue>.75);assert.ok(image.getPixel(150,50).red>.9);assert.ok(image.getPixel(185,50).red<.2);
        const before=c.drawing.exportShapes();c.saveUndoState('move');c.drawing.moveShape(shapes[0],10,10);image=capture();assert.ok(image.getPixel(30,60).red>.75);c.undo();assert.strictEqual(c.drawing.exportShapes(),before);c.redo();capture();
        const bytes=importer.exportBinary(c.drawing.getShapes());const restored=importer.fromBinary(bytes);assert.strictEqual(restored.shapes[0].type,'Group');
        port.clear();for(const s of c.drawing.deserializeDocument(restored))s.draw(port);image=new pdg.Image(port);assert.ok(image.getPixel(30,60).red>.75);assert.ok(image.getPixel(90,60).blue>.75);
    }finally{pdg.gfx.closeGraphicsPort(port);}
}));
test('gradient references, transforms, stop alpha and unsupported richer gradients are explicit',()=>{
    const d=svg('<defs><linearGradient id="base"><stop offset="0" stop-color="#ff0000" stop-opacity=".5"/><stop offset="1" stop-color="blue"/></linearGradient><linearGradient id="copy" href="#base" gradientTransform="rotate(90 .5 .5)"/><linearGradient id="rich" spreadMethod="repeat"><stop stop-color="red"/><stop offset=".5" stop-color="green"/><stop offset="1" stop-color="blue"/></linearGradient><radialGradient id="ellipse"><stop stop-color="white"/><stop offset="1" stop-color="black"/></radialGradient></defs><rect width="100" height="100" fill="url(#copy)"/><rect x="100" width="80" height="20" fill="url(#rich)"/><rect width="100" height="20" fill="url(#ellipse)"/>');
    const g=d.shapes[0].data.fillGradient;assert.strictEqual(g.startColor,'#ff000080');near(g.start.y,0);near(g.end.y,1);near(g.start.x,g.end.x);
    for(const s of ['more than two stops','Repeating','Elliptical'])assert.ok(d.importWarnings.some(w=>w.includes(s)));
});
test('editable text keeps content, font, baseline, anchor and rotation',()=>withController(c=>{
    const data=svg('<text x="100" y="60" font-family="Arial" font-size="24" font-weight="bold" font-style="italic" text-anchor="middle" fill="#123456" transform="rotate(30 100 60)">Hello &amp; SVG</text>');
    assert.deepStrictEqual(data.importWarnings,[]);const text=c.drawing.deserializeDocument(data)[0];text.layout(c.port);
    assert.ok(text instanceof Shapes.Text);assert.strictEqual(text.text,'Hello & SVG');assert.strictEqual(text.fontSize,24);assert.strictEqual(text.textStyle,3);near(text.rotation,Math.PI/6);
    const rect=text.textRect(),center=text.getCenterPoint(),anchor=text.rotatePoint(rect.left+text._textWidth/2,rect.top+text._ascent,center.x,center.y,text.rotation);
    near(anchor.x,100);near(anchor.y,60);const before=c.drawing.serializeShape(text);text.draw(c.port);assert.deepStrictEqual(c.drawing.serializeShape(text),before);
}));
test('text gradients and supported SVG blend modes render through PDG',()=>withController(c=>{
    const d=svg('<defs><linearGradient id="g"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient></defs><rect width="200" height="100" fill="yellow"/><rect x="20" y="20" width="50" height="50" fill="blue" style="mix-blend-mode:multiply"/><rect x="80" y="20" width="50" height="50" fill="blue" style="mix-blend-mode:screen"/><text x="10" y="90" font-size="20" fill="url(#g)">Gradient</text>');
    assert.deepStrictEqual(d.importWarnings,[]);const shapes=c.drawing.deserializeDocument(d),port=pdg.gfx.createOffscreenPort(new pdg.Rect(200,100));
    try{for(const s of shapes)s.draw(port);const image=new pdg.Image(port);assert.ok(image.getPixel(40,40).red<.01&&image.getPixel(40,40).blue<.01);assert.ok(image.getPixel(100,40).red>.95&&image.getPixel(100,40).blue>.95);assert.ok(shapes.at(-1).fillGradient);}finally{pdg.gfx.closeGraphicsPort(port);}
    const warning=svg('<rect width="20" height="20" style="mix-blend-mode:color-dodge"/>');assert.ok(warning.importWarnings.some(w=>w.includes('color-dodge')));
}));
test('gradient fills survive curve fitting and solid fill replacement can be undone',()=>withController(c=>{
    const d=svg('<defs><linearGradient id="g"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient></defs><rect x="10" y="10" width="100" height="60" fill="url(#g)"/>');
    const original=c.drawing.deserializeDocument(d)[0];original.selected=true;c.drawing.addShape(original);assert.ok(c.pointEditor.fitCurve());
    let shape=c.drawing.getShapes()[0];assert.ok(shape instanceof Shapes.BezierSpline);assert.ok(shape.fillGradient);c.pointEditor.clear();shape.selected=true;
    c.openColorPicker('fillcolor');c.colorPickerController.cancel();assert.ok(shape.fillGradient);
    c.openColorPicker('fillcolor');c.colorPickerController.accept();assert.strictEqual(shape.fillGradient,undefined);c.undo();shape=c.drawing.getShapes()[0];assert.ok(shape.fillGradient);
}));
test('unsupported SVG features are reported without executing or loading resources',()=>{
    const d=svg('<defs><linearGradient id="paint"/></defs><style>.x{fill:red}</style><text>Ignored</text><image href="https://example.invalid/image.png"/><script>throw new Error("executed")</script><rect class="x" width="20" height="20" fill="url(#paint)" stroke="black" filter="url(#f)" clip-path="url(#c)" style="stroke-dasharray:2 2"/><path fill-rule="nonzero" d="M30 0H50V20Z M35 5H45V15Z"/>');
    for(const name of ['CSS stylesheets','<image>','<script>','Empty gradient','filter','clip-path','stroke-dasharray','CSS classes','nonzero'])assert.ok(d.importWarnings.some(s=>s.includes(name)),name);
    assert.strictEqual(d.shapes.length,3);
});
test('malformed XML, path data, invalid dimensions and entity declarations fail clearly',()=>{
    for(const s of ['<svg><g></svg>','<svg/><svg/>','<!DOCTYPE svg [<!ENTITY x "x">]><svg/>','<svg><path d="M0 0 L1"/></svg>','<svg><path d="M0 0R1 1"/></svg>','<svg><rect width="20%" height="10"/></svg>','<svg width="1e999"><rect width="20" height="10"/></svg>','<svg><path d="M0 0L1e999 2"/></svg>'])assert.throws(()=>fromSVG(s));
});
test('opening SVG preserves clipboard, resets undo and saves to a new editor filename',()=>withController(c=>{
    const original=new Shapes.Rectangle(0,0,20,20,'blue',null,0);c.drawing.addShape(original);original.selected=true;c.copySelectedShapes();
    const clipboard=c.clipboard;assert.ok(c.openDrawingFile(fixture('t-pose.ink.svg')));
    assert.strictEqual(c.clipboard,clipboard);assert.strictEqual(c.undoStack.length,0);assert.ok(c.currentFilename.endsWith('t-pose.ink.skrbl'));
    assert.strictEqual(c.drawing.getShapeCount(),25);
    const doc={fileFormat:'skrbl-v0.0.4',imageData:[],shapes:c.drawing.getShapes().map(s=>({type:s.constructor.name,data:c.drawing.serializeShape(s)}))};assert.deepStrictEqual(c.drawing.deserializeDocument(doc).map(s=>c.drawing.serializeShape(s)),c.drawing.getShapes().map(s=>c.drawing.serializeShape(s)));
}));
test('placing SVG keeps the document and canvas; placement is editable and undoable',()=>withController(c=>{
    const original=new Shapes.Rectangle(0,0,20,20,'blue',null,0);c.drawing.addShape(original);const canvas=c.navigation.getCanvas?c.navigation.getCanvas():null;
    assert.ok(c.activateImageTool(fixture('t-pose.ink.svg')));assert.strictEqual(c.drawing.getShapeCount(),1);
    const manager=c.toolManager;manager.startDrawing(200,200,c.drawing.getShapeClasses());const group=manager.getCurrentShape();assert.strictEqual(group.children.length,25);
    const center=group.getCenterPoint();near(center.x,200);near(center.y,200);
    c.saveUndoState('add shape');c.drawing.addShape(group);manager.finishCurrentDrawing();assert.strictEqual(c.drawing.getShapeCount(),2);
    c.undo();assert.strictEqual(c.drawing.getShapeCount(),1);c.redo();assert.strictEqual(c.drawing.getShapes()[1].children.length,25);
    if(canvas)assert.deepStrictEqual(c.navigation.getCanvas(),canvas);
}));
test('Open and Place surface limitations in the notification',()=>withController(c=>{
    const file='/tmp/skrybble-svg-limitations.svg';fs.writeFileSync(file,'<svg><image href="missing.png"/><rect width="20" height="20"/></svg>');
    try{assert.ok(c.openDrawingFile(file));assert.ok(c.getSaveMessage().includes('<image>'));assert.ok(c.activateImageTool(file));assert.ok(c.getSaveMessage().includes('<image>'));}finally{fs.unlinkSync(file);}
}));
test('failed SVG imports preserve the current drawing and show the specific error',()=>withController(c=>{
    const original=new Shapes.Rectangle(0,0,20,20,'blue',null,0);c.drawing.addShape(original);const file='/tmp/skrybble-svg-invalid.svg';
    fs.writeFileSync(file,'<svg><path d="M0 0 L1"/></svg>');
    try{assert.strictEqual(c.openDrawingFile(file),false);assert.strictEqual(c.drawing.getShapes()[0],original);assert.ok(c.getSaveMessage().includes('path parameters'));assert.strictEqual(c.activateImageTool(file),false);assert.strictEqual(c.drawing.getShapeCount(),1);}finally{fs.unlinkSync(file);}
}));
console.log(`${passed} passed, ${failed} failed`);process.exit(failed?1:0);
