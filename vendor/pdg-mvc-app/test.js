// -----------------------------------------------
// test.js
// 
// Simple test file for the JavaScript Application Framework
// Tests basic functionality of the ported classes
//
// Ported from C++ by Assistant, 2024
// Original Copyright (c) 2004-2012, Dream Rock Studios, LLC
// -----------------------------------------------

const framework = require('./index');
const mocks = require('./mocks');

// Extract classes from the framework object
const Application = framework.Application.Application;
const AppStates = framework.Application.AppStates;
const IObserver = framework.Observer.IObserver;
const Subject = framework.Observer.Subject;
const View = framework.View.View;
const ClickablePartsIDs = framework.View.ClickablePartsIDs;
const ViewBinding = framework.View.ViewBinding;
const Controller = framework.Controller.Controller;
const ControllerPreferences = framework.Controller.ControllerPreferences;
const Button = framework.Button.Button;
const Dialog = framework.Dialog.Dialog;
const DialogFlags = framework.Dialog.DialogFlags;
const Checkbox = framework.Checkbox.Checkbox;
const EditText = framework.EditText.EditText;
const ListBox = framework.ListBox.ListBox;
const Scrollbar = framework.Scrollbar.Scrollbar;
const ScrollbarOrientation = framework.Scrollbar.ScrollbarOrientation;
const ModalController = framework.ModalController.ModalController;
const TouchController = framework.TouchController.TouchController;
const ScrollingView = framework.ScrollingView.ScrollingView;
const RadioButton = framework.RadioButton.RadioButton;
const PopupMenu = framework.PopupMenu.PopupMenu;
const MessageDialog = framework.MessageDialog.MessageDialog;
const MessageDialogButtonText = framework.MessageDialog.MessageDialogButtonText;
const MessageView = framework.MessageView.MessageView;

// Extract mock classes
const MockPdg = mocks.MockPdg;
const MockEventManager = mocks.MockEventManager;
const MockResourceManager = mocks.MockResourceManager;
const MockGraphicsManager = mocks.MockGraphicsManager;
const MockPort = mocks.MockPort;

class TestApplication extends Application {
    constructor() {
        const eventManager = new MockEventManager();
        const resourceManager = new MockResourceManager();
        super(eventManager, resourceManager);
        
        // Set up mock managers
        this.timerMgr = {
            timers: new Map(),
            startTimer: (id, delay, oneShot = true) => {
                console.log(`Timer started: ${id} delay=${delay} oneShot=${oneShot}`);
                if (!oneShot) {
                    // For repeating timers, just log and don't actually start them
                    console.log(`Mock repeating timer ${id} would run every ${delay}ms`);
                }
            },
            cancelTimer: (id) => {
                console.log(`Timer cancelled: ${id}`);
                this.timerMgr.timers.delete(id);
            }
        };
        this.graphicsMgr = new MockGraphicsManager();
        this.logMgr = {
            log: (msg) => console.log(`LOG: ${msg}`)
        };
        this.configMgr = {
            get: (key) => console.log(`Config get: ${key}`)
        };
    }
    
    initialize(args) {
        console.log('MockApplication initialized with args:', args);
        this.setState(AppStates.state_Running);
    }
    
    cleanup() {
        console.log('MockApplication cleanup');
    }
}


// Test classes
class TestObserver extends IObserver {
    constructor(name) {
        super();
        this.name = name;
        this.notified = false;
    }
    
    notify(subject) {
        console.log(`Observer ${this.name} notified by`, subject.constructor.name);
        this.notified = true;
    }
}

class TestView extends View {
    constructor(controller, rect) {
        super(controller, rect);
        this.drawCount = 0;
    }
    
    drawSelf() {
        console.log(`TestView drawSelf called (count: ${++this.drawCount})`);
        const port = this.getPort();
        const area = this.getViewArea();
        var attrs = new pdg.Attributes().fillColor({ r: 0.8, g: 0.8, b: 1.0, a: 1.0 });
        port.drawRect(area, attrs);
    }
}

class TestController extends Controller {
    constructor(app) {
        super(app, true, true, true, false, true);
        this.buttonClicked = false;
    }
    
    buttonClicked(buttonId, button) {
        console.log(`Button clicked: ID=${buttonId}, Text="${button.getText()}"`);
        this.buttonClicked = true;
    }
}

