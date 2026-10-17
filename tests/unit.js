// Run with ./skrybble tests/unit.js (graphical PDG; no visible window required).
require('pdg');
const assert=require('assert');
const Shape=require('../shapes');
const Drawing=require('../drawing');
const CanvasNavigation=require('../CanvasNavigation');
const DrawingController=require('../DrawingController');
const WidthPicker=require('../LineWidthController');
const SmoothnessPicker=require('../SmoothnessController');
const ColorPicker=require('../ColorPickerController');
let passed=0,failed=0;
function test(name,fn) { try {fn();passed++;console.log('PASS '+name);} catch(e) {failed++;console.error('FAIL '+name+'\n'+e.stack);} }
const near=(a,b)=>assert.ok(Math.abs(a-b)<.001,`${a} != ${b}`);
const surface=pdg.gfx.createOffscreenPort(new pdg.Rect(900,700));
const controller=new DrawingController({getEventManager:()=>pdg.evt},surface);
// Exercise normalized PDG input, rather than duplicating platform keycode tables.
function inputKey(c,code,down,modifiers=0) {
    c.shortcuts.syncMode();
    pdg.getInputManager().feed({kind:'key',code,down,modifiers});
    return down?c.doKeyDown({keyCode:code}):c.doKeyUp({keyCode:code});
}
function pressShortcut(c,event) {
    const char=String.fromCharCode(event.unicode).toUpperCase();
    const code=event.code || ({27:'Escape',32:'Space',48:'Digit0',92:'Backslash',63:'Slash',
        28:'ArrowLeft',29:'ArrowRight',30:'ArrowUp',31:'ArrowDown',9:'Tab',127:'Delete',8:'Backspace',43:'Equal',61:'Equal',45:'Minus'}[event.unicode] || 'Key'+char);
    const mods=(event.shift?1:0)|(event.ctrl?2:0)|(event.alt?4:0)|(event.meta?8:0);
    const keys=[[event.shift,'ShiftLeft'],[event.ctrl,'ControlLeft'],[event.alt,'AltLeft'],[event.meta,'MetaLeft']].filter(([held])=>held).map(([,key])=>key);
    for(const key of keys)inputKey(c,key,true,mods);
    inputKey(c,code,true,mods);c.doKeyPress(event);inputKey(c,code,false,mods);
    for(const key of keys.reverse())inputKey(c,key,false,0);
}


