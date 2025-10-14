// -----------------------------------------------
// SliderView.js
// 
// Slider view for color picker
//
// (c) 2025, Ed Zavada
// -----------------------------------------------

const View = require('./index').View;

class SliderView extends View {
    constructor(controller, rect, label, value, color, gradient) {
        super(controller, rect);
        this.label = label;
        this.value = value; // 0.0 to 1.0
        this.color = color; // Current color for the knob
        this.gradient = gradient; // Array of colors for the gradient [start, end]
        this.isDragging = false;
        
        // Make the entire slider area clickable
        const viewArea = this.getViewArea();
        this.addClickablePart(viewArea, 1);
    }

    setValue(value) {
        this.value = Math.max(0, Math.min(1, value));
    }

    getValue() {
        return this.value;
    }

    setColor(color) {
        this.color = color;
    }

    setGradient(gradient) {
        this.gradient = gradient;
    }

    drawSelf(port, frameNum) {
        const viewArea = this.getViewArea();
        
        // Draw label on left
        const labelAttrs = new pdg.Attributes()
            .textSize(12)
            .textStyle(pdg.textStyle_Plain)
            .fillColor(new pdg.Color('black'));
        port.drawText(this.label, new pdg.Point(viewArea.left, viewArea.top + 15), labelAttrs);
        
        // Slider bar area (starts after label, ends before value)
        const sliderLeft = viewArea.left + 60;
        const sliderRight = viewArea.right - 60;
        const sliderTop = viewArea.top + 5;
        const sliderBottom = viewArea.bottom - 5;
        const sliderHeight = sliderBottom - sliderTop;
        
        // Draw rounded rectangle slider bar with gradient
        const sliderRect = new pdg.Rect(sliderLeft, sliderTop, sliderRight, sliderBottom);
        const cornerRadius = (sliderBottom - sliderTop) / 2;
        
        // First draw the gradient using PDG's built-in gradient support
        const gradientAttrs = new pdg.Attributes()
            .fillGradient(
                new pdg.Point(sliderLeft, sliderTop),
                this.gradient[0],
                new pdg.Point(sliderRight, sliderTop),
                this.gradient[1]
            );
        port.drawRoundedRect(sliderRect, cornerRadius, gradientAttrs);
        
        // Then draw the border on top
        const borderAttrs = new pdg.Attributes()
            .lineColor(new pdg.Color(0.5, 0.5, 0.5, 1.0))
            .lineThickness(1);
        port.drawRoundedRect(sliderRect, cornerRadius, borderAttrs);
        
        // Calculate knob position
        const knobX = sliderLeft + this.value * (sliderRight - sliderLeft);
        const knobY = sliderTop + sliderHeight / 2;
        const knobRadius = 8;
        
        // Draw knob (circle with current color)
        const knobFillAttrs = new pdg.Attributes()
            .fillColor(new pdg.Color(this.color));
        port.drawCircle(new pdg.Point(knobX, knobY), knobRadius, knobFillAttrs);
        
        // Draw knob border (white or black based on contrast)
        const brightness = this.getColorBrightness(this.color);
        const borderColor = brightness > 0.5 ? 'black' : 'white';
        const knobBorderAttrs = new pdg.Attributes()
            .lineColor(new pdg.Color(borderColor))
            .lineThickness(2);
        port.drawCircle(new pdg.Point(knobX, knobY), knobRadius, knobBorderAttrs);
        
        // Draw value on right side
        const valueText = this.value.toFixed(2);
        const valueAttrs = new pdg.Attributes()
            .textSize(12)
            .textStyle(pdg.textStyle_Plain)
            .fillColor(new pdg.Color('black'));
        port.drawText(valueText, new pdg.Point(sliderRight + 10, viewArea.top + 15), valueAttrs);
    }

    interpolateColor(color1, color2, t) {
        return new pdg.Color(
            color1.r + (color2.r - color1.r) * t,
            color1.g + (color2.g - color1.g) * t,
            color1.b + (color2.b - color1.b) * t,
            1.0
        );
    }

    getColorBrightness(colorStr) {
        // Parse color string or use default values
        if (typeof colorStr === 'string') {
            // Simple approximation for named colors
            if (colorStr === 'black') return 0;
            if (colorStr === 'white') return 1;
            // For hex colors, we'd need to parse them
            return 0.5;
        }
        // For PDG Color objects or RGB values
        const r = colorStr.r || 0;
        const g = colorStr.g || 0;
        const b = colorStr.b || 0;
        return (r * 0.299 + g * 0.587 + b * 0.114);
    }

    // Convert mouse position to slider value
    mouseToValue(mouseX) {
        const viewArea = this.getViewArea();
        const sliderLeft = viewArea.left + 60;
        const sliderRight = viewArea.right - 30;
        
        const relativeX = mouseX - sliderLeft;
        const sliderWidth = sliderRight - sliderLeft;
        const value = relativeX / sliderWidth;
        
        return Math.max(0, Math.min(1, value));
    }
}

module.exports = SliderView;

