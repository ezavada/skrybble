// -----------------------------------------------
// LineWidthController.js
// 
// Line width picker popup controller
//
// (c) 2025, Ed Zavada
// -----------------------------------------------

const Controller = require('./index').Controller;

class LineWidthController extends Controller {
    constructor(parentController, initialWidth, targetShapes, onAccept, onCancel, toolSlotX) {
        console.log('LineWidthController constructor - initialWidth:', initialWidth, 'targetShapes:', targetShapes?.length, 'toolSlotX:', toolSlotX);
        
        // Store these temporarily so setupViews can access them
        LineWidthController._tempInitialWidth = initialWidth;
        LineWidthController._tempCurrentWidth = initialWidth;
        LineWidthController._tempTargetShapes = targetShapes;
        LineWidthController._tempParentController = parentController;
        LineWidthController._tempToolSlotX = toolSlotX;
        
        super(parentController);
        
        console.log('LineWidthController constructor - after super()');
        
        // Now assign the actual instance properties
        this.parentController = parentController;
        this.initialWidth = LineWidthController._tempInitialWidth;
        this.currentWidth = LineWidthController._tempCurrentWidth;
        this.targetShapes = targetShapes;
        this.onAccept = onAccept;
        this.onCancel = onCancel;
        this.selectedIndex = this.getIndexForWidth(initialWidth);
        
        console.log('LineWidthController constructor - complete, selectedIndex:', this.selectedIndex);
        
        // Clean up temp variables
        delete LineWidthController._tempInitialWidth;
        delete LineWidthController._tempCurrentWidth;
        delete LineWidthController._tempTargetShapes;
        delete LineWidthController._tempParentController;
        delete LineWidthController._tempToolSlotX;
    }

    static getWidthOptions() {
        return [0.25, 1.0, 2.0, 3.5, 5.0];
    }

    getIndexForWidth(width) {
        const options = LineWidthController.getWidthOptions();
        // Find closest matching width
        let closestIndex = 0;
        let closestDiff = Math.abs(options[0] - width);
        for (let i = 1; i < options.length; i++) {
            const diff = Math.abs(options[i] - width);
            if (diff < closestDiff) {
                closestDiff = diff;
                closestIndex = i;
            }
        }
        return closestIndex;
    }

    getMousePosition(event) {
        if (event && event.mousePos) {
            return {
                x: event.mousePos.x,
                y: event.mousePos.y
            };
        }
        return { x: 0, y: 0 };
    }

    setupViews() {
        const port = this.port;
        const drawingArea = port.getDrawingArea();
        
        // Create popup positioned under the line width tool slot in toolbar
        const popupWidth = 120;
        const popupHeight = 182;
        
        // Position under toolbar (toolbar is 50px high)
        const toolSlotX = LineWidthController._tempToolSlotX || 0;
        let popupLeft = toolSlotX;
        const popupTop = 50; // Right under toolbar
        
        // Keep popup within bounds
        popupLeft = Math.max(drawingArea.left, Math.min(popupLeft, drawingArea.right - popupWidth));
        
        this.popupRect = new pdg.Rect(popupLeft, popupTop, popupLeft + popupWidth, popupTop + popupHeight);
        
        // Create main view
        this.mainView = new LineWidthPickerView(this, this.popupRect);
    }

    doMouseDown(mouseInfo, view, id, part) {
        // Check if we've been destroyed or closed
        const parent = this.parentController || this.parent;
        if (!parent || parent.lineWidthController !== this) {
            return false;
        }
        
        console.log('LineWidthController.doMouseDown called');
        // Consume the event to prevent it from reaching parent
        return true;
    }

    doMouseUp(mouseInfo, view, id, part) {
        if (!view || part===-1) { this.cancel(); return true; }
        return false;
    }

    doLeftClick(clickInfo, view, id, part) {
        // Check if we've been destroyed or closed
        const parent = this.parentController || this.parent;
        if (!parent || parent.lineWidthController !== this) {
            return false;
        }
        
        console.log('LineWidthController.doLeftClick called, view:', view?.constructor.name);
        
        const pos = this.getMousePosition(clickInfo);
        
        // Check if clicking outside the popup - cancel
        if (!this.popupRect.contains(new pdg.Point(pos.x,pos.y))) {
            console.log('LineWidthController.doLeftClick - click outside popup, canceling');
            this.cancel();
            return true;
        }
        
        // Check if clicking on a width option
        const clickedIndex = part>=2 && part<=6 ? part-2 : -1;
        console.log('LineWidthController.doLeftClick - clickedIndex:', clickedIndex);
        if (clickedIndex !== -1) {
            this.selectedIndex = clickedIndex;
            const options = LineWidthController.getWidthOptions();
            this.currentWidth = options[clickedIndex];
            
            console.log('LineWidthController.doLeftClick - setting width to:', this.currentWidth, 'for', this.targetShapes?.length, 'shapes');
            
            // Apply to target shapes immediately
            if (this.targetShapes && this.targetShapes.length > 0) {
                for (const shape of this.targetShapes) {
                    console.log('LineWidthController.doLeftClick - before:', shape.strokeWidth, 'after:', this.currentWidth);
                    shape.strokeWidth = this.currentWidth;
                }
            }
            
            // Auto-accept and close
            console.log('LineWidthController.doLeftClick - calling accept()');
            this.accept();
            return true;
        }
        
        // Clicked inside popup but not on an option - just consume the event
        return true;
    }



