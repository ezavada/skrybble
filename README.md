# Skrybble - PDG Drawing Application

A vector drawing application built with the PDG (Pixel Dust Games) JavaScript
MVC Framework. It supports geometric and freehand drawing, multi-selection,
grouping, direct manipulation, configurable colors and strokes, smoothing,
undo/redo, draw-order control, and persistent `.skrbl` documents.

## Features

### Drawing Tools
- **Select Tool** (`Esc`) - Select and manipulate existing shapes
- **Bone Tool** (`B`) - Draw a PDG rig, attach selected artwork, and edit bone endpoints
- **Line Tool** (`\\`) - Draw straight lines
- **Freehand Tool** (`N`) - Draw freehand curves (auto-converts to Cardinal Spline)
- **Cardinal Spline Tool** (`S`) - Create smooth curves through control points
- **Pen Tool** (`P`) - Create smooth Bezier curves with draggable control points
- **Circle Tool** (`Shift+L`) - Draw perfect circles
- **Oval Tool** (`L`) - Draw ellipses
- **Rectangle Tool** (`M`) - Draw rectangles
- **Quad Tool** (`Q`) - Create 4-point polygons (auto-finishes after 4th point)
- **Polygon Tool** (`Shift+P`) - Create multi-point closed polygons
- **Image Tool** (`Shift+I`) - Import an image or place another `.skrbl` drawing as a group
- **Text Tool** (`T`) - Click to create text or edit an existing text object
- **Font & Style** (`Shift+T`) - Choose font, size, bold, and italic
- **Pan Tool** (`H`) - Drag to navigate the canvas
- **Fill Color Picker** (`F`) - Change fill color of selected shape or default
- **Line Color Picker** (`Shift+F`) - Change stroke color of selected shape or default
- **Line Width Picker** (`Shift+W`) - Apply one of five stroke widths to selected shapes or set the default for new shapes
- **Smoothness Picker** (`U`) - Re-sample selected freehand splines or set the smoothing level for future freehand strokes
- **Help Tool** (`?`) - Display keyboard shortcuts

### Canvas Navigation
- The canvas overlay shows the selected entity type and dimensions in document pixels: line length, circle radius, or original width × height. Multiple selections show their count and combined bounds.
- New documents use a **1024 × 1024** logical canvas; imported PDG drawings retain their canvas dimensions. 100% zoom is 1:1.
- Use the **Pan tool** (`H`) or hold **Space** while dragging to pan.
- Scroll the mouse wheel/trackpad to zoom in and out; no modifier is required.
- The **Magnifier tool** (beside Pan) zooms in on click; **Right-click** or **Shift/Option/Control-click** zooms out. It always focuses the clicked point, regardless of selection.
- **Z** zooms in; **Shift+Z** zooms out. Zoom keeps the point under the cursor
  fixed when it is inside the selected objects' combined bounds. Outside those
  bounds, zoom focuses the selection center. Without a selection, zoom follows
  the cursor (or the viewport center when the cursor is outside the drawing area).
- **Ctrl/Cmd + 0** resets to 100% and centers the canvas.
- Zoom ranges from **25% to 800%**. You can pan across the gray workspace
  even when the whole page fits. The camera can move beyond a page edge to preserve
  zoom focus, while navigation remains bounded to keep the page within reach.
- Shape handles and their hit areas keep a fixed screen size at every zoom;
  artwork geometry and stroke widths scale with the document.
- The toolbar, popups, help, and notifications remain in screen space.

### Text Editing

Text grows, shrinks, changes font/style, and rotates around a fixed center point.

Text starts with a box about three characters wide and grows as you type, while the
font keeps its natural size and proportions. Click to place the blinking caret,
drag or Shift+Arrow to select, and use arrows, Home/End, Backspace, and Delete to
edit. Ctrl/Cmd+A selects text; Ctrl/Cmd+C/X/V copies, cuts, and pastes text.
Enter commits the edit as one undo step; Esc restores the original text.