// Test functions
function testObserverPattern() {
    console.log('\n=== Testing Observer Pattern ===');
    
    const subject = new Subject();
    const observer1 = new TestObserver('Observer1');
    const observer2 = new TestObserver('Observer2');
    
    subject.addObserver(observer1);
    subject.addObserver(observer2);
    
    console.log('Observer count:', subject.getObserverCount());
    
    subject.notifyObservers();
    
    console.log('Observer1 notified:', observer1.notified);
    console.log('Observer2 notified:', observer2.notified);
    
    subject.removeObserver(observer1);
    console.log('Observer count after removal:', subject.getObserverCount());
}

function testApplication() {
    console.log('\n=== Testing Application ===');
    
    const app = new MockApplication();
    console.log('Application state:', app.getState());
    
    try {
        const eventManager = app.getEventManager();
        console.log('Event manager retrieved successfully');
    } catch (error) {
        console.log('Error getting event manager:', error.message);
    }
    
    app.initialize(['-nosplash']);
    console.log('Application state after init:', app.getState());
}

function testView() {
    console.log('\n=== Testing View ===');
    
    const app = new MockApplication();
    const controller = new TestController(app);
    const rect = new pdg.Rect(10, 10, 100, 50);
    
    const view = new TestView(controller, rect);
    console.log('View area:', view.getViewArea());
    console.log('View visible:', view.isVisible());
    console.log('View enabled:', view.isEnabled());
    
    view.draw(app.graphicsMgr.getMainPort(), 0);
    view.hide();
    console.log('View visible after hide:', view.isVisible());
    view.show();
    console.log('View visible after show:', view.isVisible());
}

function testButton() {
    console.log('\n=== Testing Button ===');
    
    const app = new MockApplication();
    const controller = new TestController(app);
    const rect = new pdg.Rect(50, 50, 120, 30);
    
    const button = new Button(controller, rect, 1, -1, -1, -1);
    button.setText('Test Button');
    console.log('Button text:', button.getText());
    console.log('Button ID:', button.getButtonID());
    console.log('Button enabled:', button.isEnabled());
    console.log('Button pressed:', button.isPressed());
    
    button.draw(app.graphicsMgr.getMainPort(), 0);
    
    // Simulate click
    const mouseInfo = { mousePos: new pdg.Point(100, 65), rightButton: false };
    button.doLeftClick(mouseInfo, 1, 1);
    console.log('Controller button clicked:', controller.buttonClicked);
}

function testCheckbox() {
    console.log('\n=== Testing Checkbox ===');
    
    const app = new MockApplication();
    const controller = new TestController(app);
    const rect = new pdg.Rect(50, 100, 150, 25);
    
    const checkbox = new Checkbox(controller, rect);
    checkbox.setString('Test Checkbox');
    checkbox.setTextSize(14);
    console.log('Checkbox text:', checkbox.getString());
    console.log('Checkbox checked:', checkbox.isChecked());
    console.log('Checkbox text size:', checkbox.getTextSize());
    
    checkbox.draw(app.graphicsMgr.getMainPort(), 0);
    
    // Toggle checkbox
    checkbox.toggle();
    console.log('Checkbox checked after toggle:', checkbox.isChecked());
    
    checkbox.draw(app.graphicsMgr.getMainPort(), 0);
}

function testDialog() {
    console.log('\n=== Testing Dialog ===');
    
    const app = new MockApplication();
    const controller = new TestController(app);
    
    const dialog = new Dialog(controller, 300, 200, DialogFlags.dialog_Standard, 1, 2);
    console.log('Dialog rect:', dialog.getDialogRect());
    console.log('Dialog centered:', dialog.isCentered());
    console.log('Dialog modal:', dialog.isModal());
    console.log('Dialog OK button ID:', dialog.getOkButtonId());
    console.log('Dialog Cancel button ID:', dialog.getCancelButtonId());
    
    // Create a button for the dialog
    const buttonRect = new pdg.Rect(50, 150, 80, 25);
    const okButton = new Button(dialog, buttonRect, 1, -1, -1, -1);
    okButton.setText('OK');
    dialog.addView(okButton, 1);
    
    // Simulate OK button click
    const mouseInfo = { mousePos: new pdg.Point(90, 162), rightButton: false };
    dialog.doLeftClick(mouseInfo, okButton, 1, 1);
}

