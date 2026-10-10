const childProcess = require('child_process');

function run(command, args) {
    try {
        return childProcess.execFileSync(command, args, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
    } catch (error) {
        // Cancellation and an unavailable picker both mean "no selection".
        return '';
    }
}

function chooseImageFile() {
    if (typeof globalThis !== 'undefined' && globalThis.skrybbleWeb) {
        return globalThis.skrybbleWeb.chooseFile({
            accept: '.png,.jpg,.jpeg,.gif,.bmp,.skrbl,.pdgdrawing,.drawing.json,image/*',
            prompt: 'Choose an image, Skrybble or PDG drawing'
        });
    }

    if (process.platform === 'darwin') {
        return run('/usr/bin/osascript', [
            '-e',
            'POSIX path of (choose file with prompt "Choose an image, Skrybble or PDG drawing" of type {"public.image", "skrbl", "pdgdrawing", "json"})'
        ]);
    }

    if (process.platform === 'win32') {
        const script = [
            'Add-Type -AssemblyName System.Windows.Forms',
            '$dialog = New-Object System.Windows.Forms.OpenFileDialog',
            '$dialog.Title = "Choose an image, Skrybble or PDG drawing"',
            '$dialog.Filter = "Supported files|*.png;*.jpg;*.jpeg;*.gif;*.bmp;*.skrbl;*.pdgdrawing;*.drawing.json|Image files|*.png;*.jpg;*.jpeg;*.gif;*.bmp|Drawing files|*.skrbl;*.pdgdrawing;*.drawing.json"',
            'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $dialog.FileName }'
        ].join('; ');
        return run('powershell.exe', ['-NoProfile', '-STA', '-Command', script]);
    }

    const zenityResult = run('zenity', [
        '--file-selection',
        '--title=Choose an image, Skrybble or PDG drawing',
        '--file-filter=Supported files | *.png *.jpg *.jpeg *.gif *.bmp *.skrbl *.pdgdrawing *.drawing.json'
    ]);
    if (zenityResult) return zenityResult;

    return run('kdialog', [
        '--getopenfilename',
        '.',
        'Supported files (*.png *.jpg *.jpeg *.gif *.bmp *.skrbl *.pdgdrawing *.drawing.json)'
    ]);
}

module.exports = chooseImageFile;
