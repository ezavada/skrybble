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
        port.drawRect(viewArea, new pdg.Attributes().fillColor(new pdg.Color(0.9, 0.9, 0.9, 1.0)));
        
        // Draw border
        port.drawRect(viewArea, new pdg.Attributes().lineColor(new pdg.Color(0.7, 0.7, 0.7, 1.0)).lineThickness(1));
        
        let x = viewArea.left;
        const toolColor = new pdg.Color(0.2, 0.2, 0.2, 1.0);
        let i = 0;
        for (const whichTool in Tools.TOOLS) {
            const tool = Tools.TOOLS[whichTool];
            let toolShortcut = tool.toUpperCase()[0];
            if (tool === Tools.TOOLS.HELP) {
                toolShortcut = 'H';
            }
            if (tool === Tools.TOOLS.FILL_COLOR) {
                toolShortcut = 'M';
            }
            if (tool === Tools.TOOLS.LINE_COLOR) {
                toolShortcut = 'N';
            }
            if (tool === Tools.TOOLS.LINE_WIDTH) {
                toolShortcut = 'W';
            }
            if (tool === Tools.TOOLS.SMOOTHNESS) {
                toolShortcut = 'U';
            }
            if (tool == this.activeTool) {
                port.drawRect(new pdg.Rect(x+1, viewArea.top+1, x + 49, viewArea.top + 49), 
                    new pdg.Attributes().fillColor(new pdg.Color(0.8, 0.8, 0.8, 1.0)));
            }
            switch (tool) {
                case Tools.TOOLS.SELECT:
                    toolShortcut = 'esc';
                    port.drawText('+', new pdg.Point(x + 25, viewArea.top + 30), 
                        new pdg.Attributes().textSize(20).textStyle(pdg.textStyle_Centered).fillColor(toolColor));
                    break;
                case Tools.TOOLS.LINE:
                    port.drawLine(new pdg.Point(x + 10, viewArea.top + 35), new pdg.Point(x + 40, viewArea.top + 10), 
                        new pdg.Attributes().lineColor(toolColor).lineThickness(2.0).lineOpacity(0.75));
                    port.drawLine(new pdg.Point(x + 9.5, viewArea.top + 35), new pdg.Point(x + 39.5, viewArea.top + 10), 
                        new pdg.Attributes().lineColor(toolColor).lineThickness(2.0).lineOpacity(0.25));
                    port.drawLine(new pdg.Point(x + 10.5, viewArea.top + 35), new pdg.Point(x + 40.5, viewArea.top + 10), 
                        new pdg.Attributes().lineColor(toolColor).lineThickness(2.0).lineOpacity(0.25));
                    break;
                case Tools.TOOLS.CIRCLE:
                    port.drawCircle(new pdg.Point(x + 25, viewArea.top + 25), 15, 
                        new pdg.Attributes().lineColor(toolColor).lineThickness(2.0));
                    break;
                case Tools.TOOLS.OVAL:
                    port.drawEllipse(new pdg.Point(x + 25, viewArea.top + 25), 18, 12, 
                        new pdg.Attributes().lineColor(toolColor).lineThickness(2.0));
                    break;
                case Tools.TOOLS.RECT:
                    const r = new pdg.Rect(x + 10, viewArea.top + 10, x + 40, viewArea.top + 35);
                    port.drawRect(r, new pdg.Attributes().lineColor(toolColor).lineThickness(2.0));
                    break;
                case Tools.TOOLS.SPLINE:
                case Tools.TOOLS.BEZIER:
                    const p1 = new pdg.Point(x + 10, viewArea.top + 10);
                    const p2 = new pdg.Point(x + 40, viewArea.top + 35);
                    const v1 = new pdg.Vector(160, 10); // 
                    const v2 = new pdg.Vector(190, 10);
                    const spline = new pdg.Spline(pdg.spline_Hermite);
                    spline.addSegment(p1, p2, v1, v2);
                    port.drawSpline(spline, new pdg.Attributes().lineColor(toolColor).lineThickness(2.0));
                    port.drawCircle(new pdg.Point(x + 12, viewArea.top + 10), 2, new pdg.Attributes().fillColor(new pdg.Color('red')));
                    port.drawCircle(new pdg.Point(x + 40, viewArea.top + 35), 2, new pdg.Attributes().fillColor(new pdg.Color('red')));
                    if (tool == Tools.TOOLS.SPLINE) {
                        // draw additional points on spline
                        port.drawCircle(new pdg.Point(x + 28, viewArea.top + 14), 2, new pdg.Attributes().fillColor(new pdg.Color('red')));
                        port.drawCircle(new pdg.Point(x + 16, viewArea.top + 29), 2, new pdg.Attributes().fillColor(new pdg.Color('red')));
                    } else if (tool == Tools.TOOLS.BEZIER) {
                        // draw bezier control points
                        port.drawCircle(new pdg.Point(x + 38, viewArea.top + 10), 2, new pdg.Attributes().fillColor(new pdg.Color('green')));
                        port.drawCircle(new pdg.Point(x + 8, viewArea.top + 33), 2, new pdg.Attributes().fillColor(new pdg.Color('green')));
                    }
                    break;
                case Tools.TOOLS.POLY:
                    const poly = new pdg.Polygon();
                    poly.addPoint(new pdg.Point(x + 15, viewArea.top + 10));
                    poly.addPoint(new pdg.Point(x + 35, viewArea.top + 10));
                    poly.addPoint(new pdg.Point(x + 40, viewArea.top + 35));
                    poly.addPoint(new pdg.Point(x + 25, viewArea.top + 30));
                    poly.addPoint(new pdg.Point(x + 10, viewArea.top + 35));
                    port.drawPolygon(poly, new pdg.Attributes().lineColor(toolColor).lineThickness(2.0));
                    break;
                case Tools.TOOLS.IMAGE:
                    port.drawText('IMG', new pdg.Point(x + 25, viewArea.top + 30), 
                        new pdg.Attributes().textSize(20).textStyle(pdg.textStyle_Centered).fillColor(toolColor));
                    break;
                case Tools.TOOLS.QUAD:
                    const r2 = new pdg.Rect(x + 10, viewArea.top + 10, x + 40, viewArea.top + 35);
                    const quad = new pdg.Quad(r2);
                    quad.points[0].x += 5;
                    quad.points[2].x -= 5;
                    port.drawQuad(quad, new pdg.Attributes().lineColor(toolColor).lineThickness(2.0));
                    break;
                case Tools.TOOLS.FREEHAND:
                    // Draw a question mark
                    port.drawText('✎', new pdg.Point(x + 38, viewArea.top + 35), 
                        new pdg.Attributes().textSize(32).textStyle(pdg.textStyle_Centered).fillColor(toolColor));
                    break;
                case Tools.TOOLS.FILL_COLOR:
                    // Draw a filled square icon with current fill color
                    const fillRect = new pdg.Rect(x + 12, viewArea.top + 12, x + 38, viewArea.top + 38);
                    // Get color from selected shape if available, otherwise use default
                    let currentFillColor = this.controller.getToolManager().fillColor || 'white';
                    const selectedShapes = this.controller.getDrawing().getShapes().filter(s => s.selected);
                    if (selectedShapes.length > 0 && selectedShapes[0].fillColor) {
                        currentFillColor = selectedShapes[0].fillColor;
                    }
                    port.drawRect(fillRect, new pdg.Attributes().fillColor(new pdg.Color(currentFillColor))
                        .lineColor(toolColor).lineThickness(1).lineOpacity(0.5).lineStyle(pdg.lineStyle_Solid));
                    break;
                case Tools.TOOLS.LINE_COLOR:
                    // Draw a line with current stroke color and black dots on ends
                    let currentStrokeColor = this.controller.getToolManager().strokeColor || 'black';
                    const selectedShapesForStroke = this.controller.getDrawing().getShapes().filter(s => s.selected);
                    if (selectedShapesForStroke.length > 0 && selectedShapesForStroke[0].strokeColor) {
                        currentStrokeColor = selectedShapesForStroke[0].strokeColor;
                    }
                    port.drawLine(new pdg.Point(x + 10, viewArea.top + 25), new pdg.Point(x + 40, viewArea.top + 25), 
                        new pdg.Attributes().lineColor(new pdg.Color(currentStrokeColor)).lineThickness(3));
                    // Draw small black dots on both ends
                    port.drawCircle(new pdg.Point(x + 10, viewArea.top + 25), 3, 
                        new pdg.Attributes().fillColor(new pdg.Color('black')));
                    port.drawCircle(new pdg.Point(x + 40, viewArea.top + 25), 3, 
                        new pdg.Attributes().fillColor(new pdg.Color('black')));
                    break;
                case Tools.TOOLS.LINE_WIDTH:
                    // Draw stacked horizontal lines at different thicknesses
                    port.drawLine(new pdg.Point(x + 15, viewArea.top + 15), new pdg.Point(x + 35, viewArea.top + 15), 
                        new pdg.Attributes().lineColor(toolColor).lineThickness(0.5));
                    port.drawLine(new pdg.Point(x + 15, viewArea.top + 20), new pdg.Point(x + 35, viewArea.top + 20), 
                        new pdg.Attributes().lineColor(toolColor).lineThickness(1.5));
                    port.drawLine(new pdg.Point(x + 15, viewArea.top + 27), new pdg.Point(x + 35, viewArea.top + 27), 
                        new pdg.Attributes().lineColor(toolColor).lineThickness(3.0));
                    port.drawLine(new pdg.Point(x + 15, viewArea.top + 36), new pdg.Point(x + 35, viewArea.top + 36), 
                        new pdg.Attributes().lineColor(toolColor).lineThickness(5.0));
                    break;
                case Tools.TOOLS.SMOOTHNESS:
                    // Draw a wavy/irregular line to represent smoothness
                    const wavyPoints = [];
                    for (let wx = 0; wx <= 20; wx += 2) {
                        const wy = Math.sin(wx * 0.8) * 3;
                        wavyPoints.push(new pdg.Point(x + 15 + wx, viewArea.top + 25 + wy));
                    }
                    for (let wp = 0; wp < wavyPoints.length - 1; wp++) {
                        port.drawLine(wavyPoints[wp], wavyPoints[wp + 1], 
                            new pdg.Attributes().lineColor(toolColor).lineThickness(2.0));
                    }
                    break;
                case Tools.TOOLS.HELP:
                    // Draw a question mark
                    port.drawText('?', new pdg.Point(x + 25, viewArea.top + 32), 
                        new pdg.Attributes().textSize(28).textStyle(pdg.textStyle_Centered).fillColor(toolColor));
                    break;
                default:
                    port.drawText(tool, new pdg.Point(x + 25, viewArea.top + 30), 
                        new pdg.Attributes().textSize(10).textStyle(pdg.textStyle_Centered).fillColor(toolColor));
            }
            port.drawText(toolShortcut, new pdg.Point(x + 2, viewArea.top + 10), 
                new pdg.Attributes().textSize(9).textStyle(pdg.textStyle_Plain).fillColor(toolColor));
            x += 50;
            port.drawLine(new pdg.Point(x, viewArea.top), new pdg.Point(x, viewArea.top + 50), 
                new pdg.Attributes().lineColor(toolColor).lineThickness(1));
        }
        
        // Draw clickable parts for debugging
        // this.drawClickableParts(); // Commented out - internal method uses old PDG API
    }

    updateToolSelection(selectedToolId) {
        this.activeTool = selectedToolId;
    }

}

module.exports = ToolPaletteView;
