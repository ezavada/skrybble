# Scrybble - PDG Drawing Application

A full-featured vector drawing application built with the PDG (Pixel Dust Games) JavaScript MVC Framework. Supports multiple shape types, interactive editing, rotation, draw order manipulation, and file persistence.

## Features

### Drawing Tools
- **Select Tool** (`Esc`) - Select and manipulate existing shapes
- **Line Tool** (`L`) - Draw straight lines
- **Circle Tool** (`C`) - Draw perfect circles
- **Oval Tool** (`O`) - Draw ellipses
- **Rectangle Tool** (`R`) - Draw rectangles
- **Polygon Tool** (`P`) - Create multi-point closed polygons
- **Cardinal Spline Tool** (`S`) - Create smooth curves through control points
- **Bezier Spline Tool** (`B`) - Create smooth Bezier curves with draggable control points

### Shape Editing
- **Endpoint Dragging** - Click and drag red endpoint handles to reshape
- **Control Point Editing** - Drag green control points on splines to adjust curves
- **Rotation** - Click blue center point and drag to rotate any shape
- **Nudging** - Arrow keys move shapes (10px, or 1px with Shift)
- **Draw Order** - Reorder shapes with `+`/`-` keys (Ctrl/Cmd + for to front/back)

### Selection & Manipulation
- **Click Selection** - Click on a shape to select it
- **Rubber-Band Selection** - Click and drag in empty space to select multiple shapes
  - `Shift` + drag: Add to selection
  - `Ctrl/Alt/Cmd` + drag: Toggle selection
- **Tab Navigation** - Tab through shapes in drawing order (Shift+Tab reverses)

### Clipboard Operations
- **Copy** (`Cmd/Ctrl+C`) - Copy selected shapes
- **Cut** (`Cmd/Ctrl+X`) - Cut selected shapes
- **Paste** (`Cmd/Ctrl+V`) - Paste with cumulative 10px offset

### Undo/Redo System
- **Undo** (`Cmd/Ctrl+Z`) - Undo last action
- **Redo** (`Cmd/Ctrl+Shift+Z`) - Redo undone action
- Supports up to 50 undo levels
- Smart accumulation for nudges and draw order changes

### File Management
- **Save** (`Cmd/Ctrl+S`) - Save drawing to .skrbl file
- **Load** - Specify filename on command line to load on startup
- Auto-generates timestamped filename if none specified
- JSON-based file format preserves all shape properties including rotation

## File Structure

```
anime-faces/
├── main.js                 # Application entry point
├── DrawingApp.js          # Main application class
├── DrawingController.js   # Primary controller (event handling, state management)
├── DrawingSurfaceView.js  # Main drawing canvas view
├── ToolPaletteView.js     # Tool palette UI
├── drawing.js             # Drawing model (shape storage, serialization)
├── shapes.js              # All shape class implementations
├── tools.js               # Tool management and drawing state
├── index.js               # PDG framework exports
└── facegen.js             # Face generation (placeholder/unused)
```

## Usage

### Running the Application

```bash
# Start with a new drawing
node main.js

# Load an existing file
node main.js drawing.skrbl
```

### Keyboard Shortcuts

#### Tool Selection
- `Esc` - Select tool (also cancels current drawing)
- `L` - Line tool
- `S` - Cardinal Spline tool
- `B` - Bezier Spline tool
- `C` - Circle tool
- `O` - Oval tool
- `R` - Rectangle tool
- `P` - Polygon tool

#### Editing & Navigation
- `Tab` - Select next shape (backward in draw order)
- `Shift+Tab` - Select previous shape (forward in draw order)
- `Delete` / `Backspace` - Delete selected shapes
- Arrow keys - Move selected shapes 10px
- `Shift` + Arrow keys - Move selected shapes 1px

#### Draw Order
- `+` or `=` - Move selected shapes forward one level
- `-` - Move selected shapes backward one level
- `Cmd/Ctrl` + `+` - Move selected shapes to front
- `Cmd/Ctrl` + `-` - Move selected shapes to back

#### Clipboard
- `Cmd/Ctrl+C` - Copy
- `Cmd/Ctrl+X` - Cut
- `Cmd/Ctrl+V` - Paste

#### File Operations
- `Cmd/Ctrl+S` - Save
- `Cmd/Ctrl+Z` - Undo
- `Cmd/Ctrl+Shift+Z` - Redo

