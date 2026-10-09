# Skrybble - PDG Drawing Application

A vector drawing application built with the PDG (Pixel Dust Games) JavaScript
MVC Framework. It supports geometric and freehand drawing, multi-selection,
grouping, direct manipulation, configurable colors and strokes, smoothing,
undo/redo, draw-order control, and persistent `.skrbl` documents.

## Features

### Drawing Tools
- **Select Tool** (`Esc`) - Select and manipulate existing shapes
- **Line Tool** (`L`) - Draw straight lines
- **Freehand Tool** (`F`) - Draw freehand curves (auto-converts to Cardinal Spline)
- **Cardinal Spline Tool** (`S`) - Create smooth curves through control points
- **Bezier Spline Tool** (`B`) - Create smooth Bezier curves with draggable control points
- **Circle Tool** (`C`) - Draw perfect circles
- **Oval Tool** (`O`) - Draw ellipses
- **Rectangle Tool** (`R`) - Draw rectangles
- **Quad Tool** (`Q`) - Create 4-point polygons (auto-finishes after 4th point)
- **Polygon Tool** (`P`) - Create multi-point closed polygons
- **Image Tool** (`I`) - Import an image or place another `.skrbl` drawing as a group
- **Fill Color Picker** (`M`) - Change fill color of selected shape or default
- **Line Color Picker** (`N`) - Change stroke color of selected shape or default
- **Line Width Picker** (`W`) - Apply one of five stroke widths to selected shapes or set the default for new shapes
- **Smoothness Picker** (`U`) - Re-sample selected freehand splines or set the smoothing level for future freehand strokes
- **Help Tool** (`H`) - Display keyboard shortcuts

### Shape Editing
- **Endpoint Dragging** - Click and drag red endpoint handles to reshape
- **Control Point Editing** - Drag green control points on splines to adjust curves
- **Direct Dragging** - Drag a selected shape to move it; dragging one member of a multi-selection moves the whole selection
- **Rotation** - Drag the blue center handle to rotate supported ungrouped shapes (circles are rotation-invariant)
- **Nudging** - Arrow keys move shapes (10px, or 1px with Shift)
- **Draw Order** - Reorder shapes with `+`/`-` keys (Ctrl/Cmd + for to front/back)
- **Stroke Width** - Choose 0.25, 1, 2, 3.5, or 5 pixel strokes, with undo support
- **Freehand Smoothing** - Choose five point-spacing levels with live preview, accept, cancel, and undo

### Selection & Manipulation
- **Click Selection** - Click on a shape to select it
- **Rubber-Band Selection** - Click and drag in empty space to select multiple shapes
  - `Shift` + drag: Add to selection
  - `Ctrl/Alt/Cmd` + drag: Toggle selection
- **Tab Navigation** - Tab through shapes in drawing order (Shift+Tab reverses)
- **Grouping** - Combine two or more selected shapes into a persistent group and ungroup them later

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
- **Open** (`Cmd/Ctrl+O`) - Choose and load a `.skrbl` drawing
- **Save** (`Cmd/Ctrl+S`) - Save drawing to .skrbl file
- **Load** - Specify filename on command line to load on startup
- Auto-generates timestamped filename if none specified
- JSON-based file format preserves all shape properties and stores each unique embedded image once

## File Structure

```
skrybble/
├── skrybble                  # Portable macOS launcher
├── skrybble.ps1/.cmd         # Portable Windows launchers
├── main.js                    # Application entry point
├── DrawingApp.js             # Main application class
├── DrawingController.js      # Primary controller (event handling, state management)
├── DrawingSurfaceView.js     # Main drawing canvas view
├── ToolPaletteView.js        # Tool palette UI
├── ColorPickerController.js  # Color picker popup controller
├── LineWidthController.js    # Stroke-width popup controller
├── SmoothnessController.js   # Freehand smoothing popup controller
├── SliderView.js             # Slider view for color picker
├── drawing.js                # Drawing model (shape storage, serialization)
├── shapes.js                 # All shape class implementations
├── tools.js                  # Tool management and drawing state
├── index.js                  # Application and vendored MVC exports
└── vendor/pdg-mvc-app/       # Complete pinned public PDG MVC framework
```

## Usage

### Running the Application

```bash
# macOS (Apple silicon): downloads and verifies PDG v1.1.1 on first run
./skrybble

# Load an existing file
./skrybble -- drawing.skrbl

# Windows PowerShell
.\skrybble.ps1
.\skrybble.ps1 -- drawing.skrbl
```

### Web build

The web build downloads the pinned PDG `v1.1.1` Emscripten/Wasm32 release on
first use, verifies its SHA-256, and caches it under `.pdg/`:

```bash
./tools/build-web.sh
python3 -m http.server --directory dist 8080
```

