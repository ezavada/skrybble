### TODO ###

## freehand tool ## ✓ COMPLETED
- ✓ add a freehand tool that just collects points more than 2px apart as the user moves and holds down the mouse, creating a Cardinal Spline out of them
- ✓ unlike normal Cardinal Spline creation, you should not draw control points or endpoints while the shape is under construction

## help tool ## ✓ COMPLETED
- ✓ add a help tool to the far right of the tool palette that when clicked, shows the keyboard shortcuts

## color picker ## ✓ COMPLETED
- ✓ An RGB color picker that has separate horizontal red, green, blue, and opacity slider with a number from 0.0 to 1.0 to the left of each slider
- ✓ Each slider should be a rounded rectangle, filled with a gradient representing the range of colors from change that one component of the current color
- ✓ the slider control point should be a circle filled with the currect color, and framed with a white frame or black frame depending on the contrast with the fill.
- ✓ the hex value of the color should be shown
- ✓ there should also be a selection of most recently used colors. Save those in drawing file, too.
- ✓ be sure to implement a separate slider controller and view
- ✓ the selector popup should have its own controller and view
- ✓ there must be two tools, a fill color picker and a line color picker, that each will popup up a color picker
- ✓ each tool must start with the initial color of the selected item, and apply the color to the selected item as it changes
- ✓ esc cancels the color change, enter accepts
- ✓ accepted color changes are undoable/redoable

## quad tool ## ✓ COMPLETED
- ✓ implement the quad tool, which draws a 4 point polygon and automatically finishes when the 4th point is chosen

## line color tool ## ✓ COMPLETED
- ✓ the line color tool should show small black dots on either end, not a big white dot in the center

## freehand tool ## ✓ COMPLETED
- ✓ the freehand tool icon in the toolbar should look like a pencil
- ✓ the freehand tool should be right after the line tool in the toolbar, before the spline tool.

## multiclick shapes ## ✓ COMPLETED
- ✓ use <delete> key rather than <esc> to go back one point
- ✓ if cardinal spline is at two point (control + endpoint), delete completely erases the shape
- ✓ <esc> stops the drawing completely in the current state and goes into select mode

## saving ## ✓ COMPLETED
- ✓ if save succeeded, briefly display "Saved to {filename}" in the center of the screen

## toolbar ##
- need anti-aliasing for the spines, circles, and ovals, just like we did for lines

## key controls ## ✓ COMPLETED
- ✓ <esc> isn't being recognized at all other than closing the color picker
- ✓ <delete> during cardinal spline construction needs to delete the current spline if hit when there are 4 points, not 3

## control points ## ✓ COMPLETED
- ✓ hairline for angle (thickness 1, alpha 0.5)
- ✓ start angle from straight north at 0 radians
- ✓ white hairline around all control points for visibility

## color picker ##
- ✓ move current color swatch and hex to be right aligned with color numbers
- ✓ make current color swatch 1.5x larger
- ✓ move hex underneath current color swatch and remove "Hex:" from it
- ✓ move recent colors palette up about 4px to be tighter to "Recent Colors:" label
- ✓ checkerboard underneath alpha slider and under current color swatch
- ✓ if possible, position the color picker so it doesn't cover the currently selected item. If not possible, continue to center it on the screen.
- ✓ new items are not being created with the default color

## thickness control ##
- need a line thickness control that goes from hairline (0.25) to 5px
- sets line thickness of selected items
- undoable

## freehand smoothing operator ##
- remove points a certain distance from each other in a freehand spline depending on smoothing level
- undoable

## bugs ##
- after opening the color picker, <esc> stops working
- <esc> should close help
- tweak position of color display
- clicking outside color picker should not change selection, but should set current color to color of object hit
- can open color picker when already open
- should not handle any clicks in toolbar when color picker open

