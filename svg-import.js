'use strict';
// An inert SVG subset reader: no browser DOM, scripts, external resources or
// entity expansion. Produces the same editable document records on all hosts.
const ID=[1,0,0,1,0,0], NUMBER=/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const point=(m,p)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
const same=(a,b)=>a.x===b.x&&a.y===b.y;
function numbers(s) {
    if(String(s).replace(NUMBER,'').replace(/[\s,]/g,''))throw Error('Invalid SVG number list');
    const values=(String(s).match(NUMBER)||[]).map(Number);
    if(!values.every(Number.isFinite))throw Error('Non-finite SVG coordinate');
    return values;
}
function transform(s='') {
    let m=ID.slice(),end=0;
    for(const match of s.matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g)) {
        if(s.slice(end,match.index).replace(/[\s,]/g,''))throw Error('Invalid SVG transform');
        end=match.index+match[0].length;
        const v=numbers(match[2]),name=match[1];let t;
        if(name==='matrix'&&v.length===6)t=v;
        else if(name==='translate'&&(v.length===1||v.length===2))t=[1,0,0,1,v[0],v[1]||0];
        else if(name==='scale'&&(v.length===1||v.length===2))t=[v[0],0,0,v.length===2?v[1]:v[0],0,0];
        else if(name==='rotate'&&(v.length===1||v.length===3)) {
            const r=v[0]*Math.PI/180,c=Math.cos(r),s=Math.sin(r);t=[c,s,-s,c,0,0];
            if(v.length===3)t=mul(mul([1,0,0,1,v[1],v[2]],t),[1,0,0,1,-v[1],-v[2]]);
        } else if((name==='skewX'||name==='skewY')&&v.length===1) {
            t=ID.slice();t[name==='skewX'?2:1]=Math.tan(v[0]*Math.PI/180);
        } else throw Error('Unsupported SVG transform '+name);
        m=mul(m,t);
    }
    if(s.slice(end).trim())throw Error('Invalid SVG transform');
    return m;
}
function xml(source) {
    if(typeof source!=='string'||source.length>64*1024*1024)throw Error('SVG is too large');
    // Deliberately reject declarations rather than evaluating custom entities.
    source=source.replace(/^\uFEFF/,'').replace(/<!--[^]*?-->/g,'').replace(/<\?[^]*?\?>/g,'');
    if(/<!/i.test(source))throw Error('SVG document declarations/entities are not supported');
    const root={children:[],content:[]},stack=[root];let end=0,count=0;
    const decode=s=>{
        if(/&(?!#x[\da-f]+;|#\d+;|amp;|quot;|apos;|lt;|gt;)/i.test(s))throw Error('Unsupported XML entity');
        return s.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi,(_,s)=>{
        if(s[0]==='#') {const n=s[1].toLowerCase()==='x'?parseInt(s.slice(2),16):Number(s.slice(1));if(n>0x10ffff||n===0)throw Error('Invalid XML entity');return String.fromCodePoint(n);}
        return {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'}[s];
        });
    };
    for(const match of source.matchAll(/<\s*(\/?)\s*([\w:.-]+)((?:[^>"']|"[^"]*"|'[^']*')*)>/g)) {
        const gap=source.slice(end,match.index);if(gap.includes('<'))throw Error('Malformed SVG XML');
        if(stack.length===1&&gap.trim())throw Error('Text outside SVG root');
        if(stack.length>1)stack.at(-1).content.push(decode(gap));
        end=match.index+match[0].length;
        if(match[1]) {
            if(match[3].trim()||stack.length===1||stack.pop().fullName!==match[2])throw Error('Unbalanced SVG XML');
            continue;
        }
        if(++count>100000||stack.length>256)throw Error('SVG is too complex');
        const self=/\/\s*$/.test(match[3]),body=match[3].replace(/\/\s*$/,'');
        const attrs={};let offset=0;
        for(const a of body.matchAll(/([\w:.-]+)\s*=\s*("[^"]*"|'[^']*')/g)) {
            if(body.slice(offset,a.index).trim()||Object.hasOwn(attrs,a[1]))throw Error('Malformed SVG attributes');
            const raw=a[2].slice(1,-1);if(/&(?!#x[\da-f]+;|#\d+;|amp;|quot;|apos;|lt;|gt;)/i.test(raw))throw Error('Unsupported XML entity');
            attrs[a[1]]=decode(raw);offset=a.index+a[0].length;
        }
        if(body.slice(offset).trim())throw Error('Malformed SVG attributes');
        const node={fullName:match[2],name:match[2].split(':').at(-1),attrs,children:[],content:[]};
        stack.at(-1).children.push(node);stack.at(-1).content.push(node);if(!self)stack.push(node);
    }
    if(source.slice(end).trim()||stack.length!==1||root.children.length!==1||root.children[0].name!=='svg')throw Error('Invalid SVG root');
    return root.children[0];
}
// Endpoint-to-center conversion from the SVG arc implementation notes. Cubics
// span no more than 90 degrees and retain editable endpoints and tangents.
function arc(p,rx,ry,angle,large,sweep,q) {
    rx=Math.abs(rx);ry=Math.abs(ry);if(same(p,q))return [];
    if(!rx||!ry)return [{p0:p,p1:p,p2:q,p3:q,line:true}];
    const phi=angle*Math.PI/180,c=Math.cos(phi),s=Math.sin(phi),dx=(p.x-q.x)/2,dy=(p.y-q.y)/2;
    const x=c*dx+s*dy,y=-s*dx+c*dy,scale=x*x/(rx*rx)+y*y/(ry*ry);
    if(scale>1){rx*=Math.sqrt(scale);ry*=Math.sqrt(scale);}
    const factor=(large===sweep?-1:1)*Math.sqrt(Math.max(0,(rx*rx*ry*ry-rx*rx*y*y-ry*ry*x*x)/(rx*rx*y*y+ry*ry*x*x)));
    const cx=factor*rx*y/ry,cy=-factor*ry*x/rx;
    const center={x:c*cx-s*cy+(p.x+q.x)/2,y:s*cx+c*cy+(p.y+q.y)/2};
    const start=Math.atan2((y-cy)/ry,(x-cx)/rx);let delta=Math.atan2((-y-cy)/ry,(-x-cx)/rx)-start;
    if(sweep&&delta<0)delta+=2*Math.PI;if(!sweep&&delta>0)delta-=2*Math.PI;
    const n=Math.ceil(Math.abs(delta)/(Math.PI/2)),step=delta/n,out=[];
    const at=t=>({x:center.x+c*rx*Math.cos(t)-s*ry*Math.sin(t),y:center.y+s*rx*Math.cos(t)+c*ry*Math.sin(t)});
    const tangent=t=>({x:-c*rx*Math.sin(t)-s*ry*Math.cos(t),y:-s*rx*Math.sin(t)+c*ry*Math.cos(t)});
    for(let i=0;i<n;i++) {
        const a=start+i*step,b=a+step,k=4/3*Math.tan(step/4),a0=i?at(a):p,b0=i===n-1?q:at(b),da=tangent(a),db=tangent(b);
        out.push({p0:a0,p1:{x:a0.x+k*da.x,y:a0.y+k*da.y},p2:{x:b0.x-k*db.x,y:b0.y-k*db.y},p3:b0});
    }
    return out;
}
function pathData(d) {
    let i=0,command='',p={x:0,y:0},sub=null,previous='',lastC=null,lastQ=null,total=0;const paths=[];
    const space=()=>{while(/[\s,]/.test(d[i]||'')&&i<d.length)i++;};
    function number(flag=false){space();const m=(flag?/^[01]/:/^[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/).exec(d.slice(i));if(!m)throw Error('Invalid SVG path parameters');i+=m[0].length;const v=Number(m[0]);if(!Number.isFinite(v))throw Error('Non-finite SVG path');return v;}
    const add=s=>{if(++total>1000000)throw Error('SVG path is too complex');sub.segments.push(s);p=s.p3;};
    const line=q=>add({p0:p,p1:p,p2:q,p3:q,line:true});
    while(true) {
        space();if(i>=d.length)break;
        if(/[a-z]/i.test(d[i]))command=d[i++];else if(!command)throw Error('Missing SVG path command');
        const c=command.toUpperCase(),relative=command!==c;
        const pair=()=>({x:number()+(relative?p.x:0),y:number()+(relative?p.y:0)});
        if(c==='M') {p=pair();sub={start:p,segments:[],closed:false};paths.push(sub);command=relative?'l':'L';}
        else {
            if(!sub)throw Error('SVG path must start with moveto');
            if(c==='Z'){if(!same(p,sub.start))line(sub.start);sub.closed=true;p=sub.start;command='';}
            else if(c==='L')line(pair());
            else if(c==='H')line({x:number()+(relative?p.x:0),y:p.y});
            else if(c==='V')line({x:p.x,y:number()+(relative?p.y:0)});
            else if(c==='C'||c==='S') {
                const a=c==='C'?pair():/[CS]/.test(previous)?{x:2*p.x-lastC.x,y:2*p.y-lastC.y}:p;
                const b=pair(),q=pair();add({p0:p,p1:a,p2:b,p3:q});lastC=b;
            } else if(c==='Q'||c==='T') {
                const a=c==='Q'?pair():/[QT]/.test(previous)?{x:2*p.x-lastQ.x,y:2*p.y-lastQ.y}:p,q=pair();
                add({p0:p,p1:{x:p.x+2/3*(a.x-p.x),y:p.y+2/3*(a.y-p.y)},p2:{x:q.x+2/3*(a.x-q.x),y:q.y+2/3*(a.y-q.y)},p3:q});lastQ=a;
            } else if(c==='A') {const rx=number(),ry=number(),a=number(),large=number(true),sweep=number(true),q=pair();for(const s of arc(p,rx,ry,a,large,sweep,q))add(s);}
            else throw Error('Unsupported SVG path command '+command);
        }
        previous=c;
    }
    return paths.filter(p=>p.segments.length);
}
const NAMES={black:'#000000',white:'#ffffff',red:'#ff0000',green:'#008000',blue:'#0000ff',yellow:'#ffff00',gray:'#808080',grey:'#808080',silver:'#c0c0c0',maroon:'#800000',purple:'#800080',fuchsia:'#ff00ff',lime:'#00ff00',olive:'#808000',navy:'#000080',teal:'#008080',aqua:'#00ffff',orange:'#ffa500',rebeccapurple:'#663399',transparent:'#00000000'};
function color(value,alpha,warn) {
    value=value.trim().toLowerCase();if(value==='none')return null;
    value=NAMES[value]||value;let rgba;
    if(/^#[\da-f]{3,4}$/i.test(value))value='#'+value.slice(1).split('').map(c=>c+c).join('');
    if(/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value))rgba=[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)).concat(value.length===9?parseInt(value.slice(7),16)/255:1);
    else {
        const m=/^rgba?\(([^)]*)\)$/.exec(value);
        if(m){const v=m[1].trim().split(/[\s,/]+/);if(v.length===3||v.length===4) {
            rgba=v.slice(0,3).map(s=>s.endsWith('%')?parseFloat(s)*255/100:parseFloat(s));rgba.push(v[3]===undefined?1:parseFloat(v[3])/(v[3].endsWith('%')?100:1));
        }}
    }
    if(!rgba||!rgba.every(Number.isFinite)){warn(value.startsWith('url(')?'Paint servers (gradients/patterns) omitted':'Unsupported color '+value);return null;}
    const byte=v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0');
    return '#'+rgba.slice(0,3).map(byte).join('')+(rgba[3]*alpha<1?byte(255*rgba[3]*alpha):'');
}
const INHERITED=['fill','stroke','stroke-width','fill-opacity','stroke-opacity','fill-rule','color','visibility','stroke-linecap','stroke-linejoin','stroke-dasharray','vector-effect','font-size','font-family','font-weight','font-style','text-anchor','dominant-baseline','letter-spacing','word-spacing'];
function fromSVG(source) {
    const root=xml(source),shapes=[],warnings=new Set();const warn=s=>warnings.add(s);
    const definitions=new Map();
    function index(node){
        if(node.attrs.id)definitions.set(node.attrs.id,node);
        if(node.name==='style')warn('CSS stylesheets are not supported');
        if(node.name==='script')warn('<script> is not supported and was skipped');
        for(const key of Object.keys(node.attrs))if(/^on/i.test(key))warn('SVG event handlers ignored');
        for(const child of node.children)index(child);
    }index(root);
    function declarations(a) {
        const result={...a};
        if(a.style)for(const entry of a.style.split(';')) {
            if(!entry.trim())continue;const colon=entry.indexOf(':');if(colon<0){warn('Invalid inline style ignored');continue;}
            result[entry.slice(0,colon).trim()]=entry.slice(colon+1).trim();
        }
        return result;
    }
    function definition(id,seen=new Set()) {
        if(seen.has(id)||seen.size>64){warn('Cyclic gradient reference omitted');return null;}seen.add(id);
        const node=definitions.get(id);if(!node||!['linearGradient','radialGradient'].includes(node.name)){warn('Missing or unsupported paint server '+id);return null;}
        const href=node.attrs.href||node.attrs['xlink:href'];
        const parent=href&&href.startsWith('#')?definition(href.slice(1),seen):null;
        if(href&&!href.startsWith('#'))warn('External gradient references are not supported');
        return {type:node.name,attrs:{...(parent?.attrs||{}),...node.attrs},stops:node.children.filter(c=>c.name==='stop').length?node.children.filter(c=>c.name==='stop'):parent?.stops||[]};
    }
    function length(v,fallback=0) {
        if(v===undefined)return fallback;
        const m=/^\s*([-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?)\s*(px|pt|pc|mm|cm|in|%)?\s*$/.exec(v);
        if(!m)throw Error('Unsupported SVG length '+v);
        if(m[2]==='%')throw Error('Percentage geometry is not supported');
        return Number(m[1])*({pt:96/72,pc:16,mm:96/25.4,cm:96/2.54,in:96}[m[2]]||1);
    }
    const vb=root.attrs.viewBox===undefined?null:numbers(root.attrs.viewBox);
    if(vb&&(vb.length!==4||vb[2]<=0||vb[3]<=0))throw Error('Invalid SVG viewBox');
    const dimension=(s,fallback)=>s&&s.trim().endsWith('%')?fallback:length(s,fallback);
    const width=dimension(root.attrs.width,vb?vb[2]:300),height=dimension(root.attrs.height,vb?vb[3]:150);
    if(![width,height].every(n=>Number.isFinite(n)&&n>0&&n<=100000))throw Error('Invalid SVG canvas');
    let viewport=ID;
    if(vb) {
        const par=(root.attrs.preserveAspectRatio||'xMidYMid meet').trim();let sx=width/vb[2],sy=height/vb[3],x=0,y=0;
        if(par!=='none') {
            if(!/^x(Min|Mid|Max)Y(Min|Mid|Max)( (meet|slice))?$/.test(par))throw Error('Unsupported preserveAspectRatio');
            sx=sy=par.endsWith('slice')?Math.max(sx,sy):Math.min(sx,sy);
            x=(width-vb[2]*sx)*(par.includes('xMax')?1:par.includes('xMid')?.5:0);
            y=(height-vb[3]*sy)*(par.includes('YMax')?1:par.includes('YMid')?.5:0);
            if(par.endsWith('slice'))warn('Viewport clipping is not supported');
        }
        viewport=[sx,0,0,sy,x-vb[0]*sx,y-vb[1]*sy];
    }
    function record(type,data){if(shapes.length>=100000)throw Error('Too many SVG shapes');shapes.push({type,data:{type,rotation:0,...data}});}
    function gradient(value,m,box,style,opacity) {
        const ref=/^url\(\s*['"]?#([^\s)'" ]+)['"]?\s*\)/.exec(value||'');if(!ref)return null;
        const g=definition(ref[1]);if(!g)return null;
        const a=g.attrs,unit=a.gradientUnits||'objectBoundingBox';
        if(!['objectBoundingBox','userSpaceOnUse'].includes(unit)){warn('Unsupported gradient units');return null;}
        const amount=(v,f)=>{const n=v===undefined?f:v.trim().endsWith('%')?parseFloat(v)/100:length(v);if(!Number.isFinite(n))throw Error('Invalid SVG gradient number');return n;};
        const stops=g.stops.map(node=>{const s=declarations(node.attrs),v=s['stop-color']||'#000000',alpha=amount(s['stop-opacity'],1);return {offset:Math.max(0,Math.min(1,amount(s.offset,0))),color:color(v==='currentColor'?style.color:v,opacity*Math.max(0,Math.min(1,alpha)),warn)};});
        if(!stops.length){warn('Empty gradient omitted');return null;}
        if(stops.length>2)warn('Gradients with more than two stops approximated using their endpoint stops');
        if(a.spreadMethod&&a.spreadMethod!=='pad')warn('Repeating/reflecting gradients approximated using pad');
        const first=stops[0],last=stops.at(-1);if(!first.color||!last.color)return null;
        if(first.offset>=last.offset)return {solid:last.color};
        const bbox=unit==='objectBoundingBox'?[box.width,0,0,box.height,box.left,box.top]:ID;
        const gm=mul(m,mul(bbox,transform(a.gradientTransform||'')));
        const coord=(v,f,axis)=>{
            const n=amount(v,f);if(unit==='objectBoundingBox'||!String(v||'').endsWith('%'))return n;
            return n*(axis==='x'?(vb?vb[2]:width):(vb?vb[3]:height));
        };
        if(g.type==='linearGradient') {
            const p={x:coord(a.x1,0,'x'),y:coord(a.y1,0,'y')},q={x:coord(a.x2,unit==='objectBoundingBox'?1:(vb?vb[2]:width),'x'),y:coord(a.y2,0,'y')};
            const dx=q.x-p.x,dy=q.y-p.y,len=dx*dx+dy*dy,det=gm[0]*gm[3]-gm[1]*gm[2];
            if(!len||!det)return {solid:last.color};
            // A gradient is a scalar field: transform its normal by inverse
            // transpose, including under a non-square object bounding box.
            const nx=(gm[3]*dx-gm[1]*dy)/det/len,ny=(-gm[2]*dx+gm[0]*dy)/det/len,n=nx*nx+ny*ny,origin=point(gm,p);
            return {type:'linear',start:{x:origin.x+nx/n*first.offset,y:origin.y+ny/n*first.offset},end:{x:origin.x+nx/n*last.offset,y:origin.y+ny/n*last.offset},startColor:first.color,endColor:last.color};
        }
        const cx=coord(a.cx,unit==='objectBoundingBox'?.5:(vb?vb[2]:width)/2,'x'),cy=coord(a.cy,unit==='objectBoundingBox'?.5:(vb?vb[3]:height)/2,'y');
        const diagonal=Math.hypot(vb?vb[2]:width,vb?vb[3]:height)/Math.SQRT2;
        const r=amount(a.r,unit==='objectBoundingBox'?.5:diagonal/2)*(unit==='userSpaceOnUse'&&String(a.r||'').endsWith('%')?diagonal:1);
        if(r<0)throw Error('Negative SVG gradient radius');if(!r)return {solid:last.color};
        if(a.fx&&coord(a.fx,cx,'x')!==cx||a.fy&&coord(a.fy,cy,'y')!==cy||a.fr&&amount(a.fr,0)!==0)warn('Off-center radial gradient focus is unsupported; using a centered gradient');
        if(Math.abs(Math.hypot(gm[0],gm[1])-Math.hypot(gm[2],gm[3]))>1e-6||Math.abs(gm[0]*gm[2]+gm[1]*gm[3])>1e-6)warn('Elliptical radial gradients approximated as circular');
        if(first.offset!==0||last.offset!==1)warn('Radial gradient stop offsets approximated');
        return {type:'radial',center:point(gm,{x:cx,y:cy}),radius:r*Math.sqrt(Math.abs(gm[0]*gm[3]-gm[1]*gm[2])),startColor:first.color,endColor:last.color};
    }
    function attachPaint(start,g,blend) {
        for(const s of shapes.slice(start)) {
            if(blend)s.data.blendMode=blend;
            if(!g||!s.data.fillColor||g.solid)continue;
            const b=s.type==='Text'?s.data._gradientBounds:require('./fill-style').bounds([...s.data.points,...(s.data.controlPoints||[])]);
            const normalize=p=>({x:(p.x-b.left)/b.width,y:(p.y-b.top)/b.height});
            s.data.fillGradient={...g,baseColor:s.data.fillColor};
            for(const key of ['start','end','center'])if(g[key])s.data.fillGradient[key]=normalize(g[key]);
            if(g.radius!==undefined)s.data.fillGradient.radius=g.radius/Math.max(b.width,b.height);
            delete s.data._gradientBounds;
        }
    }
    function blend(style) {
        const name=style['mix-blend-mode'];if(!name||name==='normal')return null;
        if(name==='multiply'||name==='screen')return name==='multiply'?'Multiply':'Screen';
        warn('Blend mode '+name+' is not supported and was ignored');return null;
    }
    function emit(paths,m,style,opacity) {
        const paint=value=>value==='currentColor'?style.color:value;
        const alpha=v=>{const n=v===undefined?1:parseFloat(v)/(String(v).endsWith('%')?100:1);if(!Number.isFinite(n))throw Error('Invalid SVG paint opacity');return Math.max(0,Math.min(1,n));};
        const localBox=require('./fill-style').pathBounds(paths.flatMap(p=>p.segments));
        const g=gradient(style.fill,m,localBox,style,opacity*alpha(style['fill-opacity']));
        const fill=g?(g.solid||g.startColor):color(paint(style.fill),opacity*alpha(style['fill-opacity']),warn),stroke=color(paint(style.stroke),opacity*alpha(style['stroke-opacity']),warn);
        const firstShape=shapes.length,mode=blend(style);
        const scale=Math.sqrt(Math.abs(m[0]*m[3]-m[1]*m[2]));
        const sw=Math.max(0,length(style['stroke-width'],1))*scale;
        if(stroke&&sw&&Math.abs(m[0]*m[2]+m[1]*m[3]) + Math.abs(Math.hypot(m[0],m[1])-Math.hypot(m[2],m[3]))>1e-6)warn('Nonuniform stroke scaling approximated');
        if(!fill&&(!stroke||!sw))return;
        paths=paths.map(path=>({...path,segments:path.segments.map(s=>({...s,p0:point(m,s.p0),p1:point(m,s.p1),p2:point(m,s.p2),p3:point(m,s.p3)}))}));
        const linear=paths.every(p=>p.segments.every(s=>s.line));
        const vertices=p=>[p.segments[0].p0,...p.segments.map(s=>s.p3)];
        const spline=(p,f,s)=>record('BezierSpline',{points:vertices(p),controlPoints:p.segments.flatMap(s=>[s.p1,s.p2]),manuallyEditedControls:p.segments.flatMap((_,i)=>[2*i,2*i+1]),fillColor:f,strokeColor:s,strokeWidth:s?sw:0});
        if(paths.length===1) {
            const p=paths[0];
            if(linear&&p.closed)record('Polygon',{points:vertices(p).slice(0,-1),fillColor:fill,strokeColor:stroke,strokeWidth:sw});
            else {
                // SVG fills implicitly close an open path, but its stroke stays open.
                if(fill&&!p.closed){const q={...p,segments:[...p.segments,{p0:p.segments.at(-1).p3,p1:p.segments.at(-1).p3,p2:p.segments[0].p0,p3:p.segments[0].p0,line:true}]};spline(q,fill,null);if(stroke&&sw)spline(p,null,stroke);}
                else spline(p,fill,stroke);
            }
            attachPaint(firstShape,g,mode);return;
        }
        if(fill) {
            if(style['fill-rule']!=='evenodd')warn('Compound nonzero fill rule is unsupported; imported using even-odd');
            if(!linear)warn('Compound curved fills approximated as editable polygons');
            const flatten=require('./path-editing').flatten;
            const rings=paths.map(p=>linear?vertices(p):p.segments.flatMap(s=>flatten(s,.2).slice(0,-1)).concat(p.segments.at(-1).p3));
            const points=[],origin=rings[0][0];
            // Doubled bridges cancel in PDG's even-odd polygon fill. Strokes
            // stay separate to avoid drawing these artificial connections.
            for(const ring of rings){for(const p of ring)points.push(p);points.push(ring[0],origin);}
            record('Polygon',{points,fillColor:fill,strokeColor:null,strokeWidth:0});
        }
        if(stroke&&sw)for(const p of paths)spline(p,null,stroke);
        attachPaint(firstShape,g,mode);
    }
    function visit(node,parent,m,opacity) {
        const a=node.attrs,style={};for(const k of INHERITED)if(parent[k]!==undefined)style[k]=parent[k];
        Object.assign(style,declarations(a));
        for(const k of INHERITED)if(style[k]==='inherit')style[k]=parent[k];
        if(style.display==='none')return;
        if(['defs','title','desc','metadata'].includes(node.name))return;
        if(node.name==='style'){warn('CSS stylesheets are not supported');return;}
        if(!['svg','g','path','polygon','polyline','line','rect','circle','ellipse','text'].includes(node.name)){warn('<'+node.name+'> is not supported and was skipped');return;}
        for(const key of ['clip-path','mask','filter','marker-start','marker-mid','marker-end'])if(style[key]&&style[key]!=='none'&&style[key]!=='normal')warn(key+' is not supported and was ignored');
        for(const key of ['stroke-dasharray','vector-effect'])if(style[key]&&style[key]!=='none')warn(key+' is not supported and was ignored');
        const supportedStyles=new Set([...INHERITED,'opacity','transform','display','clip-path','mask','filter','marker-start','marker-mid','marker-end','mix-blend-mode','stroke-miterlimit']);
        if(a.style)for(const entry of a.style.split(';')){const key=entry.slice(0,entry.indexOf(':')).trim();if(key&&!supportedStyles.has(key))warn('CSS property '+key+' is unsupported');}
        if(style['stroke-miterlimit']&&style['stroke-miterlimit']!=='4')warn('Custom stroke miter limits are unsupported');
        if(style['stroke-linecap']&&style['stroke-linecap']!=='butt')warn('Custom stroke caps are not supported');
        if(style['stroke-linejoin']&&style['stroke-linejoin']!=='miter')warn('Custom stroke joins are not supported');
        for(const key of Object.keys(a))if(/^on/i.test(key))warn('SVG event handlers ignored');
        if(a.class)warn('CSS classes are not supported');
        if(node.name==='svg'&&node!==root){warn('Nested SVG viewports are not supported and were skipped');return;}
        m=mul(m,transform(style.transform||''));
        if(style.opacity!==undefined&&style.opacity!=='inherit') {
            const value=parseFloat(style.opacity)/(String(style.opacity).endsWith('%')?100:1);if(!Number.isFinite(value))throw Error('Invalid SVG opacity');
            opacity*=Math.max(0,Math.min(1,value));
            if(node.children.length&&value!==1)warn('Group opacity applied per shape; overlapping shapes may differ');
        }
        if(node.name==='svg'||node.name==='g'){
            if(style['mix-blend-mode']&&style['mix-blend-mode']!=='normal')warn('Group blend modes are unsupported and were ignored');
            for(const child of node.children)visit(child,style,m,opacity);return;
        }
        if(style.visibility==='hidden'||style.visibility==='collapse')return;
        if(node.name==='text') {
            const text=node.content.map(function content(item){if(typeof item==='string')return item;if(item.name==='tspan'){warn('Text spans flattened; span styling and positioning are not supported');return item.content.map(content).join('');}warn('<'+item.name+'> in text is unsupported and was skipped');return '';}).join('').replace(/\s+/g,' ').trim();
            if(!text)return;
            const size=length(style['font-size'],16),sx=Math.hypot(m[0],m[1]),sy=Math.hypot(m[2],m[3]),rotation=Math.atan2(m[1],m[0]);
            if(Math.abs(sx-sy)>1e-6||Math.abs(m[0]*m[2]+m[1]*m[3])>1e-6||m[0]*m[3]-m[1]*m[2]<0)warn('Skewed, reflected or nonuniformly scaled text approximated with uniform scaling');
            const fontSize=size*sx,family=(style['font-family']||'serif').split(',')[0].trim().replace(/^['"]|['"]$/g,''),fontName=({'serif':'Times New Roman','sans-serif':'Arial','monospace':'Courier New'})[family]||family,textStyle=(style['font-weight']==='bold'||Number(style['font-weight'])>=600?1:0)|(['italic','oblique'].includes(style['font-style'])?2:0);
            if(!Number.isFinite(fontSize)||fontSize<=0||fontSize>10000)throw Error('Invalid SVG font size');
            let ascent=fontSize*.8,descent=fontSize*.2,textWidth=text.length*fontSize*.6,minimum=fontSize*2.5;
            if(typeof pdg!=='undefined') {
                const font=pdg.gfx.createFont(fontName),port=pdg.gfx.createOffscreenPort(new pdg.Rect(1,1));
                try{port.setFontForStyle(textStyle,font);ascent=Math.ceil(font.getFontAscent(fontSize,textStyle));descent=Math.ceil(font.getFontDescent(fontSize,textStyle));textWidth=port.getTextWidth(text,fontSize,textStyle);minimum=port.getTextWidth('MMM',fontSize,textStyle);}finally{pdg.gfx.closeGraphicsPort(port);}
            } else warn('Text metrics estimated without the PDG runtime');
            const first=(v,f=0)=>{if(v===undefined)return f;const list=v.trim().split(/[\s,]+/);if(list.length>1)warn('Per-character text positions are unsupported; using the first position');return length(list[0]);};
            const origin=point(m,{x:first(a.x)+first(a.dx),y:first(a.y)+first(a.dy)}),w=Math.max(minimum,textWidth)+8,h=ascent+descent+8;
            const anchor=style['text-anchor']||'start',offset=anchor==='middle'?textWidth/2:anchor==='end'?textWidth:0;
            let dy=h/2-4-ascent;const baseline=style['dominant-baseline'];
            if(baseline&&baseline!=='auto'&&baseline!=='alphabetic')warn('Non-alphabetic text baseline is unsupported');
            for(const key of ['letter-spacing','word-spacing'])if(style[key]&&style[key]!=='normal'&&style[key]!=='0')warn(key+' is unsupported');
            if(a.rotate)warn('Per-character text rotation is unsupported');
            if(style.stroke&&style.stroke!=='none')warn('Text stroke is unsupported and was omitted');
            const dx=w/2-4-offset,c=Math.cos(rotation),s=Math.sin(rotation),x=origin.x+c*dx-s*dy-w/2,y=origin.y+s*dx+c*dy-h/2;
            const box={left:first(a.x)+first(a.dx)-offset/sx,top:first(a.y)+first(a.dy)-ascent/sy,width:textWidth/sx,height:(ascent+descent)/sy};
            const fillAlpha=opacity*parseFloat(style['fill-opacity']||'1')/(String(style['fill-opacity']||'').endsWith('%')?100:1);
            if(!Number.isFinite(fillAlpha))throw Error('Invalid SVG text opacity');
            const g=gradient(style.fill,m,box,style,Math.max(0,Math.min(1,fillAlpha)));
            const fill=g?(g.solid||g.startColor):color(style.fill==='currentColor'?style.color:style.fill,Math.max(0,Math.min(1,fillAlpha)),warn);
            if(fill){
                // Text retains its rotation as an editable shape transform;
                // unlike path coordinates, its gradient must stay unrotated.
                if(g)for(const key of ['start','end','center'])if(g[key]){const dx=g[key].x-(x+w/2),dy=g[key].y-(y+h/2);g[key]={x:x+w/2+c*dx+s*dy,y:y+h/2-s*dx+c*dy};}
                const start=shapes.length;record('Text',{x,y,text,fontSize,fontName,textStyle,width:w,height:h,fillColor:fill,rotation,_gradientBounds:{left:x+4,top:y+4,width:Math.max(1,textWidth),height:ascent+descent}});attachPaint(start,g,blend(style));delete shapes.at(-1).data._gradientBounds;
            }
            return;
        }
        let paths;
        if(node.name==='path')paths=pathData(a.d||'');
        else if(node.name==='polygon'||node.name==='polyline') {
            const v=numbers(a.points||'');if(v.length%2)throw Error('Invalid SVG points');
            paths=pathData(v.length?'M'+v.slice(0,2).join(' ')+(v.length>2?' L'+v.slice(2).join(' '):'')+(node.name==='polygon'?' Z':''):'');
        } else if(node.name==='line'){style.fill='none';paths=pathData(`M${length(a.x1)} ${length(a.y1)} L${length(a.x2)} ${length(a.y2)}`);}
        else if(node.name==='rect') {
            const x=length(a.x),y=length(a.y),w=length(a.width),h=length(a.height);if(w<0||h<0)throw Error('Negative SVG rectangle size');if(!w||!h)return;
            let rx=Math.min(w/2,length(a.rx,a.ry===undefined?0:length(a.ry))),ry=Math.min(h/2,length(a.ry,rx));if(rx<0||ry<0)throw Error('Negative SVG corner radius');
            paths=pathData(rx&&ry?`M${x+rx} ${y} H${x+w-rx} A${rx} ${ry} 0 0 1 ${x+w} ${y+ry} V${y+h-ry} A${rx} ${ry} 0 0 1 ${x+w-rx} ${y+h} H${x+rx} A${rx} ${ry} 0 0 1 ${x} ${y+h-ry} V${y+ry} A${rx} ${ry} 0 0 1 ${x+rx} ${y} Z`:`M${x} ${y} h${w} v${h} h${-w} Z`);
        } else {
            const x=length(a.cx),y=length(a.cy),rx=length(node.name==='circle'?a.r:a.rx),ry=node.name==='circle'?rx:length(a.ry);if(rx<0||ry<0)throw Error('Negative SVG radius');if(!rx||!ry)return;
            paths=pathData(`M${x-rx} ${y} A${rx} ${ry} 0 1 0 ${x+rx} ${y} A${rx} ${ry} 0 1 0 ${x-rx} ${y} Z`);
        }
        if(paths.length)emit(paths,m,style,opacity);
        for(const child of node.children)visit(child,style,m,opacity);
    }
    visit(root,{fill:'#000000',stroke:'none','stroke-width':'1','fill-rule':'nonzero',color:'#000000'},viewport,1);
    if(!shapes.length)throw Error('SVG contains no supported visible shapes'+(warnings.size?': '+[...warnings].join('; '):''));
    for(const shape of shapes)for(const p of [...(shape.data.points||[{x:shape.data.x,y:shape.data.y}]),...(shape.data.controlPoints||[])])if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1e9||Math.abs(p.y)>1e9)throw Error('SVG coordinates are out of range');
    return {fileFormat:'skrbl-v0.0.4',imageData:[],shapes,canvas:[width,height],importWarnings:[...warnings]};
}
module.exports={fromSVG};
