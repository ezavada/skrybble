const path = require('path');

function parseLaunchOptions(args = []) {
    const options = {input: null, output: null, convertCurves: false};
    let positional = null;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--convert-curves') { options.convertCurves = true; continue; }
        const match = /^(--input|--output)(?:=(.*))?$/.exec(arg);
        if (match) {
            const value = match[2] === undefined ? args[++i] : match[2];
            if (!value || value.startsWith('--')) throw new Error(`${match[1]} requires a filename`);
            const key = match[1].slice(2);
            if (options[key]) throw new Error(`Duplicate ${match[1]}`);
            options[key] = path.resolve(value);
        } else if (/^--/.test(arg)) {
            throw new Error(`Unknown launch option: ${arg}`);
        } else if (!positional && /\.(skrbl|pdgdrawing|drawing\.json|svg)$/i.test(arg)) {
            positional = path.resolve(arg);
        }
    }
    if (options.input && positional) throw new Error('Use either --input or a positional input filename');
    options.explicitInput = !!options.input;
    options.input = options.input || positional;
    if (options.output && !/\.(skrbl|pdgdrawing)$/i.test(options.output))
        throw new Error('--output must end in .skrbl or .pdgdrawing');
    if (options.convertCurves && (!options.input || !options.output))
        throw new Error('--convert-curves requires an input and --output');
    if (options.convertCurves && options.input === options.output)
        throw new Error('Batch conversion requires a separate output file');
    return options;
}
module.exports = parseLaunchOptions;
