// Run with PDG_SOURCE=devel ./skrybble tests/shutdown.js.
require('pdg');
const assert=require('assert'),DrawingApp=require('../DrawingApp'),Controller=require('../DrawingController');
const app=Object.create(DrawingApp.prototype);
app.eventMgr=pdg.evt;app.mainPort=pdg.gfx.createOffscreenPort(new pdg.Rect(900,700));
app.drawingController=new Controller({getEventManager:()=>pdg.evt},app.mainPort);
app._registerEventHandlers();
const originalQuit=pdg.quit,originalTimeout=globalThis.setTimeout;let quits=0;const pending=[];
try {
    // Flush the deferred turn explicitly. A script-only PDG process can stop
    // its native loop before Node timers fire, falsely reporting success.
    globalThis.setTimeout=(callback,delay)=>{const task={callback,delay};pending.push(task);return task;};
    pdg.quit=()=>{quits++;app.onShutdown({});};
    assert.strictEqual(app.onQuitRequest(),true);const task=app.quitTask;
    assert.strictEqual(app.onQuitRequest(),true);assert.strictEqual(app.quitTask,task);
    assert.strictEqual(pending.length,1);assert.strictEqual(task.delay,0);
    assert.strictEqual(quits,0,'native callback must return before quitting');
    globalThis.setTimeout=originalTimeout;
    task.callback();
    assert.strictEqual(quits,1);assert.strictEqual(app.mainPort,null);assert.strictEqual(app.drawingController,null);
    assert.strictEqual(app.quitRequestHandler,null);assert.strictEqual(app.shutdownHandler,null);
    app.cleanup();assert.strictEqual(quits,1);
    console.log('PASS deferred window close, duplicate requests and idempotent cleanup');
} finally {pdg.quit=originalQuit;globalThis.setTimeout=originalTimeout;}
process.exit(0);
