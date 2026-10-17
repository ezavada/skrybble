// PDG accepts RGB hex strings but not RGBA hex strings. Keep alpha in editor
// documents using CSS #rrggbbaa, and convert it at the native drawing boundary.
function toColor(value) {
    if(typeof value==='string' && /^#[0-9a-f]{8}$/i.test(value)) {
        const channels=[1,3,5,7].map(i=>parseInt(value.slice(i,i+2),16)/255);
        return new pdg.Color(...channels);
    }
    return new pdg.Color(value);
}
function toHex(color) {
    const byte=value=>Math.round(Math.max(0,Math.min(1,value))*255).toString(16).padStart(2,'0');
    const rgb='#'+[color.r,color.g,color.b].map(byte).join('');
    return rgb+(color.a===undefined || color.a>=1?'':byte(color.a));
}
module.exports={toColor,toHex};
