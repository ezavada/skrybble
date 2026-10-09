# JavaScript Application Framework

This directory contains a JavaScript port of the PDG C++ Application Framework. The framework provides a complete UI system with views, controllers, and UI components that mirror the functionality of the original C++ implementation.

**API Stability: 2 — Evolving.** The public views, controls, application and
appearance classes are implemented and supported, but their contract is still
settling. Compatibility is preserved where practical; breaking changes are
documented in release notes. This rating also applies to their C++ counterparts.
See the [engine stability policy](../../../docs/javascript/dox/index.dox).

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
src/js/mvc-app/
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

`View` now extends `pdg.AnimatedAttributes`, as does every visual control derived from it.
The matching C++ base is `View : AnimatedAttributes`. Controllers, observers, and
`ControlAttributes` theme objects are not Animated. MVC views never own a PhysicsBody or expose
`.physics`.

The Animated location is the center of the unrotated view rectangle; width and
height are its layout dimensions. Movement, easing and growth update drawing and
clickable areas. Durations and `animate(deltaSeconds)` use floating-point seconds.
The top-level controller advances views and child controllers once per PortDraw,
before rendering. Hidden views continue animating; a controller which neither
draws nor runs while inactive pauses its views. Do not manually advance a view
that is already managed by a controller.

`view.animate(deltaSeconds)` accepts finite nonnegative elapsed seconds and
returns whether animation values changed. For an unmanaged View, call it once
per update. `controller.animateViews(deltaSeconds)` advances each current View
once, then its child controllers; it returns no value. Views removed during an
update are skipped, and Views added during that update start on the next step.

Subclasses can override `viewAreaChanged(previous)` to rebuild custom layout
after movement or resizing. `previous` is the old unrotated rectangle in Port
coordinates; `getViewArea()` already returns the new rectangle. Call the base
implementation first to preserve proportional resizing of clickable regions:

```javascript
viewAreaChanged(previous) {
    super.viewAreaChanged(previous);
    this.updateLayout(); // Your subclass's layout routine.
}
```

The C++ hook has the same contract: override
`void viewAreaChanged(const pdg::Rect& previous)` and call
`View::viewAreaChanged(previous)` before custom layout.

```javascript
button.moveBy(80, 0, 0.5, pdg.easeInOutQuad);
button.resizeTo(180, 48, 0.25, pdg.easeInOutQuad);
```

`getViewArea()` and `viewArea` return rectangle values in JavaScript. To edit a
rectangle, modify a copy and call `setViewArea(rect)`. C++ callers likewise use
`setViewArea()` instead of the removed mutable `getModifiableViewAreaRect()`.
C++ port-resize flags are grouped in `View::Bind`: `Top`, `Bottom`, `Left`,
`Right`, `GrowHorz`, `GrowVert`, and `Grow`. Combine edges with `|`, for example
`View::Bind::Top | View::Bind::Right`. The all-edge flag is `View::Bind::Grow`
in C++ and `ViewBinding.grow` in JavaScript. Call `view.grow(...)` directly
to multiply the current width and height, optionally over a duration in seconds.

Appearance tracks such as `view.changeFillOpacity(0.2, 0.5)` run on the same
controller clock. For custom drawing, pass the View as Attributes and use a
centered unit rectangle (`new pdg.Rect(-0.5, -0.5, 0.5, 0.5)`): the matrix maps it
to the view area. Drawings still copy this sample. Controls use their current ControlAttributes state as the base, then apply only
appearance channels explicitly set or scheduled on the View. Unset channels keep
the theme, including hovered/pressed/disabled states. Explicit default values
(such as `roundedCorners(0)` or `textSize(12)`) also override the theme. Labels
keep the theme foreground color and inherit the View's text/font, fill opacity,
and blend settings. Text-size storage in JavaScript controls uses the inherited attribute
instead of hiding its methods with a numeric instance property.

Focused checks (run from the repository root):

```sh
./test/demo --automated mvc
./test/unit mvc_animation mvc-app
ctest --test-dir build/darwin/arm64/pdg -R '^pdg-view-animation$' --output-on-failure
```

The gallery check opens a window, animates a real button using PortDraw, verifies
the resulting layout/clickable area and animated appearance, then closes automatically.
It includes the assertions from the retired standalone MVC probes.

Rotation, reflection, scale and shear affect the whole clipped View, including
text, images and custom draw routines. Input uses the inverse of the same affine
transform; a view collapsed to zero scale cannot be hit. `getViewArea()` remains
the unrotated layout rectangle. Point conversion methods include the transform
outside `drawSelf()`; during drawing, `localToGlobal()` produces layout coordinates
because the View applies its transform to the completed drawing. Rectangle
conversion methods return bounding rectangles of all four converted corners.

A `ScrollingView` clips to `getViewFrame()` while its content uses `getViewArea()`.
Moving the content scrolls within the frame. Resize the viewport with
`setViewFrame(rect)`. Port clipping is intersected and restored, including when
`drawSelf()` throws. Transformed clipping follows the actual viewport, not its
axis-aligned bounds. Each transformed View reuses an offscreen surface; resizing
the viewport reallocates it. Destroy a View when finished to release that surface.

For composite controls, `child.setParentView(parent)` links drawing, clipping,
visibility and coordinate conversion. Both views must belong to the same
Controller. The controller still steps each once; the parent draws its children
once in insertion order. Children keep Port-coordinate layout rectangles and
follow their parent's movement and resizing. `setParentView(null)` detaches without
deleting either view; cycles are rejected. ListBox uses this for its scrollbar.
Custom composites can override `viewAreaChanged(previous)` to refine child layout
after calling the base implementation.

