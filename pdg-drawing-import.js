'use strict';
// Polygon drawing exchange v1 and PDG Drawing snapshots v4/v5 emitted by the
// local pose converter. Binary decoding is independent of native bindings so
// the same files work in desktop PDG and the browser's uploaded-file filesystem.
const fs = require('fs');
const Colors = require('./colors');
const LAYERS = ['light', 'midtone', 'shadow', 'ink'];
const LIMIT = 1000000;

function isPdgDrawing(filename) {
    return /\.(pdgdrawing|drawing\.json)$/i.test(filename);
}
function polygon(points, fillColor, strokeColor = null, strokeWidth = 0) {
    if (!Array.isArray(points) || points.length < 3 || points.length > LIMIT ||
        !points.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)))
        throw new Error('Invalid PDG polygon coordinates');
    return { type: 'Polygon', data: { type: 'Polygon', points: points.map(([x,y]) => ({x,y})),
        fillColor, strokeColor, strokeWidth, rotation: 0 } };
}
function document(shapes, canvas) {
    if (!shapes.length || shapes.length > LIMIT) throw new Error('Invalid PDG drawing polygon count');
    return { fileFormat: 'skrbl-v0.0.4', imageData: [], shapes, canvas };
}
function fromJSON(record) {
    if (!record || record.format !== 'pdg-polygon-drawing' || record.version !== 1 ||
        !Array.isArray(record.canvas) || record.canvas.length !== 2 ||
        !record.canvas.every(n => Number.isFinite(n) && n > 0 && n <= 100000) ||
        !Array.isArray(record.layers) || record.layers.length !== 4)
        throw new Error('Unsupported PDG polygon drawing format');
    const shapes = [];
    let pointCount = 0;
    record.layers.forEach((layer, index) => {
        if (layer.name !== LAYERS[index] || !/^#[0-9a-f]{6}$/i.test(layer.color) || !Array.isArray(layer.polygons))
            throw new Error('Invalid PDG drawing layer');
        for (const points of layer.polygons) {
            shapes.push(polygon(points, layer.color));
            pointCount += points.length;
            if (shapes.length > LIMIT || pointCount > 4000000) throw new Error('PDG drawing is too large');
        }
    });
    return document(shapes, record.canvas.slice());
}

class Reader {
    constructor(bytes) {
        if (!(bytes instanceof Uint8Array) || bytes.length > 64 * 1024 * 1024)
            throw new Error('Invalid or oversized PDG drawing stream');
        this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        this.offset = 0; this.bit = 0; this.booleanByte = 0;
    }
    number(size, method) {
        if (this.offset + size > this.view.byteLength) throw new Error('Truncated PDG drawing stream');
        const value = this.view[method](this.offset, false); this.offset += size;
        return value;
    }
    byte() { return this.number(1, 'getUint8'); }
    u16() { return this.number(2, 'getUint16'); }
    u32() { return this.number(4, 'getUint32'); }
    signed() { return this.number(4, 'getInt32'); }
    tag() { return this.byte() * 65536 + this.byte() * 256 + this.byte(); }
    float() {
        const value = this.number(4, 'getFloat32');
        if (!Number.isFinite(value)) throw new Error('Non-finite PDG drawing coordinate');
        return value;
    }
    uint() { const tag = this.byte(); return tag === 255 ? this.u32() : tag === 254 ? this.u16() : tag; }
    flag() {
        if (!this.bit) this.booleanByte = this.byte();
        const value = Boolean(this.booleanByte & (1 << this.bit));
        this.bit = (this.bit + 1) % 8;
        return value;
    }
    point() {
        if (!this.flag()) return [0,0];
        const xInt = this.flag(), yInt = this.flag();
        return [xInt ? this.uint() : this.float(), yInt ? this.uint() : this.float()];
    }
    color() {
        const alpha = this.flag() ? this.byte() : 255;
        const rgb = [this.byte(),this.byte(),this.byte()];
        return Colors.toHex({r:rgb[0]/255,g:rgb[1]/255,b:rgb[2]/255,a:alpha/255});
    }
}

function attributes(reader, version) {
    const result = { fill: null, stroke: '#000000', width: 1, style: 0 };
    if (!reader.flag()) return result;
    // Order is defined by pdg-devel/src/sys/drawing-snapshot.inc. Packed bools
    // share their cursor with color/coordinate fields throughout the stream.
    for (let i = 0; i < 7; ++i) if (reader.flag()) {
        const color = reader.color();
        if (i === 0) result.stroke = color;
        if (i === 1) result.fill = color;
    }
    const coordinateDefaults = [[1,12],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]];
    for (let i = 0; i < coordinateDefaults.length; ++i) if (reader.flag()) {
        const pair = reader.point();
        if (i === 0) result.width = pair[0];
        else if (pair.some((v,j) => v !== coordinateDefaults[i][j]))
            throw new Error('PDG polygon effects/translations are not supported');
    }
    const floatDefaults = [1,1,0,1,0,0,0,1,0,1];
    for (const fallback of floatDefaults) if (reader.flag() && reader.float() !== fallback)
        throw new Error('PDG polygon opacity/transforms are not supported');
    const integerDefaults = [0,0,0,0,0,1];
    for (let i = 0; i < integerDefaults.length; ++i) if (reader.flag()) {
        const value = reader.signed();
        if (i === 0) result.style = value;
        else if (value !== integerDefaults[i]) throw new Error('PDG polygon gradients/effects are not supported');
    }
    if (reader.flag() || reader.flag() || (version >= 5 && reader.flag()))
        throw new Error('PDG polygon clipping, textures and fonts are not supported');
    if (result.style !== 0 && result.style !== 1 && result.style !== 2)
        throw new Error('Unsupported PDG polygon stroke style');
    if (result.width < 0) throw new Error('Invalid PDG polygon stroke width');
    return result;
}

