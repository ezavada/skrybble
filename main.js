// -----------------------------------------------
// main.js
// 
// Drawing Application using the PDG JavaScript MVC Framework
//
// (c) 2025, Ed Zavada
// -----------------------------------------------

const DrawingApp = require('./DrawingApp.js');

// Main execution
function main() {
    try {
        // Create the application (initialization happens automatically in base class constructor)
        // Pass process.argv from this context to ensure arguments are passed correctly
        const app = new DrawingApp(process.argv);
    } catch (error) {
        console.error('Failed to start DrawingApp:', error && error.stack ? error.stack : error);
        process.exitCode = 1;
        pdg.quit();
        if (typeof globalThis !== 'undefined' && globalThis.skrybbleWeb) throw error;
    }
}

main();