Use **Font & style** (`Shift+T`) for Arial, Times New Roman, or Courier New, preset
sizes, bold, and italic. It previews selected text and supports Apply and Cancel;
with no selected text it sets the defaults for new text. Formatting survives save,
load, duplicate, and undo.

### Shape Editing

- Hold **Shift** to draw squares or circles, snap lines and rotation to 45° steps,
  or constrain dragging to the dominant horizontal/vertical axis. A small margin
  before changing axes keeps nearly diagonal drags stable.
- Drag the blue rotation center or guide tip. The guide points toward the mouse,
  extends for distant drags, and keeps its normal minimum length.
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
- **Open** (`Cmd/Ctrl+O`) - Load `.skrbl`, `.svg`, `.pdgdrawing`, or `.drawing.json` drawings
- **Save** (`Cmd/Ctrl+S`) - Save to the current document filename
- **Save As** (`Cmd/Ctrl+Shift+S`) - Choose `.skrbl` or native `.pdgdrawing` output
- **Load** - Specify a positional filename or `--input FILE` to load on startup
- **Output** - `--output FILE.skrbl` or `--output FILE.pdgdrawing` sets the save destination after loading
- **Batch curves** - `--convert-curves` selects all, runs the normal Convert to Curves operation, saves to `--output`, then exits. Requires an existing input and a separate output path.
- Auto-generates timestamped filename if none specified
- JSON-based file format preserves all shape properties and stores each unique embedded image once

```sh
PDG_SOURCE=devel ./skrybble --input pose.ink.svg --output r3/pose.pdgdrawing --convert-curves
```

Launch options also accept `--input=FILE` and `--output=FILE`. Paths containing spaces must be quoted. Without `--convert-curves`, the editor stays open and the supplied output path is used by Save.

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
# Current v1.3 candidate: use a built sibling pdg-devel checkout
PDG_SOURCE=devel ./skrybble

# Load an existing file
PDG_SOURCE=devel ./skrybble -- drawing.skrbl

# Windows PowerShell
$env:PDG_SOURCE = "devel"
.\skrybble.ps1
.\skrybble.ps1 -- drawing.skrbl
```

The current application and vendored MVC framework require PDG v1.3. Until
v1.3 is published, use `PDG_SOURCE=devel` (or an explicit `PDG_EXECUTABLE`).
The release manifest still records v1.2.0; the launcher's default release mode
is unsuitable for this candidate. Final v1.3 asset hashes will be pinned after
release artifacts are available.

### Web build

For the v1.3 candidate, build with the local Emscripten/Wasm32 artifacts:

```bash
PDG_SOURCE=devel ./tools/build-web.sh
python3 -m http.server --directory dist 8080
```

Then open `http://localhost:8080`. Set `PDG_WASM_DIR` to use artifacts from a
local PDG Emscripten build, `PDG_CACHE_DIR` to share the release cache between
clones, or `SKRYBBLE_WEB_OUTPUT` to change the output directory. Pass
`--refresh-pdg` to download and reverify the pinned release again. The generated
site is static and contains Skrybble, `libpdg.js`, `libpdg.wasm`, and PDG's
license bundle. Browser Open/Image operations use the system file picker; Save
downloads the selected `.skrbl` or `.pdgdrawing` format.

The launchers cache the exact public PDG release under `.pdg/` and verify its
SHA-256 before use. Set `PDG_CACHE_DIR` to share that cache between clones, or
`PDG_EXECUTABLE` to test with an already installed runtime. Pass
`--refresh-pdg` (or `-RefreshPdg` in PowerShell) to use and replace the cached release.

The wide-stroke renderer fix is currently in `pdg-devel`; pinned PDG 1.2 binaries
still have OpenGL line-width limits. For native development, build that checkout
and launch with `PDG_EXECUTABLE=/path/to/pdg-devel/pdg ./skrybble`. For the browser,
set `PDG_WASM_DIR` to its rebuilt WASM artifacts when running `tools/build-web.sh`.


