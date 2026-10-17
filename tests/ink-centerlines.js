// Run with PDG_SOURCE=devel ./skrybble tests/ink-centerlines.js.
require('pdg');
const assert=require('assert'),fs=require('fs'),path=require('path');
const centerlines=require('../ink-centerline'),Shapes=require('../shapes'),Geometry=require('../path-editing');
const Controller=require('../DrawingController'),{cameraPort}=require('../rendering');
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}
const points=array=>array.map(([x,y])=>({x,y}));
const ribbon=()=>points([[20,20],[180,20],[180,24],[20,24]]);
const tee=()=>points([[20,20],[180,20],[180,24],[102,24],[102,160],[98,160],[98,24],[20,24]]);
const ring=()=>points([[20,20],[180,20],[180,180],[20,180],[20,20],[24,24],[24,176],[176,176],[176,24],[24,24],[20,20]]);
const wavy=()=>{const p=Array.from({length:81},(_,i)=>({x:20+i*3,y:90+30*Math.sin(i/8)}));return [...p.map(p=>({x:p.x,y:p.y-2})),...p.slice().reverse().map(p=>({x:p.x,y:p.y+2}))];};
const near=(a,b,tolerance=.01)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);
function withController(fn){
    const port=pdg.gfx.createOffscreenPort(new pdg.Rect(900,700)),c=new Controller({getEventManager:()=>pdg.evt},port);
    try{fn(c);}finally{c.destroy();pdg.getInputManager().feed({kind:'focusLost'});pdg.gfx.closeGraphicsPort(port);}
}
function cycles(lines){
    const nodes=new Map(),key=p=>p.x.toFixed(6)+','+p.y.toFixed(6);
    const root=k=>{let p=k;while(nodes.get(p)!==p)p=nodes.get(p);return p;};
    for(const line of lines){const a=key(line.points[0]),b=key(line.points.at(-1));for(const k of [a,b])if(!nodes.has(k))nodes.set(k,k);nodes.set(root(a),root(b));}
    return lines.length-nodes.size+new Set([...nodes.keys()].map(root)).size;
}

