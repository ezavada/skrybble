// -----------------------------------------------
// sample.js
// 
// Sample PDG Application using the JavaScript MVC Framework
//
// This sample creates an interactive application with:
// - PDG graphics rendering
// - Event handling (mouse, keyboard, timer)
// - Interactive UI components
// -----------------------------------------------

const framework = require('./index');

// Extract classes from the framework object
const Application = framework.Application.Application;
const AppStates = framework.Application.AppStates;
const View = framework.View.View;
const ViewBinding = framework.View.ViewBinding;
const Controller = framework.Controller.Controller;
const Button = framework.Button.Button;
const Dialog = framework.Dialog.Dialog;
const DialogFlags = framework.Dialog.DialogFlags;
const Checkbox = framework.Checkbox.Checkbox;
const EditText = framework.EditText.EditText;
const ListBox = framework.ListBox.ListBox;
const Scrollbar = framework.Scrollbar.Scrollbar;
const ScrollbarOrientation = framework.Scrollbar.ScrollbarOrientation;
const MessageDialog = framework.MessageDialog.MessageDialog;
const MessageDialogButtonText = framework.MessageDialog.MessageDialogButtonText;

// -----------------------------------------------
// Sample Application class
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

class SampleApplication extends Application {
    constructor() {
        super(pdg.evt, pdg.res);
        
        this.timerMgr = pdg.tm;
        this.graphicsMgr = pdg.gfx;
        this.logMgr = pdg.lm;
        this.configMgr = pdg.cfg;
        
        this.mainController = null;
     }
    
    initialize(args) {
        console.log('SampleApplication initializing with args:', args);
        
        try {
            // Create graphics port first
            this.createGraphicsPort();
            
            // Set up event handlers
            this.setupEventHandlers();
            
            // Create main controller
            this.createMainController();

            // Start the application
            this.setState(AppStates.state_Running);

            console.log('SampleApplication initialized successfully');
            
        } catch (error) {
            console.error('Error initializing SampleApplication:', error);
            this.setState(AppStates.state_Error);
        }
    }
    
    createGraphicsPort() {
        console.log('Creating graphics port...');
        
        // Create a window port for the application, centered on the primary screen
        const screenRect = pdg.gfx.getScreenBounds();
        const windowRect = new pdg.Rect(0, 0, 800, 600);
        windowRect.center(screenRect);
        this.mainPort = pdg.gfx.createWindowPort(windowRect, 'PDG Sample Application', 0);
        
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
    
    createMainController() {
        this.mainController = new SampleController(this, this.mainPort);
        console.log('Main controller created');
    }

    onShutdown(event) {
        console.log('Shutdown event received');
        super.onShutdown(event);
        this.cleanup();
    }
    
    showSampleDialog() {
        const dialog = new MessageDialog(this.mainController, 
            'This is a sample dialog!\n\nIt demonstrates the MessageDialog component.',
            MessageDialogButtonText.OK, 
            MessageDialogButtonText.CANCEL);
        
        console.log('Sample dialog created');
    }
    
    cleanup() {
        console.log('SampleApplication cleaning up...');  
        delete this.mainController;
        this.mainController = null;
        pdg.gfx.closeGraphicsPort(this.mainPort);
        this.mainPort = null;
        super.cleanup();  
        console.log('SampleApplication cleanup complete');
        pdg.quit();
    }
}

// -----------------------------------------------
// Sample Background View
//
// just fills the area with white
// -----------------------------------------------

class SampleBackgroundView extends View {
    constructor(controller, rect) {
        super(controller, rect);
    }

    drawSelf(port, frameNum) {
        const area = port.getDrawingArea();
        // fill the area with white
        var attrs = new pdg.Attributes().fillColor('white');
        port.drawRect(area, attrs);
    }
}


// -----------------------------------------------
// Sample Controller class
//
// controller is responsible for handling events and
// managing views
//
// it tends to be highly specialized for specific
// applications, though you can and should create
// additional controllers for subsections of your
// app, e.g. a controller for a specific dialog, or
// a controller for a specific set of functions or
// features
//
// see Controller.js for more details
// -----------------------------------------------

class SampleController extends Controller {
    constructor(app, port) {
        // super calls setupViews()
        // this is the top level controller, so we give it app and port rather than a parent
        super(null, app, port, true, true, true, false, true);
    }
    
    setupViews() {
        // add the background view
        this.backgroundView = new SampleBackgroundView(this, this.port.getDrawingArea(), ViewBinding.grow);
        
        // UI Components
        this.buttons = [];
        this.checkboxes = [];
        this.editTexts = [];
        this.listBox = null;
        this.scrollbar = null;
        
        this.createButtons(this.port.getDrawingArea());
        this.createCheckboxes(this.port.getDrawingArea());
        this.createEditTexts(this.port.getDrawingArea());
        this.createListBox(this.port.getDrawingArea());
        this.createScrollbar(this.port.getDrawingArea());
    }

    createButtons(area) {
        // TODO: constrain to the area
        // Start/Stop Animation button
        const startStopRect = new pdg.Rect(20, 20, 150, 30);
        const startStopButton = new Button(this, startStopRect, 1, -1, -1, -1);
        startStopButton.setText('Start Animation');
        this.buttons.push(startStopButton);
        
        // Color Change button
        const colorRect = new pdg.Rect(180, 20, 120, 30);
        const colorButton = new Button(this, colorRect, 2, -1, -1, -1);
        colorButton.setText('Change Color');
        this.buttons.push(colorButton);
        
        // Show Dialog button
        const dialogRect = new pdg.Rect(310, 20, 120, 30);
        const dialogButton = new Button(this, dialogRect, 3, -1, -1, -1);
        dialogButton.setText('Show Dialog');
        this.buttons.push(dialogButton);
        
        // Speed Control buttons
        const speedUpRect = new pdg.Rect(440, 20, 80, 30);
        const speedUpButton = new Button(this, speedUpRect, 4, -1, -1, -1);
        speedUpButton.setText('Faster');
        this.buttons.push(speedUpButton);
        
        const speedDownRect = new pdg.Rect(530, 20, 80, 30);
        const speedDownButton = new Button(this, speedDownRect, 5, -1, -1, -1);
        speedDownButton.setText('Slower');
        this.buttons.push(speedDownButton);
    }
    
