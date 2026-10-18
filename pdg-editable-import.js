'use strict';
// Recursive native drawing snapshots. Keep this schema aligned with
// pdg-devel/src/sys/drawing-snapshot.inc, including the shared bool cursor and
// object-reference table. Unsupported content falls back to the native codec.
const Colors=require('./colors'),Shapes=require('./shapes'),Drawing=require('./drawing');
const ID=[1,0,0,1,0,0],mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const point=(m,p)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
const matrix=m=>[m[0],m[1],0,m[2],m[3],0,m[4],m[5],1];
module.exports=function(bytes,Reader) {
    const reader=new Reader(bytes),objects=[];let pointCount=0,elementCount=0;
    let tag=reader.tag();const tagged=tag===0x706467;if(tagged)tag=reader.tag();
    function appearance(version) {
        const colors=['#000000','#00000000','#000000','#000000','#000000','#000000','#808080'];
        const coords=[[1,12],...Array.from({length:9},()=>[0,0])],floats=[1,1,0,1,0,0,0,1,0,1],ints=[0,0,0,0,0,1];
        if(reader.flag()) {
            colors.forEach((_,i)=>{if(reader.flag())colors[i]=reader.color();});
            coords.forEach((_,i)=>{if(reader.flag())coords[i]=reader.point();});
            floats.forEach((_,i)=>{if(reader.flag())floats[i]=reader.float();});
            ints.forEach((_,i)=>{if(reader.flag())ints[i]=reader.signed();});
            if(reader.flag()||reader.flag()||(version>=5&&reader.flag()))throw Error('Native clipping, textures or fonts need retained rendering');
        }
        if(coords.slice(5,9).some(p=>p.some(n=>n!==0))||floats[2]!==0||floats[5]!==0||floats[8]!==0||floats[9]!==1||ints[4]!==0||ints[5]!==1||coords[1][0]!==0)
            throw Error('Native visual effects need retained rendering');
        if(![0,1,2].includes(ints[0])||![0,1,2].includes(ints[1])||![0,2,3].includes(ints[2]))throw Error('Native appearance mode needs retained rendering');
        const m=[floats[3],floats[4],floats[6],floats[7],...coords[9]],attrs=new pdg.Attributes()
            .lineColor(Colors.toColor(colors[0])).fillColor(Colors.toColor(colors[1])).lineThickness(coords[0][0])
            .lineOpacity(floats[0]).fillOpacity(floats[1]).lineStyle(ints[0]).blendMode(ints[2]).setTransform(matrix(m));
        if(ints[1]===1)attrs.fillGradient(new pdg.Point(...coords[2]),Colors.toColor(colors[2]),new pdg.Point(...coords[3]),Colors.toColor(colors[3]));
        if(ints[1]===2)attrs.fillRadialGradient(new pdg.Point(...coords[4]),Colors.toColor(colors[4]),coords[1][1],Colors.toColor(colors[5]));
        return {colors,coords,floats,ints,m,attrs};
    }
    function object(firstTag,depth=0) {
        if(depth>100)throw Error('Native drawing nesting is too deep');
        const tag=firstTag===undefined?reader.tag():firstTag;
        if(tag===0x726566){const index=reader.uint(),obj=objects[index];if(!obj||obj.loading)throw Error('Invalid or cyclic native drawing reference');return obj;}
        if(tag!==0x6f626a||reader.u32()!==0xffffff09)throw Error('Expected native drawing object');
        const node={elements:[],native:pdg.createDrawing(),loading:true};objects.push(node);
        if(tagged&&reader.u16()!==objects.length)throw Error('Invalid native drawing object count');
        const size=reader.uint(),end=reader.offset+size;
        if(end>reader.view.byteLength)throw Error('Truncated native drawing');
        const version=reader.byte();if(![4,5,6].includes(version))throw Error('Unsupported native drawing version');
        const count=reader.uint();elementCount+=count;if(elementCount>100000)throw Error('Too many native drawing elements');
        for(let i=0;i<count;i++) {
            const type=reader.byte(),a=appearance(version),n=reader.uint();pointCount+=n;
            if(n>1000000||pointCount>4000000)throw Error('Too many native drawing points');
            const points=Array.from({length:n},()=>{const [x,y]=reader.point();if(Math.abs(x)>100000||Math.abs(y)>100000)throw Error('Native drawing coordinate out of range');return {x,y};});
            const e={type,a,points};const nativePoints=()=>points.map(p=>new pdg.Point(p));
            if(type===6){if(n<3)throw Error('Invalid native polygon');node.native.addPolygon(new pdg.Polygon(nativePoints()),a.attrs);}
            else if(type===2) {
                e.splineType=reader.byte();e.loop=reader.flag();
                if(![2,4].includes(e.splineType)||e.loop)throw Error('Native spline type needs retained rendering');
                const spline=new pdg.Spline(e.splineType);for(const p of nativePoints())spline.addPoint(p);node.native.addSpline(spline,a.attrs);
            } else if(type===1){if(n!==2)throw Error('Invalid native line');node.native.addLine(...nativePoints(),a.attrs);}
            else if(type===4||type===5){if(n!==4)throw Error('Invalid native quad');const q=new pdg.Quad();q.points=nativePoints();node.native.addQuad(q,a.attrs);}
            else if(type===10){if(n!==4)throw Error('Invalid nested drawing bounds');e.child=object(undefined,depth+1);node.native.addDrawing(new pdg.Rect(points[0].x,points[0].y,points[2].x,points[2].y),e.child.native,a.attrs);}
            else throw Error('Native element type needs retained rendering: '+type);
            node.elements.push(e);
        }
        if(reader.offset!==end)throw Error('Invalid native drawing record length');
        node.loading=false;return node;
    }
    const root=object(tag);if(reader.offset!==reader.view.byteLength)throw Error('Trailing native drawing data');
    let expanded=0;
    function convert(node,parent=ID,lineOpacity=1,fillOpacity=1,parentBlend=0,depth=0) {
        if(depth>100)throw Error('Native drawing nesting is too deep');
        const shapes=[];
        for(const e of node.elements) {
            if(++expanded>100000)throw Error('Too many expanded drawing elements');
            const {a}=e,m=mul(parent,a.m),lo=lineOpacity*a.floats[0],fo=fillOpacity*a.floats[1],blend=parentBlend||a.ints[2];
            if(e.child) {
                const b=e.child.native.getBounds(),p=e.points,w=b.width()||1,h=b.height()||1;
                const sx=b.width()?(p[2].x-p[0].x)/w:1,sy=b.height()?(p[2].y-p[0].y)/h:1;
                const fit=[sx,0,0,sy,p[0].x-sx*b.left,p[0].y-sy*b.top];
                const children=convert(e.child,mul(m,fit),lo,fo,blend,depth+1);
                if(children.length===1)shapes.push(children[0]);else if(children.length)shapes.push(new Shapes.Group(children));
                continue;
            }
            const opacity=(value,alpha)=>{const c=Colors.toColor(value);return Colors.toHex({r:c.red,g:c.green,b:c.blue,a:c.alpha*alpha});};
            const stroke=a.ints[0]===1?null:opacity(a.colors[0],lo),fill=a.colors[1]==='#00000000'&&a.ints[1]===0?null:opacity(a.colors[1],fo),points=e.points.map(p=>point(m,p));
            const width=a.coords[0][0];let shape;
            if(e.type===6||e.type===4||e.type===5)shape=new Shapes.Polygon(points,fill,a.ints[0]===0?null:stroke,width);
            else if(e.type===1)shape=new Shapes.Line(points[0].x,points[0].y,points[1].x,points[1].y,stroke||'#00000000',width);
            else if(e.splineType===2)shape=new Shapes.Spline(points,null,stroke||'#00000000',width);
            else {
                if(points.length<4||(points.length-1)%3)throw Error('Invalid native Bezier control point count');
                const anchors=[points[0]],controls=[];
                for(let i=0;i<points.length-1;i+=3){controls.push(points[i+1],points[i+2]);anchors.push(points[i+3]);}
                shape=new Shapes.BezierSpline(anchors,null,stroke,width);shape.controlPoints=controls;shape.manuallyEditedControls=new Set(controls.map((_,i)=>i));
            }
            if(a.ints[1]&&[4,5,6].includes(e.type)) {
                if(e.type!==6)throw Error('Gradient quads need retained rendering');
                const b=require('./fill-style').bounds([...shape.getEndpoints(),...(shape.controlPoints||[])]),normal=p=>({x:(p.x-b.left)/b.width,y:(p.y-b.top)/b.height});
                const startColor=opacity(a.colors[a.ints[1]===1?2:4],fo),endColor=opacity(a.colors[a.ints[1]===1?3:5],fo);shape.fillColor=startColor;
                // PDG's polygon renderer evaluates gradients at transformed
                // vertices using the stored gradient coordinates. Preserve that
                // native appearance when baking the element's transform.
                if(a.ints[1]===1)shape.fillGradient={type:'linear',start:normal({x:a.coords[2][0],y:a.coords[2][1]}),end:normal({x:a.coords[3][0],y:a.coords[3][1]}),startColor,endColor,baseColor:startColor};
                else shape.fillGradient={type:'radial',center:normal({x:a.coords[4][0],y:a.coords[4][1]}),radius:a.coords[1][1]/Math.max(b.width,b.height),startColor,endColor,baseColor:startColor};
            }
            if(blend)shape.blendMode=blend===2?'Multiply':'Screen';shapes.push(shape);
        }
        return shapes;
    }
    const children=convert(root);if(!children.length)throw Error('Empty editable native drawing');
    const model=new Drawing(),group=children.length===1&&children[0] instanceof Shapes.Group?children[0]:new Shapes.Group(children),bounds=root.native.getBounds();
    const canvas=[Math.max(1,Math.ceil(bounds.right)),Math.max(1,Math.ceil(bounds.bottom))];if(canvas.some(n=>!Number.isFinite(n)||n>100000))throw Error('Invalid native drawing canvas');
    return {fileFormat:'skrbl-v0.0.4',imageData:[],canvas,shapes:[{type:'Group',data:model.serializeShape(group)}]};
};
