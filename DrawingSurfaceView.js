// -----------------------------------------------
// DrawingSurfaceView.js
// 
// Drawing Application using the PDG JavaScript MVC Framework
//
// (c) 2025, Ed Zavada
// -----------------------------------------------

const View = require('./index').View;

// -----------------------------------------------
// Drawing Surface View
//
// just fills the area with white
// -----------------------------------------------

class DrawingSurfaceView extends View {
    constructor(controller, rect) {
        super(controller, rect);
    }

    drawSelf(port, frameNum) {
        const area = this.getViewArea();

        // fill the area with white
        port.drawRect(area, new pdg.Attributes().fillColor(new pdg.Color('white')));
        
        // Draw all shapes from the drawing
        const drawing = this.controller.getDrawing();
        if (drawing) {
            const shapes = drawing.getShapes();
            shapes.forEach(shape => {
                shape.draw(port);
            });
            
            // Draw current shape being drawn
            const toolManager = this.controller.getToolManager();
            if (toolManager.isCurrentlyDrawing()) {
                const currentShape = toolManager.getCurrentShape();
                if (currentShape) {
                    currentShape.draw(port);
                }
            }
        }
        
        // Draw rubber-band selection rectangle
        if (this.controller.rubberBandActive && this.controller.rubberBandStart && this.controller.rubberBandEnd) {
            const start = this.controller.rubberBandStart;
            const end = this.controller.rubberBandEnd;
            
            // Create rectangle from start and end points
            const left = Math.min(start.x, end.x);
            const right = Math.max(start.x, end.x);
            const top = Math.min(start.y, end.y);
            const bottom = Math.max(start.y, end.y);
            
            const rect = new pdg.Rect(left, top, right, bottom);
            
            // Alternate between black and white every 125ms
            const colorName = this.controller.rubberBandColorToggle ? 'white' : 'black';
            const color = new pdg.Color(colorName);
            color.alpha = 0.25; // 25% alpha
            
            // Draw framed (outline only) rectangle using drawRect with only lineColor
            const attrs = new pdg.Attributes()
                .lineColor(color)
                .lineThickness(1)
                .lineStyle(pdg.lineStyle_Solid);
            
            port.drawRect(rect, attrs);
        }
    }
}

module.exports = DrawingSurfaceView;
