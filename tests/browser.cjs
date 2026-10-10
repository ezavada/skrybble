const fs=require('fs'),http=require('http'),path=require('path'),os=require('os'),{spawn}=require('child_process');
const root=path.resolve(__dirname,'../dist');
const errors=[];
const server=http.createServer((req,res)=>{try{const p=path.join(root,new URL(req.url,'http://localhost').pathname);const file=p.endsWith('/')?p+'index.html':p;res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':'text/html');const content=fs.readFileSync(file);res.end(file.endsWith('/main.js') ? content.toString().replace('const app = new DrawingApp(process.argv);','const app = new DrawingApp(process.argv); window.__skrybbleTestApp=app;') : content);}catch(e){res.writeHead(404);res.end('Missing');}});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'skrybble-smoke-'));
const chrome=spawn(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--enable-unsafe-swiftshader','--remote-debugging-pipe','--no-first-run','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let seq=0,buffer='';const pending=new Map();
chrome.stdio[4].on('data',b=>{buffer+=b;let n;while((n=buffer.indexOf('\0'))>=0){const m=JSON.parse(buffer.slice(0,n));buffer=buffer.slice(n+1);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);if(m.method==='Runtime.consoleAPICalled' && m.params.type==='error'){const message=m.params.args.map(a=>a.value || a.description).join(' ');if(!/^(WARNING: using emscripten GL |glfwSetInputMode called with GLFW_STICKY_(KEYS|MOUSE_BUTTONS) mode not implemented)/.test(message))errors.push(message);}if(pending.has(m.id)){const {resolve,reject,timer}=pending.get(m.id);clearTimeout(timer);pending.delete(m.id);m.error?reject(Error(m.error.message)):resolve(m.result);}}});
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>reject(Error('Timeout '+method)),15000);pending.set(id,{resolve,reject,timer});chrome.stdio[3].write(JSON.stringify({id,method,params,sessionId})+'\0');});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const {targetId}=await send('Target.createTarget',{url:'about:blank'});const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});const call=(m,p)=>send(m,p,sessionId);const evalPage=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);return r.result.value;};
await call('Page.enable');await call('Runtime.enable');await call('Emulation.setDeviceMetricsOverride',{width:1280,height:960,deviceScaleFactor:1,mobile:false});await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'});
let ready=false;for(let i=0;i<120;i++){await delay(250);const status=await evalPage('document.documentElement.dataset.status');if(status==='failed')throw Error(await evalPage('document.getElementById("status").textContent'));if(status==='ready'){ready=true;break;}}if(!ready)throw Error('Startup timed out');
const key=async (text,code,virtual)=> {
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:text,code,windowsVirtualKeyCode:virtual,text});
    await call('Input.dispatchKeyEvent',{type:'keyUp',key:text,code,windowsVirtualKeyCode:virtual});
};
const shortcut=async value=> {
    const shifted=value.startsWith('Shift+') || value==='?';
    const char=value.replace('Shift+',''),code=char==='?'?'Slash':'Key'+char.toUpperCase(),virtual=char==='?'?191:char.charCodeAt(0);
    if(shifted)await call('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16,modifiers:8});
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:char,code,windowsVirtualKeyCode:virtual,text:char,modifiers:shifted?8:0});
    await call('Input.dispatchKeyEvent',{type:'keyUp',key:char,code,windowsVirtualKeyCode:virtual,modifiers:shifted?8:0});
    if(shifted)await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16});
};
const click=async (x,y)=> {
    await call('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
    await call('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
};
const shot=async()=> {await delay(350);return (await call('Page.captureScreenshot',{format:'png'})).data;};
if(!await evalPage(`(()=> {
    const port=pdg.gfx.createOffscreenPort(new pdg.Rect(200,140));
    try {
        port.drawLine(new pdg.Point(20,70),new pdg.Point(180,70),new pdg.Attributes().lineColor('black').lineThickness(64));
        const image=new pdg.Image(port);let pixels=0;
        for(let y=35;y<=105;y++)if(image.getPixel(100,y).alpha>.5)pixels++;
        return pixels>=62 && pixels<=66;
    } finally {pdg.gfx.closeGraphicsPort(port);}
})()`))throw Error('Browser renderer did not preserve a 64-pixel stroke');
const before=await shot();
await key('m','KeyM',77);
await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:400,y:400});
if(!await evalPage('document.querySelector("canvas").style.cursor==="crosshair"'))throw Error('Shape tool did not use crosshair cursor');
await call('Input.dispatchMouseEvent',{type:'mousePressed',x:250,y:250,button:'left',clickCount:1});
await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:550,y:450,button:'left',buttons:1});
const freeRect=JSON.parse(await evalPage('JSON.stringify({w:__skrybbleTestApp.drawingController.toolManager.currentShape.width,h:__skrybbleTestApp.drawingController.toolManager.currentShape.height})'));
await call('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16,modifiers:8});
if(!await evalPage('Math.abs(Math.abs(__skrybbleTestApp.drawingController.toolManager.currentShape.width)-Math.abs(__skrybbleTestApp.drawingController.toolManager.currentShape.height))<.01'))throw Error('Stationary Shift press did not constrain the rectangle'); 
await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16});
if(!await evalPage(`Math.abs(__skrybbleTestApp.drawingController.toolManager.currentShape.width-${freeRect.w})<.01 && Math.abs(__skrybbleTestApp.drawingController.toolManager.currentShape.height-${freeRect.h})<.01`))throw Error('Stationary Shift release did not restore the rectangle');

