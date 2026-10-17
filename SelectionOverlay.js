const {cameraPort}=require('./rendering');

// Selection handles are static between edits and camera changes. Rasterize once
// rather than issuing thousands of immediate circle draws on every idle frame.
class SelectionOverlay {
    draw(port,area,camera,shapes,pointEditor){
        if(!shapes.length)return;
        const origin=camera.worldToView(new pdg.Point(0,0));
        const key=JSON.stringify([area.left,area.top,area.right,area.bottom,origin.x,origin.y,camera.getZoom(),
            shapes.map(s=>[s._geometryKey || s.points || s.getEndpoints(),s.x,s.y,s.x2,s.y2,s.width,s.height,
                s.radius,s.radiusX,s.radiusY,s.rotation,s._rotationGuideLength,s.controlPoints,
                [...(pointEditor.selection.get(s) || [])]])]);
        if(key!==this.key){
            const width=Math.ceil(area.width()),height=Math.ceil(area.height());
            if(!this.surface || this.width!==width || this.height!==height){
                this.destroy();this.surface=pdg.gfx.createOffscreenPort(new pdg.Rect(width,height));
                if(!this.surface)throw Error('Cannot create selection overlay');
                this.width=width;this.height=height;
            }
            this.surface.setDrawingOrigin(area.leftTop());this.surface.clear();
            const controls=cameraPort(this.surface,camera).controls;
            for(const shape of shapes){
                shape.drawEndpoints?.(controls);shape.drawControlPoints?.(controls);shape.drawRotationControl(controls);
            }
            pointEditor.drawHighlights(controls);
            this.image=new pdg.Image(this.surface,pdg.CopyPixels);this.key=key;
        }
        port.drawImage(this.image,area,new pdg.Attributes().fitType(pdg.fit_Fill));
    }
    destroy(){if(this.surface)pdg.gfx.closeGraphicsPort(this.surface);this.surface=null;this.image=null;this.key=null;}
}
module.exports=SelectionOverlay;
