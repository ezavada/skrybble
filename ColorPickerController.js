// -----------------------------------------------
// ColorPickerController.js
// 
// Color picker popup controller
//
// (c) 2025, Ed Zavada
// -----------------------------------------------

const Controller = require('./index').Controller;
const SliderView = require('./SliderView');
const Colors = require('./colors');

class ColorPickerController extends Controller {
    constructor(parentController, initialColor, colorType, targetShape, onAccept, onCancel, recentColors = []) {
        // Initialize color properties BEFORE calling super (which calls setupViews)
        // We use a temporary static method to parse the color before super() is called
        const parsedColor = ColorPickerController.staticParseColor(initialColor);
        
        // Store these temporarily so setupViews can access them
        ColorPickerController._tempInitialColor = parsedColor;
        ColorPickerController._tempCurrentColor = { ...parsedColor };
        ColorPickerController._tempColorType = colorType;
        ColorPickerController._tempTargetShape = targetShape;
        ColorPickerController._tempRecentColors = recentColors;
        ColorPickerController._tempParentController = parentController;
        
        super(parentController);
        
        // Now assign the actual instance properties
        this.parentController = parentController; // Explicitly save parent controller reference
        this.initialColor = ColorPickerController._tempInitialColor;
        this.initialColorValue = initialColor;
        this.currentColor = ColorPickerController._tempCurrentColor;
        this.colorType = colorType;
        this.targetShape = targetShape;
        this.onAccept = onAccept;
        this.onCancel = onCancel;
        this.recentColors = recentColors;
        
        for (const [slider,channel] of [[this.redSlider,'r'],[this.greenSlider,'g'],[this.blueSlider,'b'],[this.alphaSlider,'a']]) {
            slider.onValueChanged=value=> { this.currentColor[channel]=value; this.updateColor(); };
        }
        // Clean up temp variables
        delete ColorPickerController._tempInitialColor;
        delete ColorPickerController._tempCurrentColor;
        delete ColorPickerController._tempColorType;
        delete ColorPickerController._tempTargetShape;
        delete ColorPickerController._tempRecentColors;
        delete ColorPickerController._tempParentController;
    }
    
    static staticParseColor(colorStr) {
        // Handle null/undefined
        if (!colorStr) {
            colorStr = 'black';
        }
        
        try {
            // Use PDG's built-in color parsing
            const pdgColor = Colors.toColor(colorStr);
            
            return {
                r: pdgColor.red || 0,
                g: pdgColor.green || 0,
                b: pdgColor.blue || 0,
                a: (pdgColor.alpha !== undefined ? pdgColor.alpha : 1)
            };
        } catch (error) {
            console.error('Error parsing color:', colorStr, error);
            return { r: 0, g: 0, b: 0, a: 1 };
        }
    }

    parseColor(colorStr) {
        // Handle null/undefined
        if (!colorStr) {
            colorStr = 'black';
        }
        
        try {
            // Use PDG's built-in color parsing
            const pdgColor = Colors.toColor(colorStr);
            
            const result = {
                r: pdgColor.red || 0,
                g: pdgColor.green || 0,
                b: pdgColor.blue || 0,
                a: (pdgColor.alpha !== undefined ? pdgColor.alpha : 1)
            };
            
            return result;
        } catch (error) {
            console.error('Error parsing color:', colorStr, error);
            return { r: 0, g: 0, b: 0, a: 1 };
        }
    }

    colorToHex() {
        return Colors.toHex(this.currentColor);
    }

    colorToString() {
        return this.colorToHex();
    }

