# JavaScript Application Framework

This directory contains a JavaScript port of the PDG C++ Application Framework. The framework provides a complete UI system with views, controllers, and UI components that mirror the functionality of the original C++ implementation.

## Overview

The JavaScript Application Framework includes:

- **Observer Pattern**: Subject/Observer implementation for event handling
- **Application Management**: Base application class with state management
- **View System**: Base view class with mouse/touch/gesture handling
- **Controller System**: View management and event handling
- **UI Components**: Complete set of UI components including Button, Dialog, Checkbox, EditText, ListBox, Scrollbar, RadioButton, PopupMenu, MessageDialog, MessageView, and more
- **Advanced Controllers**: ModalController and TouchController for specialized behavior
- **Scrollable Views**: ScrollingView base class for scrollable content
- **Control Theming**: State-based drawing, images, foreground colors, custom draw routines, and click behavior through `ControlAttributes`

## File Structure

```
src/js/app/
├── Observer.js          # Observer pattern implementation
├── Application.js       # Application base class
├── View.js             # View base class with input handling
├── Controller.js       # Controller base class
├── ControlAttributes.js # Shared application control theming
├── Button.js           # Button UI component
├── Dialog.js           # Dialog UI component
├── Checkbox.js         # Checkbox UI component
├── EditText.js         # Text input component with caret handling
├── ListBox.js          # Scrollable list component with selection
├── MessageDialog.js    # Dialog for displaying messages with buttons
├── MessageView.js      # Simple view for displaying text messages
├── ModalController.js  # Controller with modal behavior
├── PopupMenu.js        # Dropdown menu component
├── RadioButton.js      # Radio button group component
├── Scrollbar.js        # Scrollbar component with orientation
├── ScrollingView.js    # Base class for scrollable content
├── TouchController.js  # Advanced controller with gesture recognition
├── index.js            # Main export file
├── test.js             # Test suite
└── README.md           # This file
```

## Core Classes

### Observer Pattern

```javascript
const { IObserver, Subject } = require('./Observer');

// Create an observer
class MyObserver extends IObserver {
    notify(subject) {
        console.log('Subject changed!');
    }
}

// Create a subject
const subject = new Subject();
subject.addObserver(new MyObserver());
subject.notifyObservers(); // Notifies all observers
```

### Application

```javascript
const { Application, AppStates } = require('./Application');

class MyApplication extends Application {
    initialize(args) {
        console.log('Application initialized');
        this.setState(AppStates.state_Running);
    }
    
    cleanup() {
        console.log('Application cleanup');
    }
}
```

### View

```javascript
const { View, Rect } = require('./View');

class MyView extends View {
    constructor(controller, rect) {
        super(controller, rect);
    }
    
    drawSelf() {
        const port = this.getPort();
        const area = this.getViewArea();
        port.fillRect(area, { r: 0.8, g: 0.8, b: 1.0, a: 1.0 });
    }
    
    doLeftClick(mouseInfo, id, part) {
        console.log('View clicked!');
        return true;
    }
}
```

### Controller

```javascript
const { Controller } = require('./Controller');

class MyController extends Controller {
    constructor(app) {
        super(app, true, true, true, false, true);
    }
    
    doLeftClick(mouseInfo, view, id, part) {
        console.log('Controller handled click');
        return true;
    }
}
```

## UI Components

Applications can theme every instance of a control type from their top-level
controller and can then add per-instance overrides:

```javascript
const { ControlAttributes, ControlState, ControlType } = require('./ControlAttributes');

class GameController extends Controller {
    getControlAttributes(type, styleId = -1) {
        const attributes = new ControlAttributes();
        if (type === ControlType.Button) {
            attributes
                .stateForeground(ControlState.Normal, new pdg.Color(1, 1, 1, 1))
                .clickRoutine(() => this.playButtonSound());
        }
        return attributes;
    }
}
```

An interactive parity gallery is available at `test/js/app-control-gallery.js`:

```sh
./pdg test/js/app-control-gallery.js
```

### Button

```javascript
const { Button } = require('./Button');

// Create a button
const button = new Button(controller, new Rect(10, 10, 100, 30), 1);
button.setText('Click Me');
button.setClickSound(soundObject);

// Handle button clicks in controller
buttonClicked(buttonId, button) {
    console.log(`Button ${buttonId} clicked: ${button.getText()}`);
}
```

### Dialog

```javascript
const { Dialog, DialogFlags } = require('./Dialog');

// Create a dialog
const dialog = new Dialog(parentController, 300, 200, 
                         DialogFlags.dialog_Standard, 1, 2);

// Add buttons to dialog
const okButton = new Button(dialog, new Rect(50, 150, 80, 25), 1);
okButton.setText('OK');
dialog.addView(okButton, 1);
```

