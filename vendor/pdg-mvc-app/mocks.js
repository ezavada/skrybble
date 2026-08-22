// -----------------------------------------------
// mocks.js
// 
// Mock classes for testing the JavaScript Application Framework
// These mock the PDG engine classes for unit testing
//
// Ported from C++ by Assistant, 2024
// Original Copyright (c) 2004-2012, Dream Rock Studios, LLC
// -----------------------------------------------

// Set PDG_DEBUG_MOCKS=1 to log mock draw calls (off by default to keep test output quiet)
const mockLog = (...args) => {
  if (process.env.PDG_DEBUG_MOCKS === '1') {
    console.log(...args);
  }
};

class MockPdg {

    static all_events = 0;
    static eventType_Shutdown = 2;
    static eventType_Timer = 3;
    static eventType_KeyDown = 4;
    static eventType_KeyUp = 5;
    static eventType_KeyPress = 6;
    static eventType_MouseDown = 7;
    static eventType_MouseUp = 8;
    static eventType_MouseMove = 9;
    static eventType_MouseEnter = 22;
    static eventType_MouseLeave = 23;
    static eventType_PortResized = 15;
    static eventType_ScrollWheel = 16;
    static eventType_SoundEvent = 14;
    static eventType_PortDraw = 24;
    static key_Home = 2;
    static key_End = 3;
    static key_Clear = 4;
    static key_Help = 5;
    static key_Pause = 6;
    static key_Mute = 7;
    static key_Backspace = 8;
    static key_Delete = 127;
    static key_Tab = 9;
    static key_PageUp = 11;
    static key_PageDown = 12;
    static key_Return = 13;
    static key_Enter = 13;

    constructor() {
        this.evt = new MockEventManager();
        this.res = new MockResourceManager();
        this.tm = new MockTimerManager();
        this.gfx = new MockGraphicsManager();
        this.lm = new MockLogManager();
        this.cfg = new MockConfigManager();
    }

    on (eventType, func) {
        return this.evt.on(eventType, func);
    }
    onShutdown (func) {
        return this.evt.onShutdown(func);
    }
    onTimer (func) {
        return this.evt.onTimer(func);
    }
    onKeyDown (func) {
        return this.evt.onKeyDown(func);
    }
    onKeyUp (func) {
        return this.evt.onKeyUp(func);
    }
    onKeyPress (func) {
        return this.evt.onKeyPress(func);
    }
    onMouseDown (func) {
        return this.evt.onMouseDown(func);
    }
    onMouseUp (func) {
        return this.evt.onMouseUp(func);
    }
    onMouseMove (func) {
        return this.evt.onMouseMove(func);
    }

}

// Mock classes for testing (in a real implementation, these would be actual PDG classes)
class MockEventManager {
    constructor() {
        this.handlers = new Map();
    }
    
