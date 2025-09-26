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
        // Create and initialize the application
        const app = new DrawingApp();
        app.initialize(process.argv);
        pdg.run()
    } catch (error) {
        console.error('Failed to start DrawingApp:', error);
        pdg.quit();
    }
}

main();
