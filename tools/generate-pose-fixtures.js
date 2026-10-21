// PDG_SOURCE=devel ./skrybble tools/generate-pose-fixtures.js
require('pdg');
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const importer=require('../pdg-drawing-import'),Drawing=require('../drawing'),Controller=require('../DrawingController');
const name='t-pose',destination=path.resolve(__dirname,'../tests/fixtures'),outputs=new Map();
const read=suffix=>fs.readFileSync(path.join(destination,name+suffix));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const full=read('.svg'),ink=read('.ink.svg'),fromSVG=require('../svg-import').fromSVG;
const fullDoc=fromSVG(full.toString()),inkDoc=fromSVG(ink.toString());
const info={name,smoothnessLevel:2,canvas:fullDoc.canvas,sha256:{svg:hash(full),inkSvg:hash(ink)}};
const largest=inkDoc.shapes.reduce((a,b)=>a.data.points.length>b.data.points.length?a:b);
info.networkVertices=largest.data.points.length;info.fullPolygons=fullDoc.shapes.length;info.inkPolygons=inkDoc.shapes.length;
outputs.set('.ink-network.json',JSON.stringify({canvas:info.canvas,fillColor:largest.data.fillColor,points:largest.data.points.map(p=>[p.x,p.y])})+'\n');
const model=new Drawing();outputs.set('.flat.pdgdrawing',importer.exportBinary(model.deserializeDocument(fullDoc)));
for(const [suffix,svg,key] of [['.nested.pdgdrawing',full,'fullNestedChildren'],['.ink.nested.pdgdrawing',ink,'inkNestedChildren']]) {
    const port=pdg.gfx.createOffscreenPort(new pdg.Rect(900,700)),c=new Controller({getEventManager:()=>pdg.evt},port);
    try {
        const doc=require('../svg-import').fromSVG(svg.toString());
        c.drawing.deserializeDocument(doc).forEach(s=>{s.selected=true;c.drawing.addShape(s);});
        c.toolManager.smoothnessLevel=2;assert.ok(c.pointEditor.fitCurve());
        const root=pdg.createDrawing();
        for(const shape of c.drawing.getShapes()){const art=shape.getArtwork(1);root.addDrawing(art.getBounds(),art,new pdg.Attributes());}
        const bytes=importer.encodeNative(root),editable=model.deserializeDocument(importer.fromBinary(bytes));
        assert.strictEqual(editable.length,1);assert.strictEqual(editable[0].constructor.name,'Group');
        info[key]=editable[0].children.length;assert.strictEqual(info[key],c.drawing.getShapeCount());outputs.set(suffix,bytes);
    }finally{c.destroy();pdg.gfx.closeGraphicsPort(port);}
}
outputs.set('.fixture.json',JSON.stringify(info,null,2)+'\n');
for(const [suffix,bytes] of outputs)fs.writeFileSync(path.join(destination,name+suffix),bytes);
console.log(JSON.stringify(info,null,2));process.exit(0);