test('camera round trips and pointer anchored zoom',()=> {
    const nav=new CanvasNavigation();nav.setViewport(new pdg.Rect(0,50,600,650));
    const point=new pdg.Point(330,360),world=nav.toWorld(point);
    const view=nav.toView(world);near(view.x,point.x);near(view.y,point.y);
    nav.zoomAt(2,point);const after=nav.toWorld(point);near(after.x,world.x);near(after.y,world.y);
});
test('page-edge zoom preserves focus through repeated zoom, viewport sync and limits',()=> {
    for(const edge of [{x:0,y:0},{x:1024,y:1024},{x:0,y:1024}]) {
        const nav=new CanvasNavigation(),area=new pdg.Rect(0,50,1200,1150);
        nav.setViewport(area);
        const screen=nav.toView(edge);
        for(const factor of [.5,.5,.5,2,2,2,2,2,2,2,.25]) {
            nav.zoomAt(factor,screen);nav.setViewport(area);
            const actual=nav.toView(edge);near(actual.x,screen.x);near(actual.y,screen.y);
        }
        assert.strictEqual(nav.contains({x:-1,y:512}),false);
        assert.strictEqual(nav.contains({x:1025,y:512}),false);
    }
});
test('all zoom inputs prioritize selected bounds, then cursor, then viewport center',()=> {
    const getMouse=pdg.gfx.getMouse;
    const original=controller.drawing;
    try {
        controller.drawing=new Drawing();
        const a=new Shape.Rectangle(50,100,80,40),b=new Shape.Rectangle(900,850,100,60);
        a.selected=b.selected=true;
        controller.drawing.addShape(a);controller.drawing.addShape(b);
        const focus={x:525,y:505},cursor=new pdg.Point(200,200);
        pdg.gfx.getMouse=()=>cursor;
        controller.navigation.reset();
        for(const zoom of [()=>controller.doScrollWheel({ctrl:true,vertDelta:-2,mousePos:cursor}),
            ()=>pressShortcut(controller,{unicode:122}),()=>pressShortcut(controller,{unicode:90,shift:true})]) {
            const before=controller.navigation.toView(focus);zoom();
            const after=controller.navigation.toView(focus);near(after.x,before.x);near(after.y,before.y);
        }
        a.selected=b.selected=false;
        const world=controller.navigation.toWorld(cursor);
        controller.doScrollWheel({meta:true,vertDelta:2,mousePos:cursor});
        const after=controller.navigation.toView(world);near(after.x,cursor.x);near(after.y,cursor.y);
        const center=controller.backgroundView.getViewArea().centerPoint();
        const anchor=controller.navigationAnchor(new pdg.Point(0,0));near(anchor.x,center.x);near(anchor.y,center.y);
    } finally {controller.drawing=original;pdg.gfx.getMouse=getMouse;controller.navigation.reset();}
});
test('camera drawing restores reusable attributes, including when rendering throws',()=> {
    const nav=new CanvasNavigation();nav.setViewport(new pdg.Rect(900,700));
    nav.zoomAt(2,new pdg.Point(450,350));nav.pan(40,-25);
    const transforms=[],attrs=new pdg.Attributes().translation(new pdg.Point(12,17));
    const original=attrs.getTransform();
    const port=require('../rendering').cameraPort({drawCircle:(point,radius,style)=>transforms.push(style.getTransform())},nav.camera);
    port.drawCircle(new pdg.Point(100,100),4,attrs);
    port.drawCircle(new pdg.Point(200,200),4,attrs);
    assert.deepStrictEqual(transforms[0],transforms[1]);
    assert.deepStrictEqual(attrs.getTransform(),original);
    const failing=require('../rendering').cameraPort({drawCircle:()=>{throw Error('render failed');}},nav.camera);
    assert.throws(()=>failing.drawCircle(new pdg.Point(100,100),4,attrs),/render failed/);
    assert.deepStrictEqual(attrs.getTransform(),original);
});
test('freehand handles align with every curve point through pan and zoom',()=> {
    const nav=new CanvasNavigation();nav.setViewport(new pdg.Rect(900,700));
    nav.zoomAt(1.5,new pdg.Point(450,350));nav.pan(30,-15);
    const samples=Array.from({length:30},(_,i)=>({x:350+i*8,y:400+Math.sin(i/4)*35}));
    const shape=new Shape.Spline([{...samples[0]},...samples,{...samples[samples.length-1]}]);
    const circles=[];
    const canvas=require('../rendering').cameraPort({drawCircle:(point,radius,attrs)=> {
        const m=attrs.getTransform();
        circles.push({x:m[0]*point.x+m[3]*point.y+m[6],y:m[1]*point.x+m[4]*point.y+m[7]});
    }},nav.camera);
    shape.drawEndpoints(canvas);shape.drawControlPoints(canvas);
    const handles=[...samples,samples[0],samples[samples.length-1]];
    handles.forEach((point,i)=> {
        const expected=nav.toView(point);
        for(const actual of circles.slice(i*2,i*2+2)) {near(actual.x,expected.x);near(actual.y,expected.y);}
    });
});
test('rendered freehand handles stay on the zoomed curve rather than drifting offscreen',()=> {
    const port=pdg.gfx.createOffscreenPort(new pdg.Rect(900,700));
    try {
        const nav=new CanvasNavigation();nav.setViewport(new pdg.Rect(900,700));
        nav.zoomAt(1.5,new pdg.Point(450,350));nav.pan(30,-15);
        const points=Array.from({length:30},(_,i)=>({x:350+i*8,y:400+Math.sin(i/4)*35}));
        const shape=new Shape.Spline([{...points[0]},...points,{...points[points.length-1]}]);
        shape.drawEndpoints(require('../rendering').cameraPort(port,nav.camera));
        const image=new pdg.Image(port);
        for(const point of points) {
            const expected=nav.toView(point),color=image.getPixel(Math.round(expected.x),Math.round(expected.y));
            assert.ok(color.alpha>.9 && color.red>.9 && color.green<.1,`Missing handle at ${expected.x},${expected.y}`);
        }
    } finally {pdg.gfx.closeGraphicsPort(port);}
});
test('pan and zoom stay bounded, reset centers document',()=> {
    const nav=new CanvasNavigation();nav.setViewport(new pdg.Rect(600,600));
    nav.pan(99999,-99999);let p=nav.camera.getLocation();near(p.x,-300);near(p.y,1324);
    nav.zoomAt(100,new pdg.Point(300,300));near(nav.camera.getZoom(),8);
    nav.zoomAt(.0001,new pdg.Point(300,300));near(nav.camera.getZoom(),.25);
    p=nav.camera.getLocation();assert.ok(p.x>=-1200 && p.x<=2224 && p.y>=-1200 && p.y<=2224);
    nav.reset();near(nav.camera.getZoom(),1);near(nav.camera.getLocation().x,512);near(nav.camera.getLocation().y,512);
});
test('desktop-sized windows pan through MVC capture even when the whole page fits',()=> {
    const port=pdg.gfx.createOffscreenPort(new pdg.Rect(1600,1200));
    const c=new DrawingController({getEventManager:()=>pdg.evt},port);
    try {
        for(const space of [false,true]) {
            c.navigation.reset();c.toolManager.setTool(space ? 'select' : 'pan');
            if(space)inputKey(c,'Space',true);
            c.onMouseDown({mousePos:new pdg.Point(800,550),lastClickElapsed:1000});
            c.onMouseMove({mousePos:new pdg.Point(900,650)});
            c.onMouseUp({mousePos:new pdg.Point(900,650)});
            near(c.navigation.camera.getLocation().x,412);near(c.navigation.camera.getLocation().y,412);
            assert.strictEqual(c.panPosition,null);assert.strictEqual(c.drawing.getShapeCount(),0);
            if(space)inputKey(c,'Space',false);
        }
        c.navigation.reset();
        c.drawing.addShape(new Shape.Rectangle(500,500,24,24,'red',null,0));
        c.backgroundView.drawSelf(port,0);
        const original=c.navigation.toView({x:512,y:512});
        assert.ok(new pdg.Image(port).getPixel(Math.round(original.x),Math.round(original.y)).green<.1);
        c.navigation.pan(100,100);port.clear();c.backgroundView.drawSelf(port,1);
        const moved=c.navigation.toView({x:512,y:512}),image=new pdg.Image(port);
        assert.ok(image.getPixel(Math.round(moved.x),Math.round(moved.y)).green<.1);
        assert.ok(image.getPixel(Math.round(original.x),Math.round(original.y)).green>.9);
        c.navigation.reset();c.navigation.zoomAt(.25,new pdg.Point(800,550));
        const before=c.navigation.camera.getLocation();c.navigation.pan(10,10);
        near(c.navigation.camera.getLocation().x,before.x-40);near(c.navigation.camera.getLocation().y,before.y-40);
    } finally {c.destroy();pdg.gfx.closeGraphicsPort(port);}
});
test('native wheel navigation works with a stale pointer outside the canvas',()=> {
    const getMouse=pdg.gfx.getMouse;
    try {
        pdg.gfx.getMouse=()=>new pdg.Point(0,0);
        controller.navigation.reset();controller.showHelp=false;
        assert.ok(controller.onScrollWheel({meta:true,vertDelta:-1,horizDelta:0}));
        assert.ok(controller.navigation.camera.getZoom()>1);
        near(controller.navigation.camera.getLocation().x,512);near(controller.navigation.camera.getLocation().y,512);
        const before=controller.navigation.camera.getZoom();
        assert.ok(controller.onScrollWheel({vertDelta:1,horizDelta:1}));
        assert.ok(controller.navigation.camera.getZoom()<before);
        controller.showHelp=true;const zoom=controller.navigation.camera.getZoom();
        assert.strictEqual(controller.onScrollWheel({ctrl:true,vertDelta:-1,horizDelta:0}),false);
        near(controller.navigation.camera.getZoom(),zoom);
    } finally {pdg.gfx.getMouse=getMouse;controller.showHelp=false;}
});
test('browser wheel bridge suppresses duplicate native wheel navigation',()=> {
    const bridge=controller.removeBrowserWheel;
    try {
        controller.removeBrowserWheel=()=>{};
        controller.navigation.reset();
        controller.onScrollWheel({ctrl:true,vertDelta:-1,mousePos:new pdg.Point(200,200)});
        controller.doScrollWheel({ctrl:true,vertDelta:-1});
        controller.doScrollWheel({vertDelta:1,horizDelta:1});
        near(controller.navigation.camera.getZoom(),1);
        near(controller.navigation.camera.getLocation().x,512);near(controller.navigation.camera.getLocation().y,512);
    } finally {controller.removeBrowserWheel=bridge;}
});
test('keyboard zoom works in both directions and reset restores the view',()=> {
    controller.navigation.reset();pressShortcut(controller,{unicode:122});near(controller.navigation.camera.getZoom(),1.25);
    pressShortcut(controller,{unicode:90,shift:true});near(controller.navigation.camera.getZoom(),1);
    controller.navigation.pan(20,20);pressShortcut(controller,{unicode:48,meta:true});
    near(controller.navigation.camera.getLocation().x,512);near(controller.navigation.camera.getZoom(),1);
});
test('group dragging retains artwork and child coordinates',()=> {
    const rect=new Shape.Rectangle(100,100,40,20,'red','black',1);
    const group=new Shape.Group([rect]);const art=group.getArtwork();
    group.moveBy(25,30);assert.strictEqual(group.getArtwork(),art);
    assert.strictEqual(rect.x,100);assert.ok(group.contains(130,140));assert.ok(!group.contains(105,105));
    near(art.getBounds().left,125);near(art.getBounds().top,130);
    rect.strokeColor='blue';assert.strictEqual(group.getArtwork(),art);
});
test('nested group moves survive serialization and ungroup',()=> {
    const model=new Drawing(),leaf=new Shape.Rectangle(10,20,40,30);
    const inner=new Shape.Group([leaf]);inner.moveBy(5,7);
    const outer=new Shape.Group([inner]);outer.moveBy(11,13);model.addShape(outer);
    const restored=model.deserializeShape('Group',model.serializeShape(outer));
    assert.ok(restored.contains(30,45));
    model.clearShapes();model.addShape(restored);model.ungroupShapes([restored]);
    const child=model.getShapes()[0];near(child.x,16);near(child.y,20);
    model.ungroupShapes([child]);near(model.getShapes()[0].x,26);near(model.getShapes()[0].y,40);
});
test('retained rotation updates bounds without rebuilding geometry',()=> {
    const rect=new Shape.Rectangle(100,100,40,20,'red');const group=new Shape.Group([rect]);
    group.getArtwork();rect.rotation=Math.PI/2;const b=group.getArtwork().getBounds();
    near(b.left,110);near(b.top,90);near(b.right,130);near(b.bottom,130);
});
test('text round trips through model and clipboard offsets',()=> {
    const text=new Shape.Text(12,34,'Hello 🌎','#123456',30,200,50);text.rotation=.3;
    const data=controller.drawing.serializeShape(text);const copy=controller.drawing.deserializeShape('Text',data);
    assert.strictEqual(copy.text,text.text);assert.strictEqual(copy.fontSize,30);near(copy.rotation,.3);
    controller.drawing.moveShape(copy,10,20);near(copy.x,22);near(copy.y,54);
    const art=copy.getArtwork();assert.ok(art.getBounds().width()>0);surface.drawDrawing(art,new pdg.Point(0,0),new pdg.Attributes());
});
test('text editing commits as one undo action, cancel and unicode backspace',()=> {
    controller.beginTextEdit(new Shape.Text(40,40,''),true);
    for(const char of ['H','i','🌎']) controller.handleTextKey({unicode:char.codePointAt(0)});
    controller.handleTextKey({unicode:8});assert.strictEqual(controller.textEdit.shape.text,'Hi');
    controller.handleTextKey({unicode:13});assert.strictEqual(controller.drawing.getShapes().length,1);
    controller.undo();assert.strictEqual(controller.drawing.getShapes().length,0);
    controller.redo();const text=controller.drawing.getShapes()[0];assert.strictEqual(text.text,'Hi');
    controller.beginTextEdit(text);controller.handleTextKey({unicode:33});controller.handleTextKey({unicode:27});
    assert.strictEqual(text.text,'Hi');
});
test('selection pulse and notification finish without wall-clock timers',()=> {
    const view=controller.backgroundView;view.startSelectionPulse();view.animate(.1);
    assert.ok(view.selectionAppearance.getLineOpacity()<1);view.stopSelectionPulse();
    controller.showSaveMessage('Saved');view.animate(1.75);
    assert.ok(view.notificationAppearance.getFillOpacity()<1);
    view.animate(.5);assert.strictEqual(controller.getSaveMessage(),null);
});
test('width popup uses captured release then clickable option',()=> {
    let accepted=null;
    const picker=new WidthPicker(controller,1,[],value=>accepted=value,()=>{},0);
    controller.lineWidthController=picker;
    const p=picker.popupRect;const event={mousePos:new pdg.Point(p.left+60,p.top+110),lastClickElapsed:1000};
    picker.onMouseDown(event);picker.onMouseUp(event);
    assert.strictEqual(accepted,2);controller.lineWidthController=null;
});
test('smoothness popup option accepts and outside release cancels',()=> {
    let accepted=null;
    const picker=new SmoothnessPicker(controller,2,[],value=>accepted=value,()=>{},0);
    controller.smoothnessController=picker;
    const p=picker.popupRect,event={mousePos:new pdg.Point(p.left+60,p.top+80),lastClickElapsed:1000};
    picker.onMouseDown(event);picker.onMouseUp(event);assert.strictEqual(accepted,1);
    controller.smoothnessController=null;
});
test('slider capture clamps outside pointer motion and changes one channel',()=> {
    const picker=new ColorPicker(controller,'black','fill',null,()=>{},()=>{},['#ff0000']);
    controller.colorPickerController=picker;
    const r=picker.redSlider.getViewArea(),down={mousePos:new pdg.Point(r.left+70,r.top+15),lastClickElapsed:1000};
    picker.onMouseDown(down);
    picker.onMouseMove({mousePos:new pdg.Point(r.right+100,r.top+15)});
    assert.strictEqual(picker.currentColor.r,1);assert.strictEqual(picker.currentColor.g,0);
    picker.onMouseUp({mousePos:new pdg.Point(r.right+100,r.top+15)});
    assert.strictEqual(picker.mousePress,null);picker.destroy();controller.colorPickerController=null;
});
test('toolbar caches 2x images for all tools and draws at 1x',()=> {
    const palette=controller.toolPaletteView;
    for(const tool of Object.values(require('../tools').TOOLS)) {
        const image=palette.getIcon(tool);assert.strictEqual(image.getWidth(),100);assert.strictEqual(image.getHeight(),100);
        assert.strictEqual(palette.getIcon(tool),image);
    }
    palette.drawSelf(surface);
});
test('canvas and retained help and notification render under zoom',()=> {
    controller.navigation.zoomAt(2,new pdg.Point(450,350));
    controller.backgroundView.drawSelf(surface,1);
    controller.showHelp=true;controller.drawViews(surface,2);
    const cached=controller.backgroundView._helpImage;controller.drawViews(surface,3);
    assert.strictEqual(controller.backgroundView._helpImage,cached);
    controller.showHelp=false;controller.showSaveMessage('Saved');controller.backgroundView.drawSelf(surface,4);
});
test('retained text updates its native element without replacing artwork',()=> {
    const text=new Shape.Text(20,20,'Before');const art=text.getArtwork();
    text.text='After';assert.strictEqual(text.getArtwork(),art);
    assert.strictEqual(text._elements[0].getText(),'After');
});
test('all vector shapes retain geometry through style and rotation changes',()=> {
    const shapes=[new Shape.Line(10,10,50,40),new Shape.Circle(50,50,20),
        new Shape.Oval(50,50,20,10),new Shape.Rectangle(10,10,40,30),
        new Shape.Polygon([{x:10,y:10},{x:50,y:10},{x:30,y:40}]),
        new Shape.Spline([{x:10,y:10},{x:10,y:10},{x:50,y:40},{x:50,y:40}]),
        new Shape.BezierSpline([{x:10,y:10},{x:50,y:40}])];
    for(const shape of shapes) {
        const art=shape.getArtwork();shape.strokeColor='blue';shape.rotation=.4;
        assert.strictEqual(shape.getArtwork(),art);shape.draw(surface);
        shape.selected=true;shape.draw(surface); // handles never enter retained document artwork
        const count=shape._geometry.getElementCount();shape.selected=false;shape.getArtwork();
        assert.strictEqual(shape._geometry.getElementCount(),count);
    }
});
test('endpoint changes replace geometry while group translations remain independent',()=> {
    const line=new Shape.Line(10,10,30,10),group=new Shape.Group([line]);
    group.moveBy(100,200);const before=group.getArtwork();line.x2=50;
    assert.notStrictEqual(group.getArtwork(),before);near(group.getBounds().right,150);
});
test('rendered group moves and recolors at the expected pixels',()=> {
    const p=pdg.gfx.createOffscreenPort(new pdg.Rect(100,100));
    try {
        const leaf=new Shape.Rectangle(10,10,20,20,'red',null,0),group=new Shape.Group([leaf]);
        group.moveBy(30,20);group.draw(p);
        let image=new pdg.Image(p);assert.ok(image.getPixel(45,35).red>.9);assert.ok(image.getPixel(15,15).alpha<.01);
        p.clear();group.fillColor='blue';group.draw(p);image=new pdg.Image(p);
        assert.ok(image.getPixel(45,35).blue>.9);assert.ok(image.getPixel(45,35).red<.01);
    } finally {pdg.gfx.closeGraphicsPort(p);}
});
test('text and translated groups save/load, with legacy documents accepted',()=> {
    const fs=require('fs'),file=require('path').join(require('os').tmpdir(),'skrybble-unit-document.skrbl');
    const model=new Drawing(),group=new Shape.Group([new Shape.Text(20,30,'Portable text')]);
    group.moveBy(17,19);model.addShape(group);
    const data=model.serializeShape(group);
    const legacy=model.deserializeDocument({fileFormat:'skrbl-v0.0.3',imageData:[],shapes:[{type:'Group',data}]});
    assert.strictEqual(legacy[0].children[0].text,'Portable text');
    controller.drawing=model;controller.currentFilename=file;
    try {
        assert.ok(controller.saveFile());const saved=JSON.parse(fs.readFileSync(file,'utf8'));
        assert.strictEqual(saved.fileFormat,'skrbl-v0.0.4');controller.drawing.clearShapes();
        assert.ok(controller.loadFile(file));const restored=controller.drawing.getShapes()[0];
        near(restored.x,17);near(restored.y,19);assert.strictEqual(restored.children[0].text,'Portable text');
    } finally {if(fs.existsSync(file))fs.unlinkSync(file);controller.currentFilename=null;}
});
test('normalized Space action releases without a KeyPress event',()=> {
    inputKey(controller,'Space',true);assert.ok(controller.spaceHeld);
    inputKey(controller,'Space',false);assert.ok(!controller.spaceHeld);
});
test('canvas gestures use world coordinates after zoom and pan',()=> {
    const Tools=require('../tools');controller.navigation.reset();
    controller.navigation.zoomAt(2,new pdg.Point(450,375));controller.toolManager.setTool(Tools.TOOLS.LINE);
    const start=controller.navigation.toView({x:300,y:300}),end=controller.navigation.toView({x:350,y:340});
    controller.handleMouseDown({mousePos:start});controller.handleMouseMove({mousePos:end});controller.handleMouseUp({mousePos:end});
    const line=controller.drawing.getShapes().at(-1);near(line.x,300);near(line.y,300);near(line.x2,350);near(line.y2,340);
});
test('outside document clicks cannot create shapes',()=> {
    controller.navigation.camera.setZoom(.25);controller.navigation.constrain();
    const start=controller.navigation.toView({x:-20,y:-20});
    controller.handleMouseDown({mousePos:start});assert.ok(!controller.toolManager.isCurrentlyDrawing());
});
test('outside popup release cancels without accepting',()=> {
    let accepted=false,cancelled=false;
    const picker=new SmoothnessPicker(controller,2,[],()=>accepted=true,()=>cancelled=true,0);
    controller.smoothnessController=picker;
    picker.onMouseDown({mousePos:new pdg.Point(60,130),lastClickElapsed:1000});
    picker.onMouseUp({mousePos:new pdg.Point(500,400)});
    assert.ok(cancelled);assert.ok(!accepted);controller.smoothnessController=null;
});
test('recent color swatches use local clickable parts',()=> {
    const picker=new ColorPicker(controller,'black','fill',null,()=>{},()=>{},['#ff0000']);
    controller.colorPickerController=picker;
    const r=picker.mainView.getViewArea();const event={mousePos:new pdg.Point(r.left+25,r.bottom-75),lastClickElapsed:1000};
    picker.onMouseDown(event);picker.onMouseUp(event);assert.strictEqual(picker.currentColor.r,1);
    picker.destroy();controller.colorPickerController=null;
});
test('toolbar hit regions remain aligned after resize',()=> {
    const palette=controller.toolPaletteView;palette.setViewArea(new pdg.Rect(0,0,540,50));
    const tools=Object.values(require('../tools').TOOLS),w=palette.slotWidth();
    tools.forEach((tool,i)=>assert.strictEqual(palette.getPartClicked(new pdg.Point((i+.5)*w,25)),i+1));
    palette.setViewArea(new pdg.Rect(0,0,900,50));
});
test('2x toolbar downsampling produces partial edge coverage',()=> {
    surface.clear();const palette=controller.toolPaletteView;
    surface.drawImage(palette.getIcon(require('../tools').TOOLS.CIRCLE),new pdg.Rect(0,0,50,50),new pdg.Attributes());
    const image=new pdg.Image(surface);let partial=0;
    for(let x=5;x<45;x++) for(let y=5;y<45;y++) {const a=image.getPixel(x,y).alpha;if(a>.01 && a<.99) partial++;}
    assert.ok(partial>10,`Expected antialiased edge pixels, got ${partial}`);
});
test('canvas rendering clips artwork to fixed page bounds',()=> {
    controller.backgroundView.animate(3);
    controller.navigation.camera.setZoom(.25);controller.navigation.constrain();
    controller.drawing.clearShapes();controller.drawing.addShape(new Shape.Rectangle(-500,-500,2024,2024,'red',null,0));
    surface.clear();controller.backgroundView.drawSelf(surface,10);const image=new pdg.Image(surface);
    const center=controller.navigation.toView({x:512,y:512});const edge=controller.navigation.toView({x:-30,y:512});
    assert.ok(image.getPixel(Math.round(center.x),Math.round(center.y)).red>.99);
    assert.ok(image.getPixel(Math.round(edge.x),Math.round(edge.y)).blue>.5);
});
test('wheel events route from canvas view to camera navigation',()=> {
    controller.navigation.reset();const before=controller.navigation.camera.getZoom();
    assert.ok(controller.backgroundView.doScrollWheel({ctrl:true,vertDelta:-1,horizDelta:0}));
    assert.ok(controller.navigation.camera.getZoom()>before);
});
test('duplicate preserves text/group semantics and adds the copy',()=> {
    const model=new Drawing(),text=new Shape.Text(10,20,'Duplicate');model.addShape(text);
    const copy=model.duplicateShape(text);assert.strictEqual(model.getShapeCount(),2);
    assert.strictEqual(copy.text,'Duplicate');near(copy.x,20);near(copy.y,30);
});
test('Escape cancels text, returns to Select, and leaves input usable',()=> {
    const Tools=require('../tools');controller.drawing.clearShapes();
    controller.toolManager.setTool(Tools.TOOLS.TEXT);
    controller.beginTextEdit(new Shape.Text(50,50,''),true);controller.handleTextKey({unicode:88});
    pressShortcut(controller,{unicode:27});assert.strictEqual(controller.textEdit,null);
    assert.strictEqual(controller.toolManager.getCurrentTool(),Tools.TOOLS.SELECT);
    assert.strictEqual(controller.drawing.getShapeCount(),0);assert.strictEqual(controller.selectedShape,null);
    controller.toolManager.setTool(Tools.TOOLS.LINE);
    const a=controller.navigation.toView({x:400,y:400}),b=controller.navigation.toView({x:450,y:450});
    controller.handleMouseDown({mousePos:a});controller.handleMouseMove({mousePos:b});controller.handleMouseUp({mousePos:b});
    assert.strictEqual(controller.drawing.getShapeCount(),1);
});
test('Escape from an incomplete polygon cancels; a triangle finishes and renders',()=> {
    const Tools=require('../tools');controller.drawing.clearShapes();
    const start=()=> {controller.toolManager.setTool(Tools.TOOLS.POLY);controller.toolManager.startDrawing(100,100);
        controller.toolManager.updateDrawing(200,100);controller.toolManager.addPointToShape(200,100);};
    start();pressShortcut(controller,{unicode:27});assert.strictEqual(controller.drawing.getShapeCount(),0);
    assert.strictEqual(controller.toolManager.getCurrentTool(),Tools.TOOLS.SELECT);
    start();controller.toolManager.updateDrawing(200,200);controller.toolManager.addPointToShape(200,200);
    pressShortcut(controller,{unicode:27});assert.strictEqual(controller.drawing.getShapeCount(),1);
    assert.strictEqual(controller.drawing.getShapes()[0].points.length,3);
    assert.ok(!controller.toolManager.isCurrentlyDrawing());controller.backgroundView.drawSelf(surface,100);
});
test('help uses a full-window cache independent of document zoom and clipping',()=> {
    const view=controller.backgroundView;controller.showHelp=true;controller.drawViews(surface,110);
    const image=view._helpImage;assert.strictEqual(image.getWidth(),900);assert.strictEqual(image.getHeight(),700);
    controller.navigation.camera.setZoom(3);controller.drawViews(surface,111);assert.strictEqual(view._helpImage,image);
    assert.ok(image.getPixel(1,1).alpha>.75); // includes the toolbar area, outside the canvas View
    const clip=surface.getClipRect();surface.setClipRect(new pdg.Rect(100,100,200,200));
    view.drawHelp(surface,surface.getDrawingArea());assert.strictEqual(surface.getClipRect().left,100);
    surface.setClipRect(clip);controller.showHelp=false;
});
test('help text fits each column with natural point-based text at smaller window sizes',()=> {
    for(const [width,height] of [[640,480],[900,700],[1200,900]]) {
        const calls=[];const port={drawRect:()=>{},getTextWidth:(...args)=>surface.getTextWidth(...args),
            drawText:(text,point,attrs)=>calls.push({text,point,size:attrs.getTextSize(),style:attrs.getTextStyle()})};
        controller.backgroundView.drawHelpOverlay(port,new pdg.Rect(width,height));
        for(const call of calls) {
            assert.ok(call.point.y>=0 && call.point.y<height,call.text);
            if(!(call.style & pdg.textStyle_Centered)) {
                const textWidth=surface.getTextWidth(call.text,call.size);
                assert.ok(call.point.x+textWidth<=width+1,call.text+' exceeds window');
            }
        }
    }
});
test('text starts compact, grows naturally, and its ink never fills the editing box',()=> {
    const text=new Shape.Text(40,40,'');text.layout(surface);const small=text.width,height=text.height;
    assert.ok(small<100);text.text='A';text.layout(surface);near(text.width,small);
    const ink=text.getArtwork().getBounds();near(ink.width(),text.measure(surface));assert.ok(ink.width()<text.width);
    text.text='A long line of text that expands the editor';text.layout(surface);
    assert.ok(text.width>small*2);near(text.height,height);near(text.getArtwork().getBounds().width(),text.measure(surface));
});
test('text caret inserts in the middle, arrows select, and delete preserves Unicode graphemes',()=> {
    controller.drawing.clearShapes();controller.beginTextEdit(new Shape.Text(50,50,'A🌎B'),true);
    controller.handleTextKey({unicode:28});controller.handleTextKey({unicode:88});
    assert.strictEqual(controller.textEdit.shape.text,'A🌎XB');
    controller.handleTextKey({unicode:28,shift:true});controller.handleTextKey({unicode:127});
    assert.strictEqual(controller.textEdit.shape.text,'A🌎B');
    controller.handleTextKey({unicode:8});assert.strictEqual(controller.textEdit.shape.text,'AB');
    controller.handleTextKey({unicode:2});controller.handleTextKey({unicode:127});
    assert.strictEqual(controller.textEdit.shape.text,'B');controller.commitTextEdit(true);
});
test('text editing undo and redo stay within the current text session',()=> {
    controller.beginTextEdit(new Shape.Text(50,50,'A'),true);
    controller.handleTextKey({unicode:66});controller.handleTextKey({unicode:90,meta:true});
    assert.strictEqual(controller.textEdit.shape.text,'A');
    controller.handleTextKey({unicode:90,meta:true,shift:true});assert.strictEqual(controller.textEdit.shape.text,'AB');
    controller.commitTextEdit(true);
});
test('text click and drag select characters without resetting edits; caret blinks',()=> {
    controller.beginTextEdit(new Shape.Text(50,50,'Hello'),true);
    const edit=controller.textEdit.editor;
    edit.positionAt({x:edit.shape.x+4+edit.getTextWidth('He'),y:edit.shape.y+5});near(edit.caretPos,2);
    edit.positionAt({x:edit.shape.x+4+edit.getTextWidth('Hell'),y:edit.shape.y+5},true);
    assert.strictEqual(edit.getSelectedText(),'ll');
    controller.handleTextKey({unicode:88});assert.strictEqual(edit.text,'HeXo');
    assert.ok(edit.mbShowCaret);edit.animate(.5);assert.ok(!edit.mbShowCaret);
    controller.handleTextKey({unicode:3});assert.ok(edit.mbShowCaret);near(edit.caretPos,edit.text.length);
    controller.commitTextEdit(true);
});
test('MVC editor uses PDG controls, Shift selection, and whole grapheme movement',()=> {
    controller.beginTextEdit(new Shape.Text(50,50,'e\u0301 👩‍💻 word'),true);
    const edit=controller.textEdit.editor;
    edit.doKeyPress({unicode:2});edit.doKeyPress({unicode:29});near(edit.caretPos,2);
    edit.doKeyPress({unicode:127});assert.strictEqual(edit.text,'e\u0301👩‍💻 word');
    edit.doKeyPress({unicode:29});near(edit.caretPos,'e\u0301👩‍💻'.length);
    edit.doKeyPress({unicode:65,ctrl:true});assert.strictEqual(edit.getSelectedText(),edit.text);
    edit.doKeyPress({unicode:90});assert.strictEqual(edit.text,'Z');controller.commitTextEdit(true);
});
test('font popup receives parent input and outside motion does not recurse',()=> {
    controller.openFontPicker(14);const picker=controller.fontPickerController,r=picker.popupRect;
    controller.onMouseMove({mousePos:new pdg.Point(r.left-10,r.top-10)});
    const point=new pdg.Point(r.left+30,r.top+80);
    controller.onMouseDown({mousePos:point,lastClickElapsed:1000});controller.onMouseUp({mousePos:point});
    assert.strictEqual(picker.value.fontName,'Times New Roman');
    controller.onMouseDown({mousePos:new pdg.Point(r.right+10,r.bottom+10),lastClickElapsed:1000});
    assert.strictEqual(controller.fontPickerController,null);
});
test('font picker previews, cancels, persists formatting, and accepts as one undo action',()=> {
    controller.drawing.clearShapes();const text=new Shape.Text(50,50,'Styled');controller.drawing.addShape(text);controller.selectShape(text);
    controller.openFontPicker(14);let picker=controller.fontPickerController;
    picker.doLeftClick({},picker.mainView,0,11);picker.doLeftClick({},picker.mainView,0,30);
    assert.strictEqual(text.fontName,'Times New Roman');assert.ok(text.textStyle & pdg.textStyle_Bold);
    picker.cancel();assert.strictEqual(text.fontName,'Arial');assert.strictEqual(text.textStyle,0);
    controller.openFontPicker(14);picker=controller.fontPickerController;
    picker.doLeftClick({},picker.mainView,0,12);picker.doLeftClick({},picker.mainView,0,24);picker.doLeftClick({},picker.mainView,0,31);picker.accept();
    const copy=controller.drawing.deserializeShape('Text',controller.drawing.serializeShape(text));
    assert.strictEqual(copy.fontName,'Courier New');near(copy.fontSize,48);assert.ok(copy.textStyle & pdg.textStyle_Italic);
    controller.undo();assert.strictEqual(controller.drawing.getShapes()[0].fontName,'Arial');controller.redo();
    assert.strictEqual(controller.drawing.getShapes()[0].fontName,'Courier New');
    controller.selectShape(null);controller.openFontPicker(14);picker=controller.fontPickerController;
    picker.doLeftClick({},picker.mainView,0,11);picker.accept();assert.strictEqual(controller.textDefaults.fontName,'Times New Roman');
});
test('rotation points at the mouse regardless of starting angle and snaps to 45 degrees',()=> {
    controller.navigation.reset();controller.toolManager.setTool('select');
    const shape=new Shape.Rectangle(400,400,80,40);shape.rotation=.7;controller.rotatingShape=shape;
    const center=shape.getCenterPoint(),point={x:center.x+100,y:center.y+30};
    controller.handleMouseMove({mousePos:controller.navigation.toView(point)});
    near(shape.rotation,Math.atan2(30,100)+Math.PI/2);assert.ok(shape._rotationGuideLength>=Math.hypot(100,30)-.001);
    controller.handleMouseMove({mousePos:controller.navigation.toView(point),shift:true});
    near(shape.rotation/(Math.PI/4),Math.round(shape.rotation/(Math.PI/4)));
    controller.handleMouseUp({mousePos:controller.navigation.toView(point)});assert.strictEqual(shape._rotationGuideLength,undefined);
});
test('rotation guide stretches toward the pointer and retains its minimum length',()=> {
    const shape=new Shape.Rectangle(10,10,80,40);shape.selected=true;shape.rotation=Math.PI/2;shape._rotationGuideLength=100;
    const lines=[],port={drawCircle(){},drawLine:(a,b)=>lines.push([a,b])};shape.drawRotationControl(port);
    const [a,b]=lines[0];near(b.x-a.x,100);near(b.y-a.y,0);
    lines.length=0;shape._rotationGuideLength=1;shape.drawRotationControl(port);
    near(lines[0][1].x-lines[0][0].x,shape.getRotationLineLength());
});
test('rotated groups render, hit test, serialize, and ungroup without changing child placement',()=> {
    const model=new Drawing(),child=new Shape.Rectangle(100,100,80,40,'red');const group=new Shape.Group([child]);
    group.moveBy(20,30);group.rotation=Math.PI/2;
    const bounds=group.getArtwork().getBounds();near(bounds.width(),40);near(bounds.height(),80);
    assert.ok(group.contains(160,170));assert.ok(!group.contains(130,140));
    const copy=model.deserializeShape('Group',model.serializeShape(group));near(copy.rotation,Math.PI/2);
    const before=copy.getArtwork().getBounds();model.addShape(copy);model.ungroupShapes([copy]);
    const after=model.getShapes()[0].getArtwork().getBounds();near(after.left,before.left);near(after.top,before.top);near(after.right,before.right);
});
test('Shift draws squares, circles, and straight lines',()=> {
    const Tools=require('../tools'),tools=new Tools(controller.drawing.getShapeClasses());
    tools.setTool('rect');tools.startDrawing(100,100);tools.updateDrawing(180,125,true);
    near(tools.currentShape.width,tools.currentShape.height);
    tools.setTool('oval');tools.startDrawing(100,100);tools.updateDrawing(120,180,true);
    near(tools.currentShape.radiusX,tools.currentShape.radiusY);
    tools.setTool('line');tools.startDrawing(100,100);tools.updateDrawing(180,110,true);near(tools.currentShape.y2,100);
});
test('Shift movement chooses the dominant axis with slop and restores free movement',()=> {
    const shape=new Shape.Rectangle(100,100,30,20);controller.draggedShapes=[shape];
    controller.shapeDragLastPosition={x:100,y:100};controller.shapeDragOrigin={x:100,y:100};controller._moveConstraint={};
    controller.updateDraggedShapes(120,119,true);near(shape.x,120);near(shape.y,100);
    controller.updateDraggedShapes(120,122,true);near(shape.x,120);near(shape.y,100);
    controller.updateDraggedShapes(120,150,true);near(shape.x,100);near(shape.y,150);
    controller.updateDraggedShapes(125,155,false);near(shape.x,125);near(shape.y,155);controller.draggedShapes=null;
});
test('Shift endpoint resizing keeps rectangles square and ovals circular',()=> {
    const rect=new Shape.Rectangle(100,100,40,20);controller.draggedPoint={shape:rect,type:'endpoint',index:2};
    controller.updateDraggedPoint(200,130,true);near(Math.abs(rect.width),Math.abs(rect.height));
    const oval=new Shape.Oval(100,100,30,20);controller.draggedPoint={shape:oval,type:'endpoint',index:1};
    controller.updateDraggedPoint(150,100,true);near(oval.radiusX,oval.radiusY);controller.draggedPoint=null;
});
test('Illustrator tool keys select tools and shifted keys resolve without collisions',()=> {
    controller.commitTextEdit(true);
    for(const [unicode,shift,tool] of [[86,false,'select'],[72,false,'pan'],[92,false,'line'],[78,false,'freehand'],
        [80,false,'bezier'],[80,true,'poly'],[76,false,'oval'],[76,true,'circle'],[77,false,'rect'],[84,false,'text']]) {
        pressShortcut(controller,{unicode,shift});assert.strictEqual(controller.toolManager.currentTool,tool);
    }
    controller.toolManager.setTool('select');
});

