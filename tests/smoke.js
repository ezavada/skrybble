require('pdg');
const framework = require('../index.js');

if (typeof framework.Application !== 'function' ||
    typeof framework.Controller !== 'function' ||
    typeof framework.View !== 'function') {
    throw new Error('Vendored PDG MVC framework did not load correctly.');
}

console.log('Skrybble standalone dependency smoke test passed.');
process.exit(0);
