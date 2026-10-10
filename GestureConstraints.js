// Axis selection has hysteresis, so a nearly diagonal drag doesn't flicker.
function axisPoint(origin,point,state,shift,slop=6) {
    if(!shift) {state.axis=null;return point;}
    const dx=point.x-origin.x,dy=point.y-origin.y,ax=Math.abs(dx),ay=Math.abs(dy);
    if(!state.axis) state.axis=ax>=ay?'x':'y';
    else if(state.axis==='x' && ay>ax+slop) state.axis='y';
    else if(state.axis==='y' && ax>ay+slop) state.axis='x';
    return state.axis==='x'?{x:point.x,y:origin.y}:{x:origin.x,y:point.y};
}
function snapAngle(angle) {return Math.round(angle/(Math.PI/4))*(Math.PI/4);}
function linePoint(origin,point) {
    const dx=point.x-origin.x,dy=point.y-origin.y,angle=snapAngle(Math.atan2(dy,dx)),length=Math.hypot(dx,dy);
    return {x:origin.x+Math.cos(angle)*length,y:origin.y+Math.sin(angle)*length};
}
module.exports={axisPoint,snapAngle,linePoint};