function fromPolygonBinary(bytes) {
    const reader = new Reader(bytes);
    let tag = reader.tag();
    const tagged = tag === 0x706467;
    if (tagged) tag = reader.tag();
    if (tag !== 0x6f626a || reader.u32() !== 0xffffff09)
        throw new Error('Not a PDG Drawing snapshot');
    if (tagged && reader.u16() !== 1) throw new Error('Invalid PDG drawing object count');
    const size = reader.uint(), end = reader.offset + size;
    if (end !== reader.view.byteLength) throw new Error('Invalid PDG drawing body length');
    const version = reader.byte();
    if (version !== 4 && version !== 5) throw new Error('Unsupported PDG Drawing snapshot version');
    const count = reader.uint();
    if (!count || count > LIMIT) throw new Error('Invalid PDG drawing polygon count');
    const shapes = [];
    let maxX = 1, maxY = 1, pointCount = 0;
    for (let i = 0; i < count; ++i) {
        if (reader.byte() !== 6) throw new Error('Only polygon PDG Drawing snapshots can be imported');
        const style = attributes(reader, version);
        const strokePadding = style.style === 2 && style.stroke ? style.width / 2 : 0;
        const length = reader.uint();
        pointCount += length;
        if (length < 3 || length > LIMIT || pointCount > 4000000) throw new Error('Invalid PDG polygon size');
        const points = [];
        for (let j = 0; j < length; ++j) {
            const point = reader.point();
            if (point.some(v => Math.abs(v) > 100000)) throw new Error('PDG drawing coordinates exceed the supported canvas');
            maxX = Math.max(maxX, point[0] + strokePadding); maxY = Math.max(maxY, point[1] + strokePadding);
            points.push(point);
        }
        shapes.push(polygon(points, style.fill, style.style === 2 ? style.stroke : null,
            style.style === 2 ? style.width : 0));
    }
    if (reader.offset !== end) throw new Error('Trailing PDG drawing data');
    // Native snapshots store artwork rather than the original image canvas.
    return document(shapes, [Math.ceil(maxX),Math.ceil(maxY)]);
}