await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:550,y:450,button:'left',clickCount:1});
const drawn=await shot();if(before===drawn)throw Error('Rectangle was not rendered');
await key('t','KeyT',84);await click(300,500);
for(const character of 'Hello PDG')await key(character,'Key'+character.toUpperCase(),character.toUpperCase().charCodeAt(0));
await call('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
await call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
await key('X','KeyX',88);
if(!await evalPage('__skrybbleTestApp.drawingController.textEdit.shape.text === "Hello PDXG"'))throw Error('ArrowLeft did not move the text caret');
await key('\b','Backspace',8);
if(!await evalPage('__skrybbleTestApp.drawingController.textEdit.shape.text === "Hello PDG"'))throw Error('Backspace did not delete at the caret');
if(process.env.SKRYBBLE_TEXT_SCREENSHOT)fs.writeFileSync(process.env.SKRYBBLE_TEXT_SCREENSHOT,Buffer.from(await shot(),'base64'));
await key('\r','Enter',13);const text=await shot();if(text===drawn)throw Error('Text was not rendered');
const textCenter=JSON.parse(await evalPage('JSON.stringify(__skrybbleTestApp.drawingController.drawing.getShapes().find(s=>s.text).getCenterPoint())'));
await shortcut('Shift+T');
if(!await evalPage('!!__skrybbleTestApp.drawingController.fontPickerController'))throw Error('Shift+T did not open font picker');
if(process.env.SKRYBBLE_FONT_SCREENSHOT)fs.writeFileSync(process.env.SKRYBBLE_FONT_SCREENSHOT,Buffer.from(await shot(),'base64'));
const fontRect=await evalPage('JSON.stringify(__skrybbleTestApp.drawingController.fontPickerController.popupRect)');
const fr=JSON.parse(fontRect),area=await evalPage('JSON.stringify(__skrybbleTestApp.drawingController.port.getDrawingArea())');
const scale=1280/(JSON.parse(area).right-JSON.parse(area).left),scaleY=960/(JSON.parse(area).bottom-JSON.parse(area).top);
await click((fr.left+30)*scale,(fr.top+80)*scaleY);
await click((fr.left+50)*scale,(fr.top+282)*scaleY);
const styledCenter=JSON.parse(await evalPage('JSON.stringify(__skrybbleTestApp.drawingController.drawing.getShapes().find(s=>s.text).getCenterPoint())'));
if(Math.hypot(styledCenter.x-textCenter.x,styledCenter.y-textCenter.y)>.01)throw Error('Changing font moved the text center');
if(!await evalPage('!__skrybbleTestApp.drawingController.fontPickerController'))throw Error('Apply did not close font picker');
if(!await evalPage('__skrybbleTestApp.drawingController.drawing.getShapes().some(s=>s.text && s.fontName==="Times New Roman")'))throw Error('Font picker did not apply serif font: '+await evalPage('JSON.stringify({picker:__skrybbleTestApp.drawingController.fontPickerController?.value,defaults:__skrybbleTestApp.drawingController.textDefaults,shapes:__skrybbleTestApp.drawingController.drawing.getShapes().map(s=>({text:s.text,font:s.fontName,selected:s.selected}))})')); 
await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:400,y:400});
await evalPage('window.skrybbleZoom=[];const zoom=pdg.Camera.prototype.setZoom;pdg.Camera.prototype.setZoom=function(value){window.skrybbleZoom.push(value);return zoom.call(this,value);};');
const selectedFocus=await evalPage(`(()=> {
    const c=__skrybbleTestApp.drawingController;
    const point=c.navigation.toWorld(c.navigationAnchor(new pdg.Point(200,200)));
    window.zoomFocus=point;
    return JSON.stringify(c.navigation.toView(point));
})()`);
await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:400,y:400,deltaX:0,deltaY:-120,modifiers:0});
await delay(150);
const zoomValues=await evalPage('window.skrybbleZoom');if(!zoomValues.some(value=>value>1))throw Error('Unmodified wheel did not update camera zoom: '+JSON.stringify(zoomValues)+' '+JSON.stringify(errors)+' '+await evalPage('JSON.stringify({active:__skrybbleTestApp.drawingController.active,picker:!!__skrybbleTestApp.drawingController.fontPickerController,area:__skrybbleTestApp.drawingController.backgroundView.getViewArea(),rect:document.querySelector("canvas").getBoundingClientRect()})')); 
const zoom=await shot();if(zoom===text)throw Error('Unmodified wheel did not zoom');
if(!await evalPage('Math.abs(__skrybbleTestApp.drawingController.navigation.camera.getZoom()-Math.exp(.12))<.001'))throw Error('Browser wheel zoom was applied more than once');
const selectedAfter=JSON.parse(await evalPage('JSON.stringify(__skrybbleTestApp.drawingController.navigation.toView(window.zoomFocus))'));
const selectedBefore=JSON.parse(selectedFocus);
if(Math.hypot(selectedAfter.x-selectedBefore.x,selectedAfter.y-selectedBefore.y)>.01)throw Error('Browser wheel moved the selected zoom focus');
// With no selection, actual browser pointer coordinates must remain fixed.
await evalPage(`(()=> {
    const c=__skrybbleTestApp.drawingController;
    window.zoomSelection=c.drawing.getShapes().filter(s=>s.selected);
    window.zoomSelection.forEach(s=>s.selected=false);
    const area=c.port.getDrawingArea();
    window.zoomCursor=new pdg.Point(area.left+400/1280*area.width(),area.top+400/960*area.height());
    window.zoomCursorWorld=c.navigation.toWorld(window.zoomCursor);
})()`);
await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:400,y:400,deltaX:0,deltaY:120,modifiers:0});
await delay(150);
if(!await evalPage(`(()=> {
    const c=__skrybbleTestApp.drawingController,p=c.navigation.toView(window.zoomCursorWorld);
    window.zoomSelection.forEach(s=>s.selected=true);
    return Math.hypot(p.x-window.zoomCursor.x,p.y-window.zoomCursor.y)<.01;
})()`))throw Error('Browser wheel moved the point under the cursor: '+await evalPage('JSON.stringify({cursor:window.zoomCursor,world:window.zoomCursorWorld,actual:__skrybbleTestApp.drawingController.navigation.toView(window.zoomCursorWorld),zoom:__skrybbleTestApp.drawingController.navigation.camera.getZoom(),rect:document.querySelector("canvas").getBoundingClientRect()})')); 

