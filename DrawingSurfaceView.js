// -----------------------------------------------
// DrawingSurfaceView.js
// 
// Drawing Application using the PDG JavaScript MVC Framework
//
// (c) 2025, Ed Zavada
// -----------------------------------------------

const View = require('./index').View;

// -----------------------------------------------
// Drawing Surface View
//
// just fills the area with white
// -----------------------------------------------

class DrawingSurfaceView extends View {
    constructor(controller, rect) {
        super(controller, rect);
    }

    drawSelf(port, frameNum) {
        const area = this.getViewArea();

        // fill the area with white
        port.drawRect(area, new pdg.Attributes().fillColor(new pdg.Color('white')));
        
        // Draw all shapes from the drawing
        const drawing = this.controller.getDrawing();
        if (drawing) {
            const shapes = drawing.getShapes();
            shapes.forEach(shape => {
                shape.draw(port);
            });
            
            // Draw current shape being drawn
            const toolManager = this.controller.getToolManager();
            if (toolManager.isCurrentlyDrawing()) {
                const currentShape = toolManager.getCurrentShape();
                if (currentShape) {
                    currentShape.draw(port);
                }
            }
        }
        
        // Draw rubber-band selection rectangle
        if (this.controller.rubberBandActive && this.controller.rubberBandStart && this.controller.rubberBandEnd) {
            const start = this.controller.rubberBandStart;
            const end = this.controller.rubberBandEnd;
            
            // Create rectangle from start and end points
            const left = Math.min(start.x, end.x);
            const right = Math.max(start.x, end.x);
            const top = Math.min(start.y, end.y);
            const bottom = Math.max(start.y, end.y);
            
            const rect = new pdg.Rect(left, top, right, bottom);
            
            // Alternate between black and white every 125ms
            const colorName = this.controller.rubberBandColorToggle ? 'white' : 'black';
            const color = new pdg.Color(colorName);
            color.alpha = 0.25; // 25% alpha
            
            // Draw framed (outline only) rectangle using drawRect with only lineColor
            const attrs = new pdg.Attributes()
                .lineColor(color)
                .lineThickness(1)
                .lineStyle(pdg.lineStyle_Solid);
            
            port.drawRect(rect, attrs);
        }
        
        // Draw help overlay
        if (this.controller.getShowHelp()) {
            this.drawHelpOverlay(port, area);
        }
        
        // Draw save confirmation message
        if (this.controller.getSaveMessage && this.controller.getSaveMessage()) {
            this.drawSaveMessage(port, area);
        }
    }