    createCheckboxes(area) {
        // TODO: constrain to the area
        console.log('Creating first checkbox...');
        // Animation checkbox
        const animRect = new pdg.Rect(20, 70, 200, 25);
        console.log('About to create Checkbox...');
        const animCheckbox = new Checkbox(this, animRect);
        console.log('Checkbox created, setting string...');
        animCheckbox.setString('Enable Animation');
        console.log('Setting checked...');
        animCheckbox.setChecked(true);
        console.log('Adding to array...');
        this.checkboxes.push(animCheckbox);
        
        console.log('Skipping second checkbox for now...');
        // Color cycling checkbox
        // const colorRect = new pdg.Rect(20, 100, 200, 25);
        // const colorCheckbox = new Checkbox(this, colorRect);
        // colorCheckbox.setString('Cycle Colors');
        // colorCheckbox.setChecked(true);
        // this.checkboxes.push(colorCheckbox);
        console.log('Checkboxes created');
    }
    
    createEditTexts(area) {
        // TODO: constrain to the area
        console.log('createEditTexts called');
        // Text input field
        const textRect = new pdg.Rect(20, 140, 200, 30);
        console.log('About to create first EditText...');
        const textEdit = new EditText(this, textRect);
        console.log('First EditText created, setting text...');
        textEdit.setText('Enter some text...');
        console.log('Adding first EditText to array...');
        this.editTexts.push(textEdit);
        
        console.log('About to create second EditText...');
        // Number input field
        const numberRect = new pdg.Rect(240, 140, 100, 30);
        const numberEdit = new EditText(this, numberRect);
        console.log('Second EditText created, setting text...');
        numberEdit.setText('100');
        console.log('Setting filter...');
        numberEdit.setFilter('', '0123456789'); // Only allow numbers
        console.log('Adding second EditText to array...');
        this.editTexts.push(numberEdit);
        console.log('EditTexts created successfully');
    }
    
    createListBox(area) {
        // TODO: constrain to the area
        console.log('createListBox called');
        const listRect = new pdg.Rect(20, 180, 200, 150);
        this.listBox = new ListBox(this, listRect, 5, 
            new pdg.Color(0.9, 0.9, 0.9, 1.0), 
            new pdg.Color(0.3, 0.3, 1.0, 1.0));
        
        console.log('ListBox created, adding items...');
        // Add some sample items
        this.listBox.addToList('Red');
        console.log('Added Red');
        this.listBox.addToList('Green');
        console.log('Added Green');
        this.listBox.addToList('Blue');
        console.log('Added Blue');
        this.listBox.addToList('Yellow');
        console.log('Added Yellow');
        this.listBox.addToList('Magenta');
        console.log('Added Magenta');
        this.listBox.addToList('Cyan');
        console.log('Added Cyan, ListBox completed');
    }
    
    createScrollbar(area) {
        // TODO: constrain to the area
        const scrollRect = new pdg.Rect(240, 180, 20, 150);
        this.scrollbar = new Scrollbar(this, scrollRect, 
            ScrollbarOrientation.VERTICAL, 0, 10, 100);
    }
    
    // Override Controller event handlers as needed, but mostly shouldn't have to
    // onMouseDown(event)
    // onMouseUp(event)
    // onMouseMove(event)
    // onMouseEnter(event)
    // onMouseLeave(event)
    // onKeyDown(event)
    // onKeyUp(event)
    // onKeyPress(event) // key pressed and released
    // onPortDraw(event)
    // onTimer(event)
    buttonClicked(buttonId, button) {
        console.log(`Button clicked: ID=${buttonId}, Text="${button.getText()}"`);
        
        switch (buttonId) {
            case 1: // Start/Stop Animation
                this.app.toggleAnimation();
                button.setText(this.app.isAnimating ? 'Stop Animation' : 'Start Animation');
                break;
                                
            case 3: // Show Dialog
                this.app.showSampleDialog();
                break;
        }
    }
    
    checkboxClicked(checkbox) {
        console.log(`Checkbox clicked: "${checkbox.getString()}", checked: ${checkbox.isChecked()}`);
        
        if (checkbox.getString() === 'Enable Animation') {
            if (checkbox.isChecked()) {
                this.app.startAnimation();
            } else {
                this.app.stopAnimation();
            }
        }
    }
    
    editTextChanged(editText) {
        console.log(`EditText changed: "${editText.getText()}"`);
    }
    
    listBoxSelectionChanged(listBox) {
        console.log(`ListBox selection changed: index=${listBox.getSelectedIndex()}, text="${listBox.getSelectedText()}"`);
    }
    
    scrollbarChanged(scrollbar) {
        console.log(`Scrollbar changed: position=${scrollbar.getCurrentPosition()}`);
    }
}

// Main execution
function main() {
    console.log('Starting PDG Sample Application...');
    
    try {
        // Create and initialize the application
        const app = new SampleApplication();
    } catch (error) {
        console.error('Failed to start sample application:', error);
        pdg.quit();
    }
}

main();
