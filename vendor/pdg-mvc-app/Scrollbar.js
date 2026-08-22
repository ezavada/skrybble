// -----------------------------------------------
// Scrollbar.js
// 
// JavaScript port of the Scrollbar UI component
// A scrollbar with orientation and slider functionality
//
// Ported from C++ by Assistant, 2024
// Original Copyright (c) 2004-2012, Dream Rock Studios, LLC
// -----------------------------------------------

const { View } = require('./View');
const { Subject } = require('./Observer');
const { ControlAttributes, ControlState, ControlType } = require('./ControlAttributes');

// TimerManager requires non-zero numeric IDs. Give each scrollbar its own IDs
// so multiple controls can repeat independently.
let nextScrollbarTimerID = 0x07100000;

/**
 * Scrollbar orientation
 */
const ScrollbarOrientation = {
    HORIZONTAL: 0,
    VERTICAL: 1,           // Up is smaller
    VERTICAL_UP_IS_BIGGER: 2
};

/**
 * Scrollbar click IDs
 */
const ScrollbarClickIDs = {
    CLICK_ID_SCROLL_UP: 1,
    CLICK_ID_SCROLL_DOWN: 2,
    CLICK_ID_SLIDER_AREA: 3
};

/**
 * Scrollbar images
 */
const ScrollbarImages = {
    SCROLL_DOWN: 0,
    SCROLL_UP: 1,
    SCROLL_SLIDER: 2,
    SCROLL_DOWN_CLICKED: 3,
    SCROLL_UP_CLICKED: 4,
    MAX_SCROLL_BAR_IMAGES: 5
};

/**
 * Scrollbar UI component that extends View and implements Subject
 * Provides scrolling functionality with orientation support
 */
class Scrollbar extends View {
    constructor(controller, scrollBarRect, orientation, initValue, visibleAmount, rangeSize) {
        super(controller, scrollBarRect);
        
        // Initialize Subject functionality
        this.observers = [];
        
        this.orientation = orientation;
        this.visibleAmount = visibleAmount;
        this.minRange = 0;
        this.maxRange = Math.max(rangeSize - visibleAmount, 0);
        this.currentPosition = Math.min(Math.max(initValue, this.minRange), this.maxRange);
        this.stepSize = 1;
        this.pageSize = visibleAmount;
        
        // Event managers
        this.eventMgr = controller.getApplication().getEventManager();
        this.resMgr = controller.getApplication().getResourceManager();
        this.timerMgr = controller.getApplication().getTimerManager();
        this.scrollUpTimerID = nextScrollbarTimerID++;
        this.scrollDownTimerID = nextScrollbarTimerID++;
        this.timerHandler = typeof pdg.onTimer === 'function'
            ? pdg.onTimer((eventData) => this.handleEvent('eventType_Timer', eventData))
            : null;
        
        // Images
        this.mpScrollBarImages = new Array(ScrollbarImages.MAX_SCROLL_BAR_IMAGES).fill(null);
        
        // Button points
        this.upButtonPoint = new pdg.Point(0, 0);
        this.downButtonPoint = new pdg.Point(0, 0);
        this.sliderArea = new pdg.Rect(0, 0, 0, 0);
        
        // Tracking state
        this.sliderStartTrackPoint = new pdg.Point(0, 0);
        this.oldMousePoint = new pdg.Point(0, 0);
        this.sliderStartTrackHeight = 0;
        this.sliderPoint = new pdg.Point(0, 0);
        
        // Click states
        this.scrollUpClicked = false;
        this.scrollDownClicked = false;
        this.scrollUpFullWindowClicked = false;
        this.scrollDownFullWindowClicked = false;
        this.scrollSliderClicked = false;
        this.attributes = new ControlAttributes();
        this.attributes
            .stateAttributes(ControlState.Normal, new pdg.Attributes()
                .fillColor(new pdg.Color(76 / 255, 100 / 255, 126 / 255, 1)))
            .stateAttributes(ControlState.Decrement, new pdg.Attributes()
                .fillColor(new pdg.Color(0.8, 0.8, 0.8, 1)).lineColor(new pdg.Color(0.6, 0.6, 0.6, 1)))
            .stateAttributes(ControlState.DecrementPressed, new pdg.Attributes()
                .fillColor(new pdg.Color(0.6, 0.6, 0.6, 1)).lineColor(new pdg.Color(0, 0, 0, 1)))
            .stateAttributes(ControlState.Increment, new pdg.Attributes()
                .fillColor(new pdg.Color(0.8, 0.8, 0.8, 1)).lineColor(new pdg.Color(0.6, 0.6, 0.6, 1)))
            .stateAttributes(ControlState.IncrementPressed, new pdg.Attributes()
                .fillColor(new pdg.Color(0.6, 0.6, 0.6, 1)).lineColor(new pdg.Color(0, 0, 0, 1)))
            .stateAttributes(ControlState.Thumb, new pdg.Attributes()
                .fillColor(new pdg.Color(1, 1, 1, 1)).lineColor(new pdg.Color(0, 0, 0, 1)).roundedCorners(3));
        this.attributes.merge(controller.getTopController()
            .getControlAttributes(ControlType.Scrollbar, orientation));
        
        // Note: Event handling is done through the global pdg.on* methods
        // No need to register with eventMgr.addHandler
        
        this.calcClickableAreas();
    }

