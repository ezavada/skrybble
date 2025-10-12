// -----------------------------------------------
// DrawingApp.js
// 
// Drawing Application using the PDGJavaScript MVC Framework
//
// (c) 2025, Ed Zavada
// -----------------------------------------------

// Extract classes from the framework object
const Application = require('./index').Application;
const AppStates = require('./index').AppStates;
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
    constructor() {
        super(pdg.evt, pdg.res);
        
        this.timerMgr = pdg.tm;
        this.graphicsMgr = pdg.gfx;
        this.logMgr = pdg.lm;
        this.configMgr = pdg.cfg;
        
        this.drawingController = null;
        this.filename = null;
     }
     
    initialize(args) {
        try {
            // Parse command line arguments for filename
            const argList = args || [];
            console.log('argList:', argList);
            
            if (argList && argList.length > 0) {
                // Look for .skrbl file in arguments
                for (let arg of argList) {
                    console.log('Checking arg:', arg);
                    if (arg.endsWith('.skrbl')) {
                        this.filename = arg;
                        console.log('Found .skrbl file:', this.filename);
                        break;
                    }
                }
            }
            
            // Create graphics port first
            this.createGraphicsPort();
            
            // Set up event handlers
            this.setupEventHandlers();
            
            // Create drawing controller
            this.createDrawingController();
            
            // Load file if specified
            if (this.filename) {
                if (fs.existsSync(this.filename)) {
                    console.log('Loading file:', this.filename);
                    this.drawingController.loadFile(this.filename);
                } else {
                    console.log('File does not exist, will use for save:', this.filename);
                    this.drawingController.setFilename(this.filename);
                }
            }

            // Start the application
            this.setState(AppStates.state_Running);
        } catch (error) {
            console.error('Error initializing DrawingApp:', error);
            this.setState(AppStates.state_Error);
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
    
    setupEventHandlers() {
        // Note: Base Application class handles shutdown event via _registerEventHandlers()
        // We only need to set up additional handlers specific to this sample app
    }
    
    createDrawingController() {
        this.drawingController = new DrawingController(this, this.mainPort);
    }

    onShutdown(event) {
        super.onShutdown(event);
        this.cleanup();
    }
    
    cleanup() {
        delete this.drawingController;
        this.drawingController = null;
        pdg.gfx.closeGraphicsPort(this.mainPort);
        this.mainPort = null;
        super.cleanup();  
        pdg.quit();
    }
}

module.exports = DrawingApp;