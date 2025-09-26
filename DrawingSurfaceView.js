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
        const area = port.getDrawingArea();
        // fill the area with white
        port.fillRect(area, 'white');
    }
}

module.exports = DrawingSurfaceView;