### Selecting a development PDG runtime

Desktop launchers and browser builds retain the pinned public release default;
select development mode for this v1.3 candidate.
To use an already built sibling `../pdg-devel` checkout:

```bash
PDG_SOURCE=devel ./skrybble
PDG_SOURCE=devel ./tools/build-web.sh

# Optional checkout location (paths containing spaces are supported).
PDG_SOURCE=devel PDG_DEVEL_DIR="/path/to/pdg-devel" ./skrybble
```

In Windows PowerShell:

```powershell
$env:PDG_SOURCE = "devel"
# Optional; defaults to the sibling pdg-devel checkout.
$env:PDG_DEVEL_DIR = "C:\work\pdg-devel"
.\skrybble.ps1
# Return to the pinned release:
$env:PDG_SOURCE = "release"
```

Build PDG first: native launchers expect `pdg` (`pdg.exe` on Windows) in the
checkout root; web builds expect `libpdg.js` and `libpdg.wasm` under
`build/wasm/wasm32/release`. Development selection never builds automatically
or falls back to a release when those files are missing.

`PDG_EXECUTABLE` (desktop) and `PDG_WASM_DIR` (web) take precedence over the
selected source. `PDG_DEVEL_DIR` alone does not enable development mode.
Use `PDG_SOURCE=release` or unset `PDG_SOURCE` to return to the pinned release.
`--refresh-pdg` (`-RefreshPdg` in PowerShell) refreshes the release cache and
is rejected in development mode. Runtime selection does not change vendored
JavaScript framework sources.

### Select All and Joining Paths

**Cmd/Ctrl+A** selects every top-level object. In point-selection mode, it selects
all anchors and handles on the already-selected editable paths. During text
editing it selects the text instead.

**Cmd/Ctrl+J** joins two or more selected open paths of the same type. Lines and
existing polylines join into one straight, editable Polyline; Cardinal/freehand
splines remain Cardinal splines and Bézier splines remain Bézier splines.
The command repeatedly joins the nearest free endpoints, reversing paths when
needed. Endpoints within **0.25 document pixels** weld at their midpoint; larger
gaps receive a straight segment or a tangent-following spline segment. Existing
curve segments are preserved, apart from the tiny endpoint/handle adjustments
needed for welding. Cardinal joins store tangent corrections to retain their
original curves while keeping Cardinal point editing.

The result stays open, uses the first selected object's style in drawing order,
and replaces that object at its drawing position. Joining is one undo step.
Mixed path types, closed paths, polygons and other objects produce a message
without changing the drawing. Curve fitting and ink tracing now use **Cmd/Ctrl+L**.

### Partial point selection and scissors

In Select mode, Option-click a point or Option-drag a marquee to select points
within already-selected polygons, polylines, cardinal/freehand paths or Bézier paths.
Shift+Option adds points; Control+Option toggles them. Selected points turn blue
and remain selected after Option is released. A normal selection click returns
to whole-object selection. Two-point Line objects and primitive resize/radius
handles do not participate.

Copy/Cut requires at least two adjacent anchors; curve handles travel with the
selected segments. Disconnected runs paste as separate editable fragments.
Partial polygon copies are open and stroke-only; copying all vertices keeps the
closed, filled polygon. Option+Cmd+C/X (Option+Ctrl+C/X on Windows/Linux) closes
polygon fragments with at least three anchors. Cut reconnects surviving anchors,
removing the source if too few remain. Isolated anchors and tangent-only
selections can be nudged, but cannot be copied or cut as drawable fragments.