test('selected polygon and curve handles keep screen radii, positions and outline widths at all zooms',()=> {
    const nav=new CanvasNavigation();nav.setViewport(new pdg.Rect(900,700));
    const shapes=[new Shape.Polygon([{x:400,y:400},{x:500,y:420},{x:450,y:500}]),
        new Shape.Spline([{x:350,y:400},{x:400,y:400},{x:500,y:420},{x:550,y:420}]),
        new Shape.BezierSpline([{x:400,y:400},{x:500,y:420}])];
    for(const shape of shapes) {
        shape.selected=true;let baseline;
        for(const zoom of [.25,1,2,8]) {
            nav.camera.setZoom(zoom);const circles=[];
            const port=require('../rendering').cameraPort({drawDrawing(){},drawLine(){},
                drawCircle:(point,radius,attrs)=>circles.push({point,radius,width:attrs.getLineThickness(),transform:attrs.getTransform()})},nav.camera);
            shape.draw(port);
            const sizes=circles.map(c=>[c.radius,c.width]);
            if(!baseline)baseline=sizes;else assert.deepStrictEqual(sizes,baseline);
            const first=nav.toView(shape.getEndpoints()[0]);near(circles[0].point.x,first.x);near(circles[0].point.y,first.y);
            circles.forEach(c=>assert.deepStrictEqual(c.transform,[1,0,0,0,1,0,0,0,1]));
        }
    }
});
test('zoomed retained recording restores shared stroke attributes between segments',()=> {
    const drawing=pdg.createDrawing(),attrs=new pdg.Attributes().lineThickness(4);
    const recorder=require('../rendering').drawingPort(drawing,null,8);
    for(let y=0;y<2;y++)recorder.drawLine(new pdg.Point(0,y),new pdg.Point(10,y),attrs);
    near(attrs.getLineThickness(),4);
    recorder.refs.forEach(element=>near(element.getAttributes().getLineThickness(),32));
});
test('retained artwork strokes scale with zoom, including nested groups, without rebuilding geometry',()=> {
    const port=pdg.gfx.createOffscreenPort(new pdg.Rect(900,700));
    try {
        const nav=new CanvasNavigation();nav.setViewport(new pdg.Rect(900,700));
        nav.camera.setLocation(512,512);
        const line=new Shape.Line(400,500,600,500,'black',8);
        const group=new Shape.Group([new Shape.Group([line])]);let artwork;
        for(const zoom of [.25,1,2,8]) {
            nav.camera.setZoom(zoom);port.clear();
            group.draw(require('../rendering').cameraPort(port,nav.camera));
            if(!artwork)artwork=group._artwork;else assert.strictEqual(group._artwork,artwork);
            const point=nav.toView({x:512,y:500}),image=new pdg.Image(port);let pixels=0;
            for(let y=Math.round(point.y)-40;y<=Math.round(point.y)+40;y++)
                if(image.getPixel(Math.round(point.x),y).alpha>.5)pixels++;
            assert.ok(Math.abs(pixels-8*zoom)<=2,`Zoom ${zoom}: expected ${8*zoom}px stroke, got ${pixels}`);
        }
        near(line.strokeWidth,8);
    } finally {pdg.gfx.closeGraphicsPort(port);}
});
test('handle hit areas remain six screen pixels through zoom',()=> {
    const port=pdg.gfx.createOffscreenPort(new pdg.Rect(900,700)),c=new DrawingController({getEventManager:()=>pdg.evt},port);
    try {
        const line=new Shape.Line(400,400,600,500);line.selected=true;c.drawing.addShape(line);
        for(const zoom of [.25,1,8]) {
            c.navigation.camera.setZoom(zoom);line.selected=true;
            c.handleSelectMode(400+5/zoom,400,{});assert.ok(c.draggedPoint);c.draggedPoint=null;
            c.handleSelectMode(400+8/zoom,400,{});assert.strictEqual(c.draggedPoint,null);
            c.draggedShapes=null;c.rotatingShape=null;
        }
    } finally {c.destroy();pdg.gfx.closeGraphicsPort(port);}
});
test('stationary Shift press and release immediately constrain drawing, movement, rotation, and points',()=> {
    const port=pdg.gfx.createOffscreenPort(new pdg.Rect(900,700)),c=new DrawingController({getEventManager:()=>pdg.evt},port);
    const down=()=>inputKey(c,'ShiftLeft',true,1);
    const up=()=>inputKey(c,'ShiftLeft',false);
    const move=(x,y)=>c.handleMouseMove({mousePos:c.navigation.toView({x,y})});
    try {
        c.toolManager.setTool('rect');
        c.handleMouseDown({mousePos:c.navigation.toView({x:400,y:400})});move(460,430);
        const rect=c.toolManager.currentShape;near(rect.width,60);near(rect.height,30);
        down();near(rect.width,60);near(rect.height,60);up();near(rect.height,30);
        c.handleMouseUp({mousePos:c.navigation.toView({x:460,y:430})});c.toolManager.setTool('select');
        c.draggedShapes=[rect];c.shapeDragLastPosition={x:400,y:400};c.shapeDragOrigin={x:400,y:400};c._moveConstraint={};
        move(420,410);near(rect.x,420);near(rect.y,410);
        down();near(rect.x,420);near(rect.y,400);up();near(rect.y,410);c.draggedShapes=null;
        c.rotatingShape=rect;const center=rect.getCenterPoint();move(center.x+80,center.y+30);
        const angle=rect.rotation;down();near(rect.rotation,Math.round(angle/(Math.PI/4))*Math.PI/4);
        up();near(rect.rotation,angle);c.rotatingShape=null;
        const oval=new Shape.Oval(400,400,30,20);
        c.draggedPoint={shape:oval,type:'endpoint',index:1};c._pointDragGeometry=null;
        move(460,400);near(oval.radiusX,60);near(oval.radiusY,20);
        down();near(oval.radiusX,60);near(oval.radiusY,60);up();near(oval.radiusY,20);c.draggedPoint=null;
        const polygon=new Shape.Polygon([{x:400,y:400},{x:500,y:400},{x:500,y:500}]);
        c.draggedPoint={shape:polygon,type:'endpoint',index:0};c._pointDragGeometry=null;
        c._pointDragOrigin={x:400,y:400};c._pointConstraint={};move(420,410);
        down();near(polygon.points[0].x,420);near(polygon.points[0].y,400);
        up();near(polygon.points[0].y,410);
    } finally {c.destroy();pdg.gfx.closeGraphicsPort(port);}
});

