// -----------------------------------------------
// DrawingController.js
// 
// Drawing Application using the PDG JavaScript MVC Framework
//
// (c) 2025, Ed Zavada
// -----------------------------------------------

const ViewBinding = require('./index').ViewBinding;
const Controller = require('./index').Controller;
const Tools = require('./index').Tools;
const Drawing = require('./index').Drawing;

const DrawingSurfaceView = require('./DrawingSurfaceView.js');
const ToolPaletteView = require('./ToolPaletteView.js');
const ColorPickerController = require('./ColorPickerController.js');
const LineWidthController = require('./LineWidthController.js');
const SmoothnessController = require('./SmoothnessController.js');
const chooseImageFile = require('./image-file-picker.js');
const chooseDrawingFile = require('./drawing-file-picker.js');

const CanvasNavigation = require('./CanvasNavigation');
const ToolCursors=require('./ToolCursors');
const CanvasTextEditor=require('./CanvasTextEditor');
const FontPickerController=require('./FontPickerController');
const {axisPoint,snapAngle,linePoint}=require('./GestureConstraints');
const fs = require('fs');
const path = require('path');

// -----------------------------------------------
// Drawing Controller class
// -----------------------------------------------

class DrawingController extends Controller {
    constructor(app, port) {
        // super calls setupViews()
        // this is the top level controller, so we give it app and port rather than a parent
        super(null, app, port, true, true, true, false, true);
        this.cursors=new ToolCursors(this.port);
        this.navigation = new CanvasNavigation();
        this.navigation.setViewport(this.backgroundView.getViewArea());
        this.spaceHeld = false;
        this.panPosition = null;
        this.textEdit = null;
        if (globalThis.skrybbleWeb && globalThis.skrybbleWeb.onCanvasWheel) {
            this.removeBrowserWheel=globalThis.skrybbleWeb.onCanvasWheel(event=> {
                const area=this.port.getDrawingArea();
                const point=new pdg.Point(area.left+event.x*area.width(),area.top+event.y*area.height());
                if (!this.backgroundView.pointInViewArea(point)) return false;
                this.navigation.setViewport(this.backgroundView.getViewArea());
                if (this.fontPickerController || this.colorPickerController || this.lineWidthController || this.smoothnessController) return true;
                this.navigation.zoomAt(Math.exp(-event.deltaY/1000),this.navigationAnchor(point));
                return true;
            });
        }
        this.textDefaults={fontName:'Arial',fontSize:24,textStyle:0};
        this.fontPickerController=null;
        this.drawing = new Drawing();
        this.toolManager = new Tools(this.drawing.getShapeClasses());
        
        // Input handling state
        this.draggedPoint = null;
        this.draggedShapes = null; // Shapes being repositioned in select mode
        this.shapeDragLastPosition = null;
        this.shapeDragUndoSaved = false;
        this.selectedShape = null;
        this.rotatingShape = null; // Track if we're rotating a shape
        this.rotationStartAngle = 0; // Initial angle when rotation started
        this.shapeStartRotation = 0; // Shape's rotation when rotation started
        this.dragReferencePointIndex = null; // Index of a non-dragged point to use as reference
        this.dragReferencePointWorld = null; // Original world position of reference point
        
        // Rubber-band selection state
        this.rubberBandStart = null;
        this.rubberBandEnd = null;
        this.rubberBandActive = false;
        this.rubberBandPending = false; // True when mouse is down but hasn't moved minimum distance
        this.rubberBandModifiers = null; // Store modifier keys (shift, ctrl, etc.) for selection
        this.rubberBandInitialStates = null; // Store initial selection states for toggle mode
        
        // Clipboard for cut/copy/paste
        this.clipboard = null;
        this.pasteCount = 0; // Track how many times current clipboard has been pasted
        
        // Undo/Redo history
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoLevels = 50;
        this.isNudging = false; // Track if we're in a nudge sequence
        this.nudgeTimer = null; // Timer to finalize nudge after inactivity
        this.isReordering = false; // Track if we're in a reorder sequence
        this.reorderTimer = null; // Timer to finalize reorder after inactivity
        
        // File handling
        this.currentFilename = null;
        
        // Help display state
        this.showHelp = false;
        
        // Color picker state
        this.colorPickerController = null;
        this.recentColors = []; // Track recently used colors
        this.maxRecentColors = 10;
        
        // Line width picker state
        this.lineWidthController = null;
        this.lineWidthPreviousTool = null;
        
        // Smoothness picker state
        this.smoothnessController = null;
        this.smoothnessPreviousTool = null;
        
        // Save confirmation message
        this.saveMessage = null;
    }
    
    setupViews() {
        const drawingArea = this.port.getDrawingArea();
        
        const paletteHeight = 50;         

        // Create drawing surface below the palette
        const surfaceRect = new pdg.Rect(drawingArea);
        surfaceRect.top = paletteHeight;
        surfaceRect.setHeight(drawingArea.height() - paletteHeight);
        this.backgroundView = new DrawingSurfaceView(this, surfaceRect, ViewBinding.grow);

        // Create tool palette at the top (but drawn after the drawing surface)
        const paletteRect = new pdg.Rect(drawingArea);
        paletteRect.setHeight(paletteHeight);
        this.toolPaletteView = new ToolPaletteView(this, paletteRect, ViewBinding.grow_Horz | ViewBinding.bind_Top);

        console.log('DrawingController::setupViews, paletteRect', paletteRect);
        console.log('DrawingController::setupViews, surfaceRect', surfaceRect);
    }

    // ============================ Event Handling Overrides ============================

    activePicker() {return this.fontPickerController || this.colorPickerController || this.lineWidthController || this.smoothnessController;}
    routePickerInput(method,event) {
        // A child controller may bubble an unmatched event back to us.
        // Avoid routing it straight back to that same child.
        if(this._routingPicker)return false;
        const picker=this.activePicker();
        if(!picker)return super[method](event);
        this._routingPicker=picker;
        try {picker[method](event);return true;}
        finally {this._routingPicker=null;}
    }
    onMouseDown(event) {
        // Toolbar input takes precedence over popup and canvas capture.
        const palette=this.toolPaletteView;
        if(this.active && palette.pointInViewArea(event.mousePos) && !event.rightButton) {
            const part=palette.getPartClicked(event.mousePos);
            if(part>0) {
                this.activePicker()?.cancel();
                this.commitTextEdit();
                const tool=this.toolManager.getCurrentTool();
                if([Tools.TOOLS.SPLINE,Tools.TOOLS.BEZIER,Tools.TOOLS.POLY,Tools.TOOLS.QUAD].includes(tool) && this.toolManager.isCurrentlyDrawing()) {
                    const shape=this.toolManager.finishMultiPointShape(false);
                    if(shape){if(shape.isQuad)shape.isQuad=false;this.saveUndoState('add shape');this.drawing.addShape(shape);}
                }
                this.resetCanvasGesture();
                const chosen=Object.values(Tools.TOOLS)[part-1];
                if(chosen!==Tools.TOOLS.HELP)this.showHelp=false;
                this._toolbarPress=true;palette.pressedTool=chosen;palette.updateHover(event.mousePos);
                this.doLeftClick(event,palette,palette.getID(),part);
                this.updateCursor(event);return true;
            }
        }
        const result=this.routePickerInput('onMouseDown',event);this.updateCursor(event);return result;
    }
    onMouseUp(event) {
        if(this._toolbarPress) {
            this._toolbarPress=false;this.toolPaletteView.pressedTool=null;
            this.toolPaletteView.updateHover(event.mousePos);this.updateCursor(event);return true;
        }
        const result=this.routePickerInput('onMouseUp',event);this.updateCursor(event);return result;
    }
    onMouseMove(event) {
        this.toolPaletteView.updateHover(event.mousePos);this.updateCursor(event);
        if(this._toolbarPress)return true;
        return this.routePickerInput('onMouseMove',event);
    }

    zoomOut(event={}) {
        return !!(event.shift || event.alt || event.option || event.ctrl || event.control || event.rightButton ||
            event.buttonNumber===1 || this._shiftKeys?.size || this._zoomModifierKeys?.size);
    }

    updateZoomModifiers(info,down) {
        const browser=!!globalThis.skrybbleWeb;
        const alt=browser?[18]:[pdg.keyCode_LeftAlt,pdg.keyCode_RightAlt,342,346];
        const ctrl=browser?[17]:[pdg.keyCode_LeftControl,pdg.keyCode_RightControl,341,345];
        if(!browser && process.platform==='win32'){alt.push(18,164,165);ctrl.push(17,162,163);}
        if(!alt.includes(info.keyCode) && !ctrl.includes(info.keyCode))return false;
        this._zoomModifierKeys ||= new Set();
        if(down)this._zoomModifierKeys.add(info.keyCode);else this._zoomModifierKeys.delete(info.keyCode);
        // MouseInfo may lag behind KeyInfo. Use the tracked physical keys for
        // both the cursor and click action, so the minus always means zoom out.
        if(alt.includes(info.keyCode))this._cursorAlt=down;
        if(ctrl.includes(info.keyCode))this._cursorCtrl=down;
        this.updateCursor();return true;
    }

    updateCursor(event={}) {
        if(event.mousePos)this._cursorPoint={x:event.mousePos.x,y:event.mousePos.y};
        if('shift' in event)this._cursorShift=!!event.shift;
        if('alt' in event)this._cursorAlt=!!event.alt;
        if('ctrl' in event)this._cursorCtrl=!!event.ctrl;
        if('rightButton' in event)this._cursorRight=!!event.rightButton;
        const point=this._cursorPoint || pdg.gfx.getMouse(),tool=this.toolManager?.getCurrentTool();
        let cursor='default';
        if(this.active && !this.showHelp && !this.activePicker() && this.backgroundView.pointInViewArea(point)) {
            const world=this.navigation.toWorld(point);
            if(this.spaceHeld || tool===Tools.TOOLS.PAN)cursor=this.panPosition?'grabbing':'grab';
            else if(tool===Tools.TOOLS.ZOOM)cursor=this.zoomOut({shift:this._cursorShift,alt:this._cursorAlt,ctrl:this._cursorCtrl,rightButton:this._cursorRight})?'zoom-out':'zoom-in';
            else if(this.navigation.contains(world)) {
                const textHit=this.drawing.findShapeAt(world.x,world.y)?.constructor.name==='Text';
                if(tool===Tools.TOOLS.TEXT || (this.textEdit && this.textEdit.shape.contains(world.x,world.y)) ||
                    (tool===Tools.TOOLS.SELECT && textHit))cursor='text';
                else if([Tools.TOOLS.LINE,Tools.TOOLS.FREEHAND,Tools.TOOLS.SPLINE,Tools.TOOLS.BEZIER,
                    Tools.TOOLS.CIRCLE,Tools.TOOLS.OVAL,Tools.TOOLS.RECT,Tools.TOOLS.QUAD,Tools.TOOLS.POLY,Tools.TOOLS.IMAGE].includes(tool))cursor='crosshair';
            }
        }
        this.cursors?.set(cursor);
        return cursor;
    }