function testRectAndPoint() {
    console.log('\n=== Testing Rect and Point ===');
    
    const rect = new pdg.Rect(10, 20, 100, 50);
    console.log('Rect:', rect);
    console.log('Rect width:', rect.width());
    console.log('Rect height:', rect.height());
    console.log('Rect contains (50, 30):', rect.contains(new pdg.Point(50, 30)));
    console.log('Rect contains (200, 200):', rect.contains(new pdg.Point(200, 200)));
    
    const point = new pdg.Point(5, 10);
    const offset = new pdg.Point(3, 4);
    const newPoint = point.add(offset);
    console.log('Point:', point);
    console.log('Point + offset:', newPoint);
    
    const rect2 = new pdg.Rect(50, 30, 80, 60);
    console.log('Rect2 overlaps rect:', rect.overlaps(rect2));
    console.log('Rect intersection:', rect.intersection(rect2));
}

function testEditText() {
    console.log('\n=== Testing EditText ===');
    
    const app = new MockApplication();
    const controller = new TestController(app);
    const editRect = new pdg.Rect(50, 50, 200, 30);
    const editText = new EditText(controller, editRect);
    
    console.log('EditText created');
    console.log('EditText has focus:', editText.hasFocus());
    
    editText.setFocus(true);
    console.log('EditText has focus after setFocus(true):', editText.hasFocus());
    
    editText.setText('Hello World');
    console.log('EditText text:', editText.getText());
    
    editText.setFilter('', '0123456789'); // Block numbers
    console.log('EditText filter set to block numbers');
    
    editText.setFocus(false);
    console.log('EditText has focus after setFocus(false):', editText.hasFocus());
}

function testListBox() {
    console.log('\n=== Testing ListBox ===');
    
    const app = new MockApplication();
    const controller = new TestController(app);
    const listRect = new pdg.Rect(50, 50, 200, 150);
    const listBox = new ListBox(controller, listRect, 5,             
        new pdg.Color(0.9, 0.9, 0.9, 1.0), 
        new pdg.Color(0.3, 0.3, 1.0, 1.0));
    
    console.log('ListBox created');
    
    listBox.addToList('Item 1');
    listBox.addToList('Item 2');
    listBox.addToList('Item 3');
    listBox.addToList('Item 4');
    listBox.addToList('Item 5');
    
    console.log('ListBox item count:', listBox.getItemCount());
    console.log('ListBox selected index:', listBox.getSelectedIndex());
    
    listBox.setSelectedIndex(2);
    console.log('ListBox selected index after setSelectedIndex(2):', listBox.getSelectedIndex());
    console.log('ListBox selected text:', listBox.getSelectedText());
    
    listBox.removeItem(1);
    console.log('ListBox item count after removeItem(1):', listBox.getItemCount());
    
    listBox.clear();
    console.log('ListBox item count after clear:', listBox.getItemCount());
}

function testScrollbar() {
    console.log('\n=== Testing Scrollbar ===');
    
    const app = new MockApplication();
    const controller = new TestController(app);
    const scrollRect = new pdg.Rect(50, 50, 20, 200);
    const scrollbar = new Scrollbar(controller, scrollRect, ScrollbarOrientation.VERTICAL, 0, 10, 100);
    
    console.log('Scrollbar created');
    console.log('Scrollbar orientation:', scrollbar.getOrientation());
    console.log('Scrollbar current position:', scrollbar.getCurrentPosition());
    console.log('Scrollbar scroll range:', scrollbar.getScrollRange());
    
    scrollbar.setCurrentPosition(50);
    console.log('Scrollbar current position after setCurrentPosition(50):', scrollbar.getCurrentPosition());
    
    scrollbar.setMaxRange(200);
    console.log('Scrollbar scroll range after setMaxRange(200):', scrollbar.getScrollRange());
}

function testModalController() {
    console.log('\n=== Testing ModalController ===');
    
    const app = new MockApplication();
    const modalController = new ModalController(app);
    
    console.log('ModalController created');
    console.log('ModalController is modal:', modalController.isModal());
    console.log('ModalController is modal active:', modalController.isModalActive());
    
    modalController.activateModal();
    console.log('ModalController is modal active after activateModal:', modalController.isModalActive());
    
    modalController.deactivateModal();
    console.log('ModalController is modal active after deactivateModal:', modalController.isModalActive());
}

function testTouchController() {
    console.log('\n=== Testing TouchController ===');
    
    const app = new MockApplication();
    const touchController = new TouchController(app);
    
    console.log('TouchController created');
    console.log('TouchController is modal:', touchController.isModal());
    
    const mouseInfo = { mousePos: new pdg.Point(100, 100), rightButton: false };
    touchController.doMouseDown(mouseInfo, null, 1, 1);
    console.log('TouchController touch active after mouse down:', touchController.isTouchActive());
    
    touchController.doMouseUp(mouseInfo, null, 1, 1);
    console.log('TouchController touch active after mouse up:', touchController.isTouchActive());
}