await key('h','KeyH',72);
await call('Input.dispatchMouseEvent',{type:'mousePressed',x:400,y:400,button:'left',clickCount:1});
await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:500,y:480,button:'left',buttons:1});
await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:500,y:480,button:'left',clickCount:1});
const pan=await shot();if(pan===zoom)throw Error('Pan did not move the canvas');
const handles=await evalPage(`(()=> {
    const c=__skrybbleTestApp.drawingController;
    const points=Array.from({length:25},(_,i)=>c.navigation.toWorld(new pdg.Point(100+i*12,200+Math.sin(i/4)*25)));
    const shape=new (c.drawing.getShapeClasses().Spline)([{...points[0]},...points,{...points[points.length-1]}]);
    shape.selected=true;c.drawing.addShape(shape);
    const port=pdg.gfx.createOffscreenPort(c.port.getDrawingArea());
    try {
        c.backgroundView.drawSelf(port,0);
        const image=new pdg.Image(port);
        return points.every((point,index)=> {
            const view=c.navigation.toView(point);
            for(let dx=-2;dx<=2;dx++) for(let dy=-2;dy<=2;dy++) {
                const pixel=image.getPixel(Math.round(view.x)+dx,Math.round(view.y)+dy);
                // The duplicated first/last control handles cover these endpoints in green.
                const control=index===0 || index===points.length-1;
                if(control ? pixel.green>.4 && pixel.red<.1 && pixel.blue<.1 :
                    pixel.red>.9 && pixel.green<.1 && pixel.blue<.1) return true;
            }
            return false;
        });
    } finally {c.drawing.removeShape(shape);pdg.gfx.closeGraphicsPort(port);}
})()`);
if(!handles)throw Error('Freehand handles drifted away from the curve after pan and zoom');
await evalPage('__skrybbleTestApp.drawingController.navigation.reset()');
await key('z','KeyZ',90);
if(!await evalPage('__skrybbleTestApp.drawingController.navigation.camera.getZoom()>1'))throw Error('Z did not zoom in');
await call('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16,modifiers:8});
await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Z',code:'KeyZ',windowsVirtualKeyCode:90,text:'Z',modifiers:8});
await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Z',code:'KeyZ',windowsVirtualKeyCode:90,modifiers:8});
await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16});
if(!await evalPage('Math.abs(__skrybbleTestApp.drawingController.navigation.camera.getZoom()-1)<.001'))throw Error('Shift+Z did not zoom out');
await evalPage('__skrybbleTestApp.drawingController.navigation.zoomAt(.25,new pdg.Point(320,240))');
await key('\\','Backslash',220);
await call('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32,text:' '});
const location=await evalPage('JSON.stringify(__skrybbleTestApp.drawingController.navigation.camera.getLocation())');
await call('Input.dispatchMouseEvent',{type:'mousePressed',x:400,y:400,button:'left',clickCount:1});
await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:450,y:450,button:'left',buttons:1});
await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:450,y:450,button:'left',clickCount:1});
await call('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
if(location===await evalPage('JSON.stringify(__skrybbleTestApp.drawingController.navigation.camera.getLocation())'))throw Error('Space-drag did not pan a page that fits in the window');
if(!await evalPage('!__skrybbleTestApp.drawingController.spaceHeld && !__skrybbleTestApp.drawingController.toolManager.isDrawing'))throw Error('Space-drag left drawing or keyboard capture active');
await evalPage('__skrybbleTestApp.drawingController.navigation.reset()');
const escape=async()=> {
    await call('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await shot();
};
await key('t','KeyT',84);await click(600,600);
if(!await evalPage('document.querySelector("canvas").style.cursor==="text"'))throw Error('Text tool did not use I-beam cursor');await key('X','KeyX',88);await escape();
if(!await evalPage('!__skrybbleTestApp.drawingController.textEdit && __skrybbleTestApp.drawingController.toolManager.currentTool === "select"')) throw Error('Escape did not leave text editing');
await shortcut('Shift+P');await click(250,250);await click(500,250);await click(400,450);await escape();
if(!await evalPage('!__skrybbleTestApp.drawingController.toolManager.isDrawing && __skrybbleTestApp.drawingController.toolManager.currentTool === "select"')) throw Error('Escape did not finish polygon');
await shortcut('Shift+W');await shot();
await key('\r','Enter',13);await shot();
const magnifierSlot=JSON.parse(await evalPage(`(()=> {
    const c=__skrybbleTestApp.drawingController,area=c.port.getDrawingArea();
    c.navigation.reset();
    return JSON.stringify({x:c.toolPaletteView.slotWidth()*2.5*1280/area.width(),y:25*960/area.height()});
})()`));
await click(magnifierSlot.x,magnifierSlot.y);
await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:400,y:400});
if(!await evalPage('__skrybbleTestApp.drawingController.toolManager.currentTool==="zoom" && document.querySelector("canvas").style.cursor==="zoom-in"'))throw Error('Magnifier tool/cursor was not selected');
await click(400,400);
if(!await evalPage('Math.abs(__skrybbleTestApp.drawingController.navigation.camera.getZoom()-1.25)<.001'))throw Error('Magnifier click did not zoom in');
await call('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16,modifiers:8});
if(!await evalPage('document.querySelector("canvas").style.cursor==="zoom-out"'))throw Error('Shift did not change the magnifier cursor');
await call('Input.dispatchMouseEvent',{type:'mousePressed',x:400,y:400,button:'left',clickCount:1,modifiers:8});
await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:400,y:400,button:'left',clickCount:1,modifiers:8});
await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16});
if(!await evalPage('Math.abs(__skrybbleTestApp.drawingController.navigation.camera.getZoom()-1)<.001'))throw Error('Shift magnifier click did not zoom out');
for(const [keyName,code,virtual,modifier] of [['Alt','AltLeft',18,1],['Control','ControlLeft',17,2]]) {
    await evalPage('__skrybbleTestApp.drawingController.navigation.reset()');
    await call('Input.dispatchKeyEvent',{type:'rawKeyDown',key:keyName,code,windowsVirtualKeyCode:virtual,modifiers:modifier});
    if(!await evalPage('document.querySelector("canvas").style.cursor==="zoom-out"'))throw Error(keyName+' did not show zoom-out cursor');
    await call('Input.dispatchMouseEvent',{type:'mousePressed',x:400,y:400,button:'left',clickCount:1,modifiers:modifier});
    await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:400,y:400,button:'left',clickCount:1,modifiers:modifier});
    await call('Input.dispatchKeyEvent',{type:'keyUp',key:keyName,code,windowsVirtualKeyCode:virtual});
    if(!await evalPage('Math.abs(__skrybbleTestApp.drawingController.navigation.camera.getZoom()-.8)<.001'))throw Error(keyName+' click did not zoom out exactly once');
}
await evalPage('__skrybbleTestApp.drawingController.navigation.reset()');
await call('Input.dispatchMouseEvent',{type:'mousePressed',x:400,y:400,button:'right',clickCount:1});
await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:400,y:400,button:'right',clickCount:1});
if(!await evalPage('Math.abs(__skrybbleTestApp.drawingController.navigation.camera.getZoom()-.8)<.001'))throw Error('Right click did not zoom out exactly once');
await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:magnifierSlot.x,y:magnifierSlot.y});
if(!await evalPage('document.querySelector("canvas").style.cursor==="default"'))throw Error('Toolbar retained a drawing cursor');
await shortcut('P');
if(!await evalPage('__skrybbleTestApp.drawingController.toolManager.currentTool==="bezier"'))throw Error('P did not select Pen');
const toolbarClick=async tool=> {
    const p=JSON.parse(await evalPage(`(()=> {
        const c=__skrybbleTestApp.drawingController,area=c.port.getDrawingArea();
        const tools=Object.values(c.toolManager.constructor.TOOLS);
        return JSON.stringify({x:(tools.indexOf('${tool}')+.5)*c.toolPaletteView.slotWidth()*1280/area.width(),y:25*960/area.height()});
    })()`));
    await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y});
    await call('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});
    if(!await evalPage(`__skrybbleTestApp.drawingController.toolPaletteView.pressedTool==='${tool}'`))throw Error('Toolbar has no pressed feedback');
    await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});
    if(!await evalPage('__skrybbleTestApp.drawingController.toolPaletteView.pressedTool===null'))throw Error('Toolbar pressed feedback did not clear');
};
await toolbarClick('font');
if(!await evalPage('!!__skrybbleTestApp.drawingController.fontPickerController'))throw Error('Toolbar did not open font picker');
await toolbarClick('linewidth');
if(!await evalPage('!!__skrybbleTestApp.drawingController.lineWidthController && !__skrybbleTestApp.drawingController.fontPickerController'))throw Error('Toolbar could not switch between popups');
await toolbarClick('bezier');await toolbarClick('bezier');
if(!await evalPage('__skrybbleTestApp.drawingController.toolManager.currentTool==="bezier" && !__skrybbleTestApp.drawingController.activePicker()'))throw Error('Toolbar did not switch from popup to Pen');
await shortcut('?');const help=await shot();
if(!await evalPage('__skrybbleTestApp.drawingController.backgroundView._helpImage.getWidth() === __skrybbleTestApp.drawingController.port.getDrawingArea().width()')) throw Error('Help is not window-sized');
if(process.env.SKRYBBLE_HELP_SCREENSHOT)fs.writeFileSync(process.env.SKRYBBLE_HELP_SCREENSHOT,Buffer.from(help,'base64'));
await toolbarClick('select');
if(!await evalPage('!__skrybbleTestApp.drawingController.showHelp'))throw Error('Escape did not close help');
await shot();if(errors.length)throw Error(errors.join('\n'));
if(process.env.SKRYBBLE_SCREENSHOT) fs.writeFileSync(process.env.SKRYBBLE_SCREENSHOT,Buffer.from(pan,'base64'));
console.log('PASS: browser startup, drawing, text caret editing, font picker, Illustrator shortcuts, unmodified wheel zoom, magnifier and contextual cursors, Pen shortcut, keyboard zoom, wide strokes, stationary Shift transitions, pan including a fully visible page, picker, freehand handle alignment, Escape recovery, window-sized help, and no runtime errors');

})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{chrome.kill();server.close();setTimeout(()=>{fs.rmSync(profile,{recursive:true,force:true});process.exit(process.exitCode||0);},1000);});
