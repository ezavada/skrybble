// Native cursors use PDG images; browsers use their standard system cursors.
class ToolCursors {
    constructor(port) {this.port=port;this.images=new Map();this.current='default';}
    set(kind) {
        if(kind===this.current)return;
        if(globalThis.skrybbleWeb?.setCanvasCursor)globalThis.skrybbleWeb.setCanvasCursor(kind);
        else if(kind==='default')this.port.resetCursor();
        else {
            if(!this.images.has(kind))this.images.set(kind,this.create(kind));
            const cursor=this.images.get(kind);this.port.setCursor(cursor.image,cursor.hotspot);
        }
        this.current=kind;
    }
    create(kind) {
        if(kind==='grab' || kind==='grabbing')return this.createHand(kind==='grabbing');
        const surface=pdg.gfx.createOffscreenPort(new pdg.Rect(32,32));
        try {
            surface.clear();
            const point=(x,y)=>new pdg.Point(x,y);
            const segments=kind==='text'?[[16,5,16,27],[11,5,21,5],[11,27,21,27]]:
                kind.startsWith('zoom')?[[20,20,28,28],[8,13,18,13],...(kind==='zoom-in'?[[13,8,13,18]]:[])]:
                kind==='crosshair'?[[16,3,16,13],[16,19,16,29],[3,16,13,16],[19,16,29,16]]:
                [[8,17,8,10],[8,10,12,10],[12,10,12,5],[12,5,16,5],[16,5,16,9],
                 [16,9,20,9],[20,9,20,11],[20,11,24,11],[24,11,24,22],[24,22,20,27],
                 [20,27,12,27],[12,27,5,18],[5,18,8,17]];
            for(const [color,width] of [['white',4],['#1e293b',2]]) {
                const attrs=new pdg.Attributes().lineColor(new pdg.Color(color)).lineThickness(width);
                if(kind.startsWith('zoom'))surface.drawCircle(point(13,13),9,attrs);
                for(const [x,y,a,b] of segments)surface.drawLine(point(x,y),point(a,b),attrs);
            }
            return {image:new pdg.Image(surface),hotspot:point(kind.startsWith('zoom')?13:16,kind.startsWith('zoom')?13:16)};
        } finally {pdg.gfx.closeGraphicsPort(surface);}
    }
    createHand(closed) {
        // Filled, rounded silhouettes supersampled at 2x; separate open and
        // closed hands make the drag state clear without jagged finger outlines.
        const large=pdg.gfx.createOffscreenPort(new pdg.Rect(64,64));
        const small=pdg.gfx.createOffscreenPort(new pdg.Rect(32,32));
        try {
            large.clear();small.clear();
            const points=[],point=(x,y)=>points.push(new pdg.Point(x*2,y*2));
            const curve=(x1,y1,x2,y2,x,y)=> {
                const start=points[points.length-1],a={x:start.x/2,y:start.y/2};
                for(let i=1;i<=12;i++) {const t=i/12,u=1-t;
                    point(u*u*u*a.x+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x,
                          u*u*u*a.y+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y);}
            };
            point(10,18);
            if(closed) {
                point(10,12);curve(10,9,13,9,13,12);point(13,10);curve(13,7,17,7,17,10);
                point(17,11);curve(17,8,21,8,21,11);point(21,13);curve(21,10,25,10,25,13);
            } else {
                point(10,8);curve(10,5,13,5,13,8);point(13,14);point(13,5);curve(13,2,17,2,17,5);
                point(17,14);point(17,6);curve(17,3,21,3,21,6);point(21,16);point(21,10);curve(21,7,25,7,25,10);
            }
            point(25,21);curve(25,26,22,29,18,29);point(13,29);curve(10,29,8,27,6,24);
            point(3,19);curve(0,15,3,13,6,16);point(10,20);curve(11,21,12,20,10,18);
            const polygon=new pdg.Polygon();points.forEach(p=>polygon.addPoint(p));
            large.drawPolygon(polygon,new pdg.Attributes().fillColor(new pdg.Color('white'))
                .lineColor(new pdg.Color('#1e293b')).lineThickness(2).lineStyle(pdg.lineStyle_Solid));
            const crease=new pdg.Attributes().lineColor(new pdg.Color('#64748b')).lineThickness(1.4);
            if(!closed) {
                const fingers=new pdg.Attributes().lineColor(new pdg.Color('#1e293b')).lineThickness(2);
                for(const [x,y,end] of [[13,8,16],[17,6,16],[21,10,17]])
                    large.drawLine(new pdg.Point(x*2,y*2),new pdg.Point(x*2,end*2),fingers);
            }
            for(const x of [13,17,21])large.drawLine(new pdg.Point(x*2,18*2),new pdg.Point(x*2,21*2),crease);
            small.drawImage(new pdg.Image(large,pdg.CopyPixels),new pdg.Rect(32,32),new pdg.Attributes().fitType(pdg.fit_Fill));
            return {image:new pdg.Image(small,pdg.CopyPixels),hotspot:new pdg.Point(16,17)};
        } finally {pdg.gfx.closeGraphicsPort(large);pdg.gfx.closeGraphicsPort(small);}
    }
    destroy() {if(this.current!=='default')this.set('default');this.images.clear();}
}
module.exports=ToolCursors;
