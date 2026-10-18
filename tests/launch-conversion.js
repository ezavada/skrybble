// PDG_SOURCE=devel ./skrybble tests/launch-conversion.js
require('pdg');
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const App=require('../DrawingApp'),Controller=require('../DrawingController'),Drawing=require('../drawing'),Shapes=require('../shapes'),importer=require('../pdg-drawing-import');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'skrybble launch '));
const source=path.join(__dirname,'fixtures/v5-figure.ink.svg'),before=fs.readFileSync(source);
const port=pdg.gfx.createOffscreenPort(new pdg.Rect(900,700));
const app=Object.create(App.prototype);
let controller;
app.createDrawingController=()=>{controller=app.drawingController=new Controller({getEventManager:()=>pdg.evt},port);};
const output=path.join(dir,'batch output.pdgdrawing');
const leaves=shapes=>shapes.flatMap(shape=>shape instanceof Shapes.Group?leaves(shape.children):[shape]);
function cleanup(){if(controller)controller.destroy();pdg.gfx.closeGraphicsPort(port);fs.rmSync(dir,{recursive:true,force:true});}
try {
    app.initialize(['--input',source,'--output',output]);app.setupControllers();
    assert.strictEqual(controller.currentFilename,output);
    assert.ok(controller.drawing.getShapes().length);
    assert.ok(!fs.existsSync(output),'setting output must not immediately save');
    controller.destroy();controller=null;
    app.initialize(['--input',source,'--output',output,'--convert-curves']);
    app.onQuitRequest=()=>{
        try {
            assert.ok(fs.statSync(output).size>0);
            const model=new Drawing(),artwork=leaves(model.deserializeDocument(importer.readDocument(output)));
            assert.ok(artwork.some(shape=>shape instanceof Shapes.BezierSpline),'saved batch must contain curves');
            assert.ok(artwork.every(shape=>!(shape instanceof Shapes.NativeDrawing)),'saved output must remain editable');
            assert.deepStrictEqual(fs.readFileSync(source),before,'source changed');
            console.log('PASS startup input/output, spaces, batch save, editable curve round trip, and source preservation');
            cleanup();process.exit(0);
        }catch(error){console.error(error.stack);cleanup();process.exit(1);}
    };
    app.setupControllers();
    setTimeout(()=>{console.error('Batch did not exit');cleanup();process.exit(1);},10000);
}catch(error){console.error(error.stack);cleanup();process.exit(1);}