test('text font, size, style and content changes preserve the world and screen pivot',()=> {
    const text=new Shape.Text(350,350,'Pivot'),nav=new CanvasNavigation();
    text.layout(surface);const center=text.getCenterPoint();
    nav.setViewport(new pdg.Rect(900,700));nav.zoomAt(3,new pdg.Point(350,300));nav.pan(20,10);
    const screen=nav.toView(center);
    for(const rotation of [0,.4,Math.PI/2])for(const font of ['Arial','Times New Roman','Courier New'])
        for(const size of [12,24,72])for(const style of [0,pdg.textStyle_Bold,pdg.textStyle_Italic]) {
            text.rotation=rotation;text.fontName=font;text.fontSize=size;text.textStyle=style;
            text.text=size===12?'Short':'A much longer line of styled text';text.layout(surface);text.getArtwork();
            const actual=text.getCenterPoint(),view=nav.toView(actual);
            near(actual.x,center.x);near(actual.y,center.y);near(view.x,screen.x);near(view.y,screen.y);
            const transform=text._appearance.getTransform();
            near(transform[0]*center.x+transform[3]*center.y+transform[6],center.x);
            near(transform[1]*center.x+transform[4]*center.y+transform[7],center.y);
        }
});
test('text moves normally and retains its new center through resizing and save/load',()=> {
    const text=new Shape.Text(100,120,'Move me');text.layout(surface);const center=text.getCenterPoint();
    controller.drawing.moveShape(text,50,-20);text.fontSize=48;text.layout(surface);
    near(text.getCenterPoint().x,center.x+50);near(text.getCenterPoint().y,center.y-20);
    const copy=controller.drawing.deserializeShape('Text',controller.drawing.serializeShape(text));copy.layout(surface);
    near(copy.getCenterPoint().x,center.x+50);near(copy.getCenterPoint().y,center.y-20);
});
test('rotated text font preview, cancel, accept, undo and redo keep the same center',()=> {
    controller.drawing.clearShapes();
    const text=new Shape.Text(300,300,'Stable pivot');text.rotation=.7;text.layout(surface);
    controller.drawing.addShape(text);controller.selectShape(text);const center=text.getCenterPoint();
    const check=shape=>{shape.layout(surface);shape.getArtwork();near(shape.getCenterPoint().x,center.x);near(shape.getCenterPoint().y,center.y);near(shape.rotation,.7);};
    controller.openFontPicker(14);let picker=controller.fontPickerController;
    picker.doLeftClick({},picker.mainView,0,12);picker.doLeftClick({},picker.mainView,0,25);picker.doLeftClick({},picker.mainView,0,30);check(text);
    picker.cancel();check(text);assert.strictEqual(text.fontName,'Arial');near(text.fontSize,24);
    controller.openFontPicker(14);picker=controller.fontPickerController;
    picker.doLeftClick({},picker.mainView,0,11);picker.doLeftClick({},picker.mainView,0,24);picker.accept();check(text);
    controller.undo();check(controller.drawing.getShapes()[0]);controller.redo();check(controller.drawing.getShapes()[0]);
});
test('text editing and editing undo/redo grow and shrink around a fixed center',()=> {
    controller.beginTextEdit(new Shape.Text(100,100,'A'),true);const text=controller.textEdit.shape,center=text.getCenterPoint();
    const check=()=>{near(text.getCenterPoint().x,center.x);near(text.getCenterPoint().y,center.y);};
    for(const char of ' fairly long appended sentence'){controller.handleTextKey({unicode:char.codePointAt(0)});check();}
    controller.handleTextKey({unicode:90,meta:true});check();controller.handleTextKey({unicode:90,meta:true,shift:true});check();
    controller.commitTextEdit(true);check();
});