    /**
     * Load scrollbar images
     * @param {number} scrollbarImagesResourceID - Resource ID for images
     */
    loadImages(scrollbarImagesResourceID) {
        try {
            for (let i = 0; i < ScrollbarImages.MAX_SCROLL_BAR_IMAGES; i++) {
                this.mpScrollBarImages[i] = this.resMgr.getImage(scrollbarImagesResourceID, i);
            }
            const horizontal = this.orientation === ScrollbarOrientation.HORIZONTAL;
            this.attributes
                .stateImage(ControlState.Decrement,
                    this.mpScrollBarImages[horizontal ? ScrollbarImages.SCROLL_DOWN : ScrollbarImages.SCROLL_UP])
                .stateImage(ControlState.DecrementPressed,
                    this.mpScrollBarImages[horizontal ? ScrollbarImages.SCROLL_DOWN_CLICKED : ScrollbarImages.SCROLL_UP_CLICKED])
                .stateImage(ControlState.Increment,
                    this.mpScrollBarImages[horizontal ? ScrollbarImages.SCROLL_UP : ScrollbarImages.SCROLL_DOWN])
                .stateImage(ControlState.IncrementPressed,
                    this.mpScrollBarImages[horizontal ? ScrollbarImages.SCROLL_UP_CLICKED : ScrollbarImages.SCROLL_DOWN_CLICKED])
                .stateImage(ControlState.Thumb, this.mpScrollBarImages[ScrollbarImages.SCROLL_SLIDER]);
            this.calcClickableAreas();
        } catch (error) {
            console.warn(`Failed to load scrollbar images for ID ${scrollbarImagesResourceID}:`, error);
            this.createPlaceholderImages();
        }
    }

    /**
     * Create placeholder images
     */
    createPlaceholderImages() {
        // In a real implementation, you would create actual images
        for (let i = 0; i < ScrollbarImages.MAX_SCROLL_BAR_IMAGES; i++) {
            this.mpScrollBarImages[i] = null;
        }
    }