function readDocument(filename) {
    if (/\.pdgdrawing$/i.test(filename)) return fromBinary(fs.readFileSync(filename));
    const record = JSON.parse(fs.readFileSync(filename, 'utf8'));
    return isPdgDrawing(filename) || record.format === 'pdg-polygon-drawing' ? fromJSON(record) : record;
}
class Writer {
    constructor() { this.bytes = []; this.bit = 0; this.boolOffset = 0; }
    byte(value) { this.bytes.push(value & 255); }
    u16(value) { this.byte(value >>> 8); this.byte(value); }
    u32(value) { this.u16(value >>> 16); this.u16(value); }
    tag(value) { this.byte(value >>> 16); this.u16(value); }
    uint(value) {
        if (value < 254) this.byte(value);
        else if (value <= 65535) { this.byte(254); this.u16(value); }
        else { this.byte(255); this.u32(value); }
    }
    float(value) {
        if (!Number.isFinite(value) || Math.abs(value) > 100000) throw new Error('Invalid PDG export coordinate');
        const bytes = new Uint8Array(4);new DataView(bytes.buffer).setFloat32(0,value,false);
        for (const byte of bytes) this.byte(byte);
    }
    flag(value) {
        if (!this.bit) { this.boolOffset=this.bytes.length;this.byte(0); }
        if (value) this.bytes[this.boolOffset] |= 1 << this.bit;
        this.bit=(this.bit+1)%8;
    }
    point(point) {
        const [x,y]=point;
        this.flag(x!==0 || y!==0);
        if (x===0 && y===0) return;
        const isInt = n => Number.isInteger(n) && n>=0 && n<=65535;
        this.flag(isInt(x));this.flag(isInt(y));
        for (const n of point) isInt(n) ? this.uint(n) : this.float(n);
    }
    color(rgb) {
        const alpha=rgb.length===4?rgb[3]:255;
        this.flag(alpha!==255);if(alpha!==255)this.byte(alpha);
        for(const byte of rgb.slice(0,3))this.byte(byte);
    }
}