test('unmodified wheel zooms and magnifier clicks zoom both ways without creating shapes',()=> {
    controller.drawing.clearShapes();controller.navigation.reset();
    controller.doScrollWheel({vertDelta:-2,mousePos:new pdg.Point(450,350)});
    assert.ok(controller.navigation.camera.getZoom()>1);
    controller.doScrollWheel({vertDelta:2,mousePos:new pdg.Point(450,350)});near(controller.navigation.camera.getZoom(),1);
    controller.toolManager.setTool('zoom');
    controller.handleMouseDown({mousePos:new pdg.Point(450,350)});near(controller.navigation.camera.getZoom(),1.25);
    controller.handleMouseDown({mousePos:new pdg.Point(450,350),shift:true});near(controller.navigation.camera.getZoom(),1);
    controller.handleMouseDown({mousePos:new pdg.Point(450,350),alt:true});near(controller.navigation.camera.getZoom(),.8);
    assert.strictEqual(controller.drawing.getShapeCount(),0);assert.ok(!controller.toolManager.isCurrentlyDrawing());
    controller.navigation.reset();controller.toolManager.setTool('select');
});
test('canvas cursors reflect text, shape, zoom, toolbar, popup, and pan actions',()=> {
    controller.navigation.reset();controller.drawing.clearShapes();controller.showHelp=false;
    const point=controller.navigation.toView({x:450,y:450});
    for(const tool of ['line','freehand','spline','bezier','circle','oval','rect','quad','poly','image']) {
        controller.toolManager.setTool(tool);assert.strictEqual(controller.updateCursor({mousePos:point}),'crosshair');
    }
    controller.toolManager.setTool('text');assert.strictEqual(controller.updateCursor(),'text');
    controller.toolManager.setTool('zoom');assert.strictEqual(controller.updateCursor({shift:false,alt:false}),'zoom-in');
    assert.strictEqual(controller.updateCursor({shift:true}),'zoom-out');
    assert.strictEqual(controller.updateCursor({mousePos:new pdg.Point(10,10)}),'default');
    controller.toolManager.setTool('select');const text=new Shape.Text(450,450,'Edit');text.layout(surface);controller.drawing.addShape(text);
    assert.strictEqual(controller.updateCursor({mousePos:controller.navigation.toView(text.getCenterPoint()),shift:false}),'text');
    controller.toolManager.setTool('pan');assert.strictEqual(controller.updateCursor(),'grab');
    controller.panPosition={x:0,y:0};assert.strictEqual(controller.updateCursor(),'grabbing');controller.panPosition=null;
    controller.showHelp=true;assert.strictEqual(controller.updateCursor(),'default');controller.showHelp=false;
    controller.toolManager.setTool('select');controller.drawing.clearShapes();controller.updateCursor();
});