    drawHelpOverlay(port, area) {
        // Draw semi-transparent background
        const bgAttrs = new pdg.Attributes().fillColor(new pdg.Color(0, 0, 0, 0.8));
        port.drawRect(area, bgAttrs);
        
        // Calculate center for positioning
        const centerX = area.left + area.width() / 2;
        const startY = area.top + 50;
        
        // Draw title
        const titleAttrs = new pdg.Attributes()
            .textSize(24)
            .textStyle(pdg.textStyle_Centered)
            .fillColor(new pdg.Color('white'));
        port.drawText('Keyboard Shortcuts', new pdg.Point(centerX, startY), titleAttrs);
        
        // Define keyboard shortcuts to display
        const shortcuts = [
            { key: 'ESC', description: 'Select tool / Finish drawing' },
            { key: 'L', description: 'Line tool' },
            { key: 'F', description: 'Freehand tool' },
            { key: 'S', description: 'Cardinal Spline tool' },
            { key: 'B', description: 'Bezier Spline tool' },
            { key: 'C', description: 'Circle tool' },
            { key: 'O', description: 'Oval tool' },
            { key: 'R', description: 'Rectangle tool' },
            { key: 'Q', description: 'Quad tool (4-point)' },
            { key: 'P', description: 'Polygon tool' },
            { key: 'I', description: 'Image tool' },
            { key: 'M', description: 'Fill Color Picker' },
            { key: 'N', description: 'Line Color Picker' },
            { key: 'H', description: 'Help (this screen)' },
            { key: '', description: '' },
            { key: 'TAB', description: 'Select next shape' },
            { key: 'SHIFT+TAB', description: 'Select previous shape' },
            { key: 'DELETE/BKSP', description: 'Delete / Remove last point' },
            { key: 'ARROWS', description: 'Move selected shapes (10px)' },
            { key: 'SHIFT+ARROWS', description: 'Move selected shapes (1px)' },
            { key: '', description: '' },
            { key: 'CMD/CTRL+C', description: 'Copy selected shapes' },
            { key: 'CMD/CTRL+X', description: 'Cut selected shapes' },
            { key: 'CMD/CTRL+V', description: 'Paste shapes' },
            { key: 'CMD/CTRL+Z', description: 'Undo' },
            { key: 'CMD/CTRL+SHIFT+Z', description: 'Redo' },
            { key: 'CMD/CTRL+S', description: 'Save drawing' },
            { key: '', description: '' },
            { key: '+/=', description: 'Move shape forward' },
            { key: '-', description: 'Move shape backward' },
            { key: 'CMD/CTRL++', description: 'Move shape to front' },
            { key: 'CMD/CTRL+-', description: 'Move shape to back' }
        ];
        
        // Draw shortcuts in two columns
        const leftX = centerX - 200;
        const rightX = centerX + 50;
        const lineHeight = 20;
        let y = startY + 40;
        
        const keyAttrs = new pdg.Attributes()
            .textSize(14)
            .textStyle(pdg.textStyle_Plain)
            .fillColor(new pdg.Color(0.8, 0.9, 1.0));
        const descAttrs = new pdg.Attributes()
            .textSize(14)
            .textStyle(pdg.textStyle_Plain)
            .fillColor(new pdg.Color(0.9, 0.9, 0.9));
        
        let column = 0;
        const itemsPerColumn = Math.ceil(shortcuts.length / 2);
        
        for (let i = 0; i < shortcuts.length; i++) {
            const shortcut = shortcuts[i];
            
            // Calculate position
            const col = Math.floor(i / itemsPerColumn);
            const row = i % itemsPerColumn;
            const x = col === 0 ? leftX : rightX;
            const currentY = startY + 40 + row * lineHeight;
            
            if (shortcut.key) {
                port.drawText(shortcut.key, new pdg.Point(x, currentY), keyAttrs);
                port.drawText(shortcut.description, new pdg.Point(x + 120, currentY), descAttrs);
            }
        }
        
        // Draw footer hint
        const footerY = area.bottom - 30;
        const footerAttrs = new pdg.Attributes()
            .textSize(16)
            .textStyle(pdg.textStyle_Centered)
            .fillColor(new pdg.Color(1.0, 1.0, 0.6));
        port.drawText('Press H to close', new pdg.Point(centerX, footerY), footerAttrs);
    }

    drawSaveMessage(port, area) {
        const message = this.controller.getSaveMessage();
        if (!message) return;
        
        const centerX = area.left + area.width() / 2;
        const centerY = area.top + area.height() / 2;
        
        // Draw semi-transparent background box
        const textWidth = port.getTextWidth(message, 18);
        const padding = 20;
        const boxWidth = textWidth + padding * 2;
        const boxHeight = 60;
        const boxRect = new pdg.Rect(
            centerX - boxWidth / 2,
            centerY - boxHeight / 2,
            centerX + boxWidth / 2,
            centerY + boxHeight / 2
        );
        
        const bgAttrs = new pdg.Attributes()
            .fillColor(new pdg.Color(0.2, 0.6, 0.2, 0.9));
        port.drawRoundedRect(boxRect, 10, bgAttrs);
        
        const borderAttrs = new pdg.Attributes()
            .lineColor(new pdg.Color(0.1, 0.4, 0.1, 1.0))
            .lineThickness(2);
        port.drawRoundedRect(boxRect, 10, borderAttrs);
        
        // Draw message text
        const textAttrs = new pdg.Attributes()
            .textSize(18)
            .textStyle(pdg.textStyle_Centered)
            .fillColor(new pdg.Color('white'));
        port.drawText(message, new pdg.Point(centerX, centerY + 5), textAttrs);
    }
}

module.exports = DrawingSurfaceView;
