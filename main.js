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
        const app = new DrawingApp();
    } catch (error) {
        console.error('Failed to start DrawingApp:', error);
        pdg.quit();
    }
}

main();
