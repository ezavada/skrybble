// Run with PDG_EXECUTABLE=<current PDG 1.3 executable> ./skrybble tests/bones.js
require('pdg');
const assert=require('assert'),fs=require('fs');
const Drawing=require('../drawing'),Shapes=require('../shapes'),Tools=require('../tools');
const Controller=require('../DrawingController');
const near=(a,b)=>assert.ok(Math.abs(a-b)<.001,`${a} != ${b}`);
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack);}}
function drag(editor,start,end,edit=false){editor.begin(start,7,edit);editor.move(end);editor.finish(()=>{});}
test('native rig, arbitrary parent attachment, artwork Parts and local transforms',()=>{
    const d=new Drawing(),art=new Shapes.Rectangle(25,20,20,10);art.selected=true;d.addShape(art);
    drag(d.boneEditor,{x:20,y:20},{x:20,y:120});
    assert.strictEqual(art.rigBone,'root');assert.ok(d.boneEditor.sprite);
    assert.strictEqual(d.boneEditor.sprite.getPartCount(),2);
    const bounds=d.boneEditor.sprite.getPart(1).getContentBounds(1);
    near(bounds.left,art.getArtwork(1).getBounds().left);near(bounds.top,art.getArtwork(1).getBounds().top);
    art.selected=false;
    drag(d.boneEditor,{x:20,y:70},{x:70,y:70});
    const def=d.boneEditor.asset.getBoneDefinition('bone1');
    assert.strictEqual(def.parent,'root');near(def.x,50);near(def.y,0);near(def.rotation,-Math.PI/2);
    const copy=new Drawing();copy.boneEditor.restore(JSON.parse(JSON.stringify(d.boneEditor.snapshot())));
    near(copy.boneEditor.bones[1].root.y,70);near(copy.boneEditor.bones[1].tip.x,70);
    assert.strictEqual(copy.boneEditor.asset.getBoneCount(),2);
    drag(copy.boneEditor,{x:70,y:70},{x:90,y:80},true);
    near(copy.boneEditor.bones[1].tip.x,90);
    copy.boneEditor.selected='root';copy.boneEditor.deleteSelected(()=>{});
    assert.strictEqual(copy.boneEditor.bones.length,0);
});
test('renaming updates native hierarchy and artwork bindings and rejects duplicates',()=>{
    const d=new Drawing(),art=new Shapes.Rectangle(20,20,20,10);
    drag(d.boneEditor,{x:20,y:20},{x:120,y:20});
    art.selected=true;d.addShape(art);drag(d.boneEditor,{x:70,y:20},{x:70,y:80});
    let undo=0;d.boneEditor.rename('bone1','forearm',()=>undo++);
    assert.strictEqual(undo,1);assert.strictEqual(art.rigBone,'forearm');
    assert.strictEqual(d.boneEditor.asset.getBoneDefinition('forearm').parent,'root');
    assert.throws(()=>d.boneEditor.rename('forearm','root',()=>{}));
    assert.throws(()=>d.boneEditor.rename('forearm',' ',()=>{}));
    assert.strictEqual(d.boneEditor.rename('root','other',()=>{}),false);
});
test('grouping mixed bone artwork retains bindings, transforms and rename/delete behavior',()=>{
    const d=new Drawing(),a=new Shapes.Rectangle(20,30,10,10),b=new Shapes.Rectangle(80,40,10,10);
    d.addShape(a);d.addShape(b);a.selected=true;
    drag(d.boneEditor,{x:20,y:20},{x:120,y:20});
    b.selected=true;drag(d.boneEditor,{x:70,y:20},{x:70,y:90});
    const group=d.groupShapes([a,b]);group.x=10;group.y=20;
    let sprite=d.boneEditor.getSprite();assert.strictEqual(sprite.getPartCount(),4);
    const bounds=sprite.getPart(2).getContentBounds(1),original=a.getArtwork(1).getBounds();
    near(bounds.left,original.left+10);near(bounds.top,original.top+20);
    d.boneEditor.rename('bone1','arm',()=>{});assert.strictEqual(b.rigBone,'arm');
    d.boneEditor.deleteSelected(()=>{});assert.strictEqual(b.rigBone,undefined);
    assert.strictEqual(a.rigBone,'root');
});
test('tiny drag cancels without touching history or artwork',()=>{
    const d=new Drawing();let undo=0;
    d.boneEditor.begin({x:10,y:10},7);d.boneEditor.move({x:11,y:11});d.boneEditor.finish(()=>undo++);
    assert.strictEqual(undo,0);assert.strictEqual(d.boneEditor.asset,null);
});
const surface=pdg.gfx.createOffscreenPort(new pdg.Rect(900,700));
const c=new Controller({getEventManager:()=>pdg.evt},surface);
const filename='/tmp/skrybble-bone-roundtrip.skrbl';
try {
    test('controller gestures, undo/redo, native rig file round trip and overlay render',()=>{
        const shape=new Shapes.Rectangle(40,40,40,20);shape.selected=true;c.drawing.addShape(shape);
        c.toolManager.setTool(Tools.TOOLS.BONE);
        const event=p=>({mousePos:c.navigation.toView(p)});
        c.handleMouseDown(event({x:40,y:40}));c.handleMouseMove(event({x:100,y:40}));c.handleMouseUp(event({x:100,y:40}));
        assert.strictEqual(c.drawing.boneEditor.asset.getBoneCount(),1);
        c.undo();assert.strictEqual(c.drawing.boneEditor.asset,null);assert.strictEqual(c.drawing.getShapeCount(),1);
        c.redo();assert.strictEqual(c.drawing.boneEditor.asset.getBoneCount(),1);
        assert.strictEqual(c.drawing.getShapes()[0].rigBone,'root');
        c.currentFilename=filename;assert.strictEqual(c.saveFile(),true);
        const saved=JSON.parse(fs.readFileSync(filename,'utf8'));assert.ok(saved.rig.stream);
        c.drawing.clearShapes();assert.strictEqual(c.loadFile(filename),true);
        assert.strictEqual(c.drawing.boneEditor.getSprite().getPartCount(),2);
        c.backgroundView.drawSelf(surface,0);
        const before=c.drawing.boneEditor.snapshot();
        assert.throws(()=>c.drawing.boneEditor.restore({stream:'AAAA'}));
        assert.deepStrictEqual(c.drawing.boneEditor.snapshot(),before);
    });
    test('inline bone naming commits, cancels, validates and supports undo',()=>{
        c.commitTextEdit(true);c.drawing.clearShapes();c.undoStack=[];c.redoStack=[];
        const bones=c.drawing.boneEditor;
        drag(bones,{x:100,y:100},{x:200,y:100});drag(bones,{x:150,y:100},{x:150,y:200});
        c.beginBoneNameEdit();assert.strictEqual(c.textEdit.boneName,'bone1');
        c.textEdit.shape.text='arm';c.handleTextKey({unicode:13});
        assert.strictEqual(c.textEdit,null);assert.ok(bones.asset.getBoneNames().includes('arm'));
        c.undo();assert.ok(c.drawing.boneEditor.asset.getBoneNames().includes('bone1'));
        c.redo();assert.ok(c.drawing.boneEditor.asset.getBoneNames().includes('arm'));
        c.drawing.boneEditor.selected='arm';c.beginBoneNameEdit();c.textEdit.shape.text='root';
        c.handleTextKey({unicode:13});assert.ok(c.textEdit);assert.ok(c.drawing.boneEditor.asset.getBoneNames().includes('arm'));
        c.handleTextKey({unicode:27});assert.strictEqual(c.textEdit,null);
    });
    test('Help stays last even when tools are appended',()=>{
        Tools.TOOLS.TEST='test';
        try{assert.strictEqual(Tools.getToolList().at(-1),Tools.TOOLS.HELP);}finally{delete Tools.TOOLS.TEST;}
    });
} finally {c.destroy();pdg.gfx.closeGraphicsPort(surface);if(fs.existsSync(filename))fs.unlinkSync(filename);}
console.log(`${passed} passed, ${failed} failed`);process.exit(failed?1:0);
