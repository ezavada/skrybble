const {Controller,View}=require('./index');
const FONTS=['Arial','Times New Roman','Courier New'];
const SIZES=[12,18,24,32,48,72];
class FontPickerController extends Controller {
    constructor(parent,slotX=0) {
        FontPickerController._slotX=slotX;super(parent);
        this.owner=parent;
        this.targets=parent.drawing.getShapes().filter(shape=>shape.selected && shape.constructor.name==='Text');
        const initial=this.targets[0] || parent.textDefaults;
        this.value={fontName:initial.fontName,fontSize:initial.fontSize,textStyle:initial.textStyle};
        this.before=this.targets.map(shape=>({shape,fontName:shape.fontName,fontSize:shape.fontSize,textStyle:shape.textStyle}));
    }
    setupViews() {
        const area=this.port.getDrawingArea(),width=240,height=310;
        const x=Math.max(area.left,Math.min(FontPickerController._slotX || 0,area.right-width));
        this.popupRect=new pdg.Rect(x,50,x+width,50+height);
        this.mainView=new FontPickerView(this,this.popupRect);
    }
    preview() {for(const shape of this.targets) {Object.assign(shape,this.value);shape.layout(this.port);}}
    doMouseDown(event,view) {if(!view){this.cancel();return true;}return false;}
    doMouseUp(event,view,id,part) {if(!view || part===-1){this.cancel();return true;}return false;}
    doLeftClick(event,view,id,part) {
        if(part>=10 && part<13)this.value.fontName=FONTS[part-10];
        else if(part>=20 && part<26)this.value.fontSize=SIZES[part-20];
        else if(part===30)this.value.textStyle ^= pdg.textStyle_Bold;
        else if(part===31)this.value.textStyle ^= pdg.textStyle_Italic;
        else if(part===40){this.accept();return true;}
        else if(part===41){this.cancel();return true;}
        this.preview();return true;
    }
    doKeyPress(event) {
        if(event.unicode===27){this.cancel();return true;}
        if(event.unicode===13){this.accept();return true;}
        return true;
    }
    restore() {for(const {shape,...style} of this.before) {Object.assign(shape,style);shape.layout(this.port);}}
    accept() {
        this.restore();
        if(this.targets.length) {this.owner.saveUndoState('change font');this.preview();}
        else this.owner.textDefaults={...this.value};
        this.close();
    }
    cancel() {this.restore();this.close();}
    close() {this.owner.fontPickerController=null;this.owner.updateToolSelection(this.owner.toolManager.getCurrentTool());this.destroy();}
}
class FontPickerView extends View {
    constructor(controller,rect) {
        super(controller,rect);
        this.addClickablePart(new pdg.Rect(0,0,240,310),1);
        FONTS.forEach((font,i)=>this.addClickablePart(new pdg.Rect(10,35+i*32,230,65+i*32),10+i));
        SIZES.forEach((size,i)=>this.addClickablePart(new pdg.Rect(10+i*37,146,45+i*37,176),20+i));
        this.addClickablePart(new pdg.Rect(10,188,115,218),30);
        this.addClickablePart(new pdg.Rect(125,188,230,218),31);
        this.addClickablePart(new pdg.Rect(10,270,115,300),40);
        this.addClickablePart(new pdg.Rect(125,270,230,300),41);
    }
    drawSelf(port) {
        const r=this.getViewArea(),value=this.controller.value;
        port.drawRoundedRect(r,6,new pdg.Attributes().fillColor(new pdg.Color('#f8fafc')).lineColor(new pdg.Color('#94a3b8')));
        const label=(text,x,y,font='Arial',size=16,style=0)=>port.drawText(text,new pdg.Point(r.left+x,r.top+y),
            new pdg.Attributes().font(pdg.gfx.createFont(font)).textSize(size).textStyle(style).fillColor(new pdg.Color('#334155')));
        const button=(rect,selected)=>port.drawRoundedRect(new pdg.Rect(r.left+rect[0],r.top+rect[1],r.left+rect[2],r.top+rect[3]),4,
            new pdg.Attributes().fillColor(new pdg.Color(selected?'#cbdcf3':'#e2e8f0')));
        label('Font & style',12,24);
        FONTS.forEach((font,i)=>{button([10,35+i*32,230,65+i*32],value.fontName===font);label(font,18,57+i*32,font);});
        label('Size',12,140,undefined,12);
        SIZES.forEach((size,i)=>{button([10+i*37,146,45+i*37,176],value.fontSize===size);label(String(size),18+i*37,168,undefined,14);});
        button([10,188,115,218],value.textStyle & pdg.textStyle_Bold);label('Bold',20,210,undefined,16,pdg.textStyle_Bold);
        button([125,188,230,218],value.textStyle & pdg.textStyle_Italic);label('Italic',135,210,undefined,16,pdg.textStyle_Italic);
        label('Aa Preview',12,251,value.fontName,22,value.textStyle);
        button([10,270,115,300],true);label('Apply',32,292);
        button([125,270,230,300],false);label('Cancel',148,292);
    }
}
module.exports=FontPickerController;
