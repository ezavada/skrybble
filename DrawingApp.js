// -----------------------------------------------
// DrawingApp.js
// 
// Drawing Application using the PDGJavaScript MVC Framework
//
// (c) 2025, Ed Zavada
// -----------------------------------------------

// Extract classes from the framework object
const Application = require('./index').Application;
const DrawingController = require('./DrawingController.js');

const fs = require('fs');

// -----------------------------------------------
// Drawing Application class
// 
// This is the primary class that is instantiated and
// run. It is responsible for creating the controllers
// and not much else. Controllers should do most of the
// work.
//
// it also handles the shutdown event
//
// see Application.js for more details
// -----------------------------------------------

class DrawingApp extends Application {
    initialize(args) {
        this.drawingController = null;
        this.filename = null;

        // Parse command line arguments for filename.
        for (const arg of args || []) {
            if (/\.(skrbl|pdgdrawing|drawing\.json)$/i.test(arg)) {
                this.filename = arg;
                break;
            }
        }
    }

    setupGraphics() {
        this.createGraphicsPort();
    }

    setupControllers() {
        this.createDrawingController();

        if (this.filename) {
            if (fs.existsSync(this.filename)) {
                console.log('Loading file:', this.filename);
                this.drawingController.loadFile(this.filename);
            } else if (/\.skrbl$/i.test(this.filename)) {
                console.log('File does not exist, will use for save:', this.filename);
                this.drawingController.setFilename(this.filename);
            }
        }
    }
    
    createGraphicsPort() {
        console.log('Creating graphics port...');
        
        // Create a window port for the application, centered on the primary screen
        const screenRect = pdg.gfx.getScreenBounds();
        const windowRect = new pdg.Rect(0, 0, screenRect.width() - 100, screenRect.height() - 100);
        windowRect.center(screenRect);
        this.mainPort = pdg.gfx.createWindowPort(windowRect, 'PDG Drawing', 0);
        
        if (this.mainPort) {
            console.log('Graphics port created successfully');
            // Set the graphics manager reference
            this.graphicsMgr = pdg.gfx;
        } else {
            console.error('Failed to create graphics port');
            throw new Error('Failed to create graphics port');
        }
    }
    
    createDrawingController() {
        this.drawingController = new DrawingController(this, this.mainPort);
    }

    _registerEventHandlers() {
        super._registerEventHandlers();
        this.quitRequestHandler=pdg.on(pdg.eventType_QuitRequest,()=>this.onQuitRequest());
    }

    onQuitRequest() {
        // GLFW/Cocoa may still be iterating the windows during this callback.
        // Destroy them only after native event polling has returned to JavaScript.
        if(this.quitTask==null)this.quitTask=setTimeout(()=>{
            this.quitTask=null;
            pdg.quit();
        },0);
        return true;
    }

    onShutdown(event) {
        const handled = super.onShutdown(event);
        this.cleanup();
        return handled;
    }
    
    cleanup() {
        if(this.quitRequestHandler){this.quitRequestHandler.cancel();this.quitRequestHandler=null;}
        if(this.quitTask!=null){clearTimeout(this.quitTask);this.quitTask=null;}
        if (this.drawingController) {
            this.drawingController.destroy();
            this.drawingController = null;
        }
        if (this.mainPort) {
            pdg.gfx.closeGraphicsPort(this.mainPort);
            this.mainPort = null;
        }
        super.cleanup();
    }
}

module.exports = DrawingApp;