    /**
     * Calculate clickable areas
     */
    calcClickableAreas() {
        const viewArea = this.getViewArea();
        const decrementSize = this.decrementExtent();
        const incrementSize = this.incrementExtent();
        this.removeClickablePart(ScrollbarClickIDs.CLICK_ID_SCROLL_UP);
        this.removeClickablePart(ScrollbarClickIDs.CLICK_ID_SCROLL_DOWN);
        this.removeClickablePart(ScrollbarClickIDs.CLICK_ID_SLIDER_AREA);
        
        if (this.orientation === ScrollbarOrientation.HORIZONTAL) {
            // Horizontal scrollbar
            this.downButtonPoint = new pdg.Point(viewArea.left, viewArea.top);
            this.upButtonPoint = new pdg.Point(viewArea.right - incrementSize, viewArea.top);
            this.sliderArea = new pdg.Rect(viewArea.left + decrementSize, viewArea.top,
                                      viewArea.right - incrementSize, viewArea.bottom);
            
            // Add clickable areas
            this.addClickablePart(new pdg.Rect(0, 0, decrementSize, viewArea.height()),
                                ScrollbarClickIDs.CLICK_ID_SCROLL_DOWN);
            this.addClickablePart(new pdg.Rect(viewArea.width() - incrementSize, 0, viewArea.width(), viewArea.height()),
                                ScrollbarClickIDs.CLICK_ID_SCROLL_UP);
            this.addClickablePart(new pdg.Rect(decrementSize, 0,
                viewArea.width() - incrementSize, viewArea.height()), ScrollbarClickIDs.CLICK_ID_SLIDER_AREA);
        } else {
            // Vertical scrollbar
            this.upButtonPoint = new pdg.Point(viewArea.left, viewArea.top);
            this.downButtonPoint = new pdg.Point(viewArea.left, viewArea.bottom - incrementSize);
            this.sliderArea = new pdg.Rect(viewArea.left, viewArea.top + decrementSize,
                                      viewArea.right, viewArea.bottom - incrementSize);
            
            // Add clickable areas
            this.addClickablePart(new pdg.Rect(0, 0, viewArea.width(), decrementSize),
                                ScrollbarClickIDs.CLICK_ID_SCROLL_UP);
            this.addClickablePart(new pdg.Rect(0, viewArea.height() - incrementSize,
                viewArea.width(), viewArea.height()),
                                ScrollbarClickIDs.CLICK_ID_SCROLL_DOWN);
            this.addClickablePart(new pdg.Rect(0, decrementSize, viewArea.width(),
                viewArea.height() - incrementSize), ScrollbarClickIDs.CLICK_ID_SLIDER_AREA);
        }
        
        this.updateSliderPosition();
    }

    /**
     * Update slider position based on current position
     */
    updateSliderPosition() {
        if (this.maxRange <= 0) {
            this.sliderPoint = this.sliderArea.leftTop();
            return;
        }
        
        const range = Math.max(1, this.maxRange - this.minRange);
        const position = (this.currentPosition - this.minRange) / range;
        const thumb = this.thumbDimensions();
        
        if (this.orientation === ScrollbarOrientation.HORIZONTAL) {
            const sliderWidth = thumb.x;
            const availableWidth = this.sliderArea.width() - sliderWidth;
            const sliderX = this.sliderArea.left + position * availableWidth;
            this.sliderPoint = new pdg.Point(sliderX, this.sliderArea.top);
        } else if (this.orientation === ScrollbarOrientation.VERTICAL) {
            const sliderHeight = thumb.y;
            const availableHeight = this.sliderArea.height() - sliderHeight;
            const sliderY = this.sliderArea.top + position * availableHeight;
            this.sliderPoint = new pdg.Point(this.sliderArea.left, sliderY);
        } else {
            const sliderHeight = thumb.y;
            const availableHeight = this.sliderArea.height() - sliderHeight;
            const sliderY = this.sliderArea.bottom - sliderHeight - position * availableHeight;
            this.sliderPoint = new pdg.Point(this.sliderArea.left, sliderY);
        }
    }