    addHandler(handler, eventType) {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, []);
        }
        this.handlers.get(eventType).push(handler);
    }
    
    removeHandler(handler, eventType) {
        if (this.handlers.has(eventType)) {
            const handlers = this.handlers.get(eventType);
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    // Add on*() methods for more JavaScript-idiomatic event handling
    onShutdown(callback) {
        return { callback, eventType: MockPdg.eventType_Shutdown };
    }
    
    onKeyDown(callback) {
        return { callback, eventType: MockPdg.eventType_KeyDown };
    }
    
    onKeyUp(callback) {
        return { callback, eventType: MockPdg.eventType_KeyUp };
    }
    
    onKeyPress(callback) {
        return { callback, eventType: MockPdg.eventType_KeyPress };
    }
    
    onTimer(callback) {
        return { callback, eventType: MockPdg.eventType_Timer };
    }
    
    onMouseDown(callback) {
        return { callback, eventType: MockPdg.eventType_MouseDown };
    }
    
    onMouseUp(callback) {
        return { callback, eventType: MockPdg.eventType_MouseUp };
    }
    
    onMouseMove(callback) {
        return { callback, eventType: MockPdg.eventType_MouseMove };
    }
}

class MockResourceManager {
    constructor() {
        this.strings = new Map();
        this.images = new Map();
    }
    
    getString(id, index = 0) {
        const key = `${id}_${index}`;
        return this.strings.get(key) || `String_${key}`;
    }
    
    getImage(id, index = 0) {
        const key = `${id}_${index}`;
        return this.images.get(key) || null;
    }
}

class MockGraphicsManager {
    constructor() {
        this.mainPort = new MockPort();
    }
    
    getMainPort() {
        return this.mainPort;
    }
}

class MockPort {
    constructor() {
        this.drawingArea = new pdg.Rect(0, 0, 800, 600);
        this.clipRect = new pdg.Rect(0, 0, 0, 0);
    }
    
    getDrawingArea() {
        return this.drawingArea;
    }
    
    getClipRect() {
        return this.clipRect;
    }
    
    setClipRect(rect) {
        this.clipRect = rect;
    }
    
    fillRect(rect, color) {
        mockLog(`fillRect: ${rect.width()}x${rect.height()} at (${rect.left}, ${rect.top}) with color`, color);
    }
    
    frameRect(rect, color, width = 1) {
        mockLog(`frameRect: ${rect.width()}x${rect.height()} at (${rect.left}, ${rect.top}) with color`, color, `width=${width}`);
    }
    
    drawText(text, point, size, style, color) {
        mockLog(`drawText: "${text}" at (${point.x}, ${point.y}) size=${size} style=${style}`, color);
    }
    
    drawImage(image, point, rect) {
        mockLog(`drawImage: at (${point.x}, ${point.y}) rect=`, rect);
    }
    
    drawLine(from, to, color, width) {
        mockLog(`drawLine: from (${from.x}, ${from.y}) to (${to.x}, ${to.y})`, color, `width=${width}`);
    }
    
    // New Renderer API methods
    drawRect(rect, attrs) {
        mockLog(`drawRect: ${rect.width()}x${rect.height()} at (${rect.left}, ${rect.top}) with attrs`, attrs);
    }
    
    drawQuad(quad, attrs) {
        mockLog(`drawQuad: with attrs`, attrs);
    }
    
    drawPolygon(polygon, attrs) {
        mockLog(`drawPolygon: with attrs`, attrs);
    }
    
    drawEllipse(center, xRadius, yRadius, attrs) {
        mockLog(`drawEllipse: center (${center.x}, ${center.y}) xRadius=${xRadius} yRadius=${yRadius} with attrs`, attrs);
    }
    
    drawArc(center, xRadius, yRadius, startAngle, endAngle, attrs) {
        mockLog(`drawArc: center (${center.x}, ${center.y}) xRadius=${xRadius} yRadius=${yRadius} startAngle=${startAngle} endAngle=${endAngle} with attrs`, attrs);
    }
    
    drawSpline(spline, attrs) {
        mockLog(`drawSpline: with attrs`, attrs);
    }
    
    drawCircle(center, radius, attrs) {
        mockLog(`drawCircle: center (${center.x}, ${center.y}) radius=${radius} with attrs`, attrs);
    }
    
    drawRoundedRect(rect, radius, attrs) {
        mockLog(`drawRoundedRect: ${rect.width()}x${rect.height()} at (${rect.left}, ${rect.top}) radius=${radius} with attrs`, attrs);
    }
    
    getTextWidth(text, size, style) {
        // Mock text width calculation (approximate: 6 pixels per character)
        const textWidth = text.length * size * 0.6;
        mockLog(`getTextWidth: "${text}" size=${size} style=${style} -> ${textWidth}px`);
        return textWidth;
    }
}

// Export all mock classes
module.exports = {
    MockPdg,
    MockEventManager,
    MockResourceManager,
    MockGraphicsManager,
    MockPort,
};