test('a straight ink ribbon has a central skeleton with the measured thickness',()=>{
    for(const width of [.5,2,4,8]) {
        const lines=centerlines(points([[20,20],[180,20],[180,20+width],[20,20+width]]));
        assert.strictEqual(lines.length,1);near(lines[0].width,width,.3);
        assert.ok(lines[0].points.every(p=>Math.abs(p.y-(20+width/2))<.3));
        assert.ok(lines[0].points.at(-1).x-lines[0].points[0].x>150);
    }
});
test('junctions share exact endpoints and closed holes survive as centerline loops',()=>{
    const branches=centerlines(tee());assert.strictEqual(branches.length,3);
    const counts=new Map();for(const branch of branches)for(const p of [branch.points[0],branch.points.at(-1)]) {
        const key=p.x+','+p.y;counts.set(key,(counts.get(key)||0)+1);near(branch.width,4,.3);
    }
    assert.ok([...counts.values()].includes(3));assert.strictEqual(cycles(branches),0);
    const loop=centerlines(ring());assert.strictEqual(loop.length,1);assert.ok(loop[0].closed);
    assert.deepStrictEqual(loop[0].points[0],loop[0].points.at(-1));assert.strictEqual(cycles(loop),1);
});
test('compact fills, small specks and oversized documents do not trigger ink tracing',()=>{
    assert.strictEqual(centerlines(points([[0,0],[100,0],[100,100],[0,100]])),null);
    assert.strictEqual(centerlines(points([[0,0],[3,0],[3,1],[0,1]])),null);
    assert.strictEqual(centerlines(points([[0,0],[1e6,0],[1e6,1e6],[0,1e6]])),null);
});
test('whole ink conversion preserves color/alpha, world placement, drawing order, clipboard and one-step undo',()=>withController(c=>{
    const beforeShape=new Shapes.Circle(5,5,2),shape=new Shapes.Polygon(wavy(),'#20202080',null,0),afterShape=new Shapes.Circle(250,250,5);
    shape.rotation=.35;shape.selected=true;shape.rigBone='arm';c.drawing.addShape(beforeShape);c.drawing.addShape(shape);c.drawing.addShape(afterShape);
    const original=c.drawing.serializeShape(shape),expected=centerlines(Geometry.pathGeometry(shape).anchors),clipboard=[{untouched:true}];c.clipboard=clipboard;
    assert.ok(c.pointEditor.fitCurve());const all=c.drawing.getShapes(),curves=all.slice(1,-1);
    assert.strictEqual(all[0],beforeShape);assert.strictEqual(all.at(-1),afterShape);assert.strictEqual(curves.length,expected.length);
    for(let i=0;i<curves.length;i++) {
        const curve=curves[i];assert.ok(curve instanceof Shapes.BezierSpline);assert.strictEqual(curve.fillColor,null);
        assert.strictEqual(curve.strokeColor,'#20202080');assert.strictEqual(curve.rigBone,'arm');assert.strictEqual(curve.rotation,0);
        near(curve.strokeWidth,expected[i].width);assert.deepStrictEqual(curve.points[0],expected[i].points[0]);
        assert.deepStrictEqual(curve.points.at(-1),expected[i].points.at(-1));
        const saved=c.drawing.serializeShape(curve);assert.deepStrictEqual(c.drawing.serializeShape(c.drawing.deserializeShape(saved.type,saved)),saved);
        assert.ok(c.pointEditor.selection.get(curve).size>0);
    }
    assert.strictEqual(c.clipboard,clipboard);assert.strictEqual(c.undoStack.length,1);
    const fitted=curves.map(s=>c.drawing.serializeShape(s));c.undo();assert.deepStrictEqual(c.drawing.serializeShape(c.drawing.getShapes()[1]),original);
    c.redo();assert.deepStrictEqual(c.drawing.getShapes().slice(1,-1).map(s=>c.drawing.serializeShape(s)),fitted);
}));
test('ordinary polygons and partial point runs retain their previous curve-fitting behavior',()=>withController(c=>{
    const filled=new Shapes.Polygon(points([[0,0],[100,0],[100,100],[0,100]]),'red',null,0);filled.selected=true;c.drawing.addShape(filled);
    c.pointEditor.fitCurve();assert.strictEqual(c.drawing.getShapeCount(),1);assert.strictEqual(c.drawing.getShapes()[0].fillColor,'red');
    c.drawing.clearShapes();c.pointEditor.clear();const ink=new Shapes.Polygon(tee(),'#202020',null,0);ink.selected=true;c.drawing.addShape(ink);
    c.pointEditor.active=true;c.pointEditor.selection.set(ink,new Set(['a:0','a:1']));c.pointEditor.fitCurve();
    assert.strictEqual(c.drawing.getShapeCount(),2);const [patched,curve]=c.drawing.getShapes();
    assert.ok(patched instanceof Shapes.Polygon);assert.strictEqual(curve.strokeWidth,0); // normal point-run fitting, not inferred ink width
    assert.deepStrictEqual(curve.points[0],ink.points[0]);assert.deepStrictEqual(curve.points.at(-1),ink.points[1]);
}));
test('selecting every polygon anchor also permits whole-ink detection',()=>withController(c=>{
    const shape=new Shapes.Polygon(wavy(),'#202020',null,0);shape.selected=true;c.drawing.addShape(shape);
    c.pointEditor.active=true;c.pointEditor.selection.set(shape,new Set(shape.points.map((_,i)=>'a:'+i)));
    c.pointEditor.fitCurve();assert.ok(c.drawing.getShapes().some(s=>s instanceof Shapes.BezierSpline));
    assert.ok(c.drawing.getShapes().filter(s=>s instanceof Shapes.BezierSpline).every(s=>s.fillColor===null && s.points.length>2));
}));