**Cmd/Ctrl+L** fits editable Bézier curves to consecutive runs of selected
anchors using the current Smoothness level (higher levels allow a looser fit).
With no selected run, it fits all points on each selected path and replaces that
path with the curve, preserving its style and closure. With selected runs on a
polygon or freehand line, it removes those anchors, reconnects the remaining
shape, and adds each fitted run as a separate, open, stroke-only curve. A source
with too few remaining anchors is removed. Selected runs on an existing Bézier
curve stay attached, preserving unselected segments. Each run keeps its endpoints.
The fitted anchors remain selected, and the command is one undo step. Isolated
points or tangent handles alone count as no selected run. Two-point Line objects
are unaffected.

For a whole filled polygon with no outline stroke, Cmd/Ctrl+L also checks whether
its geometry looks like a thin ink ribbon. Ink ribbons become centerline Bézier
strokes using the polygon's fill color and an estimated width for each branch.
Junctions split into separate curves, while loops remain connected. Compact
filled regions keep the normal outline-fitting behavior; partial point runs are
unchanged. This works on imported v5 line-art polygons without needing conversion
metadata, and the entire conversion remains one undo step.
Each resulting ink curve must have an arc length at least five times its
estimated stroke width; a two-anchor curve is valid. Rejected branches stay as
filled polygon regions; if none qualify, the original polygon remains unchanged.
Ink fitting error is capped at the estimated stroke width, while lower Smoothness
settings still apply, so smoothing does not erase bends in narrow ribbons.

The Scissors tool (**C**) operates on already-selected paths, excluding two-point
Line objects and primitive shapes. Click an edge/curve segment to remove it, or
drag a straight cutting line to remove every crossed segment. Drag-cut polygon
fragments with at least three vertices close automatically and keep their fill
and stroke; smaller fragments and cut curves remain open paths. Clicking a
single segment opens the path. Each gesture is one undo step. Curve fragments retain
their geometry, including when cardinal paths become cubic Bézier fragments.

### Keyboard Shortcuts

Shortcuts and held canvas controls use PDG v1.3 input actions with normalized
physical keys. Space pans, Shift constrains gestures, and Shift/Option/Control
reverse the magnifier. Command chords take precedence over tool shortcuts.
Text editing and picker controls retain MVC Unicode input. Their modal input
context suppresses canvas shortcuts and rearms held controls after release;
focus loss clears held state. Shortcuts, including arrow nudging, reordering
and deletion, retain OS key repeat.

#### Tool Selection