### Checkbox

```javascript
const { Checkbox } = require('./Checkbox');

// Create a checkbox
const checkbox = new Checkbox(controller, new Rect(10, 10, 150, 25));
checkbox.setString('Enable Feature');
checkbox.setChecked(true);

// Handle checkbox changes
checkbox.doLeftClick(mouseInfo, id, part);
console.log('Checked:', checkbox.isChecked());
```

### EditText

```javascript
const { EditText } = require('./EditText');

// Create a text input field
const editText = new EditText(controller, new Rect(10, 10, 200, 30));
editText.setText('Hello World');
editText.setFocus(true);

// Handle text input and focus
editText.doKeyPress(keyPressInfo, view, id, part);
console.log('Text:', editText.getText());
console.log('Has focus:', editText.hasFocus());
```

### ListBox

```javascript
const { ListBox } = require('./ListBox');

// Create a list box
const listBox = new ListBox(controller, new Rect(10, 10, 200, 150));
listBox.addToList('Item 1');
listBox.addToList('Item 2');
listBox.addToList('Item 3');

// Handle selection
listBox.setSelectedIndex(1);
console.log('Selected:', listBox.getSelectedIndex());
console.log('Selected text:', listBox.getTextFromIndex(listBox.getSelectedIndex()));
```

### Scrollbar

```javascript
const { Scrollbar, ScrollbarOrientation } = require('./Scrollbar');

// Create a vertical scrollbar
const scrollbar = new Scrollbar(controller, new Rect(10, 10, 20, 200), 
                               ScrollbarOrientation.scrollbar_Vertical);
scrollbar.setMaxRange(100);
scrollbar.setCurrentPosition(50);

// Handle scroll events
scrollbar.addObserver({
    notify: (subject) => {
        console.log('Scrollbar position:', subject.getCurrentPosition());
    }
});
```

### RadioButton

```javascript
const { RadioButton } = require('./RadioButton');

// Create a radio button group
const radioButton = new RadioButton(controller, new Rect(10, 10, 150, 100));
radioButton.addString('Option 1');
radioButton.addString('Option 2');
radioButton.addString('Option 3');

// Handle selection
radioButton.setSelectedIndex(1);
console.log('Selected option:', radioButton.getSelectedIndex());
```

### PopupMenu

```javascript
const { PopupMenu } = require('./PopupMenu');

// Create a popup menu
const popupMenu = new PopupMenu(controller, new Rect(10, 10, 200, 250));
popupMenu.addMenuItem('Menu Item 1', 1);
popupMenu.addMenuItem('Menu Item 2', 2);
popupMenu.addMenuItem('Menu Item 3', 3);

// Handle menu interaction
popupMenu.setHotItem(2);
console.log('Hot item:', popupMenu.getHotItem());
```

### MessageDialog

```javascript
const { MessageDialog, MessageDialogButtonText } = require('./MessageDialog');

// Create a simple OK dialog
const dialog = new MessageDialog(controller, 'Are you sure?', 
                                MessageDialogButtonText.OK);

// Create a Yes/No dialog
const yesNoDialog = new MessageDialog(controller, 'Save changes?',
                                     MessageDialogButtonText.YES,
                                     MessageDialogButtonText.NO);

// Handle dialog result
dialog.showModal().then(buttonId => {
    console.log('Dialog button clicked:', buttonId);
});
```

### MessageView

```javascript
const { MessageView } = require('./MessageView');

// Create a message view
const messageView = new MessageView(controller, new Rect(10, 10, 200, 100), 
                                   'This is a test message');
messageView.setTextSize(14);
messageView.setWordWrap(true);

// Update message
messageView.setMessage('Updated message');
console.log('Message:', messageView.getMessage());
```

### ModalController

```javascript
const { ModalController } = require('./ModalController');

// Create a modal controller
class MyModalController extends ModalController {
    constructor(app) {
        super(app);
    }
    
    redrawAll() {
        // Redraw all views when modal is active
        console.log('Modal controller redraw');
    }
}

const modalController = new MyModalController(app);
modalController.activateModal();
```

### TouchController

```javascript
const { TouchController } = require('./TouchController');

// Create a touch controller with gesture support
class MyTouchController extends TouchController {
    constructor(app) {
        super(app);
    }
    
    doFlick(flickInfo, view, id, part) {
        console.log('Flick detected:', flickInfo);
        return true;
    }
    
    doPinchMove(pinchInfo, view, id, part) {
        console.log('Pinch detected:', pinchInfo);
        return true;
    }
}
```

