// -----------------------------------------------
// DrawingController.js
// 
// Drawing Application using the PDG JavaScript MVC Framework
//
// (c) 2025, Ed Zavada
// -----------------------------------------------

const ViewBinding = require('./index').ViewBinding;
const Controller = require('./index').Controller;
const Tools = require('./index').Tools;
const Drawing = require('./index').Drawing;

const DrawingSurfaceView = require('./DrawingSurfaceView.js');

// -----------------------------------------------
// Drawing Controller class
// -----------------------------------------------

class DrawingController extends Controller {
    constructor(app, port) {
        // super calls setupViews()
        // this is the top level controller, so we give it app and port rather than a parent
        super(null, app, port, true, true, true, false, true);
        this.toolManager = new Tools();
        this.drawing = new Drawing();
    }
    
    setupViews() {
        // add the background view
        this.backgroundView = new DrawingSurfaceView(this, this.port.getDrawingArea(), ViewBinding.grow);
    }
}

module.exports = DrawingController;
