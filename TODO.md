# Skrybble status

Last reviewed: 2026-08-19

## Remaining work

### Image tool

- [ ] Implement the currently placeholder image tool.

## Completed

### Group and ungroup

- [x] Group selected elements into a first-class Skrybble group rendered through a `pdg.Drawing`.
- [x] Ungroup elements and restore the child Skrybble shapes in drawing order.
- [x] Support nested groups, selection, movement, styling, clipboard operations, and file persistence.
- [x] Make grouping and ungrouping undoable and redoable.
- [x] Assign `Cmd/Ctrl+G` and `Cmd/Ctrl+Shift+G` shortcuts.

### Framework compatibility

- [x] Adopt the current `Application` lifecycle using `setupGraphics()` and `setupControllers()`.
- [x] Create controllers after `pdg.run()` so their draw and input handlers remain registered.
- [x] Preserve command-line `.skrbl` loading with the new lifecycle.
- [x] Forward view-resizing bindings and use the current `grow_Horz` binding name.
- [x] Initialize PDG window ports from the native content size actually granted by the OS, keeping drawing and mouse coordinates aligned.
- [x] Restore visible toolbar rendering when the OS constrains the requested window height.

### Toolbar rendering

- [x] Anti-alias the spline, Bezier, circle, and oval toolbar icons using the same layered-stroke treatment as the line icon.

### Freehand tool

- [x] Add a freehand tool that collects points more than 2 px apart while dragging and creates a Cardinal Spline from them.
- [x] Hide control points and endpoints while a freehand shape is under construction.
- [x] Use a pencil icon in the toolbar.
- [x] Position the freehand tool after the line tool and before the spline tool.

### Freehand smoothing

- [x] Remove nearby points from a freehand spline according to its smoothing level.
- [x] Fall back to the next smoothing level when a level removes too many points.
- [x] Use smoothing distances of 2, 3, 5, 8, and 13 px.
- [x] Apply the default smoothing level during freehand creation.
- [x] Change the default smoothing when no freehand item is selected.
- [x] Provide a toolbar popup with five example lines at different smoothing levels.
- [x] Assign the `U` keyboard shortcut.
- [x] Make smoothing changes undoable and redoable.

### Help tool

- [x] Add a help tool at the far right of the toolbar that displays keyboard shortcuts.
- [x] Close help with Escape.

### Color picker

- [x] Provide red, green, blue, and opacity sliders with values from 0.0 to 1.0.
- [x] Fill each rounded slider with a gradient for its color component.
- [x] Draw the slider control point using the current color and a contrast-sensitive black or white frame.
- [x] Display the hexadecimal color value.
- [x] Store recently used colors in drawing files.
- [x] Use separate slider and color-picker controllers and views.
- [x] Provide separate fill-color and line-color tools.
- [x] Initialize from the selected shape and apply changes to it interactively.
- [x] Cancel with Escape and accept with Enter.
- [x] Make accepted color changes undoable and redoable.
- [x] Right-align the current-color swatch and hexadecimal value with the component values.
- [x] Enlarge the current-color swatch and place the hexadecimal value beneath it without a label.
- [x] Tighten spacing above the recent-colors palette.
- [x] Draw a checkerboard beneath the alpha slider and current-color swatch.
- [x] Position the picker away from the selected shape when possible.
- [x] Sample a shape's color when it is clicked outside the picker without changing selection.
- [x] Create new shapes using the configured default colors.
- [x] Prevent duplicate color pickers and block toolbar input while a picker is open.
- [x] Keep Escape working after opening the color picker.

### Shape creation and editing

- [x] Implement the four-point quad tool and finish automatically after its fourth point.
- [x] Use Delete to remove the most recent point from a multi-click shape.
- [x] Delete a minimal Cardinal Spline completely.
- [x] Finish the current multi-click shape and return to Select with Escape.
- [x] Draw a 1 px, 50%-alpha rotation hairline.
- [x] Measure rotation from straight north at zero radians.
- [x] Draw a white hairline around control points for visibility.

### Line appearance controls

- [x] Show small black endpoint dots in the line-color toolbar icon.
- [x] Provide line-width options of 0.25, 1.0, 2.0, 3.5, and 5.0 px.
- [x] Apply line width to selected shapes.
- [x] Provide a five-option line-width popup below the toolbar.
- [x] Assign the `W` keyboard shortcut.
- [x] Make line-width changes undoable and redoable.

### Saving and feedback

- [x] Display `Saved to {filename}` briefly after a successful save.

### Input and popup fixes

- [x] Recognize Escape outside the color picker.
- [x] Delete a Cardinal Spline under construction at its minimal four-point representation.
- [x] Prevent outside color-picker clicks from changing selection.
- [x] Prevent toolbar clicks while the color picker is open.