    /**
     * Draw the scrollbar
     */
    drawSelf(port, frameNum) {
        const horizontal = this.orientation === ScrollbarOrientation.HORIZONTAL;
        const decrementState = (horizontal ? this.scrollDownClicked : this.scrollUpClicked)
            ? ControlState.DecrementPressed : ControlState.Decrement;
        const incrementState = (horizontal ? this.scrollUpClicked : this.scrollDownClicked)
            ? ControlState.IncrementPressed : ControlState.Increment;
        const decrementRect = horizontal ? this.getDownButtonRect() : this.getUpButtonRect();
        const incrementRect = horizontal ? this.getUpButtonRect() : this.getDownButtonRect();
        this.attributes.draw(port, this.sliderArea, ControlState.Normal);
        this.attributes.draw(port, decrementRect, decrementState);
        this.attributes.draw(port, incrementRect, incrementState);
        if (!this._stateImage(decrementState)) this.drawArrow(decrementRect, false);
        if (!this._stateImage(incrementState)) this.drawArrow(incrementRect, true);
        if (!this.scrollSliderClicked) this.updateSliderPosition();
        this.attributes.draw(port, this.getSliderRect(), ControlState.Thumb);
    }

    /**
     * Draw scrollbar components
     */
    drawScrollBar() {
        const port = this.getPort();
        const buttonSize = 16;
        
        // Draw up button
        const upButtonRect = this.getUpButtonRect();
        this.drawButton(upButtonRect, this.scrollUpClicked ? ScrollbarImages.SCROLL_UP_CLICKED : ScrollbarImages.SCROLL_UP);
        
        // Draw down button
        const downButtonRect = this.getDownButtonRect();
        this.drawButton(downButtonRect, this.scrollDownClicked ? ScrollbarImages.SCROLL_DOWN_CLICKED : ScrollbarImages.SCROLL_DOWN);
        
        // Draw slider area background
        var sliderBgAttrs = new pdg.Attributes().fillColor(new pdg.Color(0.8, 0.8, 0.8, 1.0));
        port.drawRect(this.sliderArea, sliderBgAttrs);
        var sliderBorderAttrs = new pdg.Attributes().lineColor(new pdg.Color(0.6, 0.6, 0.6, 1.0)).lineThickness(1);
        port.drawRect(this.sliderArea, sliderBorderAttrs);
        
        // Draw slider
        if (this.maxRange > 0) {
            const sliderRect = this.getSliderRect();
            this.drawSlider(sliderRect);
        }
    }

    /**
     * Draw a button
     * @param {pdg.Rect} rect - Button rectangle
     * @param {number} imageIndex - Image index
     */
    drawButton(rect, imageIndex) {
        const port = this.getPort();
        
        if (this.mpScrollBarImages[imageIndex]) {
            // Draw using loaded image
            port.drawImage(this.mpScrollBarImages[imageIndex], rect.leftTop(), rect);
        } else {
            // Draw standard button
            const bgColor = this.isButtonPressed(imageIndex) ? 
                new pdg.Color(0.6, 0.6, 0.6, 1.0) : 
                new pdg.Color(0.9, 0.9, 0.9, 1.0);
            
            var buttonBgAttrs = new pdg.Attributes().fillColor(bgColor);
            port.drawRect(rect, buttonBgAttrs);
            var buttonBorderAttrs = new pdg.Attributes().lineColor(new pdg.Color(0.5, 0.5, 0.5, 1.0)).lineThickness(1);
            port.drawRect(rect, buttonBorderAttrs);
            
            // Draw arrow
            this.drawArrow(rect, imageIndex);
        }
    }