test('Pen uses P and its hover label says Pen',()=> {
    const Tools=require('../tools'),view=controller.toolPaletteView;
    assert.strictEqual(Tools.TOOL_SHORTCUTS.P,Tools.TOOLS.BEZIER);assert.strictEqual(Tools.TOOL_NAMES.bezier,'Pen');
    const index=Object.values(Tools.TOOLS).indexOf(Tools.TOOLS.BEZIER),r=view.getViewArea();
    view.updateHover(new pdg.Point(r.left+(index+.5)*view.slotWidth(),r.top+20));view.hoverStarted=Date.now()-400;
    const labels=[];view.drawHover({getTextWidth:()=>45,drawRoundedRect(){},drawText:text=>labels.push(text)});
    assert.deepStrictEqual(labels,['Pen (P)']);view.updateHover(null);
});

test('magnifier zooms out once for right, Shift, Option and Control clicks through MVC capture',()=> {
    controller.drawing.clearShapes();controller.toolManager.setTool('zoom');
    for(const flags of [{rightButton:true,buttonNumber:1},{shift:true},{alt:true},{ctrl:true}]) {
        controller.navigation.reset();const point=new pdg.Point(450,350);
        controller.onMouseDown({mousePos:point,lastClickElapsed:1000,...flags});
        controller.onMouseUp({mousePos:point,...flags});near(controller.navigation.camera.getZoom(),.8);
        assert.strictEqual(controller.drawing.getShapeCount(),0);
    }
    const text=new Shape.Text(420,330,'Zoom over text');text.layout(surface);text.selected=true;controller.drawing.addShape(text);
    controller.navigation.reset();const textPoint=controller.navigation.toView(text.getCenterPoint());
    controller.onMouseDown({mousePos:textPoint,lastClickElapsed:1000,rightButton:true,buttonNumber:1});
    controller.onMouseUp({mousePos:textPoint,rightButton:true,buttonNumber:1});near(controller.navigation.camera.getZoom(),.8);
    assert.strictEqual(controller.textEdit,null);controller.drawing.clearShapes();
    for(const key of ['ShiftLeft','AltLeft','ControlLeft']) {
        controller.navigation.reset();inputKey(controller,key,true);
        assert.strictEqual(controller.updateCursor({mousePos:new pdg.Point(450,350)}),'zoom-out');
        controller.onMouseDown({mousePos:new pdg.Point(450,350),lastClickElapsed:1000});
        controller.onMouseUp({mousePos:new pdg.Point(450,350)});near(controller.navigation.camera.getZoom(),.8);
        inputKey(controller,key,false);
        assert.strictEqual(controller.updateCursor({shift:false,alt:false,ctrl:false,rightButton:false}),'zoom-in');
    }
    controller.navigation.reset();controller.toolManager.setTool('select');controller.updateCursor();
});
test('pan cursors are filled, antialiased and have distinct open and closed silhouettes',()=> {
    const Cursors=require('../ToolCursors'),cursors=new Cursors(surface);
    const open=cursors.createHand(false),closed=cursors.createHand(true);let fill=0,partial=0,different=0;
    for(let y=0;y<32;y++)for(let x=0;x<32;x++) {
        const a=open.image.getPixel(x,y),b=closed.image.getPixel(x,y);
        if(a.alpha>.9 && a.red>.9)fill++;
        if(a.alpha>.01 && a.alpha<.99)partial++;
        if(Math.abs(a.alpha-b.alpha)>.1)different++;
    }
    assert.ok(fill>120);assert.ok(partial>20);assert.ok(different>30);
});

