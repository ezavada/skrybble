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
        port.fillRect(area, 'white');
        
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
    }
}

module.exports = DrawingSurfaceView;