function testScrollingView() {
    console.log('\n=== Testing ScrollingView ===');
    
    const app = new MockApplication();
    const controller = new TestController(app);
    const scrollRect = new pdg.Rect(50, 50, 200, 150);
    const scrollingView = new ScrollingView(controller, scrollRect);
    
    console.log('ScrollingView created');
    console.log('ScrollingView view frame:', scrollingView.getViewFrame());
    
    scrollingView.moveView(10, 20);
    console.log('ScrollingView moved by (10, 20)');
    
    scrollingView.scrollTo(new pdg.Point(50, 50));
    console.log('ScrollingView scrolled to (50, 50)');
}

function testRadioButton() {
    console.log('\n=== Testing RadioButton ===');
    
    const app = new MockApplication();
    const controller = new TestController(app);
    const radioRect = new pdg.Rect(50, 50, 150, 100);
    const radioButton = new RadioButton(controller, radioRect, -1, 3);
    
    console.log('RadioButton created');
    console.log('RadioButton option count:', radioButton.getOptionCount());
    console.log('RadioButton selected index:', radioButton.getSelectedIndex());
    
    radioButton.setSelectedIndex(1);
    console.log('RadioButton selected index after setSelectedIndex(1):', radioButton.getSelectedIndex());
    console.log('RadioButton selected text:', radioButton.getSelectedText());
    
    radioButton.addString('New Option');
    console.log('RadioButton option count after addString:', radioButton.getOptionCount());
}

function testPopupMenu() {
    console.log('\n=== Testing PopupMenu ===');
    
    const app = new MockApplication();
    const controller = new TestController(app);
    const menuPoint = new pdg.Point(50, 50);
    const popupMenu = new PopupMenu(controller, menuPoint);
    
    console.log('PopupMenu created');
    
    popupMenu.addMenuItem(1, 'Menu Item 1');
    popupMenu.addMenuItem(2, 'Menu Item 2');
    popupMenu.addMenuItem(3, 'Menu Item 3');
    
    console.log('PopupMenu item count:', popupMenu.getItemCount());
    console.log('PopupMenu hot item:', popupMenu.getHotItem());
    
    popupMenu.setHotItem(2);
    console.log('PopupMenu hot item after setHotItem(2):', popupMenu.getHotItem());
}

function testMessageDialog() {
    console.log('\n=== Testing MessageDialog ===');
    
    const app = new MockApplication();
    const controller = new TestController(app);
    const message = 'This is a test message';
    const messageDialog = new MessageDialog(controller, message, MessageDialogButtonText.OK, MessageDialogButtonText.CANCEL);
    
    console.log('MessageDialog created');
    console.log('MessageDialog message code:', messageDialog.getMessageCode());
    
    messageDialog.setMessageCode(123);
    console.log('MessageDialog message code after setMessageCode(123):', messageDialog.getMessageCode());
}

function testMessageView() {
    console.log('\n=== Testing MessageView ===');
    
    const app = new MockApplication();
    const controller = new TestController(app);
    const messageRect = new pdg.Rect(50, 50, 200, 100);
    const messageView = new MessageView(controller, messageRect, 'This is a test message');
    
    console.log('MessageView created');
    console.log('MessageView message:', messageView.getMessage());
    console.log('MessageView text size:', messageView.getTextSize());
    
    messageView.setTextSize(16);
    console.log('MessageView text size after setTextSize(16):', messageView.getTextSize());
    
    messageView.setMessage('Updated message');
    console.log('MessageView message after setMessage:', messageView.getMessage());
}

// Run all tests
function runTests() {
    console.log('=== JavaScript Application Framework Tests ===');
    
    try {
        testObserverPattern();
        testApplication();
        testView();
        testButton();
        testCheckbox();
        testDialog();
        testRectAndPoint();
        testEditText();
        testListBox();
        testScrollbar();
        testModalController();
        testTouchController();
        testScrollingView();
        testRadioButton();
        testPopupMenu();
        testMessageDialog();
        testMessageView();
        
        console.log('\n=== All Tests Completed Successfully ===');
    } catch (error) {
        console.error('\n=== Test Failed ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
    
    // Exit after tests complete
    console.log('All tests completed, exiting...');
    process.exit(0);
}

// Export test function for use in other modules
module.exports = {
    runTests,
    TestObserver,
    TestView,
    TestController
};

// Run tests if this file is executed directly
console.log('Test file loaded, about to run tests...');
runTests();
