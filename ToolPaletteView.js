// -----------------------------------------------
// ToolPaletteView.js
// 
// Tool palette view with buttons for each drawing tool
//
// (c) 2025, Ed Zavada
// -----------------------------------------------

const View = require('./index').View;
const Tools = require('./index').Tools;

// -----------------------------------------------
// Tool Palette View
//
// Creates a horizontal toolbar with buttons for each tool
// -----------------------------------------------

class ToolPaletteView extends View {

    static TOOL_PALETTE_VIEW_ID = 50;
    
    constructor(controller, rect) {
        super(controller, rect);
        
        this.activeTool = Tools.TOOLS.SELECT;
        this.setID(ToolPaletteView.TOOL_PALETTE_VIEW_ID);
        const viewArea = this.getViewArea();
        let i = 1;
        let x = viewArea.left;
        for (const whichTool in Tools.TOOLS) {
            this.addClickablePart(new pdg.Rect(x, viewArea.top, x + 50, viewArea.top + 50), i++);
            x += 50;
        }
    }

    drawSelf(port, frameNum) {
        const viewArea = this.getViewArea();
        
        // Draw background
        port.fillRect(viewArea, new pdg.Color(0.9, 0.9, 0.9, 1.0));
        
        // Draw border
        port.frameRect(viewArea, new pdg.Color(0.7, 0.7, 0.7, 1.0), 1);
        
        let x = viewArea.left;
        const toolColor = new pdg.Color(0.2, 0.2, 0.2, 1.0);
        let i = 0;
        for (const whichTool in Tools.TOOLS) {
            const tool = Tools.TOOLS[whichTool];
            let toolShortcut = tool.toUpperCase()[0];
            if (tool == this.activeTool) {
                port.fillRect(new pdg.Rect(x+1, viewArea.top+1, x + 49, viewArea.top + 49), new pdg.Color(0.8, 0.8, 0.8, 1.0));
            }
            switch (tool) {
                case Tools.TOOLS.SELECT:
                    toolShortcut = 'esc';
                    port.drawText('+', new pdg.Point(x + 25, viewArea.top + 30), 20, pdg.textStyle_Centered, toolColor);
                    break;
                case Tools.TOOLS.LINE:
                    port.drawLine(new pdg.Point(x + 10, viewArea.top + 35), new pdg.Point(x + 40, viewArea.top + 10), toolColor, 2.0);
                    break;
                case Tools.TOOLS.CIRCLE:
                    port.frameCircle(new pdg.Point(x + 25, viewArea.top + 25), 15, toolColor, 2.0);
                    break;
                case Tools.TOOLS.OVAL:
                    port.frameOval(new pdg.Point(x + 25, viewArea.top + 25), 18, 12, toolColor, 2.0);
                    break;
                case Tools.TOOLS.RECT:
                    const r = new pdg.Rect(x + 10, viewArea.top + 10, x + 40, viewArea.top + 35);
                    port.frameRect(r, toolColor, 2.0);
                    break;
                case Tools.TOOLS.SPLINE:
                    const spline = new pdg.Spline(pdg.spline_Hermite);
                    spline.initialize(new pdg.Point(x + 10, viewArea.top + 10), // start point
                                    new pdg.Point(x + 40, viewArea.top + 40), // end point
                                    new pdg.Point(x + 40, viewArea.top + 35), // control point 1
                                    new pdg.Point(x + 10, viewArea.top + 10)); // control point 2
                    port.drawSpline(spline, toolColor, 2.0);
                    break;
                case Tools.TOOLS.POLY:
                    const poly = new pdg.Polygon();
                    poly.addPoint(new pdg.Point(x + 15, viewArea.top + 10));
                    poly.addPoint(new pdg.Point(x + 35, viewArea.top + 10));
                    poly.addPoint(new pdg.Point(x + 40, viewArea.top + 35));
                    poly.addPoint(new pdg.Point(x + 25, viewArea.top + 30));
                    poly.addPoint(new pdg.Point(x + 10, viewArea.top + 35));
                    port.framePolygon(poly, toolColor, 2.0);
                    break;
                case Tools.TOOLS.IMAGE:
                    port.drawText('IMG', new pdg.Point(x + 25, viewArea.top + 30), 20, pdg.textStyle_Centered, toolColor);
                    break;
                case Tools.TOOLS.QUAD:
                    const r2 = new pdg.Rect(x + 10, viewArea.top + 10, x + 40, viewArea.top + 35);
                    const quad = new pdg.Quad(r2);
                    quad.points[0].x += 5;
                    quad.points[2].x -= 5;
                    port.frameRect(quad, toolColor, 2.0);
                    break;
                default:
                    port.drawText(tool, new pdg.Point(x + 25, viewArea.top + 30), 10, pdg.textStyle_Centered, toolColor);
            }
            port.drawText(toolShortcut, new pdg.Point(x + 2, viewArea.top + 10), 9, pdg.textStyle_Plain, toolColor);
            x += 50;
            port.drawLine(new pdg.Point(x, viewArea.top), new pdg.Point(x, viewArea.top + 50), toolColor);
        }
        
        // Draw clickable parts for debugging
        this.drawClickableParts();
    }

    updateToolSelection(selectedToolId) {
        this.activeTool = selectedToolId;
    }

}

module.exports = ToolPaletteView;
