const View = require('./index').View;
const Tools = require('./tools');

// Every icon is rasterized at 2x, cached, then sampled into its 1x toolbar slot.
class ToolPaletteView extends View {
    static TOOL_PALETTE_VIEW_ID=50;
    constructor(controller,rect,binding=0) {
        super(controller,rect,binding);
        this.activeTool=Tools.TOOLS.SELECT;
        this.icons=new Map();
        this.setID(ToolPaletteView.TOOL_PALETTE_VIEW_ID);
        this.layoutParts();
    }
    slotWidth() { return Math.min(50,this.getViewArea().width()/Tools.getToolList().length); }
    layoutParts() {
        this.clickableParts=[];
        const r=this.getViewArea(), w=this.slotWidth();
        Tools.getToolList().forEach((tool,i)=>
            this.addClickablePart(new pdg.Rect(i*w,0,(i+1)*w,r.height()),i+1));
    }
    viewAreaChanged(previous) {
        super.viewAreaChanged(previous);
        if (this.clickableParts) this.layoutParts();
    }
    getIcon(tool,color='black') {
        const key=tool+':'+color;
        if (this.icons.has(key)) return this.icons.get(key);
        const drawing=pdg.createDrawing();
        // Preserve a 50x50 source coordinate frame, including transparent margins.
        drawing.addRect(new pdg.Rect(0,0,50,50),new pdg.Attributes().fillColor(new pdg.Color(0,0,0,0)));
        const line=new pdg.Attributes().lineColor(new pdg.Color('#334155')).lineThickness(2);
        const point=(x,y)=>new pdg.Point(x,y);
        const segment=(x,y,a,b,attrs=line)=>drawing.addLine(point(x,y),point(a,b),attrs);
        const label=value=>drawing.addText(value,new pdg.Rect(5,9,45,43),
            new pdg.Attributes().textSize(26).textStyle(pdg.textStyle_Centered).fillColor(new pdg.Color('#334155')));
        switch(tool) {
            case Tools.TOOLS.SELECT:
                segment(15,10,15,37);segment(15,10,35,29);segment(15,37,23,29);segment(23,29,35,29);break;
            case Tools.TOOLS.ZOOM:
                drawing.addEllipse(point(21,21),10,10,line);segment(29,29,40,40);
                segment(16,21,26,21);segment(21,16,21,26);break;
            case Tools.TOOLS.SCISSORS:
                drawing.addEllipse(point(15,33),5,5,line);drawing.addEllipse(point(35,33),5,5,line);
                segment(18,29,37,10);segment(32,29,13,10);break;
            case Tools.TOOLS.BONE:
                segment(12,38,38,12);segment(12,38,14,24);segment(14,24,38,12);
                drawing.addEllipse(point(12,38),3,3,line);drawing.addEllipse(point(38,12),2,2,line);break;
            case Tools.TOOLS.LINE: segment(10,37,40,12);break;
            case Tools.TOOLS.CIRCLE: drawing.addEllipse(point(25,25),14,14,line);break;
            case Tools.TOOLS.OVAL: drawing.addEllipse(point(25,25),18,11,line);break;
            case Tools.TOOLS.RECT: drawing.addRect(new pdg.Rect(10,13,40,37),line);break;
            case Tools.TOOLS.QUAD:
            case Tools.TOOLS.POLY: {
                const polygon=new pdg.Polygon();
                const points=tool===Tools.TOOLS.QUAD ? [[15,12],[40,15],[35,38],[10,35]] : [[13,13],[35,10],[40,35],[25,29],[10,37]];
                points.forEach(([x,y])=>polygon.addPoint(point(x,y)));
                drawing.addPolygon(polygon,line);break;
            }
            case Tools.TOOLS.SPLINE:
            case Tools.TOOLS.BEZIER: {
                const spline=new pdg.Spline(pdg.spline_Hermite);
                spline.addSegment(point(10,34),point(40,16),new pdg.Vector(45,-60),new pdg.Vector(45,60));
                drawing.addSpline(spline,line);
                for(const [x,y] of [[10,34],[40,16]]) drawing.addEllipse(point(x,y),2,2,new pdg.Attributes().fillColor(new pdg.Color('#ef4444')));
                if(tool===Tools.TOOLS.BEZIER) {segment(10,34,18,12);segment(40,16,32,38);}
                break;
            }
            case Tools.TOOLS.FREEHAND:
                segment(13,36,34,12);segment(17,39,38,15);segment(13,36,11,42);segment(11,42,17,39);segment(34,12,38,15);break;
            case Tools.TOOLS.IMAGE:
                drawing.addRect(new pdg.Rect(9,12,41,38),line);
                segment(10,36,21,24);segment(21,24,29,32);segment(29,32,35,26);segment(35,26,40,36);
                drawing.addEllipse(point(33,19),3,3,line);break;
            case Tools.TOOLS.FONT: break;
            case Tools.TOOLS.TEXT: break; // Render a serif glyph at its natural aspect ratio below.
            case Tools.TOOLS.PAN:
                segment(9,25,41,25);segment(25,9,25,41);
                for(const [x,y,a,b,c,d] of [[9,25,15,19,15,31],[41,25,35,19,35,31],[25,9,19,15,31,15],[25,41,19,35,31,35]]) {
                    segment(x,y,a,b);segment(x,y,c,d);
                }break;
            case Tools.TOOLS.FILL_COLOR:
                drawing.addRect(new pdg.Rect(12,12,38,38),new pdg.Attributes().fillColor(new pdg.Color(color)).lineColor(new pdg.Color('#334155')).lineThickness(1));break;
            case Tools.TOOLS.LINE_COLOR: segment(10,25,40,25,new pdg.Attributes().lineColor(new pdg.Color(color)).lineThickness(4));break;
            case Tools.TOOLS.LINE_WIDTH:
                [1,2,3.5,5].forEach((n,i)=>segment(12,13+i*8,38,13+i*8,new pdg.Attributes().lineColor(new pdg.Color('#334155')).lineThickness(n)));break;
            case Tools.TOOLS.SMOOTHNESS:
                for(let x=10;x<40;x+=2) segment(x,25+5*Math.sin(x*.4),x+2,25+5*Math.sin((x+2)*.4));break;
            case Tools.TOOLS.HELP:label('?');break;
        }
        const surface=pdg.gfx.createOffscreenPort(new pdg.Rect(100,100));
        if (!surface) throw new Error('Cannot create toolbar rendering surface');
        let image;
        try {
            surface.clear();
            if (tool===Tools.TOOLS.TEXT || tool===Tools.TOOLS.FONT) {
                this.textIconFont ||= pdg.gfx.createFont('Times New Roman');
                surface.setFontForStyle(pdg.textStyle_Plain,this.textIconFont);
                const glyph=tool===Tools.TOOLS.TEXT?'T':'Aa',size=tool===Tools.TOOLS.TEXT?72:52;
                const width=surface.getTextWidth(glyph,size,pdg.textStyle_Plain);
                surface.drawText(glyph,new pdg.Point((100-width)/2,78),
                    new pdg.Attributes().font(this.textIconFont).textSize(size)
                        .fillColor(new pdg.Color('#334155')));
            } else surface.drawDrawing(drawing,new pdg.Point(0,0),new pdg.Attributes().scale(2));
            image=new pdg.Image(surface,pdg.CopyPixels);
        }
        finally { pdg.gfx.closeGraphicsPort(surface); }
        // Color previews may change continuously; avoid keeping every sampled color.
        for (const existing of this.icons.keys()) if (existing.startsWith(tool+':')) this.icons.delete(existing);
        this.icons.set(key,image);
        return image;
    }
    drawSelf(port) {
        const r=this.getViewArea(),w=this.slotWidth(),manager=this.controller.getToolManager();
        const selected=this.controller.getDrawing().getShapes().find(s=>s.selected);
        port.drawRect(r,new pdg.Attributes().fillColor(new pdg.Color('#eef2f6')));
        Tools.getToolList().forEach((tool,i)=> {
            const x=r.left+i*w;
            const pressed=tool===this.pressedTool && tool===this.hoverTool;
            const hovered=tool===this.hoverTool,active=tool===this.activeTool;
            if(pressed || hovered || active)port.drawRoundedRect(new pdg.Rect(x+2,r.top+2,x+w-2,r.bottom-2),5,
                new pdg.Attributes().fillColor(new pdg.Color(pressed?'#8daed9':hovered?'#dbe7f5':'#cbdcf3'))
                    .lineColor(new pdg.Color(pressed?'#315c96':hovered?'#7c9abc':'#9fb8d8')).lineStyle(pdg.lineStyle_Solid).lineThickness(1));
            const color=tool===Tools.TOOLS.FILL_COLOR ? selected && selected.fillColor || manager.fillColor || 'white'
                : tool===Tools.TOOLS.LINE_COLOR ? selected && selected.strokeColor || manager.strokeColor || 'black' : 'black';
            port.drawImage(this.getIcon(tool,color),new pdg.Rect(x,r.top,x+w,r.top+50),new pdg.Attributes().fitType(pdg.fit_Fill));
            const key=Object.keys(Tools.TOOL_SHORTCUTS).find(k=>Tools.TOOL_SHORTCUTS[k]===tool) || '';
            port.drawText(key.replace('Shift+','⇧'),new pdg.Point(x+3,r.top+10),new pdg.Attributes().textSize(9).fillColor(new pdg.Color('#475569')));
        });
    }
    updateHover(point) {
        const r=this.getViewArea();
        const tool=point && this.pointInViewArea(point) ? Tools.getToolList()[Math.floor((point.x-r.left)/this.slotWidth())] : null;
        if(tool!==this.hoverTool){this.hoverTool=tool;this.hoverStarted=Date.now();}
    }
    drawHover(port) {
        if(!this.hoverTool || Date.now()-this.hoverStarted<350)return;
        const name=Tools.TOOL_NAMES[this.hoverTool],key=Object.keys(Tools.TOOL_SHORTCUTS).find(k=>Tools.TOOL_SHORTCUTS[k]===this.hoverTool);
        const text=name+(key?' ('+key+')':''),r=this.getViewArea();
        const width=port.getTextWidth(text,13)+16;
        const index=Tools.getToolList().indexOf(this.hoverTool);
        const x=Math.max(r.left,Math.min(r.left+index*this.slotWidth(),r.right-width));
        port.drawRoundedRect(new pdg.Rect(x,r.bottom+4,x+width,r.bottom+28),4,
            new pdg.Attributes().fillColor(new pdg.Color('#f8fafc')).lineColor(new pdg.Color('#94a3b8')).lineThickness(1));
        port.drawText(text,new pdg.Point(x+8,r.bottom+22),new pdg.Attributes().textSize(13).fillColor(new pdg.Color('#334155')));
    }
    updateToolSelection(tool) { this.activeTool=tool; }
    destroy() { this.icons.clear(); super.destroy(); }
}
module.exports=ToolPaletteView;
