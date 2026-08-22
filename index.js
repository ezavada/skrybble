// -----------------------------------------------
// index.js
// 
// Drawing Application using the PDG JavaScript MVC Framework
//
// (c) 2025, Ed Zavada
// -----------------------------------------------

// Load the complete MVC framework through the public PDG entry point.
// See vendor/README.md for provenance and update instructions.
const framework = require('./vendor/pdg-mvc-app/index.js');

const Tools = require('./tools.js');
const Drawing = require('./drawing.js');

module.exports = {};

module.exports.View = framework.View.View;
module.exports.Button = framework.Button.Button;
module.exports.ViewBinding = framework.ViewBinding;
module.exports.Controller = framework.Controller.Controller;
module.exports.Application = framework.Application.Application;
module.exports.AppStates = framework.Application.AppStates;
module.exports.Tools = Tools;
module.exports.Drawing = Drawing;
