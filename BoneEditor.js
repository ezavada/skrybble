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
    begin(point,tolerance,edit=false) {
        this.requireRuntime();
        const hit=this.hit(point,tolerance,edit);
        if(edit) {
            if(!hit)return false;
            this.selected=hit.bone.name;
            this.gesture={edit:hit,point:{...point}};
        } else {
            this.gesture={root:{...point},tip:{...point},parent:hit?hit.bone.name:null};
        }
        return true;
    }
    move(point) { if(this.gesture)this.gesture.point?this.gesture.point={...point}:this.gesture.tip={...point}; }
    finish(saveUndo) {
        const g=this.gesture;if(!g)return false;
        this.gesture=null;
        if(g.edit) {
            if(Math.hypot(g.point.x-g.edit.bone[g.edit.end].x,g.point.y-g.edit.bone[g.edit.end].y)<.001)return true;
            const other=g.edit.end==='root'?'tip':'root';
            if(Math.hypot(g.point.x-g.edit.bone[other].x,g.point.y-g.edit.bone[other].y)<3)return true;
            saveUndo('edit bone');g.edit.bone[g.edit.end]={...g.point};
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
            const g=this.gesture,root=g?.edit?.bone===bone && g.edit.end==='root'?g.point:bone.root;
            const tip=g?.edit?.bone===bone && g.edit.end==='tip'?g.point:bone.tip;
            attrs.lineColor(new pdg.Color(selected?'#2563eb':'#b45309'));
            const dx=tip.x-root.x,dy=tip.y-root.y,len=Math.hypot(dx,dy)||1;
            const side={x:root.x+dx*.22-dy/len*4,y:root.y+dy*.22+dx/len*4};
            port.drawLine(new pdg.Point(root),new pdg.Point(tip),attrs);
            port.drawLine(new pdg.Point(root),new pdg.Point(side),attrs);
            port.drawLine(new pdg.Point(side),new pdg.Point(tip),attrs);
            port.drawCircle(new pdg.Point(root),4,attrs);port.drawCircle(new pdg.Point(tip),3,attrs);
        };
        for(const bone of this.bones) {
            draw(bone,bone.name===this.selected);
            canvas.drawText(bone.name,new pdg.Point(bone.root.x+8,bone.root.y-8),
                new pdg.Attributes().textSize(12).fillColor(new pdg.Color('#92400e')));
        }
        if(this.gesture?.root)draw(this.gesture,true);
    }
}
module.exports=BoneEditor;
