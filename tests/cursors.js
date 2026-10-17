// Run with PDG_SOURCE=devel ./skrybble tests/cursors.js.
require('pdg');
const assert=require('assert'),Controller=require('../DrawingController'),ToolCursors=require('../ToolCursors');
(async()=>{
    const calls=[],cursors=new ToolCursors({resetCursor:()=>calls.push('default'),setCursor:()=>calls.push('custom')});
    cursors.create=()=>({image:{},hotspot:{}});
    cursors.set('crosshair');cursors.suspend();cursors.set('crosshair');
    assert.deepStrictEqual(calls,['custom','default']);
    cursors.suspend();cursors.resume();cursors.set('crosshair');assert.strictEqual(cursors.current,'default');
    cursors.resume();cursors.set('crosshair');assert.deepStrictEqual(calls,['custom','default','custom']);
    const port=pdg.gfx.createOffscreenPort(new pdg.Rect(900,700)),c=new Controller({getEventManager:()=>pdg.evt},port);
    const getMouse=pdg.gfx.getMouse;pdg.gfx.getMouse=()=>new pdg.Point(450,350);
    try {
        c.toolManager.setTool('rect');c.updateCursor({mousePos:pdg.gfx.getMouse()});
        const chooser=result=>()=>{assert.strictEqual(c.cursors.current,'default');assert.strictEqual(c.cursors.suspended,1);c.updateCursor();assert.strictEqual(c.cursors.current,'default');return result;};
        assert.strictEqual(c.chooseFileWithVisibleCursor(chooser('drawing.skrbl')),'drawing.skrbl');assert.strictEqual(c.cursors.current,'crosshair');
        assert.strictEqual(c.chooseFileWithVisibleCursor(chooser('')),'');assert.strictEqual(c.cursors.current,'crosshair');
        assert.throws(()=>c.chooseFileWithVisibleCursor(()=>{throw Error('picker error');}),/picker error/);assert.strictEqual(c.cursors.current,'crosshair');
        let resolve;const pending=c.chooseFileWithVisibleCursor(chooser(new Promise(done=>resolve=done)));
        assert.strictEqual(c.cursors.current,'default');resolve('');await pending;assert.strictEqual(c.cursors.current,'crosshair');
        await assert.rejects(c.chooseFileWithVisibleCursor(chooser(Promise.reject(Error('cancelled')))),/cancelled/);assert.strictEqual(c.cursors.current,'crosshair');
        console.log('PASS system cursor during sync/async dialogs, cancel/error restoration, nesting and unchanged-tool reapplication');
    }finally{pdg.gfx.getMouse=getMouse;c.destroy();pdg.gfx.closeGraphicsPort(port);}
})().then(()=>process.exit(0),error=>{console.error(error.stack);process.exit(1);});