    setupViews() {
        const port = this.port;
        const drawingArea = port.getDrawingArea();
        
        // Create a centered popup (larger to accommodate recent colors)
        const popupWidth = 400;
        const popupHeight = 320;
        
        // Try to position popup to not cover selected shape
        let popupLeft = drawingArea.left + (drawingArea.width() - popupWidth) / 2;
        let popupTop = drawingArea.top + (drawingArea.height() - popupHeight) / 2;
        
        if (ColorPickerController._tempTargetShape) {
            const shape = ColorPickerController._tempTargetShape;
            // Get shape's approximate center and bounding box
            const center = shape.getCenterPoint ? shape.getCenterPoint() : { x: shape.x, y: shape.y };
            
            // Try to position popup away from shape
            // If shape is in left half, put popup on right; if in right half, put on left
            const drawingCenterX = drawingArea.left + drawingArea.width() / 2;
            
            if (center.x < drawingCenterX) {
                // Shape on left, try to put popup on right
                popupLeft = Math.min(drawingArea.right - popupWidth - 20, drawingCenterX + 50);
            } else {
                // Shape on right, try to put popup on left
                popupLeft = Math.max(drawingArea.left + 20, drawingCenterX - popupWidth - 50);
            }
            
            // Keep popup within bounds
            popupLeft = Math.max(drawingArea.left + 10, Math.min(popupLeft, drawingArea.right - popupWidth - 10));
            popupTop = Math.max(drawingArea.top + 60, Math.min(popupTop, drawingArea.bottom - popupHeight - 10));
        }
        
        this.popupRect = new pdg.Rect(popupLeft, popupTop, popupLeft + popupWidth, popupTop + popupHeight);
        
        // Use temp variables since instance properties aren't set yet when setupViews is called from super()
        const currentColor = ColorPickerController._tempCurrentColor || { r: 0, g: 0, b: 0, a: 1 };
        const colorHex = ColorPickerController.colorToHexFromObj(currentColor);
        
        // Create sliders
        const sliderHeight = 30;
        const sliderSpacing = 35;
        const startY = popupTop + 50;
        
        // Create main view first (background) - this will be drawn first (under everything)
        this.mainView = new ColorPickerView(this, this.popupRect);
        
        // Create sliders - these will be drawn on top
        // Red slider
        this.redSlider = new SliderView(
            this,
            new pdg.Rect(popupLeft + 20, startY, popupLeft + popupWidth - 20, startY + sliderHeight),
            'Red',
            currentColor.r,
            colorHex,
            [new pdg.Color(0, currentColor.g, currentColor.b), new pdg.Color(1, currentColor.g, currentColor.b)]
        );
        
        // Green slider
        this.greenSlider = new SliderView(
            this,
            new pdg.Rect(popupLeft + 20, startY + sliderSpacing, popupLeft + popupWidth - 20, startY + sliderSpacing + sliderHeight),
            'Green',
            currentColor.g,
            colorHex,
            [new pdg.Color(currentColor.r, 0, currentColor.b), new pdg.Color(currentColor.r, 1, currentColor.b)]
        );
        
        // Blue slider
        this.blueSlider = new SliderView(
            this,
            new pdg.Rect(popupLeft + 20, startY + sliderSpacing * 2, popupLeft + popupWidth - 20, startY + sliderSpacing * 2 + sliderHeight),
            'Blue',
            currentColor.b,
            colorHex,
            [new pdg.Color(currentColor.r, currentColor.g, 0), new pdg.Color(currentColor.r, currentColor.g, 1)]
        );
        
        // Alpha/Opacity slider
        this.alphaSlider = new SliderView(
            this,
            new pdg.Rect(popupLeft + 20, startY + sliderSpacing * 3, popupLeft + popupWidth - 20, startY + sliderSpacing * 3 + sliderHeight),
            'Alpha',
            currentColor.a,
            colorHex,
            [new pdg.Color(currentColor.r, currentColor.g, currentColor.b, 0), new pdg.Color(currentColor.r, currentColor.g, currentColor.b, 1)]
        );
    }