    /**
     * Draw arrow in button
     * @param {pdg.Rect} rect - Button rectangle
     * @param {number} imageIndex - Image index
     */
    drawArrow(rect, increment) {
        const port = this.getPort();
        const centerX = rect.left + rect.width() / 2;
        const centerY = rect.top + rect.height() / 2;
        const size = 4;
        
        const line = new pdg.Attributes().lineColor(new pdg.Color(0.2, 0.2, 0.2, 1)).lineThickness(2);
        if (this.orientation === ScrollbarOrientation.HORIZONTAL) {
            const direction = increment ? 1 : -1;
            port.drawLine(new pdg.Point(centerX - direction * size, centerY - size),
                new pdg.Point(centerX + direction * size, centerY), line);
            port.drawLine(new pdg.Point(centerX + direction * size, centerY),
                new pdg.Point(centerX - direction * size, centerY + size), line);
        } else {
            const direction = increment ? 1 : -1;
            port.drawLine(new pdg.Point(centerX - size, centerY - direction * size),
                new pdg.Point(centerX, centerY + direction * size), line);
            port.drawLine(new pdg.Point(centerX, centerY + direction * size),
                new pdg.Point(centerX + size, centerY - direction * size), line);
        }
    }

    /**
     * Draw slider
     * @param {pdg.Rect} rect - Slider rectangle
     */
    drawSlider(rect) {
        const port = this.getPort();
        
        if (this.mpScrollBarImages[ScrollbarImages.SCROLL_SLIDER]) {
            // Draw using loaded image
            port.drawImage(this.mpScrollBarImages[ScrollbarImages.SCROLL_SLIDER], rect.leftTop(), rect);
        } else {
            // Draw standard slider
            const bgColor = this.scrollSliderClicked ? 
                new pdg.Color(0.5, 0.5, 0.5, 1.0) : 
                new pdg.Color(0.7, 0.7, 0.7, 1.0);
            
            var sliderBgAttrs = new pdg.Attributes().fillColor(bgColor);
            port.drawRect(rect, sliderBgAttrs);
            var sliderBorderAttrs = new pdg.Attributes().lineColor(new pdg.Color(0.3, 0.3, 0.3, 1.0)).lineThickness(1);
            port.drawRect(rect, sliderBorderAttrs);
        }
    }

    /**
     * Check if button is pressed
     * @param {number} imageIndex - Image index
     * @returns {boolean} true if pressed
     */
    isButtonPressed(imageIndex) {
        return imageIndex === ScrollbarImages.SCROLL_UP_CLICKED || 
               imageIndex === ScrollbarImages.SCROLL_DOWN_CLICKED;
    }

    /**
     * Get up button rectangle
     * @returns {pdg.Rect} Up button rectangle
     */
    getUpButtonRect() {
        const buttonSize = this.orientation === ScrollbarOrientation.HORIZONTAL
            ? this.incrementExtent() : this.decrementExtent();
        if (this.orientation === ScrollbarOrientation.HORIZONTAL) {
            return new pdg.Rect(this.upButtonPoint.x, this.upButtonPoint.y,
                this.upButtonPoint.x + buttonSize, this.upButtonPoint.y + this.getViewArea().height());
        } else {
            return new pdg.Rect(this.upButtonPoint.x, this.upButtonPoint.y,
                this.upButtonPoint.x + this.getViewArea().width(), this.upButtonPoint.y + buttonSize);
        }
    }

    /**
     * Get down button rectangle
     * @returns {pdg.Rect} Down button rectangle
     */
    getDownButtonRect() {
        const buttonSize = this.orientation === ScrollbarOrientation.HORIZONTAL
            ? this.decrementExtent() : this.incrementExtent();
        if (this.orientation === ScrollbarOrientation.HORIZONTAL) {
            return new pdg.Rect(this.downButtonPoint.x, this.downButtonPoint.y,
                this.downButtonPoint.x + buttonSize, this.downButtonPoint.y + this.getViewArea().height());
        } else {
            return new pdg.Rect(this.downButtonPoint.x, this.downButtonPoint.y,
                this.downButtonPoint.x + this.getViewArea().width(), this.downButtonPoint.y + buttonSize);
        }
    }

    /**
     * Get slider rectangle
     * @returns {pdg.Rect} Slider rectangle
     */
    getSliderRect() {
        const thumb = this.thumbDimensions();
        return new pdg.Rect(this.sliderPoint.x, this.sliderPoint.y,
            this.sliderPoint.x + thumb.x, this.sliderPoint.y + thumb.y);
    }

