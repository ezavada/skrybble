// -----------------------------------------------
// ScrollingView.js
// 
// JavaScript port of the ScrollingView class
// A view that can be scrolled within a frame
//
// Ported from C++ by Assistant, 2024
// Original Copyright (c) 2010, Dream Rock Studios, LLC
// -----------------------------------------------

const { View } = require('./View');

/**
 * ScrollingView binding types
 */
const ScrollingViewBindType = {
    bind_None: 0,
    bind_LimitX: 1 << 1,                      // Keep view X edges within frame X
    bind_LimitY: 1 << 2,                      // Keep view Y edges within frame Y
    bind_LimitXY: (1 << 1) | (1 << 2),        // Limit view to keep it within frame at all times
    bind_Top: 1 << 3,                         // When view smaller than frame, keep top edge of view aligned with top of frame
    bind_Bottom: 1 << 4,                      // When view smaller than frame, keep bottom edge of view aligned with bottom of frame
    bind_CenterY: (1 << 3) | (1 << 4),        // When view smaller than frame, keep view centered vertically within frame
    bind_Left: 1 << 5,                        // When view smaller than frame, keep left edge of view aligned with left of frame
    bind_Right: 1 << 6,                       // When view smaller than frame, keep right edge of view aligned with right of frame
    bind_CenterX: (1 << 5) | (1 << 6),        // When view smaller than frame, keep view centered horizontally within frame
    bind_Centers: (1 << 3) | (1 << 4) | (1 << 5) | (1 << 6),
    bind_Default: (1 << 1) | (1 << 2)         // bind_LimitXY
};

/**
 * ScrollingView that extends View
 * Provides scrolling functionality within a frame
 */
class ScrollingView extends View {
    constructor(controller, rect, viewBinding = 0, moveBinding = ScrollingViewBindType.bind_Default) {
        super(controller, rect, viewBinding);
        
        this.viewFrame = new pdg.Rect(rect);
        this.autoAdjust = moveBinding;
    }

    /**
     * Alternative constructor with explicit port
     * @param {Controller} controller 
     * @param {pdg.Port} port 
     * @param {pdg.Rect} rect 
     * @param {number} viewBinding 
     * @param {number} moveBinding 
     */
    static withPort(controller, port, rect, viewBinding = 0, moveBinding = ScrollingViewBindType.bind_Default) {
        const view = new ScrollingView(controller, rect, viewBinding, moveBinding);
        view.port = port;
        return view;
    }

    /**
     * Draw the scrolling view
     */
    draw(port, frameNum) {
        if (this.visible) {
            const clipSave = port.getClipRect();
            let ourClip;
            
            if (!clipSave.empty()) {
                ourClip = this.viewFrame.intersection(clipSave);
            } else {
                ourClip = this.viewFrame;
            }
            
            if (!ourClip.empty()) {
                // Don't draw if everything is clipped
                port.setClipRect(ourClip);
                this.drawSelf(port, frameNum);
                port.setClipRect(clipSave);
            }
        }
    }

    /**
     * Set view frame
     * @param {pdg.Rect} rect - New view frame in global/port coordinates
     */
    setViewFrame(rect) {
        this.viewFrame = new pdg.Rect(rect);
        this.applyAutoAdjust();
    }

    /**
     * Get view frame
     * @returns {pdg.Rect} View frame in global/port coordinates
     */
    getViewFrame() {
        return this.viewFrame;
    }

    /**
     * Get modifiable view frame rect
     * @returns {pdg.Rect} Modifiable view frame rect in global/port coordinates
     */
    getModifiableViewFrameRect() {
        return this.viewFrame;
    }

    /**
     * Check if point is in view visible area
     * @param {pdg.Point} screenPoint - Point in global/port coordinates
     * @returns {boolean} true if point is in view
     */
    pointInViewVisibleArea(screenPoint) {
        return this.viewFrame.contains(screenPoint);
    }

    /**
     * Check if point is in view frame
     * @param {pdg.Point} screenPoint - Point in global/port coordinates
     * @returns {boolean} true if point is in frame
     */
    pointInViewFrame(screenPoint) {
        return this.viewFrame.contains(screenPoint);
    }