Then open `http://localhost:8080`. Set `PDG_WASM_DIR` to use artifacts from a
local PDG Emscripten build, `PDG_CACHE_DIR` to share the release cache between
clones, or `SKRYBBLE_WEB_OUTPUT` to change the output directory. Pass
`--refresh-pdg` to download and reverify the pinned release again. The generated
site is static and contains Skrybble, `libpdg.js`, `libpdg.wasm`, and PDG's
license bundle. Browser Open/Image operations use the system file picker; Save
downloads a `.skrbl` file.

The launchers cache the exact public PDG release under `.pdg/` and verify its
SHA-256 before use. Set `PDG_CACHE_DIR` to share that cache between clones, or
`PDG_EXECUTABLE` to test with an already installed runtime. Pass
`--refresh-pdg` (or `-RefreshPdg` in PowerShell) to replace the cached copy.

### Keyboard Shortcuts

#### Tool Selection
- `Esc` - Select tool (finishes multi-point shapes and switches to select mode)
- `L` - Line tool
- `F` - Freehand tool
- `S` - Cardinal Spline tool
- `B` - Bezier Spline tool
- `C` - Circle tool
- `O` - Oval tool
- `R` - Rectangle tool
- `Q` - Quad tool (4-point polygon)
- `P` - Polygon tool
- `I` - Image tool
- `M` - Fill Color Picker
- `N` - Line Color Picker
- `W` - Line Width Picker
- `U` - Freehand Smoothness Picker
- `H` - Help (shows all shortcuts)

#### Editing & Navigation
- `Tab` - Select next shape (backward in draw order)
- `Shift+Tab` - Select previous shape (forward in draw order)
- `Delete` / `Backspace` - Delete selected shapes (or remove last point while drawing multi-point shapes)
- Arrow keys - Move selected shapes 10px
- `Shift` + Arrow keys - Move selected shapes 1px
- `Cmd/Ctrl+G` - Group selected shapes
- `Cmd/Ctrl+Shift+G` - Ungroup selected groups

#### Draw Order
- `+` or `=` - Move selected shapes forward one level
- `-` - Move selected shapes backward one level
- `Cmd/Ctrl` + `+` - Move selected shapes to front
- `Cmd/Ctrl` + `-` - Move selected shapes to back

#### Clipboard
- `Cmd/Ctrl+C` - Copy
- `Cmd/Ctrl+X` - Cut
- `Cmd/Ctrl+V` - Paste
- Grouped shapes can be copied, cut, pasted, reordered, moved, saved, and restored as a unit

#### Grouping
- `Cmd/Ctrl+G` - Group two or more selected shapes
- `Cmd/Ctrl+Shift+G` - Ungroup every selected group
- Groups preserve their children and drawing order when copied or saved

#### Appearance
- `M` - Set fill color for selected shapes, or the default for new shapes
- `N` - Set line color for selected shapes, or the default for new shapes
- `W` - Set line width for selected shapes, or the default for new shapes
- `U` - Smooth selected freehand splines, or set the default for new freehand strokes
- In width and smoothness popups, use `Up`/`Down` to preview, `Enter` to accept, or `Esc` to cancel

#### File Operations
- `Cmd/Ctrl+O` - Open a `.skrbl` drawing
- `Cmd/Ctrl+S` - Save
- `Cmd/Ctrl+Z` - Undo
- `Cmd/Ctrl+Shift+Z` - Redo

### Drawing Instructions

#### Basic Shapes (Line, Circle, Oval, Rectangle)
1. Select tool from palette or keyboard
2. Click and drag to draw
3. Release to finish

#### Multi-Point Shapes (Polygon, Quad, Spline, Bezier)
1. Select tool from palette or keyboard
2. Click to place first point
3. Move mouse and click to add more points
4. **Quad tool auto-finishes after 4th point**
5. For other multi-point shapes: Double-click or right-click to finish
6. Press `Delete/Backspace` to remove last point during creation
7. Press `Esc` to finish shape in current state and return to select mode

#### Freehand Drawing
1. Select Freehand tool (`F`)
2. Click and drag to draw
3. Release mouse to finish
4. Shape automatically converts to an editable Cardinal Spline

#### Importing Images and Drawings
1. Select the Image tool (`I`) and choose an image or `.skrbl` drawing in the platform file dialog
2. For an image, click the canvas to use its intrinsic dimensions or drag to choose its bounds
3. A `.skrbl` drawing is imported as one group centered at the mouse position
4. Use the Select tool to move, resize, rotate, reorder, group, copy, or delete imported content
5. Image bytes are embedded when the drawing is saved, so the original files are no longer required

#### Editing Shapes
1. Select the Select tool (`Esc`)
2. Click a shape to select it
3. Drag the shape itself to reposition it; all selected shapes move together
4. Drag **red endpoint handles** to reshape
5. Drag **green control points** (splines only) to adjust curves
6. Click **blue center point** and drag to rotate