test('toolbar switches immediately through every popup, Help, and repeated clicks',()=> {
    const port=pdg.gfx.createOffscreenPort(new pdg.Rect(900,700)),c=new DrawingController({getEventManager:()=>pdg.evt},port);
    const Tools=require('../tools'),palette=c.toolPaletteView;
    const point=tool=>new pdg.Point((Object.values(Tools.TOOLS).indexOf(tool)+.5)*palette.slotWidth(),25);
    const click=tool=>{const mousePos=point(tool);c.onMouseDown({mousePos,lastClickElapsed:10});
        assert.strictEqual(palette.pressedTool,tool);c.onMouseUp({mousePos});assert.strictEqual(palette.pressedTool,null);};
    try {
        for(const open of [()=>c.openFontPicker(14),()=>c.openColorPicker(Tools.TOOLS.FILL_COLOR),
            ()=>c.openLineWidthPicker(17),()=>c.openSmoothnessPicker(18)]) {
            open();assert.ok(c.activePicker());click('pan');assert.strictEqual(c.activePicker(),null);assert.strictEqual(c.toolManager.currentTool,'pan');
        }
        c.showHelp=true;click('rect');assert.strictEqual(c.showHelp,false);assert.strictEqual(c.toolManager.currentTool,'rect');
        for(let i=0;i<3;i++){click('bezier');assert.strictEqual(c.toolManager.currentTool,'bezier');}
        click('font');assert.ok(c.fontPickerController);click('linewidth');assert.ok(c.lineWidthController);assert.strictEqual(c.fontPickerController,null);
    } finally {c.destroy();pdg.gfx.closeGraphicsPort(port);}
});
test('toolbar interrupts canvas capture and preserves a completed polygon or text edit',()=> {
    const port=pdg.gfx.createOffscreenPort(new pdg.Rect(900,700)),c=new DrawingController({getEventManager:()=>pdg.evt},port);
    const palette=c.toolPaletteView,Tools=require('../tools');
    const click=tool=>{const mousePos=new pdg.Point((Object.values(Tools.TOOLS).indexOf(tool)+.5)*palette.slotWidth(),25);
        c.onMouseDown({mousePos,lastClickElapsed:10});c.onMouseUp({mousePos});};
    try {
        c.toolManager.setTool('rect');c.onMouseDown({mousePos:c.navigation.toView({x:400,y:400}),lastClickElapsed:1000});
        assert.ok(c.mousePress);click('pan');assert.strictEqual(c.mousePress,null);assert.strictEqual(c.toolManager.currentTool,'pan');
        assert.ok(!c.toolManager.isCurrentlyDrawing());assert.strictEqual(c.panPosition,null);
        c.beginTextEdit(new Shape.Text(400,400,'Keep me'),true);click('bezier');assert.strictEqual(c.textEdit,null);
        assert.ok(c.drawing.getShapes().some(shape=>shape.text==='Keep me'));
        c.toolManager.setTool('poly');c.toolManager.startDrawing(400,400);
        c.toolManager.updateDrawing(500,400);c.toolManager.addPointToShape(500,400);c.toolManager.updateDrawing(500,500);c.toolManager.addPointToShape(500,500);
        click('select');assert.ok(c.drawing.getShapes().some(shape=>shape.constructor.name==='Polygon'));
        assert.strictEqual(c.toolManager.currentTool,'select');assert.ok(!c.toolManager.isCurrentlyDrawing());
    } finally {c.destroy();pdg.gfx.closeGraphicsPort(port);}
});
test('toolbar hover and press produce distinct rendered backgrounds and release outside clears press',()=> {
    const palette=controller.toolPaletteView,Tools=require('../tools'),r=palette.getViewArea();
    const point=new pdg.Point((Object.values(Tools.TOOLS).indexOf('bezier')+.5)*palette.slotWidth(),25);
    const colors=()=>{const fills=[];palette.drawSelf({drawRect(){},drawImage(){},drawText(){},
        drawRoundedRect:(rect,radius,attrs)=>fills.push(attrs.getFillColor().toString())});return fills;};
    controller.toolManager.setTool('select');palette.updateToolSelection('select');palette.updateHover(null);const normal=colors();
    controller.onMouseMove({mousePos:point});const hover=colors();assert.notDeepStrictEqual(hover,normal);
    controller.onMouseDown({mousePos:point,lastClickElapsed:10});const press=colors();assert.notDeepStrictEqual(press,hover);
    controller.onMouseUp({mousePos:new pdg.Point(r.right+10,r.bottom+10)});assert.strictEqual(palette.pressedTool,null);
    assert.ok(!palette.hoverTool);controller.toolManager.setTool('select');controller.updateToolSelection('select');
});

