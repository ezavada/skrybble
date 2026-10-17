// Run with PDG_SOURCE=devel ./skrybble tests/shutdown.js.
require('pdg');
const assert=require('assert'),DrawingApp=require('../DrawingApp'),Controller=require('../DrawingController');
const app=Object.create(DrawingApp.prototype);
app.eventMgr=pdg.evt;app.mainPort=pdg.gfx.createOffscreenPort(new pdg.Rect(900,700));
app.drawingController=new Controller({getEventManager:()=>pdg.evt},app.mainPort);
app._registerEventHandlers();
const originalQuit=pdg.quit;let quits=0;
pdg.quit=()=>{quits++;app.onShutdown({});};
assert.strictEqual(app.onQuitRequest(),true);const task=app.quitTask;
assert.strictEqual(app.onQuitRequest(),true);assert.strictEqual(app.quitTask,task);
assert.strictEqual(quits,0,'native callback must return before quitting');
setTimeout(()=>{
    try {
        assert.strictEqual(quits,1);assert.strictEqual(app.mainPort,null);assert.strictEqual(app.drawingController,null);
        assert.strictEqual(app.quitRequestHandler,null);assert.strictEqual(app.shutdownHandler,null);
        app.cleanup();assert.strictEqual(quits,1);
        console.log('PASS deferred window close, duplicate requests and idempotent cleanup');
        pdg.quit=originalQuit;process.exit(0);
    }catch(error){console.error(error.stack);pdg.quit=originalQuit;process.exit(1);}
},20);