    updateColor() {
        const colorStr = this.colorToString();
        
        // Update all slider colors and gradients
        this.redSlider.setColor(colorStr);
        this.redSlider.setGradient([
            new pdg.Color(0, this.currentColor.g, this.currentColor.b),
            new pdg.Color(1, this.currentColor.g, this.currentColor.b)
        ]);
        
        this.greenSlider.setColor(colorStr);
        this.greenSlider.setGradient([
            new pdg.Color(this.currentColor.r, 0, this.currentColor.b),
            new pdg.Color(this.currentColor.r, 1, this.currentColor.b)
        ]);
        
        this.blueSlider.setColor(colorStr);
        this.blueSlider.setGradient([
            new pdg.Color(this.currentColor.r, this.currentColor.g, 0),
            new pdg.Color(this.currentColor.r, this.currentColor.g, 1)
        ]);
        
        this.alphaSlider.setColor(colorStr);
        this.alphaSlider.setGradient([
            new pdg.Color(this.currentColor.r, this.currentColor.g, this.currentColor.b, 0),
            new pdg.Color(this.currentColor.r, this.currentColor.g, this.currentColor.b, 1)
        ]);
        
        // Apply color to target shape in real-time (if there is one)
        if (this.targetShape) {
            if (this.colorType === 'fill') {
                this.targetShape.fillColor = colorStr;
            } else if (this.colorType === 'stroke') {
                this.targetShape.strokeColor = colorStr;
            }
        } else {
            // No target shape - update default colors in the parent controller's tool manager
            if (this.parentController && this.parentController.toolManager) {
                if (this.colorType === 'fill') {
                    this.parentController.toolManager.fillColor = colorStr;
                } else if (this.colorType === 'stroke') {
                    this.parentController.toolManager.strokeColor = colorStr;
                }
            }
        }
    }

    doMouseDown(mouseInfo, view, id, part) {
        if ([this.redSlider,this.greenSlider,this.blueSlider,this.alphaSlider].includes(view))
            return view.doMouseDown(mouseInfo,id,part);
        if (view===this.mainView && part>=2 && part<=11) {
            this.selectRecentColor(part-2); return true;
        }
        return false;
    }

    selectRecentColor(index) {
        const colorStr = this.recentColors[index];
        this.currentColor = this.parseColor(colorStr);
        
        // Update sliders
        this.redSlider.setValue(this.currentColor.r);
        this.greenSlider.setValue(this.currentColor.g);
        this.blueSlider.setValue(this.currentColor.b);
        this.alphaSlider.setValue(this.currentColor.a);
        
        this.updateColor();
    }

    doMouseMove(info,view,id,part) { return view ? view.doMouseMove(info,id,part) : false; }
    doMouseUp(info,view,id,part) { return view ? view.doMouseUp(info,id,part) : false; }

    doKeyPress(keyPressInfo, view, id, part) {
        // If we've been destroyed or closed, don't handle any keys
        const parent = this.parentController || this.parent;
        if (!parent || parent.colorPickerController !== this) {
            console.log('ColorPickerController.doKeyPress - already closed, ignoring');
            return false;
        }
        
        const unicode = keyPressInfo && keyPressInfo.unicode;
        let key = '';
        if (unicode) {
            key = String.fromCharCode(unicode);
        }

        console.log('ColorPickerController.doKeyPress, unicode:', unicode, 'key:', key);

        if (key === '\r' || key === '\n' || unicode === 13) {
            // Enter key - accept changes
            console.log('ColorPickerController.doKeyPress - accepting');
            this.accept();
            return true;
        } else if (key === '\u001b' || unicode === 27) {
            // Escape key - cancel changes
            console.log('ColorPickerController.doKeyPress - cancelling');
            this.cancel();
            return true;
        }
        console.log('ColorPickerController.doKeyPress - not handled, returning false');
        return false;
    }

    accept() {
        if (this.onAccept) {
            this.onAccept(this.colorToString());
        }
        this.close();
    }

    cancel() {
        // Restore original color to target shape or default colors
        const originalColor = this.initialColorValue;
        
        if (this.targetShape) {
            if (this.colorType === 'fill') {
                this.targetShape.fillColor = originalColor;
            } else if (this.colorType === 'stroke') {
                this.targetShape.strokeColor = originalColor;
            }
        } else {
            // Restore default colors
            if (this.parentController && this.parentController.toolManager) {
                if (this.colorType === 'fill') {
                    this.parentController.toolManager.fillColor = originalColor;
                } else if (this.colorType === 'stroke') {
                    this.parentController.toolManager.strokeColor = originalColor;
                }
            }
        }
        
        if (this.onCancel) {
            this.onCancel();
        }
        this.close();
    }

