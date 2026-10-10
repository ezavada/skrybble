const childProcess = require('child_process');

function run(command, args) {
    try {
        return childProcess.execFileSync(command, args, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
    } catch (error) {
        return '';
    }
}

function chooseDrawingFile() {
    if (typeof globalThis !== 'undefined' && globalThis.skrybbleWeb) {
        return globalThis.skrybbleWeb.chooseFile({
            accept: '.skrbl,.pdgdrawing,.drawing.json,application/json',
            prompt: 'Open a Skrybble or PDG drawing'
        });
    }

    if (process.platform === 'darwin') {
        return run('/usr/bin/osascript', [
            '-e',
            'POSIX path of (choose file with prompt "Open a Skrybble or PDG drawing" of type {"skrbl", "pdgdrawing", "json"})'
        ]);
    }

    if (process.platform === 'win32') {
        const script = [
            'Add-Type -AssemblyName System.Windows.Forms',
            '$dialog = New-Object System.Windows.Forms.OpenFileDialog',
            '$dialog.Title = "Open a Skrybble or PDG drawing"',
            '$dialog.Filter = "Drawing files|*.skrbl;*.pdgdrawing;*.drawing.json"',
            'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $dialog.FileName }'
        ].join('; ');
        return run('powershell.exe', ['-NoProfile', '-STA', '-Command', script]);
    }

    const zenityResult = run('zenity', [
        '--file-selection',
        '--title=Open a Skrybble or PDG drawing',
        '--file-filter=Drawing files | *.skrbl *.pdgdrawing *.drawing.json'
    ]);
    if (zenityResult) return zenityResult;

    return run('kdialog', ['--getopenfilename', '.', 'Drawing files (*.skrbl *.pdgdrawing *.drawing.json)']);
}

module.exports = chooseDrawingFile;
