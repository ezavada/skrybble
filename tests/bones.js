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
test('connected root drag solves only immediate parent and previews artwork without mutation',()=>{
    const d=new Drawing(),editor=d.boneEditor;
    drag(editor,{x:20,y:100},{x:120,y:100});
    drag(editor,{x:120,y:100},{x:220,y:100});
    const art=new Shapes.Rectangle(215,95,10,10);art.selected=true;d.addShape(art);
    drag(editor,{x:220,y:100},{x:270,y:100});
    const ancestor=JSON.stringify(editor.bones[0]),original=JSON.stringify(d.serializeShape(art));
    editor.begin({x:220,y:100},7,true);editor.move({x:120,y:300});
    const preview=editor.gesture.preview;
    assert.strictEqual(JSON.stringify(editor.bones[0]),ancestor);
    near(preview[1].root.x,120);near(preview[1].root.y,100);
    near(preview[1].tip.x,120);near(preview[1].tip.y,200);
    near(preview[2].root.x,120);near(preview[2].root.y,200);
    near(preview[2].tip.x,120);near(preview[2].tip.y,250);
    const displayed=editor.getShapesForDisplay()[0];near(displayed.getCenterPoint().x,120);near(displayed.getCenterPoint().y,200);
    assert.strictEqual(JSON.stringify(d.serializeShape(art)),original);
    let undo=0;editor.finish(()=>undo++);assert.strictEqual(undo,1);
    assert.strictEqual(JSON.stringify(editor.bones[0]),ancestor);
    near(art.getCenterPoint().x,120);near(art.getCenterPoint().y,200);near(art.rotation,Math.PI/2);
    near(editor.asset.getBoneDefinition('bone1').length,100);
    near(editor.asset.getBoneDefinition('bone2').length,50);
    const restored=new Drawing();restored.boneEditor.restore(editor.snapshot());
    near(restored.boneEditor.bones[2].root.y,200);
});
test('mid-bone attachment, siblings, parent-tip selection, zero-radius and cancellation',()=>{
    const d=new Drawing(),e=d.boneEditor;
    drag(e,{x:100,y:100},{x:200,y:100});
    drag(e,{x:150,y:100},{x:150,y:150});
    drag(e,{x:175,y:100},{x:175,y:50});
    drag(e,{x:150,y:100},{x:100,y:300},true);
    near(e.bones[0].tip.x,100);near(e.bones[0].tip.y,200);
    near(e.bones[1].root.x,100);near(e.bones[1].root.y,150);
    near(e.bones[2].root.x,100);near(e.bones[2].root.y,175);
    // The parent tip has no child endpoint on it, but still carries its attached children.
    drag(e,{x:100,y:200},{x:0,y:100},true);
    near(e.bones[0].tip.x,0);near(e.bones[1].root.x,50);
    const before=JSON.stringify(e.bones);
    e.begin({x:50,y:100},7,true);e.move({x:100,y:0});e.gesture=null;
    assert.strictEqual(JSON.stringify(e.bones),before);
    const z=new Drawing();drag(z.boneEditor,{x:20,y:20},{x:120,y:20});
    drag(z.boneEditor,{x:20,y:20},{x:20,y:80});
    const initial=JSON.stringify(z.boneEditor.bones);let undo=0;
    z.boneEditor.begin({x:20,y:20},7,true);z.boneEditor.move({x:80,y:80});z.boneEditor.finish(()=>undo++);
    assert.strictEqual(JSON.stringify(z.boneEditor.bones),initial);assert.strictEqual(undo,0);
});
test('IK keeps rotated mixed-binding group frames stable',()=>{
    const d=new Drawing(),e=d.boneEditor;
    const a=new Shapes.Rectangle(30,90,20,10),b=new Shapes.Rectangle(180,90,20,10);
    d.addShape(a);d.addShape(b);a.selected=true;drag(e,{x:20,y:100},{x:120,y:100});
    b.selected=true;drag(e,{x:120,y:100},{x:220,y:100});drag(e,{x:220,y:100},{x:270,y:100});
    const group=d.groupShapes([a,b]);group.x=15;group.y=10;group.rotation=.4;
    const center=rect=>({x:(rect.left+rect.right)/2,y:(rect.top+rect.bottom)/2});
    const sprite=e.getSprite(),fixed=center(sprite.getPart(3).getContentBounds(1)),moving=center(sprite.getPart(4).getContentBounds(1));
    drag(e,{x:220,y:100},{x:120,y:200},true);
    const next=e.getSprite(),fixedAfter=center(next.getPart(3).getContentBounds(1)),movingAfter=center(next.getPart(4).getContentBounds(1));
    near(fixedAfter.x,fixed.x);near(fixedAfter.y,fixed.y);
    near(movingAfter.x,120-(moving.y-100));near(movingAfter.y,100+(moving.x-120));
});
test('new bones at existing child starts share their parent and attachment point',()=>{
    const d=new Drawing(),e=d.boneEditor;
    drag(e,{x:100,y:100},{x:300,y:100});drag(e,{x:200,y:100},{x:200,y:200});
    drag(e,{x:202,y:102},{x:240,y:200});
    assert.strictEqual(e.bones[2].parent,'root');near(e.bones[2].root.x,200);near(e.bones[2].root.y,100);
    drag(e,{x:200,y:200},{x:240,y:240});assert.strictEqual(e.bones[3].parent,'bone1');
});
test('Shift slides child attachments on the parent without IK or sibling movement',()=>{
    const d=new Drawing(),e=d.boneEditor;
    drag(e,{x:100,y:100},{x:300,y:100});drag(e,{x:200,y:100},{x:200,y:180});
    drag(e,{x:200,y:180},{x:250,y:180});drag(e,{x:250,y:100},{x:250,y:60});
    const parent=JSON.stringify(e.bones[0]),sibling=JSON.stringify(e.bones[3]);
    e.begin({x:200,y:100},7,true,true);e.move({x:240,y:160},true);e.finish(()=>{});
    near(e.bones[1].root.x,240);near(e.bones[1].root.y,100);near(e.bones[1].tip.x,240);
    near(e.bones[2].root.x,240);near(e.bones[2].tip.x,290);
    assert.strictEqual(JSON.stringify(e.bones[0]),parent);assert.strictEqual(JSON.stringify(e.bones[3]),sibling);
    e.begin({x:240,y:100},7,true,true);e.move({x:500,y:50},true);e.finish(()=>{});near(e.bones[1].root.x,300);
    e.selected=null;const before=JSON.stringify(e.bones);let undo=0;
    e.begin({x:100,y:100},7,true,true);e.move({x:50,y:50},true);e.finish(()=>undo++);
    assert.strictEqual(JSON.stringify(e.bones),before);assert.strictEqual(undo,0);
});
test('Shift tip resizing carries descendants at their relative attachments without parent IK',()=>{
    const d=new Drawing(),e=d.boneEditor;
    drag(e,{x:20,y:100},{x:120,y:100});drag(e,{x:120,y:100},{x:220,y:100});
    drag(e,{x:170,y:100},{x:170,y:150});drag(e,{x:170,y:150},{x:200,y:150});
    const ancestor=JSON.stringify(e.bones[0]);
    e.begin({x:220,y:100},7,true,true);e.move({x:120,y:300},true);e.finish(()=>{});
    assert.strictEqual(JSON.stringify(e.bones[0]),ancestor);
    near(e.bones[1].tip.x,120);near(e.bones[1].tip.y,300);
    near(e.bones[2].root.x,120);near(e.bones[2].root.y,200);
    near(e.bones[2].tip.x,70);near(e.bones[2].tip.y,200);
    near(e.bones[3].root.x,70);near(e.bones[3].root.y,200);near(e.bones[3].tip.y,230);
    near(e.asset.getBoneDefinition('bone1').length,200);near(e.asset.getBoneDefinition('bone2').length,50);
    // At an overlapping tip/child start, the selected parent's tip can still be resized.
    const shared=new Drawing(),r=shared.boneEditor;
    drag(r,{x:20,y:20},{x:120,y:20});drag(r,{x:120,y:20},{x:120,y:80});r.selected='root';
    r.begin({x:120,y:20},7,true,true);assert.strictEqual(r.gesture.edit.end,'tip');
    r.move({x:220,y:20},true);r.finish(()=>{});near(r.bones[1].root.x,220);near(r.bones[1].tip.x,220);
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
    test('IK artwork and skeleton undo and redo as one operation',()=>{
        c.commitTextEdit(true);c.drawing.clearShapes();c.undoStack=[];c.redoStack=[];
        const art=new Shapes.Rectangle(195,95,10,10);c.drawing.addShape(art);art.selected=true;
        const e=c.drawing.boneEditor;drag(e,{x:100,y:100},{x:200,y:100});
        drag(e,{x:200,y:100},{x:250,y:100});
        e.begin({x:200,y:100},7,true);e.move({x:100,y:200});e.finish(action=>c.saveUndoState(action));
        near(art.getCenterPoint().x,100);near(art.getCenterPoint().y,200);
        assert.strictEqual(c.undoStack.length,1);c.undo();
        near(c.drawing.getShapes()[0].getCenterPoint().x,200);near(c.drawing.boneEditor.bones[1].root.x,200);
        c.redo();near(c.drawing.getShapes()[0].getCenterPoint().y,200);near(c.drawing.boneEditor.bones[1].root.y,200);
        c.backgroundView.drawSelf(surface,0);
    });
    test('controller Shift transitions recompute stationary bone previews and commit one undo',()=>{
        c.commitTextEdit(true);c.drawing.clearShapes();c.undoStack=[];c.redoStack=[];c.showHelp=false;
        c.toolManager.setTool('select');c.inputState={shift:true,pan:false};
        const e=c.drawing.boneEditor;drag(e,{x:100,y:100},{x:300,y:100});drag(e,{x:200,y:100},{x:200,y:180});
        const art=new Shapes.Rectangle(195,95,10,10);art.rigBone='bone1';c.drawing.addShape(art);
        const event=(x,y,shift)=>({mousePos:c.navigation.toView({x,y}),shift});
        c.handleMouseDown(event(200,100,true));c.handleMouseMove(event(250,130,true));
        near(e.gesture.preview[1].root.x,250);near(e.gesture.preview[1].root.y,100);
        near(e.getShapesForDisplay()[0].getCenterPoint().x,250);
        c.applyHeldInput({shift:false,pan:false});assert.ok(e.gesture.preview[0].tip.y>100);
        c.applyHeldInput({shift:true,pan:false});near(e.gesture.preview[0].tip.y,100);near(e.gesture.preview[1].root.x,250);
        c.handleMouseUp(event(250,130,true));assert.strictEqual(c.undoStack.length,1);near(e.bones[1].root.x,250);
        c.undo();near(c.drawing.boneEditor.bones[1].root.x,200);near(c.drawing.getShapes()[0].getCenterPoint().x,200);
        c.redo();near(c.drawing.boneEditor.bones[1].root.x,250);near(c.drawing.getShapes()[0].getCenterPoint().x,250);
        c.inputState={shift:false,pan:false};
    });
    test('Help stays last even when tools are appended',()=>{
        Tools.TOOLS.TEST='test';
        try{assert.strictEqual(Tools.getToolList().at(-1),Tools.TOOLS.HELP);}finally{delete Tools.TOOLS.TEST;}
    });
} finally {c.destroy();pdg.gfx.closeGraphicsPort(surface);if(fs.existsSync(filename))fs.unlinkSync(filename);}
console.log(`${passed} passed, ${failed} failed`);process.exit(failed?1:0);
