// -----------------------------------------------
// Application.js
// 
// JavaScript port of the Application base class
// Manages primary application functionality
//
// Ported from C++ by Assistant, 2024
// Original Copyright (c) 2004-2012, Dream Rock Studios, LLC
// -----------------------------------------------

/**
 * Exception class for missing managers
 */
class NoManagerError extends Error {
    constructor() {
        super("no_manager");
        this.name = "NoManagerError";
    }
}

/**
 * Application states enumeration
 */
const AppStates = {
    state_Initializing: 0,
    state_Cleanup: 1,
    state_Running: 2,
    state_FirstUserState: 3
};

/**
 * Base Application class that manages primary application functionality
 */
class Application {
    constructor(args = null) {
        // Manager references
        this.eventMgr = pdg.evt;
        this.resourceMgr = pdg.res;
        this.timerMgr = pdg.tm;
        this.netMgr = pdg.net;
        this.soundMgr = pdg.snd;
        this.graphicsMgr = pdg.gfx;
        this.logMgr = pdg.log;
        this.configMgr = pdg.cfg;
        
        // Store event handler references for cleanup
        this.shutdownHandler = null;

        // Application state
        this.appState = AppStates.state_Initializing;
        this.skipSplash = false;

        // initialize the application
        // Use provided args if it's an array, otherwise try global.pdg.argv, or fallback to process.argv
        let appArgs = process.argv; // default fallback
        if (Array.isArray(args)) {
            // args is an array, use it
            appArgs = args;
        } else if (typeof global !== 'undefined' && global.pdg && Array.isArray(global.pdg.argv)) {
            // Use global.pdg.argv from the PDG bindings
            appArgs = global.pdg.argv;
        } else if (typeof pdg !== 'undefined' && Array.isArray(pdg.argv)) {
            // Use pdg.argv if available in this context
            appArgs = pdg.argv;
        }
        this._initialize(appArgs);
    }

    /**
     * Register event handlers with the event manager
     * @private
     */
    _registerEventHandlers() {
        // these are the handlers of last resort, if no controllers have handled them
        this.shutdownHandler = pdg.onShutdown((eventData) => { return this.onShutdown(eventData); });
    }

    /**
     * Unregister event handlers from the event manager
     * @private
     */
    _unregisterEventHandlers() {
        // Remove individual event handlers
        if (this.shutdownHandler) {
            if (typeof this.shutdownHandler.cancel === 'function') this.shutdownHandler.cancel();
            else this.eventMgr.removeHandler(this.shutdownHandler, pdg.eventType_Shutdown);
            this.shutdownHandler = null;
        }
    }

    /**
     * Handle shutdown event
     * @param {Object} eventData - Event data
     * @returns {boolean} true if fully handled
     */
    onShutdown(eventData) {
        // Handle application shutdown
        this._unregisterEventHandlers();
        return true;
    }

    /**
     * Initialize the application
     * Called by the constructor
     * @private
     * @param {string[]} args - Command line arguments
     */
    _initialize(args) {
        this.initialize(args);
        this._registerEventHandlers();
        this.setupGraphics();
        pdg.run(); // make sure PDG is running
        this.preloadResources();
        this.setupControllers();
        this.setState(AppStates.state_Running);
    }

    /**
     * Initialize the application
     * Called before pdg.run()
     * @param {string[]} args - Command line arguments
     */
    initialize(args) {
        // Override to do any initialization you need, such as
        // parsing command line arguments and setting up 
        // application variables.
    }

    /**
     * Setup graphics
     * Called before pdg.run(), but after initialize(args)
     * pdg.run() is called right after this.
     */
    setupGraphics() {
        // Override to do any graphics setup you need, such as 
        // creating a main window or fullscreen port.
        // you will need at least one port to create controllers
        // in setupControllers().
    }

    /**
     * Preload resources
     * Called before setupControllers(), but after setupGraphics()
     * @param {string[]} args - Command line arguments
     */
    preloadResources() {
        // because pdg.run() has already been called, the base
        // resource directory is already open. So you can just
        // load resources you need immediately here.
        //
        // Call this.resourceMgr.openResourceFile() to open additional 
        // resource files or folders if needed.
        //
        // at very least you want to be sure that any resources
        // needed by your controllers are accessible here, if not
        // actually preloaded.
    }

    /**
     * Setup controllers
     * Called after preloadResources()
     */
    setupControllers() {
        // Override to create at least one controller to handle events
        // and manage views for your application.
    }
    
    /**
     * Cleanup the application
     */
    cleanup() {
        // Override to undo anything you did in initialize()
    }

    /**
     * Get current application state
     * @returns {number} Current state
     */
    getState() {
        return this.appState;
    }

    /**
     * Set application state with proper transitions
     * @param {number} appState - New state
     */
    setState(appState) {
        console.log(`Application::setState(${appState})`);
        const oldState = this.appState;
        this.leaveState(oldState, appState); // State transitions within leaveState() will be transitory
        const finalOldState = this.appState; // And will hide the state we were leaving from the final enterState()
        this.appState = appState;
        this.enterState(appState, finalOldState); // This allows further state transitions within enterState()
    }

    /**
     * Handle entering a new state
     * @param {number} newState - The new state
     * @param {number} oldState - The old state
     */
    enterState(newState, oldState) {
        // Override to handle additional state transitions
        // Typically this is used to setup the new state
        // Calling setState() from within enterState() is allowed, and will
        // produce another complete state leave/enter cycle
    }

    /**
     * Handle leaving a state
     * @param {number} oldState - The old state
     * @param {number} newState - The new state
     */
    leaveState(oldState, newState) {
        // Override to handle additional state transitions
        // Typically this is used to cleanup after a state, kill state specific timers, etc...
        // Calling setState() within leaveState will produce a transitory state that is
        // exited as soon as it is entered
        // Transitory states do NOT get leaveState calls as they are exited
    }


    // Manager accessors with error checking
    getEventManager() {
        if (!this.eventMgr) throw new NoManagerError();
        return this.eventMgr;
    }

    getResourceManager() {
        if (!this.resourceMgr) throw new NoManagerError();
        return this.resourceMgr;
    }

    getTimerManager() {
        if (!this.timerMgr) throw new NoManagerError();
        return this.timerMgr;
    }

    getNetworkManager() {
        if (!this.netMgr) throw new NoManagerError();
        return this.netMgr;
    }

    getSoundManager() {
        if (!this.soundMgr) throw new NoManagerError();
        return this.soundMgr;
    }

    getGraphicsManager() {
        if (!this.graphicsMgr) throw new NoManagerError();
        return this.graphicsMgr;
    }

    getLogManager() {
        if (!this.logMgr) throw new NoManagerError();
        return this.logMgr;
    }

    getConfigManager() {
        if (!this.configMgr) throw new NoManagerError();
        return this.configMgr;
    }

    /**
     * Cleanup when application is destroyed
     */
    destroy() {
        this._unregisterEventHandlers();
        this.cleanup();
    }
}

module.exports = {
    Application,
    AppStates,
    NoManagerError
};