    doMouseDown(mouseInfo, view, id, part) {
        // Don't handle toolbar in MouseDown - let it generate clicks instead
        if (view === this.toolPaletteView) {
            return false;
        }
        
        if (view === this.backgroundView) {
            // If any picker is open, don't handle drawing area clicks
            if (this.fontPickerController || this.lineWidthController || this.smoothnessController) {
                return false;
            }
            
            // If color picker is open, check if clicking on a shape to sample its color
            if (this.colorPickerController) {
                const pos = this.getMousePosition(mouseInfo);
                const shapes = this.drawing.getShapes();
                
                // Find shape at click position (don't change selection)
                for (let i = shapes.length - 1; i >= 0; i--) {
                    if (shapes[i].contains(pos.x, pos.y)) {
                        // Sample this shape's color
                        const colorType = this.colorPickerController.colorType;
                        const shapeColor = colorType === 'fill' ? shapes[i].fillColor : shapes[i].strokeColor;
                        
                        // Apply to color picker without changing selection
                        if (shapeColor && this.colorPickerController.parseColor) {
                            const parsedColor = this.colorPickerController.parseColor(shapeColor);
                            this.colorPickerController.currentColor = parsedColor;
                            
                            // Update sliders
                            if (this.colorPickerController.redSlider) {
                                this.colorPickerController.redSlider.setValue(parsedColor.r);
                                this.colorPickerController.greenSlider.setValue(parsedColor.g);
                                this.colorPickerController.blueSlider.setValue(parsedColor.b);
                                this.colorPickerController.alphaSlider.setValue(parsedColor.a);
                            }
                            
                            this.colorPickerController.updateColor();
                        }
                        return true; // Handled, don't change selection
                    }
                }
                return true; // Clicked outside shapes, do nothing
            }
            
            const currentTool = this.toolManager.getCurrentTool();
            // For multi-point tools, don't fully handle mouseDown - let it generate clicks
            if (currentTool === Tools.TOOLS.SPLINE || currentTool === Tools.TOOLS.BEZIER || currentTool === Tools.TOOLS.POLY || currentTool === Tools.TOOLS.QUAD) {
                this.handleMouseDown(mouseInfo);
                return false; // Allow click events to be generated
            }
            // For other tools, fully handle the event
            return this.handleMouseDown(mouseInfo);
        }
        return false;
    }

    doMouseUp(mouseInfo, view, id, part) {
        // Only handle mouse events on the drawing surface
        if (view === this.backgroundView) {
            const currentTool = this.toolManager.getCurrentTool();
            // For multi-point tools, don't fully handle mouseUp - let it generate clicks
            if (currentTool === Tools.TOOLS.SPLINE || currentTool === Tools.TOOLS.BEZIER || currentTool === Tools.TOOLS.POLY || currentTool === Tools.TOOLS.QUAD) {
                this.handleMouseUp(mouseInfo);
                return false; // Allow click events to be generated
            }
            // Text receives normal click counting so double-click starts editing.
            const result=this.handleMouseUp(mouseInfo);
            if(currentTool===Tools.TOOLS.ZOOM)return result;
            const pos=this.getMousePosition(mouseInfo);
            const hit=this.drawing.findShapeAt(pos.x,pos.y);
            return hit && hit.constructor.name==='Text' ? false : result;
        }
        return false;
    }

    doMouseMove(mouseInfo, view, id, part) {
        // Only handle mouse events on the drawing surface
        if (view === this.backgroundView) {
            return this.handleMouseMove(mouseInfo);
        }
        return false;
    }

    doLeftClick(mouseInfo, view, id, part) {
        // Handle toolbar clicks
        if (view === this.toolPaletteView) {
            this.activePicker()?.cancel();
            this.commitTextEdit();
            // Handle tool selection from tool palette
            // Part numbers correspond to tool indices (1-based)
            if (part > 0) {
                const toolNames = Object.values(Tools.TOOLS);
                const selectedTool = toolNames[part - 1];
                if (selectedTool) {
                    if(selectedTool===Tools.TOOLS.FONT) {this.openFontPicker(part);return true;}
                    // Special handling for HELP tool - just toggle help, don't switch tools
                    if (selectedTool === Tools.TOOLS.HELP) {
                        this.toggleHelp();
                        return true;
                    }
                    // Special handling for color picker tools
                    if (selectedTool === Tools.TOOLS.FILL_COLOR || selectedTool === Tools.TOOLS.LINE_COLOR) {
                        this.openColorPicker(selectedTool);
                        return true;
                    }
                    // Special handling for line width tool
                    if (selectedTool === Tools.TOOLS.LINE_WIDTH) {
                        this.openLineWidthPicker(part);
                        return true;
                    }
                    // Special handling for smoothness tool
                    if (selectedTool === Tools.TOOLS.SMOOTHNESS) {
                        this.openSmoothnessPicker(part);
                        return true;
                    }
                    if (selectedTool === Tools.TOOLS.IMAGE) {
                        this.activateImageTool();
                        return true;
                    }
                    
                    // If another tool is selected while a picker is open, cancel the picker
                    if (this.lineWidthController) {
                        this.lineWidthController.cancel();
                    }
                    if (this.smoothnessController) {
                        this.smoothnessController.cancel();
                    }
                    
                    this.toolManager.setTool(selectedTool);
                    this.updateToolSelection(selectedTool);
                    return true;
                }
            }
            return false;
        }
        
        // Handle single clicks on the drawing surface
        if (view === this.backgroundView) {
            // Don't handle background clicks when pickers are open
            if (this.fontPickerController || this.lineWidthController || this.smoothnessController) {
                return false;
            }
            return this.handleMouseClick(mouseInfo);
        }
        return false;
    }

    doDoubleClick(mouseInfo, view, id, part, clickCount) {
        // Handle double clicks on the drawing surface
        if (view === this.backgroundView) {
            return this.handleMouseDoubleClick(mouseInfo);
        }
        return false;
    }

    doRightClick(mouseInfo, view, id, part) {
        // Handle right clicks on the drawing surface
        // Right-click finishes multi-point shapes without adding an extra point
        if (view === this.backgroundView) {
            return this.handleMouseRightClick(mouseInfo);
        }
        return false;
    }

    doKeyDown(info) {
        this.lastPhysicalKey=info.keyCode;
        const zoomChanged=this.updateZoomModifiers(info,true);
        return this.updateGestureShift(info,true) || zoomChanged;
    }

    updateGestureShift(info,down) {
        // Native KeyInfo has only a raw keyCode; mouse modifiers arrive later.
        const keys=[pdg.keyCode_LeftShift,pdg.keyCode_RightShift,340,344];
        if(globalThis.skrybbleWeb || process.platform==='win32')keys.push(16,160,161);
        if(process.platform==='linux')keys.push(42,54,50,62);
        if(!keys.includes(info.keyCode) && info.key!=='Shift')return false;
        this._shiftKeys ||= new Set();
        const before=this._shiftKeys.size>0;
        if(down)this._shiftKeys.add(info.keyCode);else this._shiftKeys.delete(info.keyCode);
        const shift=this._shiftKeys.size>0;
        this.updateCursor({shift});
        if(before===shift)return false;
        if(this._gesturePointer && !this.textEdit && !this.activePicker() && !this.showHelp &&
            (this.panPosition || this.rotatingShape || this.draggedPoint || this.draggedShapes || this.toolManager.isCurrentlyDrawing())) {
            this.handleMouseMove({mousePos:new pdg.Point(this._gesturePointer),shift});
            return true;
        }
        return false;
    }

    doKeyUp(keyUpInfo, view, id, part) {
        const zoomChanged=this.updateZoomModifiers(keyUpInfo,false);
        const changed=this.updateGestureShift(keyUpInfo,false);
        return this.handleKeyUp(keyUpInfo) || changed || zoomChanged;
    }

    doKeyPress(keyPressInfo, view, id, part) {
        if(this.fontPickerController)return this.fontPickerController.doKeyPress(keyPressInfo);
        if (this.textEdit) return this.handleTextKey(keyPressInfo);
        const unicode = keyPressInfo && keyPressInfo.unicode;
        console.log('DrawingController.doKeyPress, unicode:', unicode, 'colorPickerController:', !!this.colorPickerController, 'showHelp:', this.showHelp);
        
        // If color picker is open, let it handle keys first
        if (this.colorPickerController) {
            console.log('DrawingController.doKeyPress - passing to color picker');
            const handled = this.colorPickerController.doKeyPress(keyPressInfo, view, id, part);
            console.log('DrawingController.doKeyPress - color picker handled:', handled, 'colorPickerController after:', !!this.colorPickerController);
            // Color picker handles ESC and ENTER, so return handled value
            return handled;
        }
        
        // If line width picker is open, let it handle keys first
        if (this.lineWidthController) {
            const handled = this.lineWidthController.doKeyPress(keyPressInfo, view, id, part);
            return handled;
        }
        
        // If smoothness picker is open, let it handle keys first
        if (this.smoothnessController) {
            const handled = this.smoothnessController.doKeyPress(keyPressInfo, view, id, part);
            return handled;
        }
        
        // If help is showing, ESC should close it
        if (this.showHelp) {
            if (unicode === 27) { // ESC key
                console.log('DrawingController.doKeyPress - closing help');
                this.toggleHelp();
                return true;
            }
        }
        
        console.log('DrawingController.doKeyPress - passing to handleKeyPress');
        return this.handleKeyPress(keyPressInfo);
    }

    // ============================ Input Handler Methods ============================

    getMousePosition(event) {
        const pos = event && event.mousePos || {x:0,y:0};
        this.navigation.setViewport(this.backgroundView.getViewArea());
        return this.navigation.toWorld(pos);
    }

    onScrollWheel(event) {
        if (!this.active || this.showHelp) return false;
        // Native wheel events have no mousePos; do not discard navigation
        // because the runtime's last pointer sample hits the toolbar.
        return this.doScrollWheel(event);
    }

    navigationAnchor(point = pdg.gfx.getMouse()) {
        this.navigation.setViewport(this.backgroundView.getViewArea());
        // Galactica's priority: selection, cursor in the canvas, viewport center.
        // Use the combined world bounds so groups and multiple selections agree.
        const selected=this.drawing.getShapes().filter(shape=>shape.selected);
        if(selected.length) {
            const bounds=selected.map(require('./shapes').getShapeBounds);
            return this.navigation.toView(new pdg.Point(
                (Math.min(...bounds.map(b=>b.left))+Math.max(...bounds.map(b=>b.right)))/2,
                (Math.min(...bounds.map(b=>b.top))+Math.max(...bounds.map(b=>b.bottom)))/2));
        }
        return this.backgroundView.pointInViewArea(point) ? point
            : this.backgroundView.getViewArea().centerPoint();
    }

