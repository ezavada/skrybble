const {EditText}=require('./vendor/pdg-mvc-app/EditText');

// Reuse MVC editing behavior without registering a screen-space view:
// the canvas owns rendering, hit testing, and the document transform.
class CanvasTextEditor extends EditText {
    constructor(controller,shape) {
        const application=controller.getApplication();
        const adapter={port:controller.port,addView(){},getApplication:()=>({
            getResourceManager:()=>application.getResourceManager?.() || pdg.rm,
            getEventManager:()=>application.getEventManager?.() || pdg.evt,
            getTimerManager:()=>application.getTimerManager?.() || pdg.tm,
            getLogManager:()=>application.getLogManager?.() || pdg.lm
        })};
        super(adapter,new pdg.Rect(shape.x,shape.y,shape.x+shape.width,shape.y+shape.height),-1,shape.fontSize);
        this.shape=shape;this.maxChars=100000;this.setText(shape.text);this.setFocus(true);
    }
    doKeyPress(event) {
        const command=event.ctrl || event.meta || event.command,code=event.unicode;
        const web=globalThis.skrybbleWeb;
        if(command && [86,118].includes(code) && web?.readClipboard) {
            web.readClipboard().then(text=>{if(this.mbHasFocus){EditText.clipboard=text.replace(/[\r\n]+/g,' ');super.doKeyPress({unicode:118,meta:true});this.sync();}})
                .catch(()=>{if(this.mbHasFocus){super.doKeyPress({unicode:118,meta:true});this.sync();}});
            return true;
        }
        if(command && [86,118].includes(code) && ['darwin','win32'].includes(process.platform)) {
            const result=process.platform==='darwin'
                ? require('child_process').spawnSync('pbpaste',[],{encoding:'utf8'})
                : require('child_process').spawnSync('powershell',['-NoProfile','-NonInteractive','-Command',
                    '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Get-Clipboard -Raw'],{encoding:'utf8'});
            if(result.status===0)EditText.clipboard=result.stdout.replace(/[\r\n]+/g,' ');
        }
        const handled=super.doKeyPress(event);
        if(command && [67,99,88,120].includes(code)) {
            if(web?.writeClipboard)web.writeClipboard(EditText.clipboard || '').catch(()=>{});
            else if(process.platform==='darwin')require('child_process').spawnSync('pbcopy',[],{input:EditText.clipboard || ''});
            else if(process.platform==='win32')require('child_process').spawnSync('powershell',['-NoProfile','-NonInteractive','-Command',
                '[Console]::InputEncoding=[System.Text.Encoding]::UTF8; Set-Clipboard -Value ([Console]::In.ReadToEnd())'],
                {input:EditText.clipboard || '',encoding:'utf8'});
        }
        return handled;
    }
    getTextWidth(text) { return this.shape.measure(this.port,text); }
    resetBlink() {this.mbShowCaret=true;this._caretElapsed=0;}
    sync() {this.shape.text=this.text;this.shape.layout(this.port);this.resetBlink();}
    positionAt(point,extend=false) {
        const c=this.shape.getCenterPoint();
        const local=this.shape.rotatePoint(point.x,point.y,c.x,c.y,-this.shape.rotation);
        this.moveCaret(this.getCaretPositionFromPoint(new pdg.Point(local.x-this.shape.x-1,0)),extend);
        this.resetBlink();
    }
    selectWord() {
        const word=char=>/[\p{L}\p{N}_]/u.test(char);
        let start=this.caretPos,end=this.caretPos;
        while(start>0 && word(this.text.slice(this.adjacentPosition(start,-1),start)))start=this.adjacentPosition(start,-1);
        while(end<this.text.length && word(this.text.slice(end,this.adjacentPosition(end,1))))end=this.adjacentPosition(end,1);
        this.highlightStartCharIndex=start;this.highlightEndCharIndex=end;this.caretPos=end;this.resetBlink();
    }
    drawOverlay(canvas) {
        const shape=this.shape;shape.layout(this.port);
        const c=shape.getCenterPoint(),attrs=()=>new pdg.Attributes().rotation(shape.rotation,new pdg.Point(c));
        canvas.drawRect(new pdg.Rect(shape.x,shape.y,shape.x+shape.width,shape.y+shape.height),
            attrs().lineColor(new pdg.Color('#3b82f6')).lineThickness(1));
        if(this.hasSelection()) {
            const start=Math.min(this.highlightStartCharIndex,this.highlightEndCharIndex);
            const end=Math.max(this.highlightStartCharIndex,this.highlightEndCharIndex);
            canvas.drawRect(new pdg.Rect(shape.x+4+this.getTextWidth(this.text.slice(0,start)),shape.y+4,
                shape.x+4+this.getTextWidth(this.text.slice(0,end)),shape.y+shape.height-4),
                attrs().fillColor(new pdg.Color(.2,.5,1,.25)));
        }
        if(this.mbShowCaret) {
            const x=shape.x+4+this.getTextWidth(this.text.slice(0,this.caretPos));
            canvas.drawLine(new pdg.Point(x,shape.y+4),new pdg.Point(x,shape.y+shape.height-4),
                attrs().lineColor(new pdg.Color('#1e293b')).lineThickness(1));
        }
    }
}
module.exports=CanvasTextEditor;
