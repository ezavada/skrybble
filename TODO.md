### TODO ###

## freehand tool ##
- add a freehand tool that just collects points more than 2px apart as the user moves and holds down the mouse, creating a Cardinal Spline out of them
- unlike normal Cardinal Spline creation, you should not draw control points or endpoints while the shape is under construction

## help tool ##
- add a help tool to the far right of the tool palette that when clicked, shows the keyboard shortcuts

## color picker ##
- An RGB color picker that has separate horizontal red, green, blue, and opacity slider with a number from 0.0 to 1.0 to the left of each slider
- Each slider should be a rounded rectangle, filled with a gradient representing the range of colors from change that one component of the current color
- the slider control point should be a circle filled with the currect color, and framed with a white frame or black frame depending on the contrast with the fill.
- the hex value of the color should be shown
- there should also be a selection of most recently used colors. Save those in drawing file, too.
- be sure to implement a separate slider controller and view
- the selector popup should have its own controller and view
- there must be two tools, a fill color picker and a line color picker, that each will popup up a color picker
- each tool must start with the initial color of the selected item, and apply the color to the selected item as it changes
- esc cancels the color change, enter accepts
- accepted color changes are undoable/redoable