    _imageDimension(image, dimension) {
        if (!image) return 0;
        return typeof image[dimension] === 'function' ? image[dimension]() : image[dimension];
    }

    _stateImage(state) {
        const visual = this.attributes.state(state);
        return visual.hasImage ? visual.image : null;
    }

    decrementExtent() {
        const image = this._stateImage(ControlState.Decrement);
        if (image) return this._imageDimension(image,
            this.orientation === ScrollbarOrientation.HORIZONTAL ? 'width' : 'height');
        return this.orientation === ScrollbarOrientation.HORIZONTAL
            ? this.getViewArea().height() : this.getViewArea().width();
    }

    incrementExtent() {
        const image = this._stateImage(ControlState.Increment);
        if (image) return this._imageDimension(image,
            this.orientation === ScrollbarOrientation.HORIZONTAL ? 'width' : 'height');
        return this.orientation === ScrollbarOrientation.HORIZONTAL
            ? this.getViewArea().height() : this.getViewArea().width();
    }

    thumbDimensions() {
        const image = this._stateImage(ControlState.Thumb);
        if (image) return new pdg.Point(this._imageDimension(image, 'width'), this._imageDimension(image, 'height'));
        return this.orientation === ScrollbarOrientation.HORIZONTAL
            ? new pdg.Point(Math.min(this.getViewArea().height(), this.sliderArea.width()), this.getViewArea().height())
            : new pdg.Point(this.getViewArea().width(), Math.min(this.getViewArea().width(), this.sliderArea.height()));
    }

    setAttributes(attributes) {
        this.attributes.merge(attributes);
        this.calcClickableAreas();
    }

    getAttributes() {
        return this.attributes;
    }

    /**
     * Handle mouse down
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doMouseDown(mouseInfo, id, part) {
        switch (part) {
            case ScrollbarClickIDs.CLICK_ID_SCROLL_UP:
                this.scrollUpPressed();
                return true;
                
            case ScrollbarClickIDs.CLICK_ID_SCROLL_DOWN:
                this.scrollDownPressed();
                return true;
                
            case ScrollbarClickIDs.CLICK_ID_SLIDER_AREA:
                this.scrollSliderAreaPressed(mouseInfo.mousePos);
                return true;
        }
        return false;
    }

    /**
     * Handle mouse up
     * @param {Object} mouseInfo - Mouse information
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doMouseUp(mouseInfo, id, part) {
        let handled = false;
        if (this.scrollUpClicked) {
            this.scrollUpReleased();
            handled = true;
        }
        if (this.scrollDownClicked) {
            this.scrollDownReleased();
            handled = true;
        }
        if (this.scrollSliderClicked || this.scrollUpFullWindowClicked ||
            this.scrollDownFullWindowClicked) {
            this.scrollSliderAreaReleased();
            handled = true;
        }
        return handled;
    }

    doMouseMove(mouseInfo, id, part) {
        if (this.scrollSliderClicked) this.trackScrollSlider(mouseInfo.mousePos);
    }

    /**
     * Scroll up
     */
    scrollUp() {
        this.setCurrentPosition(this.currentPosition +
            (this.orientation === ScrollbarOrientation.VERTICAL ? -this.stepSize : this.stepSize));
    }

    /**
     * Scroll up pressed
     */
    scrollUpPressed() {
        this.scrollUpClicked = true;
        this.scrollUp();
        
        // Start repeat timer
        this.timerMgr.startTimer(this.scrollUpTimerID, 100, false); // repeating
    }

    /**
     * Scroll up released
     */
    scrollUpReleased() {
        this.scrollUpClicked = false;
        this.timerMgr.cancelTimer(this.scrollUpTimerID);
    }

