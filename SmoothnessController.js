// -----------------------------------------------
// SmoothnessController.js
// 
// Smoothness picker popup controller
//
// (c) 2025, Ed Zavada
// -----------------------------------------------

const Controller = require('./index').Controller;
const Tools = require('./index').Tools;

class SmoothnessController extends Controller {
    constructor(parentController, initialLevel, targetShapes, onAccept, onCancel, toolSlotX) {
        // Store these temporarily so setupViews can access them
        SmoothnessController._tempInitialLevel = initialLevel;
        SmoothnessController._tempCurrentLevel = initialLevel;
        SmoothnessController._tempTargetShapes = targetShapes;
        SmoothnessController._tempParentController = parentController;
        SmoothnessController._tempToolSlotX = toolSlotX;
        
        super(parentController);
        
        // Now assign the actual instance properties
        this.parentController = parentController;
        this.initialLevel = SmoothnessController._tempInitialLevel;
        this.currentLevel = SmoothnessController._tempCurrentLevel;
        this.targetShapes = targetShapes;
        this.onAccept = onAccept;
        this.onCancel = onCancel;
        this.selectedIndex = initialLevel;
        
        // Store initial points for each target shape (for undo on cancel)
        this.initialShapePoints = [];
        if (this.targetShapes && this.targetShapes.length > 0) {
            for (const shape of this.targetShapes) {
                if (shape.points) {
                    this.initialShapePoints.push({
                        shape: shape,
                        points: shape.points.map(p => ({ ...p }))
                    });
                }
            }
        }
        
        // Clean up temp variables
        delete SmoothnessController._tempInitialLevel;
        delete SmoothnessController._tempCurrentLevel;
        delete SmoothnessController._tempTargetShapes;
        delete SmoothnessController._tempParentController;
        delete SmoothnessController._tempToolSlotX;
    }

    static getSmoothnessLevels() {
        // Returns distances [2, 3, 5, 8, 13]
        return [2, 3, 5, 8, 13];
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
        
        // Create popup positioned under the smoothness tool slot in toolbar
        const popupWidth = 120;
        const popupHeight = 182;
        
        // Position under toolbar (toolbar is 50px high)
        const toolSlotX = SmoothnessController._tempToolSlotX || 0;
        let popupLeft = toolSlotX;
        const popupTop = 50; // Right under toolbar
        
        // Keep popup within bounds
        popupLeft = Math.max(drawingArea.left, Math.min(popupLeft, drawingArea.right - popupWidth));
        
        this.popupRect = new pdg.Rect(popupLeft, popupTop, popupLeft + popupWidth, popupTop + popupHeight);
        
        // Create main view
        this.mainView = new SmoothnessPickerView(this, this.popupRect);
    }

    doMouseDown(mouseInfo, view, id, part) {
        // Check if we've been destroyed or closed
        const parent = this.parentController || this.parent;
        if (!parent || parent.smoothnessController !== this) {
            return false;
        }
        
        console.log('SmoothnessController.doMouseDown called');
        // Consume the event to prevent it from reaching parent
        return true;
    }

    doMouseUp(mouseInfo, view, id, part) {
        // Check if we've been destroyed or closed
        const parent = this.parentController || this.parent;
        if (!parent || parent.smoothnessController !== this) {
            return false;
        }
        
        console.log('SmoothnessController.doMouseUp called');
        // Consume the event to prevent it from reaching parent
        return true;
    }

    doLeftClick(clickInfo, view, id, part) {
        // Check if we've been destroyed or closed
        const parent = this.parentController || this.parent;
        if (!parent || parent.smoothnessController !== this) {
            return false;
        }
        
        console.log('SmoothnessController.doLeftClick called, view:', view?.constructor.name);
        
        const pos = this.getMousePosition(clickInfo);
        
        // Check if clicking outside the popup - cancel
        if (!this.popupRect.contains(pos.x, pos.y)) {
            console.log('SmoothnessController.doLeftClick - click outside popup, canceling');
            this.cancel();
            return true;
        }
        
        // Check if clicking on a smoothness option
        const clickedIndex = this.getClickedSmoothnessIndex(pos);
        console.log('SmoothnessController.doLeftClick - clickedIndex:', clickedIndex);
        if (clickedIndex !== -1) {
            this.selectedIndex = clickedIndex;
            this.currentLevel = clickedIndex;
            
            console.log('SmoothnessController.doLeftClick - applying smoothing');
            
            // Apply smoothing to target shapes immediately
            this.applySmoothingToTargets();
            
            // Auto-accept and close
            console.log('SmoothnessController.doLeftClick - calling accept()');
            this.accept();
            return true;
        }
        
        // Clicked inside popup but not on an option - just consume the event
        return true;
    }