    doScrollWheel(event) {
        // The DOM bridge owns browser wheel navigation. GLFW can also enqueue
        // a native event before our canvas listener stops propagation; handling
        // both zooms twice, with the native event using a stale pointer.
        if (this.removeBrowserWheel) return true;
        if (this.fontPickerController || this.colorPickerController || this.lineWidthController || this.smoothnessController) return true;
        this.navigation.zoomAt(Math.exp(-Math.max(-6,Math.min(6,event.vertDelta || 0)) * .1), this.navigationAnchor(event.mousePos));
        return true;
    }

    openFontPicker(part) {
        if(this.fontPickerController)return;
        this.commitTextEdit();
        const area=this.toolPaletteView.getViewArea();
        this.fontPickerController=new FontPickerController(this,area.left+(part-1)*this.toolPaletteView.slotWidth());
        this.updateToolSelection(Tools.TOOLS.FONT);
    }

    beginTextEdit(shape, isNew=false) {
        if(this.textEdit?.shape===shape)return;
        this.commitTextEdit();
        shape.layout(this.port);shape._editing=true;
        this.textEdit = {shape,isNew,before:shape.text,beforeWidth:shape.width,beforeHeight:shape.height,
            editor:new CanvasTextEditor(this,shape)};
        this.selectShape(shape);
    }

    commitTextEdit(cancel=false) {
        if (!this.textEdit) return;
        const {shape,isNew,before}=this.textEdit;
        const text=shape.text;
        shape.text=before;
        if (!cancel && text.trim() && (isNew || text!==before)) {
            this.saveUndoState(isNew ? 'add text' : 'edit text');
            shape.text=text;
            if (isNew) this.drawing.addShape(shape);
        }
        shape.layout(this.port);
        this.textEdit.editor.setFocus(false);delete shape._editing;
        this.textEdit=null;this.textSelecting=false;
    }

    handleTextKey(event) {
        const code=event.unicode;
        if ((event.ctrl || event.meta || event.command) && [83,115].includes(code)) {
            this.commitTextEdit(); return this.handleKeyPress(event);
        }
        if (code===27) this.escapeToSelect();
        else if (code===13) this.commitTextEdit();
        else {
            this.textEdit.editor.doKeyPress(event);
            this.textEdit.editor.sync();
        }
        return true;
    }

    handleMouseDown(event) {
        this._gesturePointer={x:event.mousePos.x,y:event.mousePos.y};
        const pos = this.getMousePosition(event);
        const currentTool = this.toolManager.getCurrentTool();
        if (currentTool===Tools.TOOLS.ZOOM && !this.spaceHeld) {
            this.commitTextEdit();
            this.navigation.zoomAt(this.zoomOut(event) ? 1/1.25 : 1.25,this.navigationAnchor(event.mousePos));
            return true;
        }
        if (this.spaceHeld || currentTool === Tools.TOOLS.PAN) {
            this.panPosition={x:event.mousePos.x,y:event.mousePos.y};
            this._panOrigin={...this.panPosition};this._panConstraint={};return true;
        }
        if (!this.navigation.contains(pos)) return true;
        if(this.textEdit && this.textEdit.shape.contains(pos.x,pos.y)) {
            this.textEdit.editor.positionAt(pos,!!event.shift);this.textSelecting=true;return true;
        }
        if (currentTool === Tools.TOOLS.TEXT) {
            const hit=this.drawing.findShapeAt(pos.x,pos.y);
            if (hit && hit.constructor.name==='Text') this.beginTextEdit(hit);
            else {
                const defaults=this.textDefaults;
                this.beginTextEdit(new (this.drawing.getShapeClasses().Text)(pos.x,pos.y,'',this.toolManager.strokeColor,
                    defaults.fontSize,undefined,undefined,defaults.fontName,defaults.textStyle),true);
            }
            this.textEdit.editor.positionAt(pos,!!event.shift);this.textSelecting=true;
            return true;
        }
        this.commitTextEdit();
        if (currentTool === Tools.TOOLS.SELECT) {
            this.handleSelectMode(pos.x, pos.y, event);
        } else if (currentTool === Tools.TOOLS.SPLINE || currentTool === Tools.TOOLS.BEZIER || currentTool === Tools.TOOLS.POLY || currentTool === Tools.TOOLS.QUAD) {
            // For multi-point tools, start drawing but wait for clicks to add points
            if (!this.toolManager.isCurrentlyDrawing()) {
                // Deselect any previously selected shape
                this.selectShape(null);
                this.toolManager.startDrawing(pos.x, pos.y, this.drawing.getShapeClasses());
            }
        } else {
            // For single-action tools, start drawing on mouse down
            this.toolManager.startDrawing(pos.x, pos.y, this.drawing.getShapeClasses());
        }
        return true;
    }