### ScrollingView

```javascript
const { ScrollingView } = require('./ScrollingView');

// Create a scrollable view
class MyScrollingView extends ScrollingView {
    constructor(controller, rect) {
        super(controller, rect);
        this.setAutoAdjust(true);
    }
    
    drawSelf() {
        // Draw scrollable content
        const port = this.getPort();
        const viewArea = this.getViewArea();
        port.fillRect(viewArea, { r: 0.9, g: 0.9, b: 0.9, a: 1.0 });
    }
}

const scrollingView = new MyScrollingView(controller, new Rect(10, 10, 300, 200));
scrollingView.setViewFrame(new Rect(10, 10, 300, 200));
```

## Newly Added Components

The following components were recently ported from C++ to complete the JavaScript framework:

### Text Input Components
- **EditText**: Full-featured text input with caret handling, focus management, and key filtering
- **MessageView**: Simple text display view with word wrapping and scrolling support

### List and Selection Components
- **ListBox**: Scrollable list with item selection, highlighting, and observer pattern support
- **RadioButton**: Radio button groups for mutually exclusive selection
- **PopupMenu**: Dropdown menu with item management and hot item highlighting

### Scrolling and Navigation
- **Scrollbar**: Vertical and horizontal scrollbars with slider tracking and observer notifications
- **ScrollingView**: Base class for scrollable content with view framing and auto-adjustment

### Advanced Controllers
- **ModalController**: Controller base class that provides modal behavior for blocking dialogs
- **TouchController**: Advanced controller with touch and gesture recognition (flick, swipe, pinch, snapback)

### Dialog Components
- **MessageDialog**: Specialized dialog for displaying messages with configurable buttons (OK, Cancel, Yes/No, etc.)

## Component Integration

All components follow the same design patterns:
- Extend from appropriate base classes (View, Controller)
- Implement proper event handling methods
- Support the observer pattern for notifications
- Use consistent coordinate systems and drawing methods
- Provide mock implementations for testing

## Coordinate System

The framework uses a coordinate system similar to the original C++ implementation:

- **Global Coordinates**: Relative to the top-left of the drawing area
- **Local Coordinates**: Relative to the top-left of a view's area
- **View Area**: The rectangle defining where a view draws

Use `localToGlobal()` and `globalToLocal()` methods to convert between coordinate systems.

## Event Handling

The framework handles various input events:

- **Mouse Events**: down, up, move, enter, leave
- **Keyboard Events**: key down, key up, key press
- **Touch/Gesture Events**: tap, touch move, swipe, pinch
- **Drag Events**: drag move, drag in, drag out, drag complete

Override the appropriate methods in your View or Controller subclasses to handle these events.

## Testing

Run the test suite to verify the framework functionality:

```bash
cd src/js/app
node test.js
```

The test suite includes:
- Observer pattern tests
- Application lifecycle tests
- View rendering tests
- UI component tests (Button, Dialog, Checkbox, EditText, ListBox, Scrollbar, RadioButton, PopupMenu, MessageDialog, MessageView)
- Advanced controller tests (ModalController, TouchController)
- Scrolling view tests
- Coordinate system tests

## Integration with PDG

This JavaScript framework is designed to work alongside the C++ PDG framework. The JavaScript version provides:

1. **Same API**: Similar method names and behavior to the C++ version
2. **Compatible Data Structures**: Rect, Point, and other classes work the same way
3. **Event System**: Compatible event handling patterns
4. **UI Components**: Same UI components with similar behavior

## Usage in PDG Applications

To use this framework in a PDG application:

1. Include the JavaScript files in your project
2. Create mock implementations of PDG managers (EventManager, ResourceManager, etc.)
3. Extend the base classes to implement your application logic
4. Use the UI components to build your interface

## Differences from C++ Version

While the JavaScript version maintains API compatibility, there are some differences:

- **Memory Management**: JavaScript uses garbage collection instead of reference counting
- **Type Safety**: JavaScript is dynamically typed, so type checking is less strict
- **Event System**: Simplified event system compared to the full PDG event manager
- **Graphics**: Mock graphics implementation for testing (replace with actual PDG graphics)

## Future Enhancements

Potential future improvements:

- Additional UI components (ProgressBar, Slider, TabControl, etc.)
- More sophisticated event handling
- Integration with actual PDG graphics system
- Performance optimizations
- TypeScript definitions
- More comprehensive test coverage
- Animation and transition support
- Theme and styling system
- Accessibility features

## License

This JavaScript port maintains the same license as the original C++ PDG framework:

Copyright (c) 2004-2012, Dream Rock Studios, LLC