    applySmoothingToTargets() {
        if (!this.targetShapes || this.targetShapes.length === 0) {
            console.log('SmoothnessController.applySmoothingToTargets - no target shapes');
            return;
        }
        
        console.log('SmoothnessController.applySmoothingToTargets - targetShapes:', this.targetShapes.length, 'level:', this.currentLevel);
        
        // Create a temporary Tools instance to use the smoothing algorithm
        const toolManager = this.parentController.getToolManager();
        
        for (let i = 0; i < this.targetShapes.length; i++) {
            const shape = this.targetShapes[i];
            const initialData = this.initialShapePoints[i];
            
            console.log('SmoothnessController.applySmoothingToTargets - shape', i, 'points:', shape.points?.length, 'initialPoints:', initialData?.points?.length);
            
            if (shape.points && initialData && initialData.points) {
                // Get original points (without the control points at start/end)
                let originalPoints = [...initialData.points];
                
                // For Cardinal splines, remove control points at start and end
                if (originalPoints.length >= 4) {
                    originalPoints = originalPoints.slice(1, -1);
                }
                
                console.log('SmoothnessController.applySmoothingToTargets - originalPoints after slice:', originalPoints.length);
                
                // If we only have 2 points or less after removing control points, nothing to smooth
                if (originalPoints.length <= 2) {
                    console.log('SmoothnessController.applySmoothingToTargets - too few points, skipping');
                    continue;
                }
                
                // Apply smoothing
                const smoothedPoints = toolManager.applySmoothingToPoints(originalPoints, this.currentLevel);
                console.log('SmoothnessController.applySmoothingToTargets - smoothedPoints:', smoothedPoints.length);
                
                // Add control points back
                const points = [...smoothedPoints];
                if (points.length > 0) {
                    points.unshift({ ...points[0] });
                    points.push({ ...points[points.length - 1] });
                    
                    shape.points = points;
                    console.log('SmoothnessController.applySmoothingToTargets - applied, new point count:', shape.points.length);
                }
            }
        }
    }

    getClickedSmoothnessIndex(pos) {
        // Smoothness options are drawn with 30px spacing, starting at y=50
        const startY = this.popupRect.top + 50;
        const lineSpacing = 30;
        const lineHeight = 20; // Clickable area height
        
        if (pos.x < this.popupRect.left || pos.x > this.popupRect.right) {
            return -1;
        }
        
        for (let i = 0; i < 5; i++) {
            const lineY = startY + i * lineSpacing;
            if (pos.y >= lineY - lineHeight/2 && pos.y <= lineY + lineHeight/2) {
                return i;
            }
        }
        
        return -1;
    }

    doMouseUp(mouseInfo, view, id, part) {
        // Ignore the first MouseUp event (from opening the picker)
        if (this.ignoreNextMouseUp) {
            console.log('SmoothnessController.doMouseUp - ignoring initial MouseUp');
            this.ignoreNextMouseUp = false;
            return true;
        }
        
        // Check if we've been destroyed or closed
        const parent = this.parentController || this.parent;
        if (!parent || parent.smoothnessController !== this) {
            return false;
        }
        
        const pos = this.getMousePosition(mouseInfo);
        
        // Check if clicking outside the popup - cancel
        if (!this.popupRect.contains(pos.x, pos.y)) {
            this.cancel();
            return true;
        }
        
        return true;
    }

    doKeyPress(keyPressInfo, view, id, part) {
        // Check if we've been destroyed or closed
        const parent = this.parentController || this.parent;
        if (!parent || parent.smoothnessController !== this) {
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
                this.currentLevel = this.selectedIndex;
                
                // Apply smoothing for preview
                this.applySmoothingToTargets();
            }
            return true;
        }
        
