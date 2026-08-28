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
    if (process.platform === 'darwin') {
        return run('/usr/bin/osascript', [
            '-e',
            'POSIX path of (choose file with prompt "Choose an image or Skrybble drawing" of type {"public.image", "skrbl"})'
        ]);
    }

    if (process.platform === 'win32') {
        const script = [
            'Add-Type -AssemblyName System.Windows.Forms',
            '$dialog = New-Object System.Windows.Forms.OpenFileDialog',
            '$dialog.Title = "Choose an image or Skrybble drawing"',
            '$dialog.Filter = "Supported files|*.png;*.jpg;*.jpeg;*.gif;*.bmp;*.skrbl|Image files|*.png;*.jpg;*.jpeg;*.gif;*.bmp|Skrybble drawings|*.skrbl"',
            'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $dialog.FileName }'
        ].join('; ');
        return run('powershell.exe', ['-NoProfile', '-STA', '-Command', script]);
    }

    const zenityResult = run('zenity', [
        '--file-selection',
        '--title=Choose an image or Skrybble drawing',
        '--file-filter=Supported files | *.png *.jpg *.jpeg *.gif *.bmp *.skrbl'
    ]);
    if (zenityResult) return zenityResult;

    return run('kdialog', [
        '--getopenfilename',
        '.',
        'Supported files (*.png *.jpg *.jpeg *.gif *.bmp *.skrbl)'
    ]);
}

module.exports = chooseImageFile;
