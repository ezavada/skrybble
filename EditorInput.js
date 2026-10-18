const Tools=require('./tools');
let nextContext=0;

const commandKeys={KeyA:'selectAll',KeyC:'copy',KeyX:'cut',KeyV:'paste',KeyO:'open',KeyL:'fitCurve',KeyJ:'joinPaths',Digit0:'resetZoom'};
const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
const toolCodes={Backslash:'\\',Slash:'?',...Object.fromEntries(
    Object.keys(Tools.TOOL_SHORTCUTS).map(key=>key.replace('Shift+',''))
        .filter(key=>/^[A-Z]$/.test(key)).map(key=>['Key'+key,key]))};

// One snapshot owner for the editor. PDG feeds normalized physical keys before
// MVC handlers run; Unicode KeyPress remains exclusively for text and pickers.
class EditorInput {
    constructor(controller) {
        this.controller=controller;
        this.manager=pdg.getInputManager();
        const name='skrybble-'+(++nextContext);
        this.context=this.manager.createContext(name);
        this.modal=this.manager.createContext(name+'-editing');
        this.handles={};
        const bind=(action,codes)=>{
            const handle=this.context.defineAction(action,{type:'button'});
            codes.forEach(code=>this.context.bind(action,{id:code,source:'key',code}));
            return handle;
        };
        this.held={pan:bind('pan',['Space']),shift:bind('constrain',['ShiftLeft','ShiftRight']),
            alt:bind('zoomModifierAlt',['AltLeft','AltRight']),control:bind('zoomModifierControl',['ControlLeft','ControlRight']),
            meta:bind('commandModifier',['MetaLeft','MetaRight'])};
        const codes=new Set([...Object.keys(commandKeys),...Object.keys(toolCodes),...Object.keys(directions),
            'KeyZ','KeyS','KeyG','Equal','Minus','Tab','Backspace','Delete','Escape']);
        for(const code of codes)this.handles[code]=bind('shortcut'+code,[code]);
        this.manager.pushContext(this.context);
        this.modalActive=false;
    }

    syncMode() {
        if(this.destroyed)return;
        const blocked=!!(this.controller.textEdit || this.controller.activePicker() || !this.controller.active);
        if(blocked===this.modalActive)return;
        if(blocked)this.manager.pushContext(this.modal,{modal:true});
        else this.manager.popContext(this.modal);
        this.modalActive=blocked;
        this.repeat=null;
        this.controller.applyHeldInput({pan:false,shift:false,alt:false,control:false,meta:false});
    }

    shortcut(code,state) {
        const command=state.control || state.meta,shift=state.shift;
        if(command) {
            if(commandKeys[code])return [commandKeys[code],{closePolygon:!!state.alt}];
            if(code==='KeyZ')return [shift?'redo':'undo'];
            if(code==='KeyS')return [shift?'saveAs':'save'];
            if(code==='KeyG')return [shift?'ungroup':'group'];
        }
        if(code==='KeyZ' && !command && !state.alt)return ['zoom',shift?1/1.25:1.25];
        if(directions[code])return ['nudge',{direction:directions[code],shift}];
        if(code==='Equal' || code==='Minus')return ['reorder',{direction:code==='Equal'?1:-1,front:command}];
        if(code==='Tab')return ['nextShape',shift];
        if(code==='Delete' || code==='Backspace')return ['delete'];
        if(code==='Escape')return ['escape'];
        // Command chords take precedence over tools. '?' requires Shift+Slash.
        const key=toolCodes[code];
        if(!key || command || (code==='Slash' && !shift))return null;
        const tool=Tools.TOOL_SHORTCUTS[(shift && 'Shift+'+key in Tools.TOOL_SHORTCUTS)?'Shift+'+key:key];
        return tool?['tool',tool]:null;
    }

    poll(keyInfo) {
        if(this.destroyed)return false;
        this.syncMode();
        const snapshot=this.manager.advance();
        const state=Object.fromEntries(Object.entries(this.held).map(([name,handle])=>[name,snapshot.held(handle)]));
        state.cancelled=[...Object.values(this.held),...Object.values(this.handles)]
            .some(handle=>!!snapshot.state(handle).cancellationReason);
        this.controller.applyHeldInput(state);
        if(this.modalActive)return false;
        let handled=false;
        for(const [code,handle] of Object.entries(this.handles)) {
            if(!snapshot.pressed(handle))continue;
            const shortcut=this.shortcut(code,state);
            if(!shortcut)continue;
            handled=this.controller.executeShortcut(...shortcut) || handled;
            if(keyInfo) {
                this.suppressText=true;
                this.repeat={code,keyCode:keyInfo.keyCode};
            }
        }
        // PDG suppresses repeated press edges. Preserve OS shortcut repeat,
        // using the opaque KeyInfo code solely
        // to distinguish a repeated key from a newly pressed modifier.
        if(!handled && keyInfo && this.repeat?.keyCode===keyInfo.keyCode && snapshot.held(this.handles[this.repeat.code])) {
            const shortcut=this.shortcut(this.repeat.code,state);
            if(shortcut)handled=this.controller.executeShortcut(...shortcut);
        }
        if(this.repeat && !snapshot.held(this.handles[this.repeat.code]))this.repeat=null;
        if(state.cancelled){this.repeat=null;this.suppressText=false;}
        this.syncMode();
        return handled;
    }

    keyDown(info) {
        this.suppressText=false;
        return this.poll(info);
    }
    keyUp(info) {
        this.suppressText=false;
        return this.poll();
    }
    destroy() {
        if(this.destroyed)return;
        if(this.modalActive)this.manager.popContext(this.modal);
        this.manager.popContext(this.context);
        this.destroyed=true;
    }
}
module.exports=EditorInput;