Common tool shortcuts follow [Adobe Illustrator](https://helpx.adobe.com/illustrator/using/default-keyboard-shortcuts.html).
Skrybble-specific tools use the additional shortcuts shown here.

| Key | Tool |
| --- | --- |
| V / Esc | Select / finish current drawing |
| H / Space-drag | Pan |
| \ | Line |
| N | Freehand (Pencil) |
| S | Cardinal Spline |
| P | Pen |
| L | Ellipse |
| Shift+L | Circle |
| M | Rectangle |
| Q | Quad |
| Shift+P | Polygon |
| Shift+I | Import image or drawing |
| T | Text |
| Shift+T | Font & style |
| F | Fill color |
| Shift+F | Stroke color |
| Shift+W | Line width |
| U | Smoothness |
| ? | Help |

#### Editing & Navigation
- `Cmd/Ctrl+A` - Select all objects, points, or text in the active editing mode
- `Cmd/Ctrl+J` - Join matching open lines or spline paths
- `Cmd/Ctrl+L` - Fit curves or trace ink centerlines using current Smoothness
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

#### Multi-Point Shapes (Polygon, Quad, Spline, Pen)
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
1. Select the Image tool (`Shift+I`) and choose an image, SVG, `.skrbl` or PDG drawing in the platform file dialog
2. For an image, click the canvas to use its intrinsic dimensions or drag to choose its bounds
3. An imported drawing is placed as one editable group centered at the mouse position
4. Use the Select tool to move, resize, rotate, reorder, group, copy, or delete imported content
5. Image bytes are embedded when the drawing is saved, so the original files are no longer required

#### Editable SVG Import
Open an `.svg` with **Cmd/Ctrl+O**, pass its filename on the command line, or use
**Shift+I** to place it in the current drawing. Opening uses the SVG canvas and
viewBox; placing preserves the current canvas and adds an editable group as one
undo step. Ungroup to edit individual objects. Saving defaults to a new `.skrbl`
filename, preserving the original SVG; SVG export is not provided.

Paths (including relative commands, cubic/quadratic Béziers and elliptical
arcs), polygons, polylines, lines, rectangles, circles and ellipses become editable
polygons or Bézier paths. Group transforms, viewBox alignment, inherited/inline
paint styles and opacity are applied. Compound even-odd paths preserve holes;
curved compound fills are approximated as editable polygons with separate strokes.
The v5 full-color and ink SVGs import without warnings and retain their vertices.

Text becomes editable Text objects with font family, size, bold/italic, alphabetic
baseline, text anchor and rotation. Linear and centered circular radial gradient
fills use PDG gradients and survive movement, grouping, copy/paste, undo and
`.skrbl` save/reopen. The solid fill picker replaces an imported gradient with a
solid color; gradient-stop editing is not yet exposed. Native `.pdgdrawing` export
preserves their appearance through PDG's drawing codec. Multiply and screen on
individual objects map to PDG blend modes; these are not SVG masks.

Import notifications report omitted or approximated features, including CSS
stylesheets/classes, images, use/symbol references, masks, clipping, filters,
patterns, gradient strokes, unsupported colors, custom stroke caps/joins/dashes,
compound nonzero winding fills and nested viewports. Multi-stop and repeat/reflect
gradients use endpoint colors and pad; elliptical or off-center radial gradients
are approximated with a centered circle. Text spans are flattened to one object;
per-character positioning, text strokes, spacing, alternate baselines and skewed
or nonuniform text transforms are reported. Group opacity is applied per object;
group blend modes and other blend modes are reported as unsupported. Scripts,
external resources and event handlers are never executed. Malformed files and
DOCTYPE declarations/custom entities fail without replacing the current drawing.

#### Text
1. Select **Text** (`T`) and click inside the page.
2. Type a single line of text. Backspace deletes the preceding character.
3. Press **Enter** to accept, or **Esc** to cancel and return to Select.
4. Click an existing text object with the Text tool, or double-click it with
   Select, to edit it again.
5. Text uses the current stroke color when created. Change its color with the
   fill-color picker; move, rotate, group, copy, save, and undo it like other shapes.

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
- `Text` - Editable UTF-8 label with color, size, bounds, and rotation

Rendering retains native `pdg.Drawing` artwork and `ElementRef` handles. Style
and text edits update existing elements; rotation uses a shared live transform.
Groups retain nested artwork and move through one translation without rewriting
child geometry. Ungrouping applies that translation to the restored children.
`CanvasNavigation` projects document coordinates through a PDG Camera. Editor hit
checks preserve Skrybble's selection semantics independently of PDG's nested
Drawing rectangle hit checks.

Toolbar icons are cached at 100 × 100 and drawn into nominal 50 × 50 slots. Slots
compress to fit narrower windows. Help and alpha-checkerboard artwork are retained;
selection pulses and save notifications advance on the animation clock.

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
- The loader accepts `.skrbl` v0.0.3 and v0.0.4 documents. New saves use v0.0.4;
  older Skrybble versions cannot read the new format.
- Text editing currently supports single-line labels at a default 24px size. It
  does not provide rich text or system clipboard text paste.

### Limitations
- Maximum 50 undo levels
- No layer system
- No grid or snap-to-grid
- No rulers or measurements

## Dependencies

- **PDG v1.3 candidate** - Use the local development runtime until final release assets are pinned
- **PDG MVC Framework** - Matching v1.3 candidate sources are vendored with license and provenance
- **Node.js APIs** - Supplied by the PDG runtime for filesystem operations and modules
- **Native Graphics** - PDG provides cross-platform window and drawing

## Verification

```sh
PDG_SOURCE=devel ./skrybble tests/smoke.js
PDG_SOURCE=devel ./skrybble tests/unit.js
PDG_SOURCE=devel ./skrybble tests/points.js
PDG_SOURCE=devel ./skrybble tests/pdg-drawing.js
python3 tests/test_runtime_selection.py
PDG_SOURCE=devel ./tools/build-web.sh
node tests/browser.cjs
```

The unit suite uses the graphical PDG runtime and offscreen ports; the headless
Node addon is insufficient. It checks camera conversions/bounds, retained artwork,
grouping/ungrouping, text/undo/persistence, captured picker input, layout, and rendered
pixels. The browser suite uses Chrome's debugging pipe with no npm dependencies.
Set `CHROME` to your Chrome executable on non-macOS systems; optionally set
`SKRYBBLE_SCREENSHOT` to save its final canvas screenshot.

## Recent Updates

### Latest additions
- ✅ **Direct Shape Dragging** - Move one shape or an entire multi-selection with the pointer
- ✅ **Persistent Groups** - Group, ungroup, move, style, copy, reorder, save, and restore composite shapes
- ✅ **Line Width Tool** - Five selectable stroke widths for existing and future shapes
- ✅ **Freehand Smoothness Tool** - Five levels with live preview and undo/redo integration
- ✅ **Toolbar Rendering Polish** - Improved antialiasing for tool icons

### Version 0.0.2 Features:
- ✅ **Freehand Drawing Tool** - Draw smooth curves by hand
- ✅ **Interactive Help System** - Press `?` to view all keyboard shortcuts
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
  "fileFormat": "skrbl-v0.0.4",
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

Group records also store an `x`/`y` translation with their child shapes. Text records
store `text`, `fontSize`, `width`, `height`, `fillColor`, position, and rotation.

All shape properties including rotation and colors are preserved on save/load. Each unique image is stored once in the top-level `imageData` table; image shapes reference it by numeric `imageId`. This keeps documents portable without repeating encoded bytes for duplicate placements.

---

*Built with PDG Framework • © 2025 Ed Zavada*

Shift constraints update immediately on key press/release during a gesture, even
when the pointer is stationary.

The canvas uses an I-beam cursor for text creation/editing, a crosshair for shape
creation, and magnifier cursors for zoom. Toolbar and popup cursors remain arrows.

## Import PDG pose drawings

Open the pose converter's `.pdgdrawing` or `.drawing.json` files with Ctrl/Cmd+O,
or pass a file to the launcher:

```sh
./skrybble ../v5-pose-library/drawings/t-pose-000-v5-tank-yoga-shaded.pdgdrawing
```

Shift+I also accepts these files and places their polygons as a group in the
current drawing. Desktop and browser file pickers support both formats.
Polygons remain editable, with fill colors, half-pixel vertices, transparent
holes and drawing order preserved, so the three cel tones stay below the ink.
Ungroup a placed drawing to edit individual polygons.

JSON imports preserve the original image canvas. Native streams do not store
image canvas metadata, so their page dimensions are derived from the polygon
extents. Opening an import fits its page in the viewport; saving writes a `.skrbl`
document beside the import and preserves page dimensions, leaving the source
PDG file unchanged. Existing `.skrbl` files without canvas metadata use 1024 × 1024.

The portable pose reader supports flat polygon snapshots v4/v5. A recursive
reader also imports nested v4/v5/v6 drawings, including the `v5-pose-library/r2`
files, as editable Groups containing polygons, lines and Cardinal/Bézier paths.
Shared drawing references become independent editable objects. Nested destination
rectangles, affine transforms, opacity and supported gradients/blend modes are
preserved. Select the imported group and use **Cmd/Ctrl+Shift+G** to ungroup it;
repeat for nested groups. Single-child drawing wrappers are collapsed on import.
Invalid files leave the current document unchanged.

Use **Ctrl/Cmd+Shift+S** to Save As `.pdgdrawing` on desktop or download the
binary stream in the browser. After Save As, Ctrl/Cmd+S saves that format again.
Native export preserves polygons, curves, primitives, text, images, attributes,
and nested groups when running a current `pdg-devel` runtime. Images are embedded;
font files must be installed on the receiving system. Pose polygons stay fully
editable, as do supported nested native drawings. Files containing unsupported
features such as embedded images, native fonts/text, clipping or other effects
reopen as retained artwork that can be moved, rotated, duplicated and grouped,
and saved inside `.skrbl` documents. An import notification explains when this
fallback prevents Ungroup, rather than silently treating the drawing as a group.

Select `PDG_SOURCE=devel` to use a built sibling `pdg-devel` runtime; an explicit
`PDG_EXECUTABLE` takes precedence.
The pinned PDG 1.2 runtime supports polygon pose exchange. For complete native
export/import on desktop, build `pdg-devel` or launch with
`PDG_EXECUTABLE=/path/to/pdg-devel/pdg ./skrybble`. For the browser, rebuild with
`PDG_WASM_DIR=/path/to/pdg-devel/build/wasm/wasm32/release ./tools/build-web.sh`.
Native streams omit editor canvas dimensions; reopening derives the page size
from the artwork bounds. `.skrbl` retains the editor canvas and shape-specific
editing information.

### Bone authoring (PDG 1.3 development runtime)

Use **B** and drag from root to tip. The first bone is named `root`. Starting
anywhere on an existing bone creates a child at that position; starting in empty
space creates another root. Selected artwork becomes a Part bound to the new
bone, keeping its placement, and is then deselected. Drawing a bare skeleton
requires no artwork selection.

New bones other than `root` open an inline name field. Press Enter to accept or
Escape to keep the generated name. Names must be nonempty and unique. With the
Select tool, drag an endpoint to edit the bind pose, or double-click a bone to
rename it. Select an endpoint and press Enter to rename later. The first `root`
keeps its name. Delete removes the selected bone and descendants, leaving artwork
unbound. Bone edits, names, and attachments support undo/redo.

Save as **.skrbl** to preserve the native serialized `AnimationRig`, editable
artwork, and Part bindings. Rig documents use `skrbl-v0.0.5`; drawings without
bones retain v0.0.4. **.pdgdrawing** exports contain artwork only. Skeletons, bone
names, and endpoint handles are editor overlays and are excluded from exports.
Dragging a connected endpoint applies IK only to its immediate parent, keeping
that parent's root fixed and preserving lengths and attachment positions. The
parent's descendants and their artwork follow its rotation during the preview
and after release; ancestors stay fixed. An unreachable target projects onto
the attachment's reachable circle. Unconnected endpoints remain editable for
changing bone lengths. Attached artwork follows endpoint edits without scaling.

Bone authoring requires a PDG runtime containing `AnimationRig`; use
`PDG_SOURCE=devel ./skrybble` or set `PDG_EXECUTABLE` to that development build.
For the web app, rebuild with a matching development WebAssembly runtime.

Starting a new bone on an existing child's parent connection creates a sibling,
sharing that child's parent and connection point. **Shift-drag** a child start
to slide its whole subtree along the parent segment; it cannot detach or rotate
the parent. An unattached start stays fixed with Shift. **Shift-drag** a tip to
resize and rotate that bone without parent IK. Descendant attachment positions
follow proportionally along its new length, and descendant lengths stay fixed.
When a parent tip overlaps a child start, select the parent first to Shift-drag
its tip; otherwise the child connection takes precedence. Releasing Shift
restores the normal immediate-parent IK behavior during the same drag.