#### Grouping Shapes
1. Select at least two shapes using Shift-click or rubber-band selection
2. Press `Cmd/Ctrl+G` to replace them with one movable group
3. Copy, paste, reorder, recolor, resize the stroke, or save the group as a unit
4. Press `Cmd/Ctrl+Shift+G` while the group is selected to restore its children

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
- `Group` - Persistent composite containing complete child shapes

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

### Color Management
- **RGB Color Picker** - Full-featured color picker with:
  - Separate sliders for Red, Green, Blue, and Alpha (opacity)
  - Real-time preview and hex value display
  - Recently used colors palette (saved with drawing)
  - Works on selected shapes or sets default colors for new shapes
  - Press `Enter` to accept, `Esc` to cancel
  - Fully integrated with undo/redo system

### Stroke Width and Freehand Smoothing
- **Line width popup** - Five visual width choices (`0.25`, `1`, `2`, `3.5`, and `5`)
- **Selected-shape editing** - Applies a width to every selected shape, including groups
- **Default width** - With nothing selected, sets the stroke used by subsequently created shapes
- **Five smoothing levels** - Re-sample freehand spline points using spacing thresholds of 2, 3, 5, 8, or 13 pixels
- **Non-destructive preview** - Arrow-key previews can be accepted with Enter or reverted with Esc
- Both operations participate in undo/redo

### Groups
- Groups are first-class drawing objects with their original child shapes retained
- Moving, copying, cutting, pasting, draw-order changes, color changes, stroke-width changes, save/load, and undo/redo operate on the group
- Ungrouping restores the individual children without flattening their geometry

### File Operations
- **Open Drawing** - Native platform chooser for `.skrbl` documents, with subsequent saves returning to the opened file
- **Save Confirmation** - Brief "Saved to [filename]" message appears on successful save
- **Recent Colors Persistence** - Recently used colors are saved with the drawing file
- Auto-generated timestamped filenames

## Known Limitations

### Known Issues
- No visual feedback during draw order changes
- The loader accepts the current file format only; automatic migration is not provided

### Limitations
- Maximum 50 undo levels
- No layer system
- No grid or snap-to-grid
- No rulers or measurements

## Dependencies

- **PDG v1.1.1** - Pinned public runtime; downloaded by the portable launcher
- **PDG MVC Framework** - Required public-tag sources are vendored with license and provenance
- **Node.js APIs** - Supplied by the PDG runtime for filesystem operations and modules
- **Native Graphics** - PDG provides cross-platform window and drawing

## Recent Updates

### Latest additions
- ✅ **Direct Shape Dragging** - Move one shape or an entire multi-selection with the pointer
- ✅ **Persistent Groups** - Group, ungroup, move, style, copy, reorder, save, and restore composite shapes
- ✅ **Line Width Tool** - Five selectable stroke widths for existing and future shapes
- ✅ **Freehand Smoothness Tool** - Five levels with live preview and undo/redo integration
- ✅ **Toolbar Rendering Polish** - Improved antialiasing for tool icons

### Version 0.0.2 Features:
- ✅ **Freehand Drawing Tool** - Draw smooth curves by hand
- ✅ **Interactive Help System** - Press `H` to view all keyboard shortcuts
- ✅ **Full RGB Color Picker** - Complete color management with sliders, hex display, and recent colors
- ✅ **Quad Tool** - 4-point polygon with auto-finish
- ✅ **Improved Multi-Point Editing** - Delete key removes last point, Esc finishes drawing
- ✅ **Save Confirmation** - Visual feedback when files are saved
- ✅ **Toolbar Color Display** - Shows current/selected shape colors
- ✅ **Embedded Images** - Place, transform, group, copy, and save raster images without external file dependencies

See `TODO.md` for completed and planned features.

## File Format

Files are saved with `.skrbl` extension in JSON format:

```json
{
  "fileFormat": "skrbl-v0.0.3",
  "imageData": [
    {
      "id": 1,
      "sourceName": "example.png",
      "imageExtension": ".png",
      "data": "iVBORw0KGgo..."
    }
  ],
  "shapes": [
    {
      "type": "Line",
      "data": {
        "x": 100, "y": 100,
        "x2": 200, "y2": 200,
        "strokeColor": "#000000",
        "strokeWidth": 1,
        "rotation": 0
      }
    },
    {
      "type": "Image",
      "data": {
        "type": "Image",
        "x": 240, "y": 100,
        "width": 320, "height": 200,
        "rotation": 0,
        "imageId": 1
      }
    }
    // ... more shapes
  ],
  "recentColors": [
    "#ff0000",
    "#00ff00",
    "#0000ff"
    // ... up to 10 recent colors
  ]
}
```

All shape properties including rotation and colors are preserved on save/load. Each unique image is stored once in the top-level `imageData` table; image shapes reference it by numeric `imageId`. This keeps documents portable without repeating encoded bytes for duplicate placements.

---

*Built with PDG Framework • © 2025 Ed Zavada*