    /**
     * Scroll down
     */
    scrollDown() {
        this.setCurrentPosition(this.currentPosition +
            (this.orientation === ScrollbarOrientation.VERTICAL ? this.stepSize : -this.stepSize));
    }

    /**
     * Scroll down pressed
     */
    scrollDownPressed() {
        this.scrollDownClicked = true;
        this.scrollDown();
        
        // Start repeat timer
        this.timerMgr.startTimer(this.scrollDownTimerID, 100, false); // repeating
    }

    /**
     * Scroll down released
     */
    scrollDownReleased() {
        this.scrollDownClicked = false;
        this.timerMgr.cancelTimer(this.scrollDownTimerID);
    }

    /**
     * Scroll slider area pressed
     * @param {pdg.Point} clickPoint - Click point
     */
    scrollSliderAreaPressed(clickPoint) {
        if (this.getSliderRect().contains(clickPoint)) {
            // Clicked on slider - start tracking
            this.scrollSliderClicked = true;
            this.sliderStartTrackPoint = new pdg.Point(clickPoint.x, clickPoint.y);
            this.oldMousePoint = new pdg.Point(clickPoint.x, clickPoint.y);
            this.sliderStartTrackHeight = this.orientation === ScrollbarOrientation.HORIZONTAL
                ? clickPoint.x - this.sliderPoint.x
                : clickPoint.y - this.sliderPoint.y;
        } else {
            // Clicked in slider area - page up/down
            if (this.orientation === ScrollbarOrientation.HORIZONTAL) {
                if (clickPoint.x < this.sliderPoint.x) {
                    this.scrollDownFullWindowClicked = true;
                    this.scrollDownFullWindow();
                } else {
                    this.scrollUpFullWindowClicked = true;
                    this.scrollUpFullWindow();
                }
            } else {
                if (clickPoint.y < this.sliderPoint.y) {
                    this.scrollUpFullWindowClicked = true;
                    this.scrollUpFullWindow();
                } else {
                    this.scrollDownFullWindowClicked = true;
                    this.scrollDownFullWindow();
                }
            }
        }
    }

    /**
     * Scroll slider area released
     */
    scrollSliderAreaReleased() {
        this.scrollSliderClicked = false;
        this.scrollUpFullWindowClicked = false;
        this.scrollDownFullWindowClicked = false;
    }

    /**
     * Scroll up full window (page up)
     */
    scrollUpFullWindow() {
        this.setCurrentPosition(this.currentPosition +
            (this.orientation === ScrollbarOrientation.VERTICAL ? -this.pageSize : this.pageSize));
    }

    /**
     * Scroll down full window (page down)
     */
    scrollDownFullWindow() {
        this.setCurrentPosition(this.currentPosition +
            (this.orientation === ScrollbarOrientation.VERTICAL ? this.pageSize : -this.pageSize));
    }

    /**
     * Track scroll slider
     */
    trackScrollSlider(mousePoint = pdg.gfx.getMouse()) {
        if (!this.scrollSliderClicked || !mousePoint) return;

        const thumb = this.thumbDimensions();
        let ratio;
        if (this.orientation === ScrollbarOrientation.HORIZONTAL) {
            const min = this.sliderArea.left;
            const max = this.sliderArea.right - thumb.x;
            this.sliderPoint.x = Math.max(min, Math.min(max,
                mousePoint.x - this.sliderStartTrackHeight));
            ratio = (this.sliderPoint.x - min) / Math.max(1, max - min);
        } else {
            const min = this.sliderArea.top;
            const max = this.sliderArea.bottom - thumb.y;
            this.sliderPoint.y = Math.max(min, Math.min(max,
                mousePoint.y - this.sliderStartTrackHeight));
            ratio = this.orientation === ScrollbarOrientation.VERTICAL
                ? (this.sliderPoint.y - min) / Math.max(1, max - min)
                : (max - this.sliderPoint.y) / Math.max(1, max - min);
        }
        this.oldMousePoint = new pdg.Point(mousePoint.x, mousePoint.y);
        const position = this.minRange + ratio * (this.maxRange - this.minRange);
        this.setCurrentPosition(Math.round(position));
    }