    /**
     * Handle port resize
     * @param {pdg.Rect} oldDrawingArea - Old drawing area
     * @param {pdg.Rect} newDrawingArea - New drawing area
     */
    portResized(oldDrawingArea, newDrawingArea) {
        // Call parent implementation first
        super.portResized(oldDrawingArea, newDrawingArea);
        
        // Adjust frame based on binding
        if (this.binding === 0) {
            return; // Short circuit
        }
        
        const newViewFrame = new pdg.Rect(this.viewFrame);
        
        if (this.binding & ViewBinding.bind_Left) {
            // Bound to left, always change left to keep distance from left boundary
            newViewFrame.left = newDrawingArea.left + (this.viewFrame.left - oldDrawingArea.left);
            if (this.binding & ViewBinding.bind_Right) {
                // Also bound to right, need to shrink or grow
                newViewFrame.right = newDrawingArea.right - (oldDrawingArea.right - this.viewFrame.right);
                // Make sure we are within our min and max sizes
                if (this.maxWidth && this.viewFrame.width() > this.maxWidth) {
                    newViewFrame.setWidth(this.maxWidth);
                }
                if (this.viewFrame.width() < this.minWidth) {
                    newViewFrame.setWidth(this.minWidth);
                }
            }
        } else if (this.binding & ViewBinding.bind_Right) {
            // Bound to right but not left, maintain width but move with right boundary
            newViewFrame.right = newDrawingArea.right - (oldDrawingArea.right - this.viewFrame.right);
            newViewFrame.left = newViewFrame.right - this.viewFrame.width();
        }
        
        if (this.binding & ViewBinding.bind_Top) {
            // Bound to top, always change top to keep distance from top boundary
            newViewFrame.top = newDrawingArea.top + (this.viewFrame.top - oldDrawingArea.top);
            if (this.binding & ViewBinding.bind_Bottom) {
                // Also bound to bottom, need to shrink or grow
                newViewFrame.bottom = newDrawingArea.bottom - (oldDrawingArea.bottom - this.viewFrame.bottom);
                // Make sure we are within our min and max sizes
                if (this.maxHeight && this.viewFrame.height() > this.maxHeight) {
                    newViewFrame.setHeight(this.maxHeight);
                }
                if (this.viewFrame.height() < this.minHeight) {
                    newViewFrame.setHeight(this.minHeight);
                }
            }
        } else if (this.binding & ViewBinding.bind_Bottom) {
            // Bound to bottom but not top, maintain height but move with bottom boundary
            newViewFrame.bottom = newDrawingArea.bottom - (oldDrawingArea.bottom - this.viewFrame.bottom);
            newViewFrame.top = newViewFrame.bottom - this.viewFrame.height();
        }
        
        this.viewFrame = newViewFrame;
        this.applyAutoAdjust();
    }

    /**
     * Set automatic adjustments applied to the view after moving and/or scaling
     * @param {number} moveBinding - Move binding type
     */
    setAutoAdjust(moveBinding) {
        this.autoAdjust = moveBinding;
        this.applyAutoAdjust();
    }

