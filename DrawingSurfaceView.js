// -----------------------------------------------
// DrawingSurfaceView.js
// 
// Drawing Application using the PDG JavaScript MVC Framework
//
// (c) 2025, Ed Zavada
// -----------------------------------------------

const View = require('./index').View;
const {cameraPort} = require('./rendering');

// -----------------------------------------------
// Drawing Surface View
//
// just fills the area with white
// -----------------------------------------------

class DrawingSurfaceView extends View {
    constructor(controller, rect, binding = 0) {
        super(controller, rect, binding);
        this.selectionAppearance = new pdg.AnimatedAttributes().lineColor(new pdg.Color('blue')).lineThickness(1);
        this.notificationAppearance = new pdg.AnimatedAttributes();
    }

    doScrollWheel(event) { return this.controller.doScrollWheel(event); }

    startSelectionPulse() {
        const a=this.selectionAppearance;
        a.cancelSchedule().lineOpacity(1);
        if (!DrawingSurfaceView._pulseDefined) {
            pdg.Animated.defineScript('skrybble-selection-pulse').series()
                .changeLineOpacity(.25,.125).andThen().changeLineOpacity(1,.125)
                .endSeries().repeat().endScript();
            DrawingSurfaceView._pulseDefined=true;
        }
        a.playScript('skrybble-selection-pulse');
    }
    stopSelectionPulse() { this.selectionAppearance.cancelSchedule(); }
    showNotification(message) {
        this._notificationMessage=message;
        this._notificationDrawing=null;
        const a=this.notificationAppearance;
        a.cancelSchedule().fillOpacity(1).lineOpacity(1);
        a.wait(1.5).andThen().changeFillOpacity(0,.5).changeLineOpacity(0,.5);
    }
    animate(seconds) {
        const changed=super.animate(seconds);
        this.selectionAppearance.animate(seconds);
        this.notificationAppearance.animate(seconds);
        this.controller.textEdit?.editor.animate(seconds);
        if (this._notificationMessage && this.notificationAppearance.getFillOpacity()<=0) {
            this._notificationMessage=null; this.controller.saveMessage=null;
        }
        return changed;
    }
    drawSelf(port, frameNum) {
        const area=this.getViewArea(), controller=this.controller;
        controller.navigation.setViewport(area);
        port.drawRect(area,new pdg.Attributes().fillColor(new pdg.Color('#d8dce2')));
        const canvas=cameraPort(port,controller.navigation.camera);
        const page=new pdg.Rect(0,0,1024,1024);
        const savedClip=port.getClipRect();
        const a=controller.navigation.toView({x:0,y:0}), b=controller.navigation.toView({x:1024,y:1024});
        const pageClip=new pdg.Rect(a.x,a.y,b.x,b.y).intersection(area).intersection(savedClip);
        port.setClipRect(pageClip);
        try {
            canvas.drawRect(page,new pdg.Attributes().fillColor(new pdg.Color('white')));
            for (const shape of controller.getDrawing().getShapes()) shape.draw(canvas);
            const current=controller.getToolManager().getCurrentShape();
            if (current) current.draw(canvas);
            if (controller.textEdit && controller.textEdit.isNew) controller.textEdit.shape.draw(canvas);
            if (controller.textEdit) controller.textEdit.editor.drawOverlay(canvas);
            if (controller.rubberBandActive) {
                const start=controller.rubberBandStart,end=controller.rubberBandEnd;
                const rect=new pdg.Rect(Math.min(start.x,end.x),Math.min(start.y,end.y),
                    Math.max(start.x,end.x),Math.max(start.y,end.y));
                const attrs=new pdg.Attributes().lineColor(new pdg.Color('blue'))
                    .lineOpacity(this.selectionAppearance.getLineOpacity()).lineThickness(1);
                canvas.drawRect(rect,attrs);
            }
        } finally { port.setClipRect(savedClip); }
        // Retain static overlay geometry until the layout changes.
        const layout=[area.left,area.top,area.right,area.bottom].join(',');
        if (this._notificationMessage) {
            if (!this._notificationDrawing || this._notificationLayout!==layout) {
                this._notificationDrawing=pdg.createDrawing();
                const x=area.left+area.width()/2, y=area.top+area.height()/2;
                const w=port.getTextWidth(this._notificationMessage,18)+40;
                const rect=new pdg.Rect(x-w/2,y-30,x+w/2,y+30);
                const bg=new pdg.AnimatedAttributes().fillColor(new pdg.Color(.2,.6,.2,.9)).roundedCorners(10);
                const label=new pdg.AnimatedAttributes().textSize(18).textStyle(pdg.textStyle_Centered).fillColor(new pdg.Color('white'));
                this._notificationStyles=[bg,label];
                this._notificationDrawing.addRect(rect,bg).setLiveAttributes(bg);
                this._notificationDrawing.addText(this._notificationMessage,rect,label).setLiveAttributes(label);
                this._notificationLayout=layout;
            }
            for (const attrs of this._notificationStyles) attrs.fillOpacity(this.notificationAppearance.getFillOpacity());
            port.drawDrawing(this._notificationDrawing,new pdg.Point(0,0),new pdg.Attributes());
        }
        port.drawText(controller.textEdit ? 'Type text · Enter to accept · Esc to cancel' : `${Math.round(controller.navigation.camera.getZoom()*100)}% · 1024 × 1024`,
            new pdg.Point(area.left+8,area.bottom-8),new pdg.Attributes().textSize(12).fillColor(new pdg.Color('#475569')));
    }