        // Down arrow - move selection down
        if (unicode === 31) {
            if (this.selectedIndex < 4) {
                this.selectedIndex++;
                this.currentLevel = this.selectedIndex;
                
                // Apply smoothing for preview
                this.applySmoothingToTargets();
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
        if (this.onAccept) {
            this.onAccept(this.currentLevel);
        }
        this.cleanup();
    }

    cancel() {
        // Restore initial points to target shapes
        for (const initialData of this.initialShapePoints) {
            initialData.shape.points = initialData.points.map(p => ({ ...p }));
        }
        
        if (this.onCancel) {
            this.onCancel();
        }
        this.cleanup();
    }

    cleanup() {
        // Notify parent to clear its reference to this controller FIRST
        const parent = this.parentController || this.parent;
        if (parent && parent.smoothnessController === this) {
            parent.smoothnessController = null;
        }
        
        // Clean up by calling destroy() which removes all views and unregisters events
        this.destroy();
    }
}

// -----------------------------------------------
// Smoothness Picker View
// -----------------------------------------------

const View = require('./index').View;

class SmoothnessPickerView extends View {
    constructor(controller, rect) {
        super(controller, rect);
        
        // Make the entire view area clickable
        const viewArea = this.getViewArea();
        this.addClickablePart(viewArea, 1);
        
        // Pre-generate example irregular lines for each smoothness level
        this.exampleLines = this.generateExampleLines();
    }

    generateExampleLines() {
        const lines = [];
        const levels = SmoothnessController.getSmoothnessLevels();
        
        // Generate a base irregular line (simulating hand-drawn)
        const basePoints = [];
        const numPoints = 40;
        const lineLength = 80;
        
        for (let i = 0; i < numPoints; i++) {
            const x = (i / (numPoints - 1)) * lineLength;
            // Create irregular y values with sine wave + random noise
            const y = Math.sin(i * 0.5) * 3 + (Math.random() - 0.5) * 4;
            basePoints.push({ x, y });
        }
        
        // Apply each smoothness level to the base points
        for (let level = 0; level < 5; level++) {
            const distance = levels[level];
            const smoothed = this.smoothPoints(basePoints, distance);
            lines.push(smoothed);
        }
        
        return lines;
    }

    smoothPoints(points, targetDistance) {
        if (points.length <= 2) return points;
        
        const smoothedPoints = [points[0]];
        
        for (let i = 1; i < points.length - 1; i++) {
            const lastKept = smoothedPoints[smoothedPoints.length - 1];
            const current = points[i];
            const dx = current.x - lastKept.x;
            const dy = current.y - lastKept.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance >= targetDistance) {
                smoothedPoints.push(current);
            }
        }
        
        smoothedPoints.push(points[points.length - 1]);
        return smoothedPoints;
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
        port.drawText('Smoothness', new pdg.Point(viewArea.left + 60, viewArea.top + 25), 
            new pdg.Attributes()
                .textSize(14)
                .textStyle(pdg.textStyle_Centered)
                .fillColor(new pdg.Color(0.2, 0.2, 0.2, 1.0)));
        
        // Draw smoothness options
        const startY = viewArea.top + 50;
        const lineSpacing = 30;
        const lineStartX = viewArea.left + 20;
        
        for (let i = 0; i < 5; i++) {
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
            
            // Draw example irregular line
            const exampleLine = this.exampleLines[i];
            if (exampleLine && exampleLine.length > 1) {
                for (let j = 0; j < exampleLine.length - 1; j++) {
                    const p1 = exampleLine[j];
                    const p2 = exampleLine[j + 1];
                    port.drawLine(
                        new pdg.Point(lineStartX + p1.x, y + p1.y),
                        new pdg.Point(lineStartX + p2.x, y + p2.y),
                        new pdg.Attributes()
                            .lineColor(new pdg.Color(0.2, 0.2, 0.2, 1.0))
                            .lineThickness(1.5)
                    );
                }
            }
        }
    }
}

module.exports = SmoothnessController;