function assertEligible(curve) {
    assert.ok(curve.points.length>=2);
    let length=0;
    for(const s of Geometry.pathGeometry(curve).segments) {
        let previous=s.p0;
        for(let i=1;i<=200;i++) {
            const t=i/200,u=1-t,p={x:u*u*u*s.p0.x+3*u*u*t*s.p1.x+3*u*t*t*s.p2.x+t*t*t*s.p3.x,
                y:u*u*u*s.p0.y+3*u*u*t*s.p1.y+3*u*t*t*s.p2.y+t*t*t*s.p3.y};
            length+=Math.hypot(p.x-previous.x,p.y-previous.y);previous=p;
        }
    }
    assert.ok(length>=curve.strokeWidth*5,`${length} length is less than 5 × ${curve.strokeWidth} width`);
}
test('long straight ribbons convert to valid two-anchor curves',()=>withController(c=>{
    const shape=new Shapes.Polygon(ribbon(),'#202020',null,0);shape.selected=true;c.drawing.addShape(shape);
    assert.ok(c.pointEditor.fitCurve());const curves=c.drawing.getShapes().filter(s=>s instanceof Shapes.BezierSpline);
    assert.strictEqual(curves.length,1);assert.strictEqual(curves[0].points.length,2);curves.forEach(assertEligible);
}));
test('short block-like ribbons remain filled without an undo entry',()=>withController(c=>{
    const outline=[];for(const x of [20,50,80,110])outline.push(...points([[20,20],[x,20],[x+12,20],[x+12,24],[x,24],[x,20],[20,20]]));
    const shape=new Shapes.Polygon(outline,'#202020',null,0);shape.selected=true;c.drawing.addShape(shape);
    const before=c.drawing.serializeShape(shape);assert.strictEqual(c.pointEditor.fitCurve(),false);
    assert.strictEqual(c.drawing.getShapes()[0],shape);assert.deepStrictEqual(c.drawing.serializeShape(shape),before);
    assert.strictEqual(c.undoStack.length,0);
}));
test('curved branches shorter than five widths stay filled alongside valid long two-anchor strokes',()=>withController(c=>{
    const outline=points([[20,20],[300,20],[300,24],[152,24],[152,28],[160,28],[160,34],[156,34],[156,32],[148,32],[148,24],[20,24]]);
    const shape=new Shapes.Polygon(outline,'#202020',null,0);shape.selected=true;c.drawing.addShape(shape);c.toolManager.setSmoothnessLevel(0);
    assert.ok(c.pointEditor.fitCurve());const curves=c.drawing.getShapes().filter(s=>s instanceof Shapes.BezierSpline);
    assert.strictEqual(curves.length,2);curves.forEach(assertEligible);
    assert.ok(c.drawing.getShapes().some(s=>s instanceof Shapes.Polygon));
}));
test('a curved branch between five and ten widths converts alongside straight strokes',()=>withController(c=>{
    const outline=points([[20,20],[300,20],[300,24],[152,24],[152,28],[160,28],[160,40],[156,40],[156,32],[148,32],[148,24],[20,24]]);
    const shape=new Shapes.Polygon(outline,'#202020',null,0);shape.selected=true;c.drawing.addShape(shape);c.toolManager.setSmoothnessLevel(0);
    assert.ok(c.pointEditor.fitCurve());const curves=c.drawing.getShapes().filter(s=>s instanceof Shapes.BezierSpline);
    assert.strictEqual(curves.length,3);curves.forEach(assertEligible);
}));
test('a qualifying wavy ribbon yields a curve with more than two anchors and at least a 5:1 ratio',()=>withController(c=>{
    const shape=new Shapes.Polygon(wavy(),'#202020',null,0);shape.selected=true;c.drawing.addShape(shape);
    assert.ok(c.pointEditor.fitCurve());const curves=c.drawing.getShapes().filter(s=>s instanceof Shapes.BezierSpline);
    assert.ok(curves.length>0);curves.forEach(assertEligible);
}));
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/v5-ink-network.json'),'utf8'));
test('the supplied v5 figure network preserves branching and cycles without tracing both sides of strokes',()=>withController(c=>{
    const shape=new Shapes.Polygon(points(fixture.points),fixture.fillColor,null,0),lines=centerlines(shape.points);
    assert.ok(lines.length>10 && lines.length<1000);assert.ok(cycles(lines)>25);
    assert.ok(lines.every(line=>line.width>0 && Number.isFinite(line.width)));
    const sorted=lines.map(line=>line.width).sort((a,b)=>a-b);assert.ok(sorted[Math.floor(sorted.length/2)]<5);
    shape.selected=true;c.drawing.addShape(shape);c.pointEditor.fitCurve();
    const artwork=c.drawing.getShapes(),curves=artwork.filter(s=>s instanceof Shapes.BezierSpline),fills=artwork.filter(s=>s instanceof Shapes.Polygon);
    assert.ok(curves.length>0 && curves.length<lines.length);assert.ok(fills.length>0);
    assert.ok(fills.every(s=>s.fillColor===fixture.fillColor && s.strokeWidth===0));
    for(const curve of curves)assertEligible(curve);
    assert.ok(curves.reduce((sum,s)=>sum+s.points.length,0)<fixture.points.length/2);
    assert.ok(curves.every(s=>s.fillColor===null && s.strokeColor===fixture.fillColor));
    // Compare rendered geometry with a small tolerance for curve fitting. This
    // catches centerlines that bridge unrelated body parts or lose whole limbs.
    const w=450,h=600,port=pdg.gfx.createOffscreenPort(new pdg.Rect(w,h));
    try {
        const camera=new pdg.Camera().setViewport(new pdg.Rect(w,h)).setLocation(fixture.canvas[0]/2,fixture.canvas[1]/2).setZoom(.4);
        const canvas=cameraPort(port,camera),capture=shapes=>{port.clear();for(const s of shapes){s.selected=false;s.draw(canvas);}return new pdg.Image(port,pdg.CopyPixels);};
        const original=capture([shape]),converted=capture(artwork),a=new Uint8Array(w*h),b=new Uint8Array(w*h);
        let countA=0,countB=0,matchedA=0,matchedB=0,massA=0,massB=0;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;const alphaA=original.getPixel(x,y).alpha,alphaB=converted.getPixel(x,y).alpha;massA+=alphaA;massB+=alphaB;a[i]=alphaA>.05;b[i]=alphaB>.05;countA+=a[i];countB+=b[i];}
        const close=(mask,x,y)=>{for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)if(x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h&&mask[(y+dy)*w+x+dx])return true;return false;};
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(a[i]&&close(b,x,y))matchedA++;if(b[i]&&close(a,x,y))matchedB++;}
        assert.ok(matchedA/countA>.9,`Source coverage ${matchedA/countA}`);assert.ok(matchedB/countB>.9,`Trace precision ${matchedB/countB}`);
        console.log(`v5 network: ${fixture.points.length} outline vertices -> ${curves.length} qualifying curves + ${fills.length} retained fills, ${cycles(lines)} source cycles, coverage ${(matchedA/countA).toFixed(3)}, precision ${(matchedB/countB).toFixed(3)}, ink mass ${(massB/massA).toFixed(3)}`);
    } finally {pdg.gfx.closeGraphicsPort(port);}
    const converted=artwork.map(s=>c.drawing.serializeShape(s));
    c.undo();assert.strictEqual(c.drawing.getShapeCount(),1);assert.deepStrictEqual(c.drawing.getShapes()[0].points,shape.points);
    c.redo();assert.deepStrictEqual(c.drawing.getShapes().map(s=>c.drawing.serializeShape(s)),converted);
}));
test('bad-ribbon produces multiple qualifying curves at every smoothness level while junk remains filled',()=>withController(c=>{
    const importer=require('../pdg-drawing-import');
    const document=importer.readDocument(path.join(__dirname,'fixtures/bad-ribbon.pdgdrawing'));
    for(let level=0;level<=4;level++) {
        c.drawing.clearShapes();c.pointEditor.clear();c.undoStack=[];c.redoStack=[];
        const shapes=c.drawing.deserializeDocument(document);shapes.forEach(s=>c.drawing.addShape(s));
        const ribbon=shapes.find(s=>s.points?.length===764),junk=shapes.filter(s=>s!==ribbon);
        assert.ok(ribbon);ribbon.selected=true;c.toolManager.setSmoothnessLevel(level);
        const before=shapes.map(s=>c.drawing.serializeShape(s));assert.ok(c.pointEditor.fitCurve());
        const artwork=c.drawing.getShapes(),curves=artwork.filter(s=>s instanceof Shapes.BezierSpline);
        assert.ok(curves.length>=3,`Smoothness level ${level}`);curves.forEach(assertEligible);
        assert.ok(artwork.filter(s=>s instanceof Shapes.Polygon).length>junk.length);
        for(const shape of junk)assert.ok(artwork.includes(shape),'Unselected junk must remain unchanged');
        const after=artwork.map(s=>c.drawing.serializeShape(s));assert.strictEqual(c.undoStack.length,1);
        c.undo();assert.deepStrictEqual(c.drawing.getShapes().map(s=>c.drawing.serializeShape(s)),before);
        c.redo();assert.deepStrictEqual(c.drawing.getShapes().map(s=>c.drawing.serializeShape(s)),after);
    }
}));
console.log(`${passed} passed, ${failed} failed`);process.exit(failed?1:0);