    handleMouseMove(event) {
        this._gesturePointer={x:event.mousePos.x,y:event.mousePos.y};
        if(this.textSelecting && this.textEdit) {
            this.textEdit.editor.positionAt(this.getMousePosition(event),true);return true;
        }
        if (this.panPosition) {
            const point=axisPoint(this._panOrigin,event.mousePos,this._panConstraint,!!event.shift);
            this.navigation.pan(point.x-this.panPosition.x,point.y-this.panPosition.y);
            this.panPosition={x:point.x,y:point.y};return true;
        }
        const pos = this.getMousePosition(event);
        if(!this.rotatingShape) {
            pos.x=Math.max(0,Math.min(1024,pos.x));pos.y=Math.max(0,Math.min(1024,pos.y));
        }

        if (this.toolManager.isCurrentlyDrawing()) {
            this.toolManager.updateDrawing(pos.x, pos.y,!!event.shift);
        } else if (this.rotatingShape) {
            const shape=this.rotatingShape,center=shape.getCenterPoint();
            const dx=pos.x-center.x,dy=pos.y-center.y;
            if(Math.hypot(dx,dy)>1/this.navigation.camera.getZoom()) {
                const angle=Math.atan2(dy,dx)+Math.PI/2;
                shape.rotation=event.shift?snapAngle(angle):angle;
                shape._rotationGuideLength=Math.max(shape.getRotationLineLength(),shape._rotationGuideLength || 0,Math.hypot(dx,dy));
            }
        } else if (this.rubberBandPending) {
            // Check if we've moved enough to activate rubber-band selection
            const MIN_DISTANCE = 3;
            const dx = pos.x - this.rubberBandStart.x;
            const dy = pos.y - this.rubberBandStart.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance >= MIN_DISTANCE) {
                // Activate rubber-band selection
                this.activateRubberBandSelection();
                this.updateRubberBandSelection(pos.x, pos.y);
            }
        } else if (this.rubberBandActive) {
            this.updateRubberBandSelection(pos.x, pos.y);
        } else if (this.draggedPoint) {
            const origin=this._pointDragOrigin ||= {x:pos.x,y:pos.y};
            this._pointConstraint ||= {};
            const shape=this.draggedPoint.shape;
            const constrained=['Rectangle','Oval','Image','Line'].includes(shape.constructor.name)?pos:
                axisPoint(origin,pos,this._pointConstraint,!!event.shift,6/this.navigation.camera.getZoom());
            this.updateDraggedPoint(constrained.x,constrained.y,!!event.shift);
        } else if (this.draggedShapes) {
            this.updateDraggedShapes(pos.x, pos.y,!!event.shift);
        }
        return true;
    }

    handleMouseUp(event) {
        if(this.textSelecting) {this.textSelecting=false;return true;}
        this._pointDragGeometry=null;
        this._pointDragOrigin=null;this._pointConstraint=null;this._moveConstraint=null;this.shapeDragOrigin=null;
        if(this.rotatingShape) delete this.rotatingShape._rotationGuideLength;
        if (this.panPosition) { this.panPosition=null; return true; }
        const pos = this.getMousePosition(event);
        const currentTool = this.toolManager.getCurrentTool();

        if (this.rubberBandActive) {
            this.finishRubberBandSelection();
        } else if (this.rubberBandPending) {
            // Mouse up before moving minimum distance - cancel rubber-band
            this.rubberBandPending = false;
            this.rubberBandStart = null;
            this.rubberBandModifiers = null;
            this.rubberBandInitialStates = null;
        } else if (this.toolManager.isCurrentlyDrawing()) {
            // For single-action tools (line, circle, oval, rect, freehand), finish on mouse up
            if (currentTool === Tools.TOOLS.LINE || currentTool === Tools.TOOLS.CIRCLE || 
                currentTool === Tools.TOOLS.OVAL || currentTool === Tools.TOOLS.RECT ||
                currentTool === Tools.TOOLS.IMAGE) {
                const finishedShape = this.toolManager.getCurrentShape();
                
                // Check if the shape is valid (mouse moved more than minimum distance)
                if (finishedShape && this.toolManager.hasMinimumSize()) {
                    this.saveUndoState('add shape');
                    this.drawing.addShape(finishedShape);
                    this.selectShape(null);
                }
                this.toolManager.finishCurrentDrawing();
            } else if (currentTool === Tools.TOOLS.FREEHAND) {
                const finishedShape = this.toolManager.getCurrentShape();
                
                // Check if we have enough points (at least 2)
                if (finishedShape && this.toolManager.freehandPoints.length >= 2) {
                    // Mark shape as no longer under construction or freehand
                    finishedShape.underConstruction = false;
                    finishedShape.freehand = false;
                    this.saveUndoState('add shape');
                    this.drawing.addShape(finishedShape);
                    this.selectShape(null);
                }
                this.toolManager.finishCurrentDrawing();
            }
            // For multi-point tools, don't finish on mouse up - wait for click or double-click
        }
        
        this.draggedPoint = null;
        this.draggedShapes = null;
        this.shapeDragLastPosition = null;
        this.shapeDragUndoSaved = false;
        this.rotatingShape = null;
        this.dragReferencePointIndex = null;
        this.dragReferencePointWorld = null;
        return true;
    }

    handleMouseClick(event) {
        const pos = this.getMousePosition(event);
        const currentTool = this.toolManager.getCurrentTool();

        console.log('handleMouseClick: tool=', currentTool, 'isDrawing=', this.toolManager.isCurrentlyDrawing());

        // For multi-point tools (spline, poly, bezier, quad), add a point on click
        if (currentTool === Tools.TOOLS.SPLINE || currentTool === Tools.TOOLS.BEZIER || currentTool === Tools.TOOLS.POLY || currentTool === Tools.TOOLS.QUAD) {
            if (this.toolManager.isCurrentlyDrawing()) {
                console.log('Adding point at', pos.x, pos.y);
                this.toolManager.addPointToShape(pos.x, pos.y);
                
                // For quad tool, auto-finish when 4 points are reached
                if (currentTool === Tools.TOOLS.QUAD && this.toolManager.isQuadReady()) {
                    const finishedShape = this.toolManager.finishMultiPointShape(false);
                    if (finishedShape) {
                        finishedShape.isQuad = false; // Clear the flag
                        this.saveUndoState('add shape');
                        this.drawing.addShape(finishedShape);
                        this.selectShape(null);
                    }
                }
            }
            return true;
        }
        
        return false;
    }

    handleMouseDoubleClick(event) {
        const pos = this.getMousePosition(event);
        const hit=this.drawing.findShapeAt(pos.x,pos.y);
        if (hit && hit.constructor.name==='Text') {this.beginTextEdit(hit);this.textEdit.editor.positionAt(pos);this.textEdit.editor.selectWord();return true;}
        const currentTool = this.toolManager.getCurrentTool();

        // For multi-point tools, finish the shape on double-click
        if (currentTool === Tools.TOOLS.SPLINE || currentTool === Tools.TOOLS.BEZIER || currentTool === Tools.TOOLS.POLY || currentTool === Tools.TOOLS.QUAD) {
            if (this.toolManager.isCurrentlyDrawing()) {
                const finishedShape = this.toolManager.finishMultiPointShape(true); // true = isDoubleClick
                if (finishedShape) {
                    if (finishedShape.isQuad) finishedShape.isQuad = false; // Clear quad flag
                    this.saveUndoState('add shape');
                    this.drawing.addShape(finishedShape);
                    this.selectShape(null);
                }
            }
            return true;
        }
        
        return false;
    }

    handleMouseRightClick(event) {
        if(this.toolManager.getCurrentTool()===Tools.TOOLS.ZOOM) {
            this.navigation.zoomAt(1/1.25,this.navigationAnchor(event.mousePos));return true;
        }
        const pos = this.getMousePosition(event);
        const currentTool = this.toolManager.getCurrentTool();

        // For multi-point tools, finish the shape on right-click
        if (currentTool === Tools.TOOLS.SPLINE || currentTool === Tools.TOOLS.BEZIER || currentTool === Tools.TOOLS.POLY || currentTool === Tools.TOOLS.QUAD) {
            if (this.toolManager.isCurrentlyDrawing()) {
                const finishedShape = this.toolManager.finishMultiPointShape(false); // false = not doubleClick
                if (finishedShape) {
                    if (finishedShape.isQuad) finishedShape.isQuad = false; // Clear quad flag
                    this.saveUndoState('add shape');
                    this.drawing.addShape(finishedShape);
                    this.selectShape(null);
                }
            }
            return true;
        }
        
        return false;
    }

    handleSelectMode(x, y, event) {
        const shiftKey = event && event.shift;
        const toggleKey = event && (event.ctrl || event.alt || event.command);
        const handleScale=1/this.navigation.camera.getZoom();
        
        // Check if clicking on an endpoint or control point
        const shapes = this.drawing.getShapes();
        for (let shape of shapes) {
            // Handles only exist interactively while they are visible. An
            // unselected shape must always be selected and dragged as a whole,
            // even when the click happens to land on a latent handle position.
            if (!shape.selected) continue;

            // Check rotation center point FIRST (highest priority)
            // Skip circles - they can't be rotated (rotation-invariant)
            if (shape.constructor.name !== 'Circle') {
                const center = shape.getCenterPoint();
                const guideLength=shape.getRotationLineLength(),angle=shape.rotation-Math.PI/2;
                const tip={x:center.x+Math.cos(angle)*guideLength,y:center.y+Math.sin(angle)*guideLength};
                if (Math.hypot(x-center.x,y-center.y)<7*handleScale || Math.hypot(x-tip.x,y-tip.y)<7*handleScale) {
                    // Start rotation
                    this.rotatingShape = shape;
                    this.shapeStartRotation = shape.rotation || 0;
                    // Calculate initial angle from center to mouse
                    const dx = x - center.x;
                    const dy = y - center.y;
                    this.rotationStartAngle = Math.atan2(dy, dx);
                    // Save undo state for rotation
                    this.saveUndoState('rotate');
                    return;
                }
            }
            
            const endpoints = shape.getEndpoints();
            const controlPoints = shape.getControlPoints();
            const center = shape.getCenterPoint();
            const rotation = shape.rotation || 0;
            
            // Check control points FIRST (they're smaller and have priority)
            for (let i = 0; i < controlPoints.length; i++) {
                let cp = controlPoints[i];
                
                // If shape is rotated, get the rotated position of the control point
                if (rotation !== 0) {
                    cp = shape.rotatePoint(cp.x, cp.y, center.x, center.y, rotation);
                }
                
                if (Math.abs(x - cp.x) < 6*handleScale && Math.abs(y - cp.y) < 6*handleScale) {
                    this.draggedPoint = { shape, type: 'control', index: i };
                    this._pointDragOrigin={x,y};this._pointConstraint={};this._pointDragGeometry=null;
                    
                    // For rotated multi-point shapes, pick a reference point
                    if (rotation !== 0 && shape.points && shape.points.length > 1) {
                        // Pick the first point that isn't the one being dragged
                        let refIdx = 0;
                        if (shape.constructor.name === 'Spline') {
                            // For splines, control points are at index 0 and last
                            if (i === 0) refIdx = 1;
                        }
                        const refPoint = shape.points[refIdx];
                        this.dragReferencePointIndex = refIdx;
                        this.dragReferencePointWorld = shape.rotatePoint(refPoint.x, refPoint.y, center.x, center.y, rotation);
                    }
                    
                    // Save undo state before dragging
                    this.saveUndoState('drag control point');
                    // Select the shape if it's not already selected
                    if (!shape.selected) {
                        this.selectShape(shape, false, false); // Normal selection for dragging
                    }
                    return;
                }
            }
            
            // Check endpoints
            for (let i = 0; i < endpoints.length; i++) {
                let ep = endpoints[i];
                
                // If shape is rotated, get the rotated position of the endpoint
                if (rotation !== 0) {
                    ep = shape.rotatePoint(ep.x, ep.y, center.x, center.y, rotation);
                }
                
                if (Math.abs(x - ep.x) < 6*handleScale && Math.abs(y - ep.y) < 6*handleScale) {
                    this.draggedPoint = { shape, type: 'endpoint', index: i };
                    this._pointDragOrigin={x,y};this._pointConstraint={};this._pointDragGeometry=null;
                    
                    // For rotated multi-point shapes, pick a reference point
                    if (rotation !== 0 && shape.points && shape.points.length > 1) {
                        // Pick a point that isn't the one being dragged
                        let refIdx = (i === 0) ? 1 : 0;
                        if (shape.constructor.name === 'Spline') {
                            // For splines, endpoints are indices 1 to length-2, so adjust
                            refIdx = (i === 0) ? 2 : 1;
                        }
                        const refPoint = shape.points[refIdx];
                        this.dragReferencePointIndex = refIdx;
                        this.dragReferencePointWorld = shape.rotatePoint(refPoint.x, refPoint.y, center.x, center.y, rotation);
                    }
                    
                    // Save undo state before dragging
                    this.saveUndoState('drag endpoint');
                    // Select the shape if it's not already selected
                    if (!shape.selected) {
                        this.selectShape(shape, false, false); // Normal selection for dragging
                    }
                    return;
                }
            }
        }

        // Check if clicking on a shape
        let clickedShape = null;
        for (let i = shapes.length - 1; i >= 0; i--) {
            if (shapes[i].contains(x, y)) {
                clickedShape = shapes[i];
                break;
            }
        }

        if (clickedShape) {
            // Update selection with modifier keys
            if (toggleKey) {
                // Toggle selection state
                clickedShape.selected = !clickedShape.selected;
            } else if (shiftKey) {
                // Add to selection
                clickedShape.selected = true;
            } else {
                // Preserve an existing multi-selection when beginning a drag
                // on one of its members. Clicking an unselected shape still
                // replaces the selection normally.
                if (!clickedShape.selected) {
                    this.selectShape(clickedShape, false, false);
                }
            }

            if (clickedShape.selected) {
                this.selectedShape = clickedShape;
                this.draggedShapes = this.drawing.getShapes().filter(shape => shape.selected);
                this.shapeDragLastPosition = { x, y };
                this.shapeDragOrigin={x,y};this._moveConstraint={};
                this.shapeDragUndoSaved = false;
            }
        } else {
            // Clicked on background - prepare for rubber-band selection
            // (will only activate if mouse moves minimum distance)
            this.rubberBandStart = { x, y };
            this.rubberBandPending = true;
            this.rubberBandModifiers = { shift: shiftKey, toggle: toggleKey };
            
            if (!shiftKey && !toggleKey) {
                // Clear selection only if not using modifiers
                this.selectShape(null, false, false);
            }
        }
    }

    selectShape(shape, additive = false, toggle = false) {
        if (!additive && !toggle) {
            // Clear previous selections for normal selection
            this.drawing.clearSelection();
        }
        
        if (shape) {
            if (toggle) {
                shape.selected = !shape.selected;
            } else {
                shape.selected = true;
            }
            this.selectedShape = shape;
        } else if (!additive && !toggle) {
            this.selectedShape = null;
        }
    }

    activateRubberBandSelection() {
        // rubberBandStart is already set when pending was set
        this.rubberBandEnd = { ...this.rubberBandStart };
        this.rubberBandActive = true;
        this.rubberBandPending = false;
        
        // Store initial selection states for all shapes (for toggle mode)
        const shapes = this.drawing.getShapes();
        this.rubberBandInitialStates = new Map();
        for (let shape of shapes) {
            this.rubberBandInitialStates.set(shape, shape.selected);
        }
        
        // Clear any existing selection only if not using modifiers
        if (!this.rubberBandModifiers || (!this.rubberBandModifiers.shift && !this.rubberBandModifiers.toggle)) {
            this.drawing.clearSelection();
        }
        
        this.backgroundView.startSelectionPulse();
    }

    updateRubberBandSelection(x, y) {
        if (!this.rubberBandActive) return;
        this.rubberBandEnd = { x, y };
        
        // Dynamically update selection based on current rectangle
        const left = Math.min(this.rubberBandStart.x, this.rubberBandEnd.x);
        const right = Math.max(this.rubberBandStart.x, this.rubberBandEnd.x);
        const top = Math.min(this.rubberBandStart.y, this.rubberBandEnd.y);
        const bottom = Math.max(this.rubberBandStart.y, this.rubberBandEnd.y);
        
        const shiftMode = this.rubberBandModifiers && this.rubberBandModifiers.shift;
        const toggleMode = this.rubberBandModifiers && this.rubberBandModifiers.toggle;
        
        // Update selection for all shapes
        const shapes = this.drawing.getShapes();
        for (let shape of shapes) {
            const intersects = shape.intersectsRect && shape.intersectsRect(left, top, right, bottom);
            const initialState = this.rubberBandInitialStates.get(shape);
            
            if (toggleMode) {
                // Toggle mode: flip selection for intersecting shapes from their initial state
                if (intersects) {
                    shape.selected = !initialState;
                } else {
                    shape.selected = initialState;
                }
            } else if (shiftMode) {
                // Shift mode: add to selection, preserve non-intersecting shapes
                if (intersects) {
                    shape.selected = true;
                } else {
                    shape.selected = initialState;
                }
            } else {
                // Normal mode: only select intersecting shapes
                shape.selected = intersects;
            }
        }
    }

    finishRubberBandSelection() {
        if (!this.rubberBandActive) return;
        
        this.backgroundView.stopSelectionPulse();
        
        // Selection is already up-to-date from updateRubberBandSelection()
        // Just reset rubber-band state
        this.rubberBandActive = false;
        this.rubberBandPending = false;
        this.rubberBandStart = null;
        this.rubberBandEnd = null;
        this.rubberBandModifiers = null;
        this.rubberBandInitialStates = null;
    }

    updateDraggedPoint(x, y, shift=false) {
        if (!this.draggedPoint) return;

        const { shape, type, index } = this.draggedPoint;
        // Recompute from the original geometry so releasing Shift restores
        // unconstrained dimensions, including the oval's other radius.
        const keys=['x','y','x2','y2','width','height','radius','radiusX','radiusY','points','controlPoints'];
        if(!this._pointDragGeometry || this._pointDragGeometryShape!==shape) {
            this._pointDragGeometryShape=shape;
            this._pointDragGeometry=Object.fromEntries(keys.filter(key=>key in shape)
                .map(key=>[key,JSON.parse(JSON.stringify(shape[key]))]));
        }
        for(const [key,value] of Object.entries(this._pointDragGeometry))
            shape[key]=JSON.parse(JSON.stringify(value));
        const rotation = shape.rotation || 0;
        
        // Step 1: Update the dragged point in local space
        let localX = x, localY = y;
        if (rotation !== 0) {
            const center = shape.getCenterPoint();
            const rotated = shape.rotatePoint(x, y, center.x, center.y, -rotation);
            localX = rotated.x;
            localY = rotated.y;
        }

        if(shift && type==='endpoint') {
            if(shape.constructor.name==='Rectangle') {
                const anchor=shape.getEndpoints()[(index+2)%4];
                const size=Math.max(Math.abs(localX-anchor.x),Math.abs(localY-anchor.y));
                localX=anchor.x+Math.sign(localX-anchor.x || 1)*size;
                localY=anchor.y+Math.sign(localY-anchor.y || 1)*size;
            } else if(shape.constructor.name==='Line') {
                const anchor=shape.getEndpoints()[index===0?1:0];
                const snapped=linePoint(anchor,{x:localX,y:localY});localX=snapped.x;localY=snapped.y;
            }
        }
        // Step 2: Apply the change to the shape
        if (type === 'endpoint') {
            const endpoints = shape.getEndpoints();
            if (endpoints[index]) {
                this.updateShapeEndpoint(shape, index, localX, localY);
            }
        } else if (type === 'control') {
            const controlPoints = shape.getControlPoints();
            if (controlPoints[index]) {
                if (shape.constructor.name === 'Spline') {
                    // For Cardinal splines, control points are first and last points in the array
                    if (index === 0) {
                        shape.points[0].x = localX;
                        shape.points[0].y = localY;
                    } else if (index === 1) {
                        const lastIdx = shape.points.length - 1;
                        shape.points[lastIdx].x = localX;
                        shape.points[lastIdx].y = localY;
                    }
                } else if (shape.constructor.name === 'BezierSpline') {
                    controlPoints[index].x = localX;
                    controlPoints[index].y = localY;
                    // Mark this control point as manually edited
                    if (shape.manuallyEditedControls) {
                        shape.manuallyEditedControls.add(index);
                    }
                }
            }
        }
        
        if(shift && shape.constructor.name==='Oval') {
            const radius=(index===0 || index===2)?shape.radiusY:shape.radiusX;
            shape.radiusX=shape.radiusY=radius;
        }
        // Step 3: For rotated multi-point shapes, compensate to keep reference point stable
        if (rotation !== 0 && this.dragReferencePointIndex !== null && this.dragReferencePointWorld && shape.points) {
            const refPoint = shape.points[this.dragReferencePointIndex];
            const newCenter = shape.getCenterPoint();
            
            // Calculate where the reference point would be now
            const newRefWorld = shape.rotatePoint(refPoint.x, refPoint.y, newCenter.x, newCenter.y, rotation);
            
            // Calculate the delta (how much it moved)
            const deltaX = this.dragReferencePointWorld.x - newRefWorld.x;
            const deltaY = this.dragReferencePointWorld.y - newRefWorld.y;
            
            // Apply the delta to all points to compensate
            for (let point of shape.points) {
                point.x += deltaX;
                point.y += deltaY;
            }
            
            // Also apply to control points if they exist
            if (shape.controlPoints) {
                for (let cp of shape.controlPoints) {
                    cp.x += deltaX;
                    cp.y += deltaY;
                }
            }
        }
    }

    updateDraggedShapes(x, y, shift=false) {
        if (!this.draggedShapes || !this.shapeDragLastPosition) return;

        this.shapeDragOrigin ||= {...this.shapeDragLastPosition};this._moveConstraint ||= {};
        const point=axisPoint(this.shapeDragOrigin,{x,y},this._moveConstraint,shift,6/this.navigation.camera.getZoom());
        x=point.x;y=point.y;
        const dx = x - this.shapeDragLastPosition.x;
        const dy = y - this.shapeDragLastPosition.y;
        if (dx === 0 && dy === 0) return;

        if (!this.shapeDragUndoSaved) {
            this.saveUndoState('move');
            this.shapeDragUndoSaved = true;
        }

        for (const shape of this.draggedShapes) {
            this.drawing.moveShape(shape, dx, dy);
        }
        this.shapeDragLastPosition = { x, y };
    }

    updateShapeEndpoint(shape, index, x, y) {
        switch (shape.constructor.name) {
            case 'Line':
                if (index === 0) {
                    shape.x = x;
                    shape.y = y;
                } else {
                    shape.x2 = x;
                    shape.y2 = y;
                }
                break;
            case 'Circle':
                // Circles keep their center at shape.x, shape.y regardless of rotation
                const dx = x - shape.x;
                const dy = y - shape.y;
                shape.radius = Math.sqrt(dx * dx + dy * dy);
                break;
            case 'Oval':
                const rotation = shape.rotation || 0;
                
                if (rotation !== 0) {
                    // For rotated ovals, keep center fixed and resize from center
                    const center = shape.getCenterPoint();
                    const dxOval = Math.abs(x - center.x);
                    const dyOval = Math.abs(y - center.y);
                    
                    if (index === 0 || index === 2) { // Top or bottom
                        shape.radiusY = dyOval;
                    } else { // Left or right
                        shape.radiusX = dxOval;
                    }
                } else {
                    // Not rotated, use distance from current position
                    const dxOval = Math.abs(x - shape.x);
                    const dyOval = Math.abs(y - shape.y);
                    if (index === 0 || index === 2) { // Top or bottom
                        shape.radiusY = dyOval;
                    } else { // Left or right
                        shape.radiusX = dxOval;
                    }
                }
                break;
            case 'Rectangle':
                this.updateRectangleCorner(shape, index, x, y);
                break;
            case 'Image':
                this.updateRectangleCorner(shape, index, x, y);
                break;
            case 'Polygon':
                shape.points[index].x = x;
                shape.points[index].y = y;
                break;
            case 'Spline':
                // For Cardinal splines, endpoints are the interior points (index 1 onwards)
                // So endpoint[0] maps to points[1], endpoint[1] maps to points[2], etc.
                shape.points[index + 1].x = x;
                shape.points[index + 1].y = y;
                break;
            case 'BezierSpline':
                // For Bezier splines, all points in the array are endpoints
                shape.points[index].x = x;
                shape.points[index].y = y;
                // Regenerate control points when endpoints move, but preserve manual edits
                if (shape.generateControlPoints) {
                    shape.controlPoints = shape.generateControlPoints(true);
                }
                break;
        }
    }

    updateRectangleCorner(shape, index, x, y) {
        const rotation = shape.rotation || 0;
        
        // If rotated, we need to keep the center fixed
        if (rotation !== 0) {
            const center = shape.getCenterPoint();
            
            // Calculate the vector from center to new corner position
            const dx = x - center.x;
            const dy = y - center.y;
            
            // The opposite corner moves the same distance in opposite direction
            const oppositeIndex = (index + 2) % 4;
            
            // Update position and size based on which corner is being dragged
            // We calculate new width and height from the center distances
            if (index === 0 || index === 2) {
                // Top-left or bottom-right: affects both x and y
                const newHalfWidth = Math.abs(dx);
                const newHalfHeight = Math.abs(dy);
                shape.width = newHalfWidth * 2;
                shape.height = newHalfHeight * 2;
                shape.x = center.x - newHalfWidth;
                shape.y = center.y - newHalfHeight;
            } else {
                // Top-right or bottom-left: affects x and y differently
                const newHalfWidth = Math.abs(dx);
                const newHalfHeight = Math.abs(dy);
                shape.width = newHalfWidth * 2;
                shape.height = newHalfHeight * 2;
                shape.x = center.x - newHalfWidth;
                shape.y = center.y - newHalfHeight;
            }
        } else {
            // Not rotated, use original logic
            const endpoints = shape.getEndpoints();
            const ep = endpoints[index];
            
            switch (index) {
                case 0: // Top-left
                    shape.width += shape.x - x;
                    shape.height += shape.y - y;
                    shape.x = x;
                    shape.y = y;
                    break;
                case 1: // Top-right
                    shape.width = x - shape.x;
                    shape.height += shape.y - y;
                    shape.y = y;
                    break;
                case 2: // Bottom-right
                    shape.width = x - shape.x;
                    shape.height = y - shape.y;
                    break;
                case 3: // Bottom-left
                    shape.width += shape.x - x;
                    shape.height = y - shape.y;
                    shape.x = x;
                    break;
            }
        }
    }

    handleKeyUp(event) {
        if (event.keyCode===this.spaceKeyCode || event.unicode===32) { this.spaceHeld=false;this.updateCursor(); return true; }
        return false;
    }

    handleKeyPress(event) {
        // Get unicode value (used for both regular keys and arrow keys)
        const unicode = event && event.unicode;
        if (unicode===32) { this.spaceHeld=true; this.spaceKeyCode=this.lastPhysicalKey;this.updateCursor(); return true; }
        if (!(event.ctrl || event.meta || event.command || event.alt) && [90,122].includes(unicode)) {
            this.navigation.zoomAt(event.shift ? 1/1.25 : 1.25,this.navigationAnchor());
            return true;
        }
        if ((event.ctrl || event.meta || event.command) && unicode===48) {
            this.navigation.reset(); return true;
        }
   
        // Check for keyboard shortcuts with Cmd/Ctrl modifiers
        const cmdOrCtrl = event && (event.meta || event.ctrl);
        
        if (cmdOrCtrl && unicode) {
            const key = String.fromCharCode(unicode).toUpperCase();
            
            switch (key) {
                case 'C': // Copy
                    this.copySelectedShapes();
                    return true;
                case 'X': // Cut
                    this.cutSelectedShapes();
                    return true;
                case 'V': // Paste
                    this.pasteShapes();
                    return true;
                case 'Z': // Undo or Redo
                    if (event.shift) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                    return true;
                case 'S': // Save
                    this.saveFile();
                    return true;
                case 'O': // Open
                    this.openDrawingFile();
                    return true;
                case 'G': // Group or ungroup
                    if (event.shift) {
                        this.ungroupSelectedShapes();
                    } else {
                        this.groupSelectedShapes();
                    }
                    return true;
            }
        }
        
        // Check for arrow keys (unicode values 28-31)
        if (unicode >= 28 && unicode <= 31) {
            // Get all selected shapes
            const selectedShapes = this.drawing.getShapes().filter(shape => shape.selected);
            
            if (selectedShapes.length > 0) {
                const moveAmount = event.shift ? 1 : 10;
                let dx = 0, dy = 0;
                
                switch (unicode) {
                    case 28: // Left arrow (pdg.key_LeftArrow)
                        dx = -moveAmount;
                        break;
                    case 29: // Right arrow (pdg.key_RightArrow)
                        dx = moveAmount;
                        break;
                    case 30: // Up arrow (pdg.key_UpArrow)
                        dy = -moveAmount;
                        break;
                    case 31: // Down arrow (pdg.key_DownArrow)
                        dy = moveAmount;
                        break;
                }
                
                // Save undo state only at the start of a nudge sequence
                if (!this.isNudging) {
                    this.saveUndoState('move');
                    this.isNudging = true;
                }
                
                // Clear existing nudge timer
                if (this.nudgeTimer) {
                    clearTimeout(this.nudgeTimer);
                }
                
                // Move all selected shapes
                for (let shape of selectedShapes) {
                    this.drawing.moveShape(shape, dx, dy);
                }
                
                // Set timer to finalize nudge after 500ms of inactivity
                this.nudgeTimer = setTimeout(() => {
                    this.isNudging = false;
                    this.nudgeTimer = null;
                }, 500);
                
                return true;
            }
            return false;
        }
        
        // Check for draw order keys (+/- to move forward/backward, Ctrl/Cmd +/- to move to front/back)
        if (unicode) {
            const key = String.fromCharCode(unicode);
            const selectedShapes = this.drawing.getShapes().filter(shape => shape.selected);
            
            // Handle + (plus) or = (as synonym for plus) to move forward
            if ((key === '+' || key === '=') && selectedShapes.length > 0) {
                // Save undo state only at the start of a reorder sequence
                if (!this.isReordering) {
                    this.saveUndoState('reorder');
                    this.isReordering = true;
                }
                
                // Clear existing reorder timer
                if (this.reorderTimer) {
                    clearTimeout(this.reorderTimer);
                }
                
                if (cmdOrCtrl) {
                    // Ctrl/Cmd + Plus: move to front
                    for (let shape of selectedShapes) {
                        this.drawing.moveShapeToFront(shape);
                    }
                } else {
                    // Plus alone: move forward by 1
                    for (let shape of selectedShapes) {
                        this.drawing.moveShapeForward(shape, 1);
                    }
                }
                
                // Set timer to finalize reorder after 500ms of inactivity
                this.reorderTimer = setTimeout(() => {
                    this.isReordering = false;
                    this.reorderTimer = null;
                }, 500);
                
                return true;
            }
            
            // Handle - (minus) to move backward
            if (key === '-' && selectedShapes.length > 0) {
                // Save undo state only at the start of a reorder sequence
                if (!this.isReordering) {
                    this.saveUndoState('reorder');
                    this.isReordering = true;
                }
                
                // Clear existing reorder timer
                if (this.reorderTimer) {
                    clearTimeout(this.reorderTimer);
                }
                
                if (cmdOrCtrl) {
                    // Ctrl/Cmd + Minus: move to back
                    for (let shape of selectedShapes) {
                        this.drawing.moveShapeToBack(shape);
                    }
                } else {
                    // Minus alone: move backward by 1
                    for (let shape of selectedShapes) {
                        this.drawing.moveShapeBackward(shape, 1);
                    }
                }
                
                // Set timer to finalize reorder after 500ms of inactivity
                this.reorderTimer = setTimeout(() => {
                    this.isReordering = false;
                    this.reorderTimer = null;
                }, 500);
                
                return true;
            }
        }
        
        // Handle key press events for color and tool selection
        let key = '';
        if (unicode) {
            key = String.fromCharCode(unicode).toUpperCase();
        }

        // Match Illustrator's shifted tool shortcuts explicitly.
        if(event.shift && ('Shift+'+key) in Tools.TOOL_SHORTCUTS)key='Shift+'+key;
        // Tool selection
        if (key in Tools.TOOL_SHORTCUTS) {
            console.log("handleKeyPress", key, Tools.TOOL_SHORTCUTS[key]);
            const tool = Tools.TOOL_SHORTCUTS[key];
            
            if(tool===Tools.TOOLS.FONT) {
                this.openFontPicker(Object.values(Tools.TOOLS).indexOf(tool)+1);return true;
            }
            // Special handling for HELP - just toggle help, don't switch tools
            if (tool === Tools.TOOLS.HELP) {
                this.toggleHelp();
                return true;
            }
            
            // Special handling for color picker tools
            if (tool === Tools.TOOLS.FILL_COLOR || tool === Tools.TOOLS.LINE_COLOR) {
                this.openColorPicker(tool);
                return true;
            }
            // Check for line width tool shortcut
            if (tool === Tools.TOOLS.LINE_WIDTH) {
                // Find the toolbar part index for line width tool
                const toolNames = Object.values(Tools.TOOLS);
                const toolIndex = toolNames.indexOf(Tools.TOOLS.LINE_WIDTH) + 1;
                this.openLineWidthPicker(toolIndex);
                return true;
            }
            // Check for smoothness tool shortcut
            if (tool === Tools.TOOLS.SMOOTHNESS) {
                // Find the toolbar part index for smoothness tool
                const toolNames = Object.values(Tools.TOOLS);
                const toolIndex = toolNames.indexOf(Tools.TOOLS.SMOOTHNESS) + 1;
                this.openSmoothnessPicker(toolIndex);
                return true;
            }
            if (tool === Tools.TOOLS.IMAGE) {
                this.activateImageTool();
                return true;
            }
            
            // If another tool is selected while a picker is open, cancel the picker
            if (this.lineWidthController) {
                this.lineWidthController.cancel();
            }
            if (this.smoothnessController) {
                this.smoothnessController.cancel();
            }
            
            this.toolManager.setTool(tool);
            this.updateToolSelection(tool);
            return true;
        }

        switch (key) {
            case '\t': // Tab key
                // Check if shift is pressed for reverse direction
                const shiftPressed = event && event.shift;
                this.selectNextShape(shiftPressed);
                // Switch to SELECT mode when using TAB to navigate shapes
                this.toolManager.setTool(Tools.TOOLS.SELECT);
                this.updateToolSelection(Tools.TOOLS.SELECT);
                return true;
            case '\u007f': // Delete key
            case '\b': // Backspace key
                const currentToolForDelete = this.toolManager.getCurrentTool();
                // For multi-point tools while drawing, remove last point
                if ((currentToolForDelete === Tools.TOOLS.SPLINE || currentToolForDelete === Tools.TOOLS.BEZIER || 
                     currentToolForDelete === Tools.TOOLS.POLY || currentToolForDelete === Tools.TOOLS.QUAD) 
                    && this.toolManager.isCurrentlyDrawing()) {
                    this.toolManager.removeLastPoint();
                } else {
                    // Delete all selected shapes when not drawing
                    const selectedShapes = this.drawing.getShapes().filter(shape => shape.selected);
                    if (selectedShapes.length > 0) {
                        this.saveUndoState('delete');
                        for (let shape of selectedShapes) {
                            this.drawing.removeShape(shape);
                        }
                        this.selectedShape = null;
                    }
                }
                return true;
            case '\u001b': // Escape key
                this.escapeToSelect();
                return true;
        }
        return true;
    }

    escapeToSelect() {
        const editing = this.textEdit;
        if (editing) this.commitTextEdit(true);
        const tool = this.toolManager.getCurrentTool();
        if ([Tools.TOOLS.SPLINE, Tools.TOOLS.BEZIER, Tools.TOOLS.POLY, Tools.TOOLS.QUAD].includes(tool)
            && this.toolManager.isCurrentlyDrawing()) {
            const shape = this.toolManager.finishMultiPointShape(false);
            if (shape) {
                if (shape.isQuad) shape.isQuad = false;
                this.saveUndoState('add shape');
                this.drawing.addShape(shape);
            }
        }
        this.toolManager.setTool(Tools.TOOLS.SELECT);
        this.updateToolSelection(Tools.TOOLS.SELECT);
        this.selectShape(editing && !editing.isNew ? editing.shape : null);
        this.resetCanvasGesture();
    }

    resetCanvasGesture() {
        if(this.rotatingShape)delete this.rotatingShape._rotationGuideLength;
        this.draggedPoint = this.draggedShapes = this.rotatingShape = this.panPosition = null;
        this._pointDragGeometry=null;
        this._pointDragOrigin=this._pointConstraint=this._moveConstraint=this.shapeDragOrigin=null;
        this.shapeDragLastPosition = this.dragReferencePointWorld = null;
        this.dragReferencePointIndex = null;
        this.shapeDragUndoSaved = false;
        this.rubberBandActive = this.rubberBandPending = false;
        this.rubberBandStart = this.rubberBandEnd = null;
        this.backgroundView.stopSelectionPulse();
        this.cancelMousePress();
    }

    drawViews(port, frameNum) {
        super.drawViews(port, frameNum);
        if (this.showHelp) this.backgroundView.drawHelp(port, port.getDrawingArea());
        else if(!this.activePicker())this.toolPaletteView.drawHover(port);
    }

    selectNextShape(reverse = false) {
        const shapes = this.drawing.getShapes();
        if (shapes.length === 0) return;

        let newIndex = -1;

        if (!this.selectedShape) {
            // Nothing selected - select most recent (last) if forward, first if reverse
            newIndex = reverse ? 0 : shapes.length - 1;
        } else {
            // Find current selection
            const currentIndex = shapes.indexOf(this.selectedShape);
            if (currentIndex === -1) {
                // Current selection not found, select most recent
                newIndex = shapes.length - 1;
            } else {
                // Move to next/previous
                if (reverse) {
                    // SHIFT-TAB: forward in drawing order (newer shapes)
                    newIndex = (currentIndex + 1) % shapes.length;
                } else {
                    // TAB: backward in drawing order (older shapes)
                    newIndex = (currentIndex - 1 + shapes.length) % shapes.length;
                }
            }
        }

        this.selectShape(shapes[newIndex]);
    }


    // ============================ Button Handling ============================

    buttonClicked(buttonID, button) {
        // Handle tool selection from button clicks
        if (this.toolPaletteView && this.toolPaletteView.toolButtons) {
            const toolButton = this.toolPaletteView.toolButtons.find(tb => tb.toolId === buttonID);
            if (toolButton) {
                this.toolManager.setTool(buttonID);
                this.updateToolSelection(buttonID);
            }
        }
    }

    updateToolSelection(selectedToolId) {
        console.log("updateToolSelection", selectedToolId);
        if (this.toolPaletteView) {
            this.toolPaletteView.updateToolSelection(selectedToolId);
        }
        this.updateCursor();
    }

    // ============================ Utility Methods ============================

    getSelectedShape() {
        return this.selectedShape;
    }

    getToolManager() {
        return this.toolManager;
    }

    getDrawing() {
        return this.drawing;
    }

    activateImageTool(filename = null) {
        const selectedFilename = filename || chooseImageFile();
        if (selectedFilename && typeof selectedFilename.then === 'function') {
            selectedFilename.then(selected => {
                if (selected) this.activateImageTool(selected);
            }).catch(error => {
                console.error('Failed to choose image:', error);
                this.showSaveMessage(`Failed to choose image: ${error.message}`);
            });
            return true;
        }
        if (!selectedFilename) return false;

        if (path.extname(selectedFilename).toLowerCase() === '.skrbl') {
            try {
                const documentData = JSON.parse(fs.readFileSync(selectedFilename, 'utf8'));
                const importedShapes = this.drawing.deserializeDocument(documentData);
                if (importedShapes.length === 0) {
                    throw new Error('drawing contains no shapes');
                }

                const ShapeClasses = this.drawing.getShapeClasses();
                const groupSnapshot = this.drawing.serializeShape(
                    new ShapeClasses.Group(importedShapes));
                this.toolManager.setImportedGroupFactory(() =>
                    this.drawing.deserializeShape(groupSnapshot.type, groupSnapshot));
                this.toolManager.setTool(Tools.TOOLS.IMAGE);
                this.updateToolSelection(Tools.TOOLS.IMAGE);
                this.showSaveMessage(`Drawing ready: ${path.basename(selectedFilename)}`);
                return true;
            } catch (error) {
                console.error('Failed to import drawing:', error);
                this.showSaveMessage(`Failed to import drawing: ${error.message}`);
                return false;
            }
        }

        try {
            const ShapeClasses = this.drawing.getShapeClasses();
            const imageData = fs.readFileSync(selectedFilename).toString('base64');
            const imageExtension = path.extname(selectedFilename);
            const sourceName = path.basename(selectedFilename);
            const probe = new ShapeClasses.Image(
                0, 0, null, null, imageData, imageExtension, sourceName);
            if (!probe.image || probe.image.getWidth() <= 0 || probe.image.getHeight() <= 0) {
                throw new Error(probe.loadError || 'unsupported or invalid image');
            }

            this.toolManager.setImageSource({ imageData, imageExtension, sourceName });
            this.toolManager.setTool(Tools.TOOLS.IMAGE);
            this.updateToolSelection(Tools.TOOLS.IMAGE);
            this.showSaveMessage(`Image ready: ${sourceName}`);
            return true;
        } catch (error) {
            console.error('Failed to load image:', error);
            this.showSaveMessage(`Failed to load image: ${error.message}`);
            return false;
        }
    }

    toggleHelp() {
        this.showHelp = !this.showHelp;
    }

    getShowHelp() {
        return this.showHelp;
    }

    openColorPicker(toolType) {
        // Don't open if color picker is already open
        if (this.colorPickerController) {
            return;
        }
        
        // Get selected shape (if any)
        const selectedShapes = this.drawing.getShapes().filter(shape => shape.selected);
        let targetShape = null;
        let initialColor;
        const colorType = toolType === Tools.TOOLS.FILL_COLOR ? 'fill' : 'stroke';
        
        if (selectedShapes.length > 0) {
            // Use the first selected shape
            targetShape = selectedShapes[0];
            initialColor = colorType === 'fill' ? targetShape.fillColor : targetShape.strokeColor;
        } else {
            // No shape selected - use default colors
            initialColor = colorType === 'fill' ? this.toolManager.fillColor : this.toolManager.strokeColor;
        }
        
        // Save state for undo before opening color picker
        this.colorPickerInitialState = {
            shape: targetShape,
            colorType: colorType,
            initialColor: initialColor
        };
        
        // Create color picker controller
        this.colorPickerController = new ColorPickerController(
            this,
            initialColor,
            colorType,
            targetShape,
            (finalColor) => this.onColorPickerAccept(finalColor),
            () => this.onColorPickerCancel(),
            this.recentColors
        );
    }

    closeColorPicker() {
        // Just clear the reference - the controller calls destroy() on itself
        this.colorPickerController = null;
    }

    onColorPickerAccept(finalColor) {
        // Only save undo state if a shape was modified
        if (this.colorPickerInitialState && this.colorPickerInitialState.shape) {
            this.saveUndoState('change color');
        }
        
        // Add to recent colors
        this.addRecentColor(finalColor);
        
        // Color is already applied to the shape or default colors, just close the picker
        this.colorPickerInitialState = null;
    }

    onColorPickerCancel() {
        // Undo state is handled by the ColorPickerController (restores initial color)
        this.colorPickerInitialState = null;
    }

    addRecentColor(colorStr) {
        // Remove if already exists
        const index = this.recentColors.indexOf(colorStr);
        if (index > -1) {
            this.recentColors.splice(index, 1);
        }
        
        // Add to front
        this.recentColors.unshift(colorStr);
        
        // Limit to max
        if (this.recentColors.length > this.maxRecentColors) {
            this.recentColors = this.recentColors.slice(0, this.maxRecentColors);
        }
    }

    getRecentColors() {
        return this.recentColors;
    }

    // ============================ Line Width Picker ============================

    openLineWidthPicker(toolPart) {
        console.log('DrawingController.openLineWidthPicker - toolPart:', toolPart);
        
        // Don't open if already open
        if (this.lineWidthController) {
            console.log('DrawingController.openLineWidthPicker - already open, returning');
            return;
        }
        
        // Save current tool to restore later
        this.lineWidthPreviousTool = this.toolManager.getCurrentTool();
        console.log('DrawingController.openLineWidthPicker - previous tool:', this.lineWidthPreviousTool);
        
        // Update toolbar to show line width as selected
        this.updateToolSelection(Tools.TOOLS.LINE_WIDTH);
        
        // Get selected shapes (if any)
        const selectedShapes = this.drawing.getShapes().filter(shape => shape.selected);
        console.log('DrawingController.openLineWidthPicker - selectedShapes:', selectedShapes.length);
        let initialWidth;
        
        if (selectedShapes.length > 0) {
            // Use the stroke width of the first selected shape
            initialWidth = selectedShapes[0].strokeWidth;
        } else {
            // No shape selected - use default stroke width
            initialWidth = this.toolManager.strokeWidth;
        }
        
        // Calculate toolbar position for popup
        const toolSlotX = this.toolPaletteView.getViewArea().left+(toolPart-1)*this.toolPaletteView.slotWidth();
        console.log('DrawingController.openLineWidthPicker - toolSlotX:', toolSlotX);
        
        // Save state for undo
        this.lineWidthInitialState = {
            shapes: selectedShapes.map(s => ({ shape: s, width: s.strokeWidth })),
            initialWidth: initialWidth,
            defaultWidth: this.toolManager.strokeWidth
        };
        
        console.log('DrawingController.openLineWidthPicker - creating controller');
        
        // Create line width controller
        this.lineWidthController = new LineWidthController(
            this,
            initialWidth,
            selectedShapes,
            (finalWidth) => this.onLineWidthPickerAccept(finalWidth),
            () => this.onLineWidthPickerCancel(),
            toolSlotX
        );
        
        console.log('DrawingController.openLineWidthPicker - controller created:', !!this.lineWidthController);
    }

    onLineWidthPickerAccept(finalWidth) {
        console.log('DrawingController.onLineWidthPickerAccept - finalWidth:', finalWidth);
        console.log('DrawingController.onLineWidthPickerAccept - initialState shapes:', this.lineWidthInitialState?.shapes.length);
        
        // Save undo state if shapes were modified
        if (this.lineWidthInitialState && this.lineWidthInitialState.shapes.length > 0) {
            console.log('DrawingController.onLineWidthPickerAccept - saving undo state');
            // Verify the shapes actually have the new width
            for (const shapeState of this.lineWidthInitialState.shapes) {
                console.log('DrawingController.onLineWidthPickerAccept - shape width is now:', shapeState.shape.strokeWidth);
            }
            this.saveUndoState('change line width');
        } else {
            // No shapes selected - update default width
            console.log('DrawingController.onLineWidthPickerAccept - updating default width');
            this.toolManager.setStrokeWidth(finalWidth);
        }
        
        this.lineWidthInitialState = null;
        
        // Restore previous tool
        if (this.lineWidthPreviousTool) {
            this.toolManager.setTool(this.lineWidthPreviousTool);
            this.updateToolSelection(this.lineWidthPreviousTool);
            this.lineWidthPreviousTool = null;
        }
    }

    onLineWidthPickerCancel() {
        console.log('DrawingController.onLineWidthPickerCancel called');
        // Width is already restored by the controller
        this.lineWidthInitialState = null;
        
        // Restore previous tool
        if (this.lineWidthPreviousTool) {
            console.log('DrawingController.onLineWidthPickerCancel - restoring tool:', this.lineWidthPreviousTool);
            this.toolManager.setTool(this.lineWidthPreviousTool);
            this.updateToolSelection(this.lineWidthPreviousTool);
            this.lineWidthPreviousTool = null;
        }
    }

    // ============================ Smoothness Picker ============================

    openSmoothnessPicker(toolPart) {
        // Don't open if already open
        if (this.smoothnessController) {
            return;
        }
        
        // Save current tool to restore later
        this.smoothnessPreviousTool = this.toolManager.getCurrentTool();
        
        // Update toolbar to show smoothness as selected
        this.updateToolSelection(Tools.TOOLS.SMOOTHNESS);
        
        // Get selected shapes (only freehand splines)
        const allSelectedShapes = this.drawing.getShapes().filter(shape => shape.selected);
        const selectedFreehandShapes = allSelectedShapes.filter(shape => 
            shape.constructor.name === 'Spline' && shape.freehand
        );
        
        let initialLevel = this.toolManager.smoothnessLevel;
        
        // Calculate toolbar position for popup
        const toolSlotX = this.toolPaletteView.getViewArea().left+(toolPart-1)*this.toolPaletteView.slotWidth();
        
        // Save state for undo
        this.smoothnessInitialState = {
            shapes: selectedFreehandShapes.map(s => ({ 
                shape: s, 
                points: s.points ? s.points.map(p => ({ ...p })) : []
            })),
            initialLevel: initialLevel,
            defaultLevel: this.toolManager.smoothnessLevel
        };
        
        // Create smoothness controller
        this.smoothnessController = new SmoothnessController(
            this,
            initialLevel,
            selectedFreehandShapes,
            (finalLevel) => this.onSmoothnessPickerAccept(finalLevel),
            () => this.onSmoothnessPickerCancel(),
            toolSlotX
        );
    }

    onSmoothnessPickerAccept(finalLevel) {
        // Save undo state if shapes were modified
        if (this.smoothnessInitialState && this.smoothnessInitialState.shapes.length > 0) {
            this.saveUndoState('change smoothness');
        } else {
            // No shapes selected - update default smoothness level
            this.toolManager.setSmoothnessLevel(finalLevel);
        }
        
        this.smoothnessInitialState = null;
        
        // Restore previous tool
        if (this.smoothnessPreviousTool) {
            this.toolManager.setTool(this.smoothnessPreviousTool);
            this.updateToolSelection(this.smoothnessPreviousTool);
            this.smoothnessPreviousTool = null;
        }
    }

    onSmoothnessPickerCancel() {
        // Points are already restored by the controller
        this.smoothnessInitialState = null;
        
        // Restore previous tool
        if (this.smoothnessPreviousTool) {
            this.toolManager.setTool(this.smoothnessPreviousTool);
            this.updateToolSelection(this.smoothnessPreviousTool);
            this.smoothnessPreviousTool = null;
        }
    }

    // ============================ Clipboard Operations ============================

    groupSelectedShapes() {
        const selectedShapes = this.drawing.getShapes().filter(shape => shape.selected);
        if (selectedShapes.length < 2) return false;

        this.saveUndoState('group');
        const group = this.drawing.groupShapes(selectedShapes);
        this.selectedShape = group;
        return !!group;
    }

    ungroupSelectedShapes() {
        const selectedGroups = this.drawing.getShapes().filter(shape =>
            shape.selected && shape.constructor.name === 'Group');
        if (selectedGroups.length === 0) return false;

        this.saveUndoState('ungroup');
        const children = this.drawing.ungroupShapes(selectedGroups);
        this.selectedShape = children.length === 1 ? children[0] : null;
        return children.length > 0;
    }

    copySelectedShapes() {
        const selectedShapes = this.drawing.getShapes().filter(shape => shape.selected);
        if (selectedShapes.length === 0) return;
        
        // Serialize selected shapes to clipboard
        this.clipboard = selectedShapes.map(shape => this.drawing.serializeShape(shape));
        // Reset paste count for new clipboard content
        this.pasteCount = 0;
    }

    cutSelectedShapes() {
        const selectedShapes = this.drawing.getShapes().filter(shape => shape.selected);
        if (selectedShapes.length === 0) return;
        
        // Copy to clipboard
        this.copySelectedShapes();
        
        // Save state for undo
        this.saveUndoState('cut');
        
        // Delete selected shapes
        for (let shape of selectedShapes) {
            this.drawing.removeShape(shape);
        }
        this.selectedShape = null;
    }

    pasteShapes() {
        if (!this.clipboard || this.clipboard.length === 0) return;
        
        // Save state for undo
        this.saveUndoState('paste');
        
        // Increment paste count for cumulative offset
        this.pasteCount++;
        
        // Clear current selection
        this.drawing.clearSelection();
        
        // Paste shapes with cumulative offset (10 pixels per paste)
        const offset = 10 * this.pasteCount;
        for (let shapeData of this.clipboard) {
            // Deserialize the shape
            const shape = this.deserializeShapeWithOffset(shapeData, offset);
            if (shape) {
                this.drawing.addShape(shape);
                shape.selected = true;
            }
        }
    }

    deserializeShapeWithOffset(shapeData, offset) {
        const shape = this.drawing.deserializeShape(shapeData.type, shapeData);
        if (shape) this.drawing.moveShape(shape, offset, offset);
        return shape;
    }

    // ============================ Undo Operations ============================

    saveUndoState(action) {
        // Finalize any ongoing nudge sequence before saving new state
        if (this.isNudging && action !== 'move') {
            this.finalizeNudge();
        }
        
        // Finalize any ongoing reorder sequence before saving new state
        if (this.isReordering && action !== 'reorder') {
            this.finalizeReorder();
        }
        
        const state = {
            action: action,
            shapes: this.drawing.getShapes().map(shape => {
                const serialized = this.drawing.serializeShape(shape);
                return {
                    data: serialized,
                    type: serialized.type
                };
            })
        };
        
        this.undoStack.push(state);
        
        // Clear redo stack when a new action is performed
        this.redoStack = [];
        
        // Limit undo stack size
        if (this.undoStack.length > this.maxUndoLevels) {
            this.undoStack.shift();
        }
    }

    finalizeNudge() {
        if (this.nudgeTimer) {
            clearTimeout(this.nudgeTimer);
            this.nudgeTimer = null;
        }
        this.isNudging = false;
    }

    finalizeReorder() {
        if (this.reorderTimer) {
            clearTimeout(this.reorderTimer);
            this.reorderTimer = null;
        }
        this.isReordering = false;
    }

    undo() {
        if (this.undoStack.length === 0) return;
        
        // Finalize any ongoing nudge sequence
        this.finalizeNudge();
        
        // Finalize any ongoing reorder sequence
        this.finalizeReorder();
        
        // Save current state to redo stack
        const currentState = {
            action: 'undo',
            shapes: this.drawing.getShapes().map(shape => {
                const serialized = this.drawing.serializeShape(shape);
                return {
                    data: serialized,
                    type: serialized.type
                };
            })
        };
        this.redoStack.push(currentState);
        
        // Get and restore previous state
        const previousState = this.undoStack.pop();
        
        // Clear current shapes
        this.drawing.clearShapes();
        
        // Restore previous shapes
        for (let shapeInfo of previousState.shapes) {
            const shape = this.drawing.deserializeShape(shapeInfo.type, shapeInfo.data);
            if (shape) {
                this.drawing.addShape(shape);
            }
        }
        
        this.selectedShape = null;
    }

    redo() {
        if (this.redoStack.length === 0) return;
        
        // Finalize any ongoing nudge sequence
        this.finalizeNudge();
        
        // Finalize any ongoing reorder sequence
        this.finalizeReorder();
        
        // Save current state to undo stack
        const currentState = {
            action: 'redo',
            shapes: this.drawing.getShapes().map(shape => {
                const serialized = this.drawing.serializeShape(shape);
                return {
                    data: serialized,
                    type: serialized.type
                };
            })
        };
        this.undoStack.push(currentState);
        
        // Get and restore redo state
        const redoState = this.redoStack.pop();
        
        // Clear current shapes
        this.drawing.clearShapes();
        
        // Restore redo shapes
        for (let shapeInfo of redoState.shapes) {
            const shape = this.drawing.deserializeShape(shapeInfo.type, shapeInfo.data);
            if (shape) {
                this.drawing.addShape(shape);
            }
        }
        
        this.selectedShape = null;
    }

    // ============================ File Operations ============================

    setFilename(filename) {
        this.currentFilename = filename;
    }

    openDrawingFile(filename = null) {
        const selectedFilename = filename || chooseDrawingFile();
        if (selectedFilename && typeof selectedFilename.then === 'function') {
            selectedFilename.then(selected => {
                if (selected) this.openDrawingFile(selected);
            }).catch(error => {
                console.error('Failed to choose drawing:', error);
                this.showSaveMessage(`Open failed: ${error.message}`);
            });
            return true;
        }
        if (!selectedFilename) return false;

        if (path.extname(selectedFilename).toLowerCase() !== '.skrbl') {
            this.showSaveMessage('Open failed: choose a .skrbl file');
            return false;
        }

        if (!this.loadFile(selectedFilename)) {
            this.showSaveMessage('Open failed: invalid or unsupported drawing');
            return false;
        }

        this.undoStack = [];
        this.redoStack = [];
        this.clipboard = null;
        this.pasteCount = 0;
        this.selectedShape = null;
        this.toolManager.finishCurrentDrawing();
        this.toolManager.setTool(Tools.TOOLS.SELECT);
        this.updateToolSelection(Tools.TOOLS.SELECT);
        this.showSaveMessage(`Opened ${path.basename(selectedFilename)}`);
        return true;
    }

    loadFile(filename) {
        this.commitTextEdit(true);
        try {
            const fileData = fs.readFileSync(filename, 'utf8');
            const data = JSON.parse(fileData);
            const loadedShapes = this.drawing.deserializeDocument(data);

            // Only replace the current drawing after the entire document has
            // been validated and materialized successfully.
            this.drawing.clearShapes();
            loadedShapes.forEach(shape => this.drawing.addShape(shape));
            
            // Load recent colors if available
            if (data.recentColors) {
                this.recentColors = data.recentColors;
            }
            
            this.currentFilename = filename;
            console.log('Loaded file:', filename);
            return true;
        } catch (error) {
            console.error('Failed to load file:', error);
            return false;
        }
    }

    saveFile() {
        this.commitTextEdit();
        // Generate filename if not set
        if (!this.currentFilename) {
            const now = new Date();
            const dateStr = now.toISOString().replace(/[:.]/g, '-').split('T')[0];
            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
            this.currentFilename = `drawing-${dateStr}-${timeStr}.skrbl`;
        }
        
        try {
            const imageRegistry = this.drawing.createImageRegistry();
            const shapes = this.drawing.getShapes().map(shape => {
                const serialized = this.drawing.serializeShape(shape, imageRegistry);
                return {
                    type: serialized.type,
                    data: serialized
                };
            });
            const data = {
                fileFormat: 'skrbl-v0.0.4',
                imageData: imageRegistry.entries,
                shapes,
                recentColors: this.recentColors
            };
            
            const jsonData = JSON.stringify(data, null, 2);
            fs.writeFileSync(this.currentFilename, jsonData, 'utf8');
            console.log('Saved file:', this.currentFilename);

            if (typeof globalThis !== 'undefined' && globalThis.skrybbleWeb) {
                globalThis.skrybbleWeb.downloadFile(
                    this.currentFilename, jsonData, 'application/json');
            }
            
            // Show save confirmation message
            this.showSaveMessage(`Saved to ${this.currentFilename}`);
            
            return true;
        } catch (error) {
            console.error('Failed to save file:', error);
            this.showSaveMessage(`Failed to save: ${error.message}`);
            return false;
        }
    }
    
    showSaveMessage(message) {
        this.saveMessage = message;
        this.backgroundView.showNotification(message);
    }

    destroy() {
        this.cursors?.destroy();
        if(this.fontPickerController)this.fontPickerController.cancel();
        this.commitTextEdit(true);
        if (this.removeBrowserWheel) this.removeBrowserWheel();
        if (this.nudgeTimer) clearTimeout(this.nudgeTimer);
        if (this.reorderTimer) clearTimeout(this.reorderTimer);
        for (const child of this.children.slice()) child.destroy();
        super.destroy();
    }

    getSaveMessage() {
        return this.saveMessage;
    }
}

module.exports = DrawingController;
