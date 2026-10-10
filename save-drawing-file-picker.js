const childProcess = require('child_process');
function run(command,args) {
    try { return childProcess.execFileSync(command,args,{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); }
    catch (error) { return ''; }
}
function chooseSaveDrawingFile(defaultName='drawing.pdgdrawing') {
    if (typeof globalThis !== 'undefined' && globalThis.skrybbleWeb)
        return globalThis.prompt('Save as .pdgdrawing or .skrbl',defaultName) || '';
    if (process.platform === 'darwin') {
        const escaped=defaultName.replace(/\\/g,'\\\\').replace(/"/g,'\\"');
        return run('/usr/bin/osascript',['-e',
            `POSIX path of (choose file name with prompt "Save drawing as .pdgdrawing or .skrbl" default name "${escaped}")`]);
    }
    if (process.platform === 'win32') {
        const escaped=defaultName.replace(/'/g,"''");
        return run('powershell.exe',['-NoProfile','-STA','-Command',[
            'Add-Type -AssemblyName System.Windows.Forms',
            '$dialog = New-Object System.Windows.Forms.SaveFileDialog',
            '$dialog.Title = "Save drawing as"',
            '$dialog.Filter = "PDG polygon drawing|*.pdgdrawing|Skrybble document|*.skrbl"',
            `$dialog.FileName = '${escaped}'`,
            '$dialog.OverwritePrompt = $true',
            'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $dialog.FileName }'
        ].join('; ')]);
    }
    return run('zenity',['--file-selection','--save','--confirm-overwrite',
        '--title=Save drawing as','--filename='+defaultName,
        '--file-filter=Drawing files | *.pdgdrawing *.skrbl']) ||
        run('kdialog',['--getsavefilename',defaultName,'Drawing files (*.pdgdrawing *.skrbl)']);
}
module.exports=chooseSaveDrawingFile;