    drawHelp(port, area) {
        const layout = [area.left, area.top, area.right, area.bottom].join(',');
        if (!this._helpImage || this._helpLayout !== layout) {
            const surface = pdg.gfx.createOffscreenPort(new pdg.Rect(Math.ceil(area.width()), Math.ceil(area.height())));
            if (!surface) throw new Error('Cannot create help rendering surface');
            try {
                surface.setDrawingOrigin(area.leftTop());
                for (let style = 0; style < 8; style++) surface.setFontForStyle(style, port.getCurrentFont(style));
                surface.clear();
                this.drawHelpOverlay(surface, area);
                this._helpImage = new pdg.Image(surface, pdg.CopyPixels);
                this._helpLayout = layout;
            } finally { pdg.gfx.closeGraphicsPort(surface); }
        }
        const clip = port.getClipRect(), cameraDrawing = port.getCameraDrawingEnabled();
        try {
            port.setClipRect(area);
            port.setCameraDrawingEnabled(false);
            port.drawImage(this._helpImage, area, new pdg.Attributes().fitType(pdg.fit_Fill));
        } finally {
            port.setCameraDrawingEnabled(cameraDrawing);
            port.setClipRect(clip);
        }
    }

    drawHelpOverlay(port, area) {
        // Draw semi-transparent background
        const bgAttrs = new pdg.Attributes().fillColor(new pdg.Color(0, 0, 0, 0.8));
        port.drawRect(area, bgAttrs);
        
        // Define keyboard shortcuts to display
        const shortcuts = [
            { key: 'ESC', description: 'Select tool / Finish drawing' },
            ...Object.entries(require('./tools').TOOL_SHORTCUTS).map(([key,tool])=>({key,
                description:require('./tools').TOOL_NAMES[tool]})),
            { key: 'WHEEL', description: 'Zoom at selection / pointer' },
            { key: 'Z / SHIFT+Z', description: 'Zoom in / out' },
            { key: 'CTRL/CMD+0', description: 'Reset view to 100%' },
            { key: 'SHIFT+DRAG', description: 'Constrain shapes, rotation, movement' },
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
            { key: 'CMD/CTRL+G', description: 'Group selected shapes' },
            { key: 'CMD/CTRL+SHIFT+G', description: 'Ungroup selected groups' },
            { key: 'CMD/CTRL+Z', description: 'Undo' },
            { key: 'CMD/CTRL+SHIFT+Z', description: 'Redo' },
            { key: 'CMD/CTRL+O', description: 'Open drawing' },
            { key: 'CMD/CTRL+S', description: 'Save drawing' },
            { key: '', description: '' },
            { key: '+/=', description: 'Move shape forward' },
            { key: '-', description: 'Move shape backward' },
            { key: 'CMD/CTRL++', description: 'Move shape to front' },
            { key: 'CMD/CTRL+-', description: 'Move shape to back' }
        ];
        
        // Measure complete columns, then choose a font that fits the window.
        // Native point-based text preserves glyph proportions and baselines.
        const items = shortcuts.filter(item => item.key).map(item => ({
            key: item.key.replace(/CMD\/CTRL|CTRL\/CMD/g, 'Ctrl').replace(/SHIFT/g, 'Shift'),
            description: item.description
        }));
        const rows = Math.ceil(items.length / 2);
        const padding = 16, gap = 20;
        const columnWidth = (area.width() - padding * 2 - gap) / 2;
        const measure = (value, size) => port.getTextWidth(value, size);
        const keyWidthAt14 = Math.max(...items.map(item => measure(item.key, 14)));
        const descWidthAt14 = Math.max(...items.map(item => measure(item.description, 14)));
        const textSize = Math.min(14, 14 * (columnWidth - 12) / (keyWidthAt14 + descWidthAt14),
            (area.height() - 110) / rows / 1.5);
        const keyWidth = Math.max(...items.map(item => measure(item.key, textSize))) + 12;
        const lineHeight = Math.max(textSize * 1.5, Math.min(22, (area.height() - 110) / rows));
        const centerX = area.left + area.width() / 2;
        port.drawText('Keyboard Shortcuts', new pdg.Point(centerX, area.top + 34),
            new pdg.Attributes().textSize(Math.min(24, textSize * 1.8)).textStyle(pdg.textStyle_Centered)
                .fillColor(new pdg.Color('white')));
        port.drawText('Ctrl shortcuts also use Cmd on macOS', new pdg.Point(centerX, area.top + 56),
            new pdg.Attributes().textSize(textSize).textStyle(pdg.textStyle_Centered)
                .fillColor(new pdg.Color('#cbd5e1')));
        const keyAttrs = new pdg.Attributes().textSize(textSize).fillColor(new pdg.Color('#cce5ff'));
        const descAttrs = new pdg.Attributes().textSize(textSize).fillColor(new pdg.Color('#eeeeee'));
        items.forEach((item, index) => {
            const column = Math.floor(index / rows), row = index % rows;
            const x = area.left + padding + column * (columnWidth + gap);
            const y = area.top + 84 + row * lineHeight;
            port.drawText(item.key, new pdg.Point(x, y), keyAttrs);
            port.drawText(item.description, new pdg.Point(x + keyWidth, y), descAttrs);
        });
        port.drawText('Press ? or Esc to close', new pdg.Point(centerX, area.bottom - 16),
            new pdg.Attributes().textSize(textSize).textStyle(pdg.textStyle_Centered)
                .fillColor(new pdg.Color('#fff099')));

    }

}

module.exports = DrawingSurfaceView;