function colorBytes(value) {
    const color = Colors.toColor(value);
    const bytes=[color.red,color.green,color.blue].map(n => Math.round(n*255));
    if(color.alpha!==1)bytes.push(Math.round(color.alpha*255));
    return bytes;
}
function exportPolygonBinary(shapes) {
    const polygons = [];
    function visit(shape, parent = p => p, depth = 0) {
        if (depth > 100) throw new Error('PDG drawing groups are nested too deeply');
        const center = shape.getCenterPoint();
        const c=Math.cos(shape.rotation || 0),s=Math.sin(shape.rotation || 0);
        const rotate = p => ({x:center.x+c*(p.x-center.x)-s*(p.y-center.y),
            y:center.y+s*(p.x-center.x)+c*(p.y-center.y)});
        if (shape.constructor.name === 'Group') {
            for (const child of shape.children) visit(child,
                p => parent(rotate({x:p.x+shape.x,y:p.y+shape.y})),depth+1);
            return;
        }
        if (shape.constructor.name !== 'Polygon')
            throw new Error('PDG pose export supports polygons and polygon groups. Save other shapes as .skrbl.');
        const points=shape.points.map(p => {const q=parent(rotate(p));return [q.x,q.y];});
        polygon(points,shape.fillColor); // validate before writing any file
        polygons.push({ points, fill: shape.fillColor ? colorBytes(shape.fillColor) : null,
            stroke: shape.strokeColor && shape.strokeWidth>0 ? colorBytes(shape.strokeColor) : null,
            width: shape.strokeWidth });
        if (polygons.length > LIMIT) throw new Error('PDG drawing is too large');
    }
    shapes.forEach(shape => visit(shape));
    if (!polygons.length) throw new Error('No polygons to export');
    const body=new Writer();body.byte(5);body.uint(polygons.length);
    for (const item of polygons) {
        body.byte(6);body.flag(true);
        const changedStroke=item.stroke && (item.stroke.length===4 || item.stroke.some(n=>n!==0));
        body.flag(changedStroke);if (changedStroke) body.color(item.stroke);
        body.flag(Boolean(item.fill));if (item.fill) body.color(item.fill);
        for (let i=0;i<5;++i) body.flag(false);
        const width=item.stroke ? item.width : 1;
        body.flag(width!==1);if (width!==1) body.point([width,12]);
        for (let i=0;i<9;++i) body.flag(false);
        for (let i=0;i<10;++i) body.flag(false);
        body.flag(true);body.u32(item.stroke ? 2 : 1);
        for (let i=0;i<5;++i) body.flag(false);
        body.flag(false);body.flag(false);body.flag(false);
        body.uint(item.points.length);
        for (const point of item.points) body.point(point);
    }
    const stream=new Writer();stream.tag(0x706467);stream.tag(0x6f626a);
    stream.u32(0xffffff09);stream.u16(1);stream.uint(body.bytes.length);
    const bytes=new Uint8Array(stream.bytes.length+body.bytes.length);
    bytes.set(stream.bytes);bytes.set(body.bytes,stream.bytes.length);
    fromBinary(bytes); // body lengths and supported styles must reload successfully
    return bytes;
}
function decodeNative(bytes) {
    if (typeof pdg === 'undefined' || typeof pdg.Deserializer.prototype.deserializeDrawing !== 'function')
        throw new Error('This drawing needs the full drawing codec. Run Skrybble with current pdg-devel via PDG_EXECUTABLE, or rebuild its browser runtime.');
    const reader = new pdg.Deserializer(); reader.setDataPtr(bytes);
    const drawing = reader.deserializeDrawing();
    if (!drawing) throw new Error('Missing PDG drawing');
    return drawing;
}
function encodeNative(drawing) {
    const writer = new pdg.Serializer();
    if (typeof writer.serializeDrawing !== 'function')
        throw new Error('This drawing needs the full drawing codec. Run Skrybble with current pdg-devel via PDG_EXECUTABLE, or rebuild its browser runtime.');
    writer.setResourceMode(pdg.serialization_Complete); writer.serializeDrawing(drawing);
    const block = writer.getDataPtr(), bytes = new Uint8Array(block.getDataSize());
    for (let i=0;i<bytes.length;++i) bytes[i]=block.getByte(i);
    return bytes;
}
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(bytes) {
    let result='';
    for (let i=0;i<bytes.length;i+=3) {
        const n=(bytes[i]<<16)|((bytes[i+1]||0)<<8)|(bytes[i+2]||0);
        result+=alphabet[(n>>>18)&63]+alphabet[(n>>>12)&63]+(i+1<bytes.length?alphabet[(n>>>6)&63]:'=')+(i+2<bytes.length?alphabet[n&63]:'=');
    }
    return result;
}
function fromBase64(value) {
    if (typeof value!=='string' || value.length>90*1024*1024 || value.length%4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
        throw new Error('Invalid retained drawing data');
    const bytes=new Uint8Array(value.length/4*3-(value.endsWith('==')?2:value.endsWith('=')?1:0));
    let k=0;
    for (let i=0;i<value.length;i+=4) {
        const n=(alphabet.indexOf(value[i])<<18)|(alphabet.indexOf(value[i+1])<<12)|((alphabet.indexOf(value[i+2])&63)<<6)|(alphabet.indexOf(value[i+3])&63);
        for (const shift of [16,8,0]) if (k<bytes.length) bytes[k++]=(n>>>shift)&255;
    }
    return bytes;
}
function fromBinary(bytes) {
    try { return fromPolygonBinary(bytes); }
    catch (polygonError) {
        const native = decodeNative(bytes), bounds=native.getBounds();
        const width=Math.max(1,Math.ceil(bounds.right)),height=Math.max(1,Math.ceil(bounds.bottom));
        if (![width,height].every(n=>Number.isFinite(n)&&n<=100000)) throw new Error('Invalid drawing bounds');
        return document([{type:'NativeDrawing',data:{type:'NativeDrawing',stream:toBase64(bytes),x:0,y:0,rotation:0}}],[width,height]);
    }
}
function exportBinary(shapes) {
    try { return exportPolygonBinary(shapes); }
    catch (polygonError) {
        const native=pdg.createDrawing();
        for (const shape of shapes) {
            if (shape.loadError) throw new Error(shape.loadError);
            const artwork=shape.getArtwork(1);
            native.addDrawing(artwork.getBounds(),artwork,new pdg.Attributes());
        }
        return encodeNative(native);
    }
}
module.exports = { isPdgDrawing, readDocument, fromJSON, fromBinary, exportBinary,
    decodeNative, encodeNative, toBase64, fromBase64 };