    /**
     * Move the view as needed so the frame is full of the view
     * If the frame is larger than the view, then the view will bound within the frame
     * according to the binding value passed in
     * @param {number} moveBinding - Move binding type
     * @returns {boolean} true if the view was actually moved, false if unchanged
     */
    adjustViewAreaToFrame(moveBinding = ScrollingViewBindType.bind_Centers) {
        const oldViewArea = new pdg.Rect(this.viewArea);
        
        // Calculate the size difference between frame and view
        const frameWidth = this.viewFrame.width();
        const frameHeight = this.viewFrame.height();
        const viewWidth = this.viewArea.width();
        const viewHeight = this.viewArea.height();
        
        let newLeft = this.viewArea.left;
        let newTop = this.viewArea.top;
        
        // Handle horizontal positioning
        if (moveBinding & ScrollingViewBindType.bind_LimitX) {
            // Limit view to frame bounds
            if (this.viewArea.left > this.viewFrame.left) {
                newLeft = this.viewFrame.left;
            } else if (this.viewArea.right < this.viewFrame.right) {
                newLeft = this.viewFrame.right - viewWidth;
            }
        }
        
        if (moveBinding & ScrollingViewBindType.bind_CenterX) {
            // Center horizontally
            newLeft = this.viewFrame.left + (frameWidth - viewWidth) / 2;
        } else if (moveBinding & ScrollingViewBindType.bind_Left) {
            // Align to left
            newLeft = this.viewFrame.left;
        } else if (moveBinding & ScrollingViewBindType.bind_Right) {
            // Align to right
            newLeft = this.viewFrame.right - viewWidth;
        }
        
        // Handle vertical positioning
        if (moveBinding & ScrollingViewBindType.bind_LimitY) {
            // Limit view to frame bounds
            if (this.viewArea.top > this.viewFrame.top) {
                newTop = this.viewFrame.top;
            } else if (this.viewArea.bottom < this.viewFrame.bottom) {
                newTop = this.viewFrame.bottom - viewHeight;
            }
        }
        
        if (moveBinding & ScrollingViewBindType.bind_CenterY) {
            // Center vertically
            newTop = this.viewFrame.top + (frameHeight - viewHeight) / 2;
        } else if (moveBinding & ScrollingViewBindType.bind_Top) {
            // Align to top
            newTop = this.viewFrame.top;
        } else if (moveBinding & ScrollingViewBindType.bind_Bottom) {
            // Align to bottom
            newTop = this.viewFrame.bottom - viewHeight;
        }
        
        // Apply new position
        this.viewArea.left = newLeft;
        this.viewArea.top = newTop;
        this.viewArea.right = newLeft + viewWidth;
        this.viewArea.bottom = newTop + viewHeight;
        
        // Check if position actually changed
        return !(oldViewArea.left === this.viewArea.left && 
                 oldViewArea.top === this.viewArea.top && 
                 oldViewArea.right === this.viewArea.right && 
                 oldViewArea.bottom === this.viewArea.bottom);
    }

    /**
     * Move the view by a delta amount
     * @param {number} deltaX - X delta
     * @param {number} deltaY - Y delta
     */
    moveView(deltaX, deltaY) {
        this.viewArea.left += deltaX;
        this.viewArea.top += deltaY;
        this.viewArea.right += deltaX;
        this.viewArea.bottom += deltaY;
        
        this.applyAutoAdjust();
    }

    /**
     * Apply automatic adjustments based on current auto adjust setting
     */
    applyAutoAdjust() {
        if (this.autoAdjust !== ScrollingViewBindType.bind_None) {
            this.adjustViewAreaToFrame(this.autoAdjust);
        }
    }

    /**
     * Check if view is within frame bounds
     * @returns {boolean} true if view is within frame
     */
    isViewWithinFrame() {
        return this.viewFrame.contains(this.viewArea.leftTop()) &&
               this.viewFrame.contains(this.viewArea.rightBottom());
    }

    /**
     * Get scroll offset from frame
     * @returns {pdg.Offset} Scroll offset
     */
    getScrollOffset() {
        return new pdg.Offset(
            this.viewArea.left - this.viewFrame.left,
            this.viewArea.top - this.viewFrame.top
        );
    }

    /**
     * Set scroll offset
     * @param {pdg.Offset} offset - Scroll offset
     */
    setScrollOffset(offset) {
        const scrollOffset = this.getScrollOffset();
        const deltaX = offset.x - scrollOffset.x;
        const deltaY = offset.y - scrollOffset.y;
        this.moveView(deltaX, deltaY);
    }

    /**
     * Scroll to a specific position within the view
     * @param {pdg.Point} position - Position to scroll to
     */
    scrollTo(position) {
        const offset = new pdg.Offset(
            position.x - this.viewArea.left,
            position.y - this.viewArea.top
        );
        this.setScrollOffset(offset);
    }

    /**
     * Scroll by a delta amount
     * @param {pdg.Offset} delta - Delta to scroll by
     */
    scrollBy(delta) {
        this.moveView(delta.x, delta.y);
    }

    /**
     * Get maximum scroll offset
     * @returns {pdg.Offset} Maximum scroll offset
     */
    getMaxScrollOffset() {
        const maxX = Math.max(0, this.viewArea.width() - this.viewFrame.width());
        const maxY = Math.max(0, this.viewArea.height() - this.viewFrame.height());
        return new pdg.Offset(maxX, maxY);
    }