    static colorToHexFromObj(colorObj) {
        return Colors.toHex(colorObj);
    }
    
    colorToHexFromObj(colorObj) {
        return ColorPickerController.colorToHexFromObj(colorObj);
    }

    close() {
        console.log('ColorPickerController.close() - about to destroy');
        
        // Notify parent to clear its reference to this controller FIRST
        const parent = this.parentController || this.parent;
        if (parent && parent.colorPickerController === this) {
            console.log('ColorPickerController.close() - clearing parent reference');
            parent.colorPickerController = null;
        }
        
        // Clean up by calling destroy() which removes all views and unregisters events
        console.log('ColorPickerController.close() - calling destroy');
        this.destroy();
        console.log('ColorPickerController.close() - destroy complete');
    }

    getCurrentColor() {
        return this.currentColor;
    }

    getColorHex() {
        return this.colorToHex();
    }
}

// Simple view class for the color picker popup background
class ColorPickerView extends require('./index').View {
    constructor(controller, rect) {
        super(controller, rect);
        
        // Make the entire view area clickable for recent colors
        const viewArea = this.getViewArea();
        this.addClickablePart(new pdg.Rect(viewArea.width(),viewArea.height()), 1);
        const colors=ColorPickerController._tempRecentColors || controller.recentColors || [];
        for(let i=0;i<Math.min(10,colors.length);i++) {
            const x=20+i*30,y=viewArea.height()-80;
            this.addClickablePart(new pdg.Rect(x,y,x+25,y+25),i+2);
        }
    }