function withInputController(fn) {
    const port=pdg.gfx.createOffscreenPort(new pdg.Rect(900,700));
    const c=new DrawingController({getEventManager:()=>pdg.evt},port);
    try {fn(c);} finally {c.destroy();pdg.getInputManager().feed({kind:'focusLost'});pdg.gfx.closeGraphicsPort(port);}
}
test('input actions give command chords precedence and consume the matching Unicode event once',()=>withInputController(c=> {
    const calls=[];
    c.pasteShapes=()=>calls.push('paste');c.redo=()=>calls.push('redo');c.saveAs=()=>calls.push('saveAs');
    pressShortcut(c,{unicode:86,ctrl:true});assert.strictEqual(c.toolManager.currentTool,'select');
    pressShortcut(c,{unicode:90,meta:true,shift:true});pressShortcut(c,{unicode:83,ctrl:true,shift:true});
    assert.deepStrictEqual(calls,['paste','redo','saveAs']);
    near(c.navigation.camera.getZoom(),1);
}));
test('action-held keys aggregate both sides and focus loss clears pan and cursor state',()=>withInputController(c=> {
    inputKey(c,'ShiftLeft',true,1);inputKey(c,'ShiftRight',true,1);inputKey(c,'ShiftLeft',false,1);
    assert.ok(c.inputState.shift);inputKey(c,'ShiftRight',false);assert.ok(!c.inputState.shift);
    inputKey(c,'Space',true);c.panPosition={x:200,y:200};
    assert.ok(c.spaceHeld);pdg.getInputManager().feed({kind:'focusLost'});c.shortcuts.poll();
    assert.ok(!c.spaceHeld);assert.strictEqual(c.panPosition,null);
    assert.ok(!c.inputState.shift && !c.inputState.alt && !c.inputState.control);
    inputKey(c,'Space',false);inputKey(c,'Space',true);assert.ok(c.spaceHeld);inputKey(c,'Space',false);
}));
test('text context preserves Unicode and Space without activating canvas shortcuts',()=>withInputController(c=> {
    const shape=new Shape.Text(100,100,'x');c.beginTextEdit(shape,true);
    inputKey(c,'Space',true);c.doKeyPress({unicode:32});assert.ok(!c.spaceHeld);
    pressShortcut(c,{unicode:86});assert.ok(c.textEdit);assert.ok(shape.text.includes('V'));
    c.commitTextEdit();c.shortcuts.poll();assert.ok(!c.spaceHeld);
    inputKey(c,'Space',false);inputKey(c,'Space',true);assert.ok(c.spaceHeld);inputKey(c,'Space',false);
}));
test('picker context blocks tools, routes Escape, then rearms canvas shortcuts',()=>withInputController(c=> {
    c.openFontPicker(14);c.shortcuts.syncMode();
    pressShortcut(c,{unicode:77});assert.ok(c.fontPickerController);assert.strictEqual(c.toolManager.currentTool,'select');
    pressShortcut(c,{unicode:27});assert.strictEqual(c.fontPickerController,null);
    pressShortcut(c,{unicode:77});assert.strictEqual(c.toolManager.currentTool,'rect');
}));
test('focus loss while a shortcut opens a picker cannot swallow fresh picker text',()=>withInputController(c=> {
    inputKey(c,'KeyF',true);c.doKeyPress({unicode:70});assert.ok(c.colorPickerController);
    pdg.getInputManager().feed({kind:'focusLost'});c.shortcuts.poll();
    let typed=0;c.colorPickerController.doKeyPress=()=>{typed++;return true;};
    inputKey(c,'KeyF',false);inputKey(c,'KeyF',true);c.doKeyPress({unicode:70});
    assert.strictEqual(typed,1);inputKey(c,'KeyF',false);c.colorPickerController.cancel();
}));
test('nudge actions preserve OS repeat and Shift precision without repeating on modifier changes',()=>withInputController(c=> {
    const rect=new Shape.Rectangle(100,100,20,20);rect.selected=true;c.drawing.addShape(rect);
    inputKey(c,'ArrowRight',true);near(rect.x,110);
    inputKey(c,'ArrowRight',true);near(rect.x,120);
    inputKey(c,'ShiftLeft',true,1);near(rect.x,120);
    inputKey(c,'ArrowRight',true,1);near(rect.x,121);
    inputKey(c,'ArrowRight',false,1);inputKey(c,'ShiftLeft',false);
    assert.strictEqual(c.undoStack.length,1);
}));
test('held command shortcuts retain OS repeat without executing again on Unicode KeyPress',()=>withInputController(c=> {
    let undone=0;c.undo=()=>undone++;
    inputKey(c,'ControlLeft',true,2);inputKey(c,'KeyZ',true,2);c.doKeyPress({unicode:122,ctrl:true});
    assert.strictEqual(undone,1);
    inputKey(c,'KeyZ',true,2);c.doKeyPress({unicode:122,ctrl:true});assert.strictEqual(undone,2);
    inputKey(c,'KeyZ',false,2);inputKey(c,'ControlLeft',false);
}));
test('adding a command modifier to a held zoom key does not invent an undo press',()=>withInputController(c=> {
    let undone=0;c.undo=()=>undone++;
    inputKey(c,'KeyZ',true);near(c.navigation.camera.getZoom(),1.25);
    inputKey(c,'ControlLeft',true,2);assert.strictEqual(undone,0);
    inputKey(c,'KeyZ',false,2);inputKey(c,'ControlLeft',false);
}));

test('selection readout shows intrinsic dimensions, line length and circle radius without mutating geometry',()=> {
    const readout=require('../selection-readout');
    assert.strictEqual(readout([]),'');
    const line=new Shape.Line(1,2,4,6);line.rotation=1;
    assert.strictEqual(readout([line]),'Line · 2pts · length 5 px');
    assert.strictEqual(readout([new Shape.Circle(20,20,12.25)]),'Circle · radius 12.3 px');
    const rect=new Shape.Rectangle(40,50,80,30);rect.rotation=Math.PI/4;
    assert.strictEqual(readout([rect]),'Rectangle · W 80 × H 30 px');
    near(rect.rotation,Math.PI/4);rect.width=90.25;
    assert.strictEqual(readout([rect]),'Rectangle · W 90.3 × H 30 px');
    const oval=new Shape.Oval(50,50,20,10);oval.rotation=Math.PI/3;
    assert.strictEqual(readout([oval]),'Oval · W 40 × H 20 px');
    const group=new Shape.Group([new Shape.Rectangle(0,0,20,10)]);group.rotation=Math.PI/2;
    assert.strictEqual(readout([group]),'Group · W 20 × H 10 px');
    assert.strictEqual(readout([new Shape.Rectangle(0,0,20,10),new Shape.Rectangle(30,40,20,10)]),
        '2 entities · W 50 × H 50 px');
});
test('selection measurements render above the zoom readout and remain unchanged by navigation',()=>withInputController(c=> {
    const rect=new Shape.Rectangle(100,100,80,30);rect.selected=true;c.drawing.addShape(rect);
    const texts=[];
    const port=new Proxy(c.port,{get:(target,key)=>key==='drawText'?(text,...args)=>{
        texts.push({text,point:args[0]});return target.drawText(text,...args);
    }:typeof target[key]==='function'?target[key].bind(target):target[key]});
    for(const zoom of [.5,2]) {
        c.navigation.camera.setZoom(zoom);c.navigation.pan(20,30);
        texts.length=0;c.backgroundView.drawSelf(port,0);
        const measure=texts.find(item=>item.text==='Rectangle · W 80 × H 30 px');
        assert.ok(measure);assert.strictEqual(measure.point.y,c.backgroundView.getViewArea().bottom-26);
        assert.ok(texts.some(item=>item.text.includes('1024 × 1024')));
    }
}));
test('line drags use actual document dimensions on tall, wide and smaller canvases after zoom and pan',()=>withInputController(c=> {
    for(const [width,height] of [[1600,2000],[600,800]]) {
        c.navigation.setCanvas(width,height);
        for(const zoom of [.25,1,2]) {
            c.navigation.camera.setZoom(zoom);c.navigation.pan(20,30);
            c.toolManager.setTool('line');
            c.handleMouseDown({mousePos:c.navigation.toView({x:100,y:100})});
            c.handleMouseMove({mousePos:c.navigation.toView({x:width-10,y:height-10})});
            near(c.toolManager.currentShape.x2,width-10);near(c.toolManager.currentShape.y2,height-10);
            c.handleMouseMove({mousePos:c.navigation.toView({x:width+100,y:height+100})});
            near(c.toolManager.currentShape.x2,width);near(c.toolManager.currentShape.y2,height);
            c.handleMouseUp({mousePos:c.navigation.toView({x:width,y:height})});
            const line=c.drawing.getShapes().at(-1);near(line.x2,width);near(line.y2,height);
        }
    }
}));

test('path readouts count vertices and curve anchors without tangent handles',()=> {
    const readout=require('../selection-readout');
    const polygon=new Shape.Polygon([{x:0,y:0},{x:38,y:0},{x:38,y:23}]);
    assert.strictEqual(readout([polygon]),'Polygon · 3pts · W 38 × H 23 px');
    const points=[{x:0,y:0},{x:10,y:10},{x:20,y:0}];
    assert.ok(readout([new Shape.Spline([points[0],...points,points.at(-1)])]).startsWith('Spline · 3pts ·'));
    assert.ok(readout([new Shape.BezierSpline(points)]).startsWith('Bezier spline · 3pts ·'));
});
test('selection overlay reuses idle handles and refreshes their pixels after edits, navigation and point selection',()=>withInputController(c=> {
    const shape=new Shape.Polygon([{x:400,y:300},{x:550,y:300},{x:550,y:450}]);
    shape.selected=true;c.drawing.addShape(shape);
    let draws=0;const draw=shape.drawEndpoints;shape.drawEndpoints=function(port){draws++;return draw.call(this,port);};
    const frame=()=>c.backgroundView.drawSelf(c.port,0);
    frame();assert.strictEqual(draws,1);frame();assert.strictEqual(draws,1);
    const point=c.navigation.toView(shape.points[0]),image=new pdg.Image(c.port,pdg.CopyPixels);
    const pixel=image.getPixel(Math.round(point.x),Math.round(point.y));assert.ok(pixel.red>.8 && pixel.green<.2);
    shape.points[0].x+=40;frame();assert.strictEqual(draws,2);
    const after=new pdg.Image(c.port,pdg.CopyPixels).getPixel(Math.round(point.x),Math.round(point.y));
    assert.ok(after.green>.2 || after.red<.8);
    c.navigation.zoomAt(1.25,new pdg.Point(450,350));frame();assert.strictEqual(draws,3);
    c.pointEditor.active=true;c.pointEditor.selection.set(shape,new Set(['a:0']));frame();assert.strictEqual(draws,4);
    frame();assert.strictEqual(draws,4);
}));

controller.destroy();pdg.gfx.closeGraphicsPort(surface);
console.log(`${passed} passed, ${failed} failed`);process.exit(failed ? 1 : 0);