    /**
     * Get minimum scroll offset
     * @returns {pdg.Offset} Minimum scroll offset
     */
    getMinScrollOffset() {
        const minX = Math.min(0, this.viewFrame.width() - this.viewArea.width());
        const minY = Math.min(0, this.viewFrame.height() - this.viewArea.height());
        return new pdg.Offset(minX, minY);
    }

    /**
     * Check if scrolling is needed
     * @returns {boolean} true if scrolling is needed
     */
    isScrollingNeeded() {
        const maxOffset = this.getMaxScrollOffset();
        const minOffset = this.getMinScrollOffset();
        return maxOffset.x > 0 || maxOffset.y > 0 || minOffset.x < 0 || minOffset.y < 0;
    }

    /**
     * Get scroll percentage (0.0 to 1.0)
     * @returns {pdg.Offset} Scroll percentage
     */
    getScrollPercentage() {
        const offset = this.getScrollOffset();
        const maxOffset = this.getMaxScrollOffset();
        const minOffset = this.getMinScrollOffset();
        
        let percentX = 0.0;
        let percentY = 0.0;
        
        if (maxOffset.x > minOffset.x) {
            percentX = (offset.x - minOffset.x) / (maxOffset.x - minOffset.x);
        }
        
        if (maxOffset.y > minOffset.y) {
            percentY = (offset.y - minOffset.y) / (maxOffset.y - minOffset.y);
        }
        
        return new pdg.Offset(percentX, percentY);
    }

    /**
     * Set scroll percentage (0.0 to 1.0)
     * @param {pdg.Offset} percentage - Scroll percentage
     */
    setScrollPercentage(percentage) {
        const maxOffset = this.getMaxScrollOffset();
        const minOffset = this.getMinScrollOffset();
        
        const offsetX = minOffset.x + percentage.x * (maxOffset.x - minOffset.x);
        const offsetY = minOffset.y + percentage.y * (maxOffset.y - minOffset.y);
        
        this.setScrollOffset(new pdg.Offset(offsetX, offsetY));
    }

    /**
     * Get visible area of the view within the frame
     * @returns {pdg.Rect} Visible area
     */
    getVisibleArea() {
        return this.viewArea.intersection(this.viewFrame);
    }

    /**
     * Get auto adjust setting
     * @returns {number} Auto adjust setting
     */
    getAutoAdjust() {
        return this.autoAdjust;
    }

    /**
     * Check if view is at top of frame
     * @returns {boolean} true if at top
     */
    isAtTop() {
        return this.viewArea.top <= this.viewFrame.top;
    }

    /**
     * Check if view is at bottom of frame
     * @returns {boolean} true if at bottom
     */
    isAtBottom() {
        return this.viewArea.bottom >= this.viewFrame.bottom;
    }

    /**
     * Check if view is at left of frame
     * @returns {boolean} true if at left
     */
    isAtLeft() {
        return this.viewArea.left <= this.viewFrame.left;
    }

    /**
     * Check if view is at right of frame
     * @returns {boolean} true if at right
     */
    isAtRight() {
        return this.viewArea.right >= this.viewFrame.right;
    }

    /**
     * Scroll to top
     */
    scrollToTop() {
        this.viewArea.top = this.viewFrame.top;
        this.viewArea.bottom = this.viewArea.top + this.viewArea.height();
    }

    /**
     * Scroll to bottom
     */
    scrollToBottom() {
        this.viewArea.bottom = this.viewFrame.bottom;
        this.viewArea.top = this.viewArea.bottom - this.viewArea.height();
    }

    /**
     * Scroll to left
     */
    scrollToLeft() {
        this.viewArea.left = this.viewFrame.left;
        this.viewArea.right = this.viewArea.left + this.viewArea.width();
    }

    /**
     * Scroll to right
     */
    scrollToRight() {
        this.viewArea.right = this.viewFrame.right;
        this.viewArea.left = this.viewArea.right - this.viewArea.width();
    }
}

module.exports = {
    ScrollingView,
    ScrollingViewBindType
};