### Drawing Instructions

#### Basic Shapes (Line, Circle, Oval, Rectangle)
1. Select tool from palette or keyboard
2. Click and drag to draw
3. Release to finish

#### Multi-Point Shapes (Polygon, Spline, Bezier)
1. Select tool from palette or keyboard
2. Click to place first point
3. Move mouse and click to add more points
4. Double-click or right-click to finish
5. Press `Esc` to remove last point during creation

#### Editing Shapes
1. Select the Select tool (`Esc`)
2. Click a shape to select it
3. Drag **red endpoint handles** to reshape
4. Drag **green control points** (splines only) to adjust curves
5. Click **blue center point** and drag to rotate

#### Selection Techniques
- **Single selection**: Click a shape
- **Add to selection**: `Shift` + click
- **Toggle selection**: `Ctrl/Alt/Cmd` + click
- **Rubber-band box**: Click and drag in empty space
- **Multi-select box**: `Shift` + drag (adds) or `Ctrl` + drag (toggles)

## Architecture

### MVC Pattern
The application follows the PDG MVC framework architecture:

- **Model** (`Drawing`, `Shape` classes) - Data storage and manipulation
- **View** (`DrawingSurfaceView`, `ToolPaletteView`) - Rendering and display
- **Controller** (`DrawingController`) - Event handling and coordination

### Core Classes

#### DrawingApp
Main application coordinator, creates window and initializes controllers.

#### DrawingController
Primary controller handling:
- Mouse and keyboard input
- Tool management
- Shape selection and editing
- Undo/redo state management
- File operations
- Clipboard operations

#### Drawing
Drawing model managing:
- Shape collection
- Shape serialization/deserialization
- Draw order manipulation

#### Shape Classes
Base `Shape` class extended by:
- `Line` - Two-point line segment
- `Circle` - Center + radius
- `Oval` - Center + X/Y radii
- `Rectangle` - Corner + width/height
- `Polygon` - Multi-point closed shape
- `Spline` - Cardinal spline with control points
- `BezierSpline` - Cubic Bezier with auto-generated control points

Each shape implements:
- `draw(port)` - Render with optional rotation
- `contains(x, y)` - Hit testing
- `getEndpoints()` - Editable endpoints
- `getControlPoints()` - Control points (splines)
- `getCenterPoint()` - Rotation center
- `intersectsRect()` - Rubber-band selection testing

### Event Flow

1. User input → `DrawingController` event handlers
2. Controller updates tool state via `ToolManager`
3. Controller modifies `Drawing` model
4. Views automatically redraw on next frame
5. Undo state saved for reversible operations

## Known Limitations & Unimplemented Features

### Not Implemented
- **Image Tool** - Shows in palette but not functional
- **Quad Tool** - Shows in palette but not functional  
- **Freehand Drawing** - Planned for future (see TODO.md)
- **Help/Shortcuts Display** - Planned for future
- **Color Picker UI** - Currently no way to change colors (all shapes use default black/white)

### Known Issues
- No visual feedback during draw order changes
- File format version (skrbl-v0.0.1) is not validated on load

### Limitations
- Maximum 50 undo levels
- No layer system
- No grouping of shapes
- No stroke width control via UI
- No grid or snap-to-grid
- No rulers or measurements

## Dependencies

- **PDG Framework** - Pixel Dust Games JavaScript MVC framework
- **Node.js** - For filesystem operations and module system
- **Native Graphics** - PDG provides cross-platform window and drawing

## Future Enhancements

See `TODO.md` for planned features:
- Freehand drawing tool with Cardinal spline output
- Interactive help/shortcuts overlay
- Full-featured RGB color picker with opacity
- Recent colors palette
- Stroke and fill color selection

## File Format

Files are saved with `.skrbl` extension in JSON format:

```json
{
  "fileFormat": "skrbl-v0.0.1",
  "shapes": [
    {
      "type": "Line",
      "data": {
        "x": 100, "y": 100,
        "x2": 200, "y2": 200,
        "strokeColor": "black",
        "strokeWidth": 1,
        "rotation": 0
      }
    }
    // ... more shapes
  ]
}
```

All shape properties including rotation are preserved on save/load.

---

*Built with PDG Framework • © 2025 Ed Zavada*
