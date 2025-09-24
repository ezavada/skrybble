# Drawing App - Galactica-4 Style

A simple drawing application framework modeled on Galactica-4, built with a modular architecture using PDG (Portable Drawing Graphics).

## Features

- **Multiple Drawing Tools**: Line, Circle, Oval, Polygon, Spline, Rectangle
- **Interactive Editing**: Drag endpoints and control points to modify shapes
- **Color Support**: Choose fill and stroke colors with keyboard shortcuts
- **Shape Management**: Keep track of all drawn shapes for editing and rendering
- **Modular Architecture**: Clean separation of concerns across multiple files

## File Structure

```
anime-faces/
├── main.js              # Entry point
├── drawing.js           # Main drawing application
├── shapes.js            # Shape classes and implementations
├── tools.js             # Tool management and drawing state
├── input.js             # Input handling (mouse/keyboard)
├── shapeManager.js      # Shape list management
├── facegen.js           # Face generation system (placeholder)
└── index.html           # Web interface for testing
```

## Usage

### Web Interface
Open `index.html` in a web browser to test the application.

### Keyboard Shortcuts

#### Tool Selection
- `1` - Line tool
- `2` - Circle tool  
- `3` - Oval tool
- `4` - Polygon tool
- `5` - Spline tool
- `7` - Rectangle tool
- `S` - Select tool

#### Color Selection
- `R` - Red stroke color
- `G` - Green stroke color
- `B` - Blue stroke color
- `K` - Black stroke color
- `W` - White fill color

#### Other Controls
- `Delete` - Delete selected shape
- `Escape` - Cancel current drawing operation

### Drawing Instructions

1. **Basic Shapes**: Select a tool (1-7), then click and drag to draw
2. **Polygons**: Select polygon tool (4), then click multiple points to create shape
3. **Splines**: Select spline tool (5), then click multiple points for smooth curves
4. **Editing**: Use select tool (S) to click on shapes, then drag red endpoints to modify
5. **Control Points**: For splines, drag green control points to adjust curve shape

## Architecture

### Core Classes

- **DrawingApp**: Main application coordinator
- **ToolManager**: Manages current tool and drawing state
- **ShapeManager**: Handles shape storage, rendering, and manipulation
- **InputHandler**: Processes mouse and keyboard events
- **Shape Classes**: Individual shape implementations (Line, Circle, etc.)

### Shape System

Each shape class extends the base `Shape` class and implements:
- `draw(ctx)` - Render the shape
- `contains(x, y)` - Check if point is inside shape
- `getEndpoints()` - Return editable endpoints
- `getControlPoints()` - Return control points (for splines)

### Event Flow

1. User input → InputHandler
2. InputHandler → ToolManager (tool changes, drawing state)
3. InputHandler → ShapeManager (shape creation, selection)
4. ShapeManager → Rendering system (display updates)

## Development

### Adding New Shapes

1. Create new class in `shapes.js` extending `Shape`
2. Implement required methods (`draw`, `contains`, `getEndpoints`)
3. Add tool constant in `tools.js`
4. Update tool selection logic in `input.js`

### Adding New Tools

1. Add tool constant to `TOOLS` in `tools.js`
2. Add keyboard shortcut to `TOOL_SHORTCUTS`
3. Implement tool-specific logic in `ToolManager`
4. Update input handling in `InputHandler`

## Dependencies

- PDG (Pixed Dust Game engine) - For canvas creation and rendering
- Modern JavaScript (ES6+ modules)

## Future Enhancements

- Image tool implementation
- Quad tool (quadrilateral) implementation
- Save/load functionality
- Undo/redo system
- Layer support
- More advanced color picker UI