    drawSelf(port, frameNum) {
        const viewArea = this.getViewArea();
        
        // Draw semi-transparent background overlay
        const drawingArea = port.getDrawingArea();
        const overlayAttrs = new pdg.Attributes().fillColor(new pdg.Color(0, 0, 0, 0.5));
        port.drawRect(drawingArea, overlayAttrs);
        
        // Draw popup background
        const bgAttrs = new pdg.Attributes()
            .fillColor(new pdg.Color(0.95, 0.95, 0.95, 1.0));
        port.drawRect(viewArea, bgAttrs);
        
        // Draw popup border
        const borderAttrs = new pdg.Attributes()
            .lineColor(new pdg.Color(0.3, 0.3, 0.3, 1.0))
            .lineThickness(2);
        port.drawRect(viewArea, borderAttrs);
        
        // Draw title
        const titleAttrs = new pdg.Attributes()
            .textSize(20)
            .textStyle(pdg.textStyle_Centered)
            .fillColor(new pdg.Color('black'));
        const titleY = viewArea.top + 34;
        const titleX = viewArea.left + viewArea.width() / 2;
        
        // Show different title if setting default colors vs shape colors
        const colorType = this.controller.colorType || 'fill';
        const colorTypeText = colorType === 'fill' ? 'Fill' : 'Stroke';
        const titleText = this.controller.targetShape ? `${colorTypeText} Color Picker` : `Default ${colorTypeText} Color`;
        port.drawText(titleText, new pdg.Point(titleX, titleY), titleAttrs);
        
        // Draw current color swatch and hex - right aligned with slider numbers
        const startY = viewArea.top + 50;
        const sliderSpacing = 35;
        const previewSize = 38;
        const previewX = viewArea.right - 38; // Right-aligned with slider numbers
        const previewY = startY + sliderSpacing * 4;
        const previewRect = new pdg.Rect(previewX - previewSize, previewY, previewX, previewY + previewSize);
        
        const currentColor = this.controller.getCurrentColor ? this.controller.getCurrentColor() : { r: 0, g: 0, b: 0, a: 1 };
        
        // Draw checkerboard pattern under swatch (for transparency visibility)
        this.drawCheckerboard(port, previewRect);
        
        // Draw color preview
        const previewAttrs = new pdg.Attributes()
            .fillColor(new pdg.Color(currentColor.r, currentColor.g, currentColor.b, currentColor.a));
        port.drawRect(previewRect, previewAttrs);
        
        const previewBorderAttrs = new pdg.Attributes()
            .lineColor(new pdg.Color('black'))
            .lineThickness(1);
        port.drawRect(previewRect, previewBorderAttrs);
        
        // Draw hex value below swatch
        const hexValue = this.controller.getColorHex ? this.controller.getColorHex() : '#000000';
        const hexAttrs = new pdg.Attributes()
            .textSize(14)
            .textStyle(pdg.textStyle_Centered)
            .fillColor(new pdg.Color('black'));
        const hexX = previewX - previewSize / 2;
        const hexY = previewY + previewSize + 14;
        port.drawText(hexValue, new pdg.Point(hexX, hexY), hexAttrs);
        
        // Draw recent colors (moved up 4px to be tighter to label)
        if (this.controller.recentColors && this.controller.recentColors.length > 0) {
            const recentAttrs = new pdg.Attributes()
                .textSize(14)
                .textStyle(pdg.textStyle_Plain)
                .fillColor(new pdg.Color('black'));
            port.drawText('Recent Colors:', new pdg.Point(viewArea.left + 20, viewArea.bottom - 85), recentAttrs);
            
            const swatchSize = 25;
            const swatchSpacing = 5;
            const startX = viewArea.left + 20;
            const startY = viewArea.bottom - 76; // Moved up 4px
            
            for (let i = 0; i < this.controller.recentColors.length && i < 10; i++) {
                const color = this.controller.recentColors[i];
                const swatchX = startX + i * (swatchSize + swatchSpacing);
                const swatchRect = new pdg.Rect(swatchX, startY, swatchX + swatchSize, startY + swatchSize);
                
                // Parse and draw color swatch
                const parsedColor = this.controller.parseColor(color);
                const swatchAttrs = new pdg.Attributes()
                    .fillColor(new pdg.Color(parsedColor.r, parsedColor.g, parsedColor.b, parsedColor.a));
                port.drawRect(swatchRect, swatchAttrs);
                
                // Draw border
                const swatchBorderAttrs = new pdg.Attributes()
                    .lineColor(new pdg.Color('black'))
                    .lineThickness(1);
                port.drawRect(swatchRect, swatchBorderAttrs);
            }
        }
        
        // Draw instructions
        const instructAttrs = new pdg.Attributes()
            .textSize(12)
            .textStyle(pdg.textStyle_Centered)
            .fillColor(new pdg.Color(0.4, 0.4, 0.4, 1.0));
        port.drawText('Enter to accept, Esc to cancel', new pdg.Point(titleX, viewArea.bottom - 15), instructAttrs);
    }

    drawCheckerboard(port, rect) {
        // Draw checkerboard pattern for transparency visualization
        const squareSize = 5;
        const lightGray = new pdg.Color(0.85, 0.85, 0.85);
        const darkGray = new pdg.Color(0.7, 0.7, 0.7);
        
        for (let x = rect.left; x < rect.right; x += squareSize) {
            for (let y = rect.top; y < rect.bottom; y += squareSize) {
                const col = Math.floor((x - rect.left) / squareSize);
                const row = Math.floor((y - rect.top) / squareSize);
                const isLight = (col + row) % 2 === 0;
                
                const squareRect = new pdg.Rect(
                    Math.max(x, rect.left),
                    Math.max(y, rect.top),
                    Math.min(x + squareSize, rect.right),
                    Math.min(y + squareSize, rect.bottom)
                );
                
                const attrs = new pdg.Attributes().fillColor(isLight ? lightGray : darkGray);
                port.drawRect(squareRect, attrs);
            }
        }
    }
}

module.exports = ColorPickerController;

