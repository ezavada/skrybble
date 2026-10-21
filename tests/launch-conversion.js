// PDG_SOURCE=devel ./skrybble tests/launch-conversion.js
require('pdg');
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const App=require('../DrawingApp'),Controller=require('../DrawingController'),Drawing=require('../drawing'),Shapes=require('../shapes'),importer=require('../pdg-drawing-import');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'skrybble launch '));
const source=path.join(__dirname,'fixtures/t-pose.ink.svg'),before=fs.readFileSync(source);
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
    let flushing=false,quitRequests=0;const pending=[],originalTimeout=globalThis.setTimeout;
    app.onQuitRequest=()=>{assert.ok(flushing,'conversion must wait until setup returns');quitRequests++;return true;};
    // Drive the scheduled batch turn explicitly: script-only PDG runs can end
    // before host timers fire, otherwise this test can silently skip its checks.
    globalThis.setTimeout=(callback,delay)=>{const task={callback,delay};pending.push(task);return task;};
    try {app.setupControllers();}finally{globalThis.setTimeout=originalTimeout;}
    assert.strictEqual(quitRequests,0);assert.ok(!fs.existsSync(output));
    assert.strictEqual(pending.length,1);assert.strictEqual(pending[0].delay,0);
    flushing=true;pending[0].callback();assert.strictEqual(quitRequests,1);
    assert.ok(fs.statSync(output).size>0);
    const model=new Drawing(),artwork=leaves(model.deserializeDocument(importer.readDocument(output)));
    assert.ok(artwork.some(shape=>shape instanceof Shapes.BezierSpline),'saved batch must contain curves');
    assert.ok(artwork.every(shape=>!(shape instanceof Shapes.NativeDrawing)),'saved output must remain editable');
    assert.deepStrictEqual(fs.readFileSync(source),before,'source changed');
    console.log('PASS startup input/output, spaces, batch save, editable curve round trip, and source preservation');
    cleanup();process.exit(0);
}catch(error){console.error(error.stack);cleanup();process.exit(1);}
