// -----------------------------------------------
// index.js
// 
// Drawing Application using the PDG JavaScript MVC Framework
//
// (c) 2025, Ed Zavada
// -----------------------------------------------

const framework = require('../pdg-devel/src/js/mvc-app/index.js');
const Tools = require('./tools.js');
const Drawing = require('./drawing.js');

module.exports = {};

module.exports.View = framework.View.View;
module.exports.ViewBinding = framework.ViewBinding;
module.exports.Controller = framework.Controller.Controller;
module.exports.Application = framework.Application.Application;
module.exports.AppStates = framework.Application.AppStates;
module.exports.Tools = Tools;
module.exports.Drawing = Drawing;
