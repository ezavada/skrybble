// Bones are editor overlays backed by PDG's serializable AnimationRig.
const codec=require('./pdg-drawing-import');
class BoneEditor {
    constructor(drawing) { this.drawing=drawing;this.bones=[];this.selected=null;this.gesture=null;this.asset=null;this.sprite=null; }
    requireRuntime() {
        if(typeof pdg.AnimationRig!=='function')throw new Error('Bone authoring requires current PDG 1.3. Run with PDG_SOURCE=devel or rebuild the browser runtime.');
    }
    hit(point,tolerance=7,endpoints=false) {
        for(let i=this.bones.length-1;i>=0;i--) {
            const bone=this.bones[i];
            for(const end of ['tip','root'])if(Math.hypot(point.x-bone[end].x,point.y-bone[end].y)<=tolerance)return {bone,end};
            if(!endpoints) {
                const a=bone.root,b=bone.tip,dx=b.x-a.x,dy=b.y-a.y;
                const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy || 1)));
                if(Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy)<=tolerance)return {bone};
            }
        }
        return null;
    }
    begin(point,tolerance,edit=false,shift=false) {
        this.requireRuntime();
        let hit=this.hit(point,tolerance,edit);
        if(edit && shift) {
            const selected=this.bones.find(b=>b.name===this.selected);
            if(selected && Math.hypot(point.x-selected.tip.x,point.y-selected.tip.y)<=tolerance)hit={bone:selected,end:'tip'};
        }
        if(edit) {
            if(!hit)return false;
            this.selected=hit.bone.name;
            this.gesture={edit:hit,point:{...point},shift};
        } else {
            // A shared child start belongs to its parent, even when the
            // reverse-order hit test encounters that child first.
            const connection=[...this.bones].reverse().find(b=>b.parent && Math.hypot(point.x-b.root.x,point.y-b.root.y)<=tolerance);
            this.gesture={root:connection?{...connection.root}:{...point},tip:{...point},parent:connection?connection.parent:hit?hit.bone.name:null};
        }
        return true;
    }
    move(point,shift=this.gesture?.shift || false) {
        const g=this.gesture;if(!g)return;
        if(g.edit) {
            g.point={...point};g.shift=shift;g.preview=this.solveEndpoint(g.edit,point,shift);
            g.shapes=this.drawing.getShapes().map(shape=>{
                const data=JSON.parse(JSON.stringify(this.drawing.serializeShape(shape)));
                const copy=this.drawing.deserializeShape(data.type,data);copy.selected=shape.selected;return copy;
            });
            this.moveArtwork(g.shapes,this.bones,g.preview);
        } else g.tip={...point};
    }
    solveEndpoint(hit,target,shift=false) {
        const bones=this.bones.map(b=>({...b,root:{...b.root},tip:{...b.tip}}));
        const original=hit.bone,parent=this.bones.find(b=>b.name===original.parent);
        if(shift) {
            const moving=new Set([original.name]);
            if(hit.end==='root') {
                if(!parent)return bones;
                const dx=parent.tip.x-parent.root.x,dy=parent.tip.y-parent.root.y,length2=dx*dx+dy*dy;
                if(length2<1e-8)return bones;
                const t=Math.max(0,Math.min(1,((target.x-parent.root.x)*dx+(target.y-parent.root.y)*dy)/length2));
                const offset={x:parent.root.x+t*dx-original.root.x,y:parent.root.y+t*dy-original.root.y};
                for(const b of bones) {
                    if(moving.has(b.parent))moving.add(b.name);
                    if(moving.has(b.name))for(const end of ['root','tip'])b[end]={x:b[end].x+offset.x,y:b[end].y+offset.y};
                }
            } else {
                const ox=original.tip.x-original.root.x,oy=original.tip.y-original.root.y,oldLength=Math.hypot(ox,oy);
                const nx=target.x-original.root.x,ny=target.y-original.root.y,newLength=Math.hypot(nx,ny);
                if(oldLength<1e-8 || newLength<3)return bones;
                const turn=Math.atan2(ny,nx)-Math.atan2(oy,ox),c=Math.cos(turn),s=Math.sin(turn);
                const frames=new Map();
                bones.find(b=>b.name===original.name).tip={...target};
                for(const b of bones) {
                    if(b.parent===original.name) {
                        const x=b.root.x-original.root.x,y=b.root.y-original.root.y;
                        const along=(x*ox+y*oy)/oldLength,across=(-x*oy+y*ox)/oldLength;
                        frames.set(b.name,{old:{...b.root},next:{x:original.root.x+nx/oldLength*along-ny/newLength*across,
                            y:original.root.y+ny/oldLength*along+nx/newLength*across}});
                    } else if(frames.has(b.parent))frames.set(b.name,frames.get(b.parent));
                    const frame=frames.get(b.name);if(!frame)continue;
                    for(const end of ['root','tip']) {
                        const x=b[end].x-frame.old.x,y=b[end].y-frame.old.y;
                        b[end]={x:frame.next.x+c*x-s*y,y:frame.next.y+s*x+c*y};
                    }
                }
            }
            return bones;
        }
        const pivotBone=hit.end==='root' && parent ? parent : original;
        const connected=!!parent && hit.end==='root' || hit.end==='tip' && this.bones.some(b=>b.parent===original.name);
        if(connected) {
            const pivot=pivotBone.root,endpoint=original[hit.end];
            const dx=endpoint.x-pivot.x,dy=endpoint.y-pivot.y;
            // Analytic one-bone IK: preserve the attachment radius and rotate
            // only this parent. No ancestor chain is inferred or solved.
            if(Math.hypot(dx,dy)<1e-8 || Math.hypot(target.x-pivot.x,target.y-pivot.y)<1e-8)return bones;
            const angle=Math.atan2(target.y-pivot.y,target.x-pivot.x)-Math.atan2(dy,dx);
            const c=Math.cos(angle),s=Math.sin(angle),moving=new Set([pivotBone.name]);
            for(const b of bones) {
                if(moving.has(b.parent))moving.add(b.name);
                if(!moving.has(b.name))continue;
                for(const end of ['root','tip']) {
                    const x=b[end].x-pivot.x,y=b[end].y-pivot.y;
                    b[end]={x:pivot.x+c*x-s*y,y:pivot.y+s*x+c*y};
                }
            }
        } else {
            const b=bones.find(b=>b.name===original.name),other=hit.end==='root'?'tip':'root';
            if(Math.hypot(target.x-b[other].x,target.y-b[other].y)>=3)b[hit.end]={...target};
        }
        return bones;
    }
    moveArtwork(shapes,before,after) {
        const angle=b=>Math.atan2(b.tip.y-b.root.y,b.tip.x-b.root.x);
        // Group frames contain only rigid transforms. Convert the bone's world
        // movement into each bound editor element's parent frame before baking it.
        const visit=(shape,frame)=>{
            const old=before.find(b=>b.name===shape.rigBone),next=after.find(b=>b.name===shape.rigBone);
            if(old && next) {
                const turn=angle(next)-angle(old),c=Math.cos(turn),s=Math.sin(turn);
                const center=shape.getCenterPoint(),fc=Math.cos(frame.angle),fs=Math.sin(frame.angle);
                const wx=frame.x+fc*center.x-fs*center.y,wy=frame.y+fs*center.x+fc*center.y;
                const x=next.root.x+c*(wx-old.root.x)-s*(wy-old.root.y)-frame.x;
                const y=next.root.y+s*(wx-old.root.x)+c*(wy-old.root.y)-frame.y;
                this.drawing.moveShape(shape,fc*x+fs*y-center.x,-fs*x+fc*y-center.y);
                shape.rotation=(shape.rotation || 0)+turn;
            } else if(shape.children) {
                const center=shape.getCenterPoint(),a=shape.rotation || 0,c=Math.cos(a),s=Math.sin(a);
                const x=center.x+c*(shape.x-center.x)-s*(shape.y-center.y);
                const y=center.y+s*(shape.x-center.x)+c*(shape.y-center.y);
                const fc=Math.cos(frame.angle),fs=Math.sin(frame.angle);
                const childFrame={x:frame.x+fc*x-fs*y,y:frame.y+fs*x+fc*y,angle:frame.angle+a};
                for(const child of shape.children)visit(child,childFrame);
                // Child edits change a Group's bounds center. Compensate its
                // translation so that its rotation frame stays fixed.
                const nextCenter=shape.getCenterPoint();
                const shiftX=x-(nextCenter.x+c*(shape.x-nextCenter.x)-s*(shape.y-nextCenter.y));
                const shiftY=y-(nextCenter.y+s*(shape.x-nextCenter.x)+c*(shape.y-nextCenter.y));
                shape.x+=shiftX;shape.y+=shiftY;
            }
        };
        for(const shape of shapes)visit(shape,{x:0,y:0,angle:0});
    }
    getShapesForDisplay() {return this.gesture?.shapes || this.drawing.getShapes();}
    finish(saveUndo) {
        const g=this.gesture;if(!g)return false;
        this.gesture=null;
        if(g.edit) {
            const preview=g.preview || this.solveEndpoint(g.edit,g.point,g.shift);
            if(!preview.some((bone,i)=>['root','tip'].some(end=>Math.hypot(bone[end].x-this.bones[i][end].x,bone[end].y-this.bones[i][end].y)>.001)))return true;
            saveUndo('edit bone');
            this.moveArtwork(this.drawing.getShapes(),this.bones,preview);
            this.bones=preview;
        } else {
            if(Math.hypot(g.tip.x-g.root.x,g.tip.y-g.root.y)<3)return true;
            saveUndo('add bone');
            let n=1;while(this.bones.some(b=>b.name==='bone'+n))n++;
            const bone={name:this.bones.length?'bone'+n:'root',parent:g.parent,root:g.root,tip:g.tip};
            this.bones.push(bone);this.selected=bone.name;
            // Each selected editor element becomes an independently editable Part.
            for(const shape of this.drawing.getShapes())if(shape.selected){shape.rigBone=bone.name;shape.selected=false;}
        }
        this.sync();this.getSprite();return true;
    }
    sync() {
        if(!this.bones.length){this.asset=null;this.sprite=null;return;}
        this.requireRuntime();
        this.asset ||= new pdg.AnimationRig();
        const angle=b=>Math.atan2(b.tip.y-b.root.y,b.tip.x-b.root.x);
        for(const b of this.bones) {
            const parent=this.bones.find(p=>p.name===b.parent),a=parent?angle(parent):0;
            const dx=b.root.x-(parent?parent.root.x:0),dy=b.root.y-(parent?parent.root.y:0);
            const options={parent:b.parent,x:Math.cos(a)*dx+Math.sin(a)*dy,y:-Math.sin(a)*dx+Math.cos(a)*dy,
                rotation:angle(b)-a,length:Math.hypot(b.tip.x-b.root.x,b.tip.y-b.root.y)};
            if(this.asset.getBoneNames().includes(b.name))this.asset.setBoneDefinition(b.name,options);
            else this.asset.createBone(b.name,options);
        }
        this.sprite=null;
    }
    rename(name,newName,saveUndo) {
        const bone=this.bones.find(b=>b.name===name);
        if(!bone || name==='root')return false;
        newName=newName.trim();
        if(!newName)throw new Error('Bone name cannot be empty');
        if(newName===name)return false;
        if(this.bones.some(b=>b.name===newName))throw new Error('Bone names must be unique');
        const asset=new pdg.AnimationRig();
        for(const b of this.bones) {
            const definition=this.asset.getBoneDefinition(b.name);
            if(definition.parent===name)definition.parent=newName;
            asset.createBone(b.name===name?newName:b.name,definition);
        }
        saveUndo('rename bone');
        bone.name=newName;
        for(const b of this.bones)if(b.parent===name)b.parent=newName;
        for(const shape of this.allShapes())if(shape.rigBone===name)shape.rigBone=newName;
        this.asset=asset;this.selected=newName;this.getSprite();return true;
    }
    allShapes() {
        const result=[];
        const visit=shape=>{result.push(shape);for(const child of shape.children || [])visit(child);};
        this.drawing.getShapes().forEach(visit);return result;
    }
    getSprite() {
        if(!this.asset)return null;
        // Rebuild artwork on demand, so normal shape edits remain authoritative.
        const sprite=new pdg.Sprite();sprite.setupRig(this.asset);
        let n=0;
        const collect=shape=>{
            if(shape.rigBone)return [{name:shape.rigBone,artwork:shape.getArtwork(1)}];
            if(!shape.children)return [];
            shape.getArtwork(1);
            return shape.children.flatMap(collect).map(entry=>{
                const artwork=pdg.createDrawing();
                artwork.addDrawing(entry.artwork.getBounds(),entry.artwork,shape._appearance);
                return {name:entry.name,artwork};
            });
        };
        for(const entry of this.drawing.getShapes().flatMap(collect)) {
            const bone=this.bones.find(b=>b.name===entry.name);if(!bone)continue;
            const a=Math.atan2(bone.tip.y-bone.root.y,bone.tip.x-bone.root.x),c=Math.cos(a),s=Math.sin(a);
            const artwork=entry.artwork,local=pdg.createDrawing();
            local.addDrawing(artwork.getBounds(),artwork,new pdg.Attributes().setTransform([
                c,-s,0,s,c,0,-c*bone.root.x-s*bone.root.y,s*bone.root.x-c*bone.root.y,1]));
            sprite.createPart('artwork'+(++n)).setDrawing(local).bindToBone(sprite.getBone(bone.name));
        }
        this.sprite=sprite;return sprite;
    }
    snapshot() {
        if(!this.asset)return null;
        const writer=new pdg.Serializer();writer.serialize_obj(this.asset);
        const block=writer.getDataPtr(),bytes=new Uint8Array(block.getDataSize());
        for(let i=0;i<bytes.length;i++)bytes[i]=block.getByte(i);
        return {stream:codec.toBase64(bytes)};
    }
    restore(data) {
        if(!data)return;
        this.requireRuntime();
        const reader=new pdg.Deserializer();reader.setDataPtr(codec.fromBase64(data.stream));
        const asset=reader.deserialize_obj();
        if(!(asset instanceof pdg.AnimationRig))throw new Error('Invalid document rig');
        const bones=[],world=new Map();
        for(const name of asset.getBoneNames()) {
            const d=asset.getBoneDefinition(name),p=d.parent?world.get(d.parent):null;
            if(d.parent&&!p)throw new Error('Invalid bone hierarchy');
            const a=p?p.angle:0,c=Math.cos(a),s=Math.sin(a);
            const root={x:(p?p.root.x:0)+c*d.x-s*d.y,y:(p?p.root.y:0)+s*d.x+c*d.y};
            const angle=a+d.rotation;
            if(d.scaleX!==1 || d.scaleY!==1)throw new Error('Scaled rigs cannot yet be edited in Skrybble');
            const bone={name,parent:d.parent,root,tip:{x:root.x+Math.cos(angle)*d.length,y:root.y+Math.sin(angle)*d.length}};
            bones.push(bone);world.set(name,{root,angle});
        }
        this.asset=asset;this.bones=bones;this.selected=null;this.gesture=null;this.sprite=null;
    }
    deleteSelected(saveUndo) {
        if(!this.selected)return false;
        saveUndo('delete bone');
        const removed=new Set([this.selected]);
        for(const b of this.bones)if(removed.has(b.parent))removed.add(b.name);
        this.asset.removeBone(this.selected,true);
        this.bones=this.bones.filter(b=>!removed.has(b.name));
        for(const shape of this.allShapes())if(removed.has(shape.rigBone))delete shape.rigBone;
        this.selected=null;this.sync();return true;
    }
    draw(canvas) {
        if(!this.bones.length && !this.gesture)return;
        const port=canvas.controls || canvas,attrs=new pdg.Attributes().lineColor(new pdg.Color('#b45309')).lineThickness(2);
        const draw=(bone,selected)=> {
            const root=bone.root,tip=bone.tip;
            attrs.lineColor(new pdg.Color(selected?'#2563eb':'#b45309'));
            const dx=tip.x-root.x,dy=tip.y-root.y,len=Math.hypot(dx,dy)||1;
            const side={x:root.x+dx*.22-dy/len*4,y:root.y+dy*.22+dx/len*4};
            port.drawLine(new pdg.Point(root),new pdg.Point(tip),attrs);
            port.drawLine(new pdg.Point(root),new pdg.Point(side),attrs);
            port.drawLine(new pdg.Point(side),new pdg.Point(tip),attrs);
            port.drawCircle(new pdg.Point(root),4,attrs);port.drawCircle(new pdg.Point(tip),3,attrs);
        };
        for(const bone of this.gesture?.preview || this.bones) {
            draw(bone,bone.name===this.selected);
            canvas.drawText(bone.name,new pdg.Point(bone.root.x+8,bone.root.y-8),
                new pdg.Attributes().textSize(12).fillColor(new pdg.Color('#92400e')));
        }
        if(this.gesture?.root)draw(this.gesture,true);
    }
}
module.exports=BoneEditor;