    /**
     * Handle events
     * @param {string} eventType - Event type
     * @param {*} eventData - Event data
     * @returns {boolean} true if handled
     */
    handleEvent(eventType, eventData) {
        if (eventType === 'eventType_Timer') {
            if (eventData.id === this.scrollUpTimerID) {
                this.scrollUp();
                return true;
            } else if (eventData.id === this.scrollDownTimerID) {
                this.scrollDown();
                return true;
            }
        }
        return false;
    }

    /**
     * Get current position
     * @returns {number} Current position
     */
    getCurrentPosition() {
        return this.currentPosition;
    }

    /**
     * Get scroll range
     * @returns {number} Scroll range
     */
    getScrollRange() {
        return this.maxRange - this.minRange;
    }

    /**
     * Set maximum range
     * @param {number} range - Maximum range
     */
    setMaxRange(range) {
        this.maxRange = range;
        this.updateSliderPosition();
    }

    /**
     * Set current position
     * @param {number} position - New position
     */
    setCurrentPosition(position) {
        const oldPosition = this.currentPosition;
        this.currentPosition = Math.min(Math.max(position, this.minRange), this.maxRange);
        
        if (this.currentPosition !== oldPosition) {
            this.updateSliderPosition();
            this.notifyObservers(); // Notify observers of change
        }
    }

    /**
     * Set minimum range
     * @param {number} range - Minimum range
     */
    setMinRange(range) {
        this.minRange = range;
        this.updateSliderPosition();
    }

    /**
     * Set visible amount
     * @param {number} amount - Visible amount
     */
    setVisibleAmount(amount) {
        this.visibleAmount = amount;
        this.updateSliderPosition();
    }

    /**
     * Set step size
     * @param {number} size - Step size
     */
    setStepSize(size) {
        this.stepSize = size;
    }

    /**
     * Set page size
     * @param {number} size - Page size
     */
    setPageSize(size) {
        this.pageSize = size;
    }

    /**
     * Get orientation
     * @returns {number} Orientation
     */
    getOrientation() {
        return this.orientation;
    }

    /**
     * Add observer (Subject method)
     * @param {IObserver} observer - Observer to add
     */
    addObserver(observer) {
        if (!this.observers.includes(observer)) {
            this.observers.push(observer);
        }
    }

    /**
     * Remove observer (Subject method)
     * @param {IObserver} observer - Observer to remove
     */
    removeObserver(observer) {
        const index = this.observers.indexOf(observer);
        if (index > -1) {
            this.observers.splice(index, 1);
        }
    }

    /**
     * Notify observers (Subject method)
     */
    notifyObservers() {
        // Most recently added is notified first (reverse iteration)
        for (let i = this.observers.length - 1; i >= 0; i--) {
            this.observers[i].notify(this);
        }
    }

    /**
     * Cleanup when scrollbar is destroyed
     */
    destroy() {
        // Cancel timers
        this.timerMgr.cancelTimer(this.scrollUpTimerID);
        this.timerMgr.cancelTimer(this.scrollDownTimerID);
        
        if (this.timerHandler) {
            if (typeof this.timerHandler.cancel === 'function') this.timerHandler.cancel();
            else this.eventMgr.removeHandler(this.timerHandler, pdg.eventType_Timer);
            this.timerHandler = null;
        }
        
        // Clean up images
        for (let i = 0; i < ScrollbarImages.MAX_SCROLL_BAR_IMAGES; i++) {
            this.mpScrollBarImages[i] = null;
        }
        
        // Clear observers
        this.observers = [];
        this.attributes = new ControlAttributes();
    }
}

module.exports = {
    Scrollbar,
    ScrollbarOrientation,
    ScrollbarClickIDs,
    ScrollbarImages
};