A custom control can compose its own theme with
`this.getDrawingAttributes(themeAttributes)`; pass `true` as the second argument
for a label. The equivalent general-purpose snapshot is
`themeAttributes.withAppearance(view, textOnly)`. Neither source is modified.
Built-in rectangle backgrounds inset their centered stroke by half its thickness,
so all four borders fit inside the View's clip. Custom draw routines should inset
border rectangles themselves; for a 5-pixel border use `new pdg.Rect(area).shrink(2.5)`.
Default checkbox boxes use the larger of font ascent plus 2 pixels or capital
height plus 4 pixels, with a bold filled checkmark. Radio circles keep a diameter
equal to the label's text size (14 pixels by default). Both use
`Font.getFontCapHeight()` to center their indicators against the label capitals.

Controllers capture each mouse press on its original View and part. That View
receives drag motion and mouse-up even outside its bounds; an outside release
has `part == -1` and does not produce a click. Clicks require the same mouse
button to release over the original enabled, visible part. Moving out clears
a button's pressed appearance; returning before release restores it. Removing
the View or deactivating its controller cancels capture and resets its state.
Scrollbar arrow repeat stops on exit, while thumb dragging continues outside
the track until release. Put actions in `doLeftClick()`/`doRightClick()` and use
`doMouseUp()` for release cleanup.

Controllers route `eventType_ScrollWheel` to the visible view under the pointer,
then through its visual parents until `doScrollWheel(wheelInfo)` returns true.
Vertical scrollbars consume `vertDelta` (positive down), horizontal scrollbars use
`horizDelta` (positive right). Each unit moves one configured step; position clamps
to the range, and a control at its limit lets the event bubble. ListBox forwards
wheel events over its rows to its scrollbar. Disabled controls ignore wheel input.
The C++ View/Scrollbar/ListBox hooks use `const ScrollWheelInfo*` with the same behavior.

Custom ControlAttributes draw routines receive the composed attributes as
`state.drawing`; use them when drawing to honor the View overrides:

```javascript
const themed = new ControlAttributes().stateDrawRoutine(ControlState.Normal,
    (port, area, state) => {
        const base = new pdg.Attributes().fillColor('navy').roundedCorners(8);
        port.drawRect(area, base.withAppearance(state.drawing || new pdg.Attributes()));
    });
button.setAttributes(themed);
button.fillOpacity(1).changeFillOpacity(0.5, 0.8);
button.rotateTo(0.12, 0.8);
```

The MVC gallery is the demo entry: `test/demo mvc`, `test/demo --web mvc`, or
`test/demo --ios mvc`. `control-gallery` is a compatibility alias for `mvc`.
`test/mvc` also opens the gallery. Use `test/unit mvc-app mvc_animation` for specs
and `tools/node test/emscripten/check_mvc_gallery.js` for real browser input checks.
The gallery includes animated and reflected buttons, a clipped scrolling viewport,
a resizing ListBox with a scrollbar, and default/custom dialogs.


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

For the browser gallery, serve the repository root over HTTP:

```sh
python3 -m http.server 8123 --bind 127.0.0.1
```

Open <http://127.0.0.1:8123/test/ui.html?interactive=1&kind=demo&suites=mvc>. It stays open
for mouse interaction, including the default and themed dialogs. The browser
uses `build/wasm/wasm32/libpdg.js` and `libpdg.wasm`; rebuild them after native
or binding changes. With Emscripten enabled by `./configure`, use `make pdg-js`.
If the generated root Makefile predates your Emscripten installation, use:

```sh
PDG_ROOT="$PWD" EMSDK_PYTHON="$(command -v python3)" \
  EM_CACHE="$PWD/build/wasm/wasm32/emscripten-cache" \
  emmake make --jobs=8 -f tools/pdg-js.mak
```

The finite browser check is
<http://127.0.0.1:8123/test/ui.html?test=mvc&automated=1>.
It verifies real PortDraw frames, a moving control, and a View whose color and
opacity change in seconds before closing the drawing port. The same check runs
on desktop with `./pdg test/js/app-control-gallery.js --ui-test`.
Shared appearance and drawing specs can be run at
<http://127.0.0.1:8123/test/unit.html?specs=animatedattributes,drawing>.

Browser AnimatedAttributes exposes both APIs and can be subclassed with
`class MyView extends pdg.AnimatedAttributes`. Native drawing calls accept the
adjusted Attributes base directly; Drawing elements still copy a snapshot.


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
./test/unit mvc-app mvc_animation
./test/demo --automated mvc
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
2. Use the real PDG managers supplied by `require('pdg')`
3. Extend the base classes to implement your application logic
4. Use the UI components to build your interface

## Differences from C++ Version

While the JavaScript version maintains API compatibility, there are some differences:

- **Memory Management**: JavaScript uses garbage collection instead of reference counting
- **Type Safety**: JavaScript is dynamically typed, so type checking is less strict
- **Event System**: Simplified event system compared to the full PDG event manager
- **Graphics**: Views render through PDG Ports and Drawing/AnimatedAttributes.
  `mocks.js` supports isolated tests; applications use the real runtime.

## Future Enhancements

Potential future improvements:

- Additional UI components (ProgressBar, Slider, TabControl, etc.)
- More sophisticated event handling
- Performance optimizations
- TypeScript definitions
- More comprehensive test coverage
- Animation and transition support
- Theme and styling system
- Accessibility features

## License

This JavaScript port maintains the same license as the original C++ PDG framework:

Copyright (c) 2004-2012, Dream Rock Studios, LLC