    doKeyPress(keyPressInfo, view, id, part) {
        // Check if we've been destroyed or closed
        const parent = this.parentController || this.parent;
        if (!parent || parent.lineWidthController !== this) {
            return false;
        }
        
        const unicode = keyPressInfo && keyPressInfo.unicode;
        let key = '';
        if (unicode) {
            key = String.fromCharCode(unicode);
        }
        
        // Up arrow - move selection up
        if (unicode === 30) {
            if (this.selectedIndex > 0) {
                this.selectedIndex--;
                const options = LineWidthController.getWidthOptions();
                this.currentWidth = options[this.selectedIndex];
                
                // Apply to target shapes for preview
                if (this.targetShapes && this.targetShapes.length > 0) {
                    for (const shape of this.targetShapes) {
                        shape.strokeWidth = this.currentWidth;
                    }
                }
            }
            return true;
        }
        
        // Down arrow - move selection down
        if (unicode === 31) {
            if (this.selectedIndex < 4) {
                this.selectedIndex++;
                const options = LineWidthController.getWidthOptions();
                this.currentWidth = options[this.selectedIndex];
                
                // Apply to target shapes for preview
                if (this.targetShapes && this.targetShapes.length > 0) {
                    for (const shape of this.targetShapes) {
                        shape.strokeWidth = this.currentWidth;
                    }
                }
            }
            return true;
        }
        
        if (key === '\r' || key === '\n' || unicode === 13) { // Enter
            this.accept();
            return true;
        } else if (key === '\u001b' || unicode === 27) { // Escape
            this.cancel();
            return true;
        }
        
        return false;
    }

    accept() {
        console.log('LineWidthController.accept() called');
        if (this.onAccept) {
            this.onAccept(this.currentWidth);
        }
        this.cleanup();
    }

    cancel() {
        console.log('LineWidthController.cancel() called');
        // Restore initial width to target shapes
        if (this.targetShapes && this.targetShapes.length > 0) {
            for (const shape of this.targetShapes) {
                shape.strokeWidth = this.initialWidth;
            }
        }
        
        if (this.onCancel) {
            this.onCancel();
        }
        this.cleanup();
    }

    cleanup() {
        console.log('LineWidthController.cleanup() called');
        // Notify parent to clear its reference to this controller FIRST
        const parent = this.parentController || this.parent;
        if (parent && parent.lineWidthController === this) {
            parent.lineWidthController = null;
        }
        
        // Clean up by calling destroy() which removes all views and unregisters events
        this.destroy();
    }
}

// -----------------------------------------------
// Line Width Picker View
// -----------------------------------------------

const View = require('./index').View;

class LineWidthPickerView extends View {
    constructor(controller, rect) {
        super(controller, rect);
        
        // Make the entire view area clickable
        const viewArea = this.getViewArea();
        this.addClickablePart(new pdg.Rect(viewArea.width(),viewArea.height()), 1);
        for(let i=0;i<5;i++) this.addClickablePart(new pdg.Rect(0,40+i*30,viewArea.width(),60+i*30),i+2);
    }

    drawSelf(port, frameNum) {
        const viewArea = this.getViewArea();
        
        // Draw background
        port.drawRect(viewArea, new pdg.Attributes()
            .fillColor(new pdg.Color(0.95, 0.95, 0.95, 1.0)));
        
        // Draw border
        port.drawRect(viewArea, new pdg.Attributes()
            .lineColor(new pdg.Color(0.3, 0.3, 0.3, 1.0))
            .lineThickness(2));
        
        // Draw title
        port.drawText('Line Width', new pdg.Point(viewArea.left + 60, viewArea.top + 25), 
            new pdg.Attributes()
                .textSize(14)
                .textStyle(pdg.textStyle_Centered)
                .fillColor(new pdg.Color(0.2, 0.2, 0.2, 1.0)));
        
        // Draw width options
        const options = LineWidthController.getWidthOptions();
        const startY = viewArea.top + 50;
        const lineSpacing = 30;
        const lineLength = 80;
        const lineStartX = viewArea.left + 20;
        const lineEndX = lineStartX + lineLength;
        
        for (let i = 0; i < options.length; i++) {
            const width = options[i];
            const y = startY + i * lineSpacing;
            
            // Highlight selected option
            if (i === this.controller.selectedIndex) {
                const highlightRect = new pdg.Rect(
                    viewArea.left + 5,
                    y - 12,
                    viewArea.right - 5,
                    y + 12
                );
                port.drawRect(highlightRect, new pdg.Attributes()
                    .fillColor(new pdg.Color(0.7, 0.8, 1.0, 0.5)));
            }
            
            // Draw the line at its thickness
            port.drawLine(
                new pdg.Point(lineStartX, y),
                new pdg.Point(lineEndX, y),
                new pdg.Attributes()
                    .lineColor(new pdg.Color(0.2, 0.2, 0.2, 1.0))
                    .lineThickness(width)
            );
        }
    }
}

module.exports = LineWidthController;

