// A fixed logical document and a camera independent of screen-space MVC views.
class CanvasNavigation {
    constructor() {
        this.size = 1024;
        this.camera = new pdg.Camera().setLocation(512,512).setZoom(1);
    }
    setViewport(rect) { this.viewport = new pdg.Rect(rect); this.camera.setViewport(rect); this.constrain(); }
    constrain() {
        const p=this.camera.getLocation();
        // Keep the page within reach without forcing its center into the page.
        // Zooming about a page edge can legitimately move the camera outside it.
        const z=this.camera.getZoom();
        const marginX=this.viewport ? this.viewport.width()/(2*z) : 0;
        const marginY=this.viewport ? this.viewport.height()/(2*z) : 0;
        this.camera.setLocation(Math.max(-marginX,Math.min(this.size+marginX,p.x)),
            Math.max(-marginY,Math.min(this.size+marginY,p.y)));
    }
    toWorld(point) { return this.camera.viewToWorld(new pdg.Point(point)); }
    toView(point) { return this.camera.worldToView(new pdg.Point(point)); }
    contains(point) { return point.x>=0 && point.y>=0 && point.x<=1024 && point.y<=1024; }
    pan(dx,dy) {
        const p=this.camera.getLocation(), z=this.camera.getZoom();
        this.camera.setLocation(p.x-dx/z,p.y-dy/z); this.constrain();
    }
    zoomAt(factor,point) {
        const before=this.toWorld(point);
        this.camera.setZoom(Math.max(.25,Math.min(8,this.camera.getZoom()*factor)));
        const after=this.toWorld(point), p=this.camera.getLocation();
        this.camera.setLocation(p.x+before.x-after.x,p.y+before.y-after.y); this.constrain();
    }
    reset() { this.camera.setZoom(1).setLocation(512,512); this.constrain(); }
}
module.exports=CanvasNavigation;
