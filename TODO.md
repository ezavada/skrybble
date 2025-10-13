### TODO ###

## draw order ##
- add + and - to change the draw order of the selected items. + moves them further forward in the draw order, - moves them further back
- add ctrl + and ctrl - to move the selected items all the way to the front of the draw order, or all the way to the back
- these must be undoable and redoable, with sequential +/- accumulating like nudges do
- since getting a true "+" requires shift on most keyboards, accept the = key as a synonym for plus

## rotation ##
- for every shape, draw a blue control point that marks the centerpoint of the shape, along with a short blue line representing the rotation
- if you click on the centerpoint, while the mouse is held down you may rotate the shape by moving the mouse, with the vector from the centerpoint to the
   mouse point representing the angle of rotation

## freehand tool ##
- add a freehand tool that just collects points more than 2px apart as the user moves and holds down the mouse, creating a Cardinal Spline out of them
- unlike normal Cardinal Spline creation, you should not draw control points or endpoints while the shape is under construction

## help tool ##
- add a help tool to the far right of the tool palette that when clicked, shows the keyboard shortcuts

## color selector ##
- 
