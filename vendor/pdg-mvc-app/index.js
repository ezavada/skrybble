// -----------------------------------------------
// index.js
// 
// Main export file for the JavaScript MVC Application Framework
// Exports all application framework classes and utilities
//
// Original Copyright (c) 2004-2012, Dream Rock Studios, LLC
// -----------------------------------------------

// Core framework classes
const { IObserver, Subject } = require('./Observer');
const { Application, AppStates, NoManagerError } = require('./Application');
const { View, ClickablePartsIDs, ViewBinding } = require('./View');
const { Controller, ControllerPreferences } = require('./Controller');
const { ControlAttributes, ControlStateAttributes, ControlState, ControlType } = require('./ControlAttributes');

// UI Components
const { Button, MAX_BUTTON_IMAGES, RES_DEFAULT_BUTTON_IMAGE_NAMES } = require('./Button');
const { Dialog, DialogResult, DialogFlags } = require('./Dialog');
const { Checkbox, CheckboxClickIDs, CBImages } = require('./Checkbox');
const { EditText, EditTextClickIDs, LEFT_MARGIN, RIGHT_MARGIN, TEXT_HEIGHT_OFFSET } = require('./EditText');
const { ListBox, ListBoxLine, ListBoxClickIDs, ListBoxSelectionIDs } = require('./ListBox');
const { Scrollbar, ScrollbarOrientation, ScrollbarClickIDs, ScrollbarImages } = require('./Scrollbar');
const { ModalController } = require('./ModalController');
const { TouchController, FLICK_DECAY_FACTOR, FLICK_MAX_MOUSE_UNMOVED_MS, FLICK_FRAME_RATE } = require('./TouchController');
const { ScrollingView, ScrollingViewBindType } = require('./ScrollingView');
const { RadioButton, MAX_RADIO_IMAGES } = require('./RadioButton');
const { PopupMenu, ItemInfo, ITEM_SIZE_OFFSET, TEXT_WIDTH_OFFSET, IMAGE_HEIGHT_OFFSET, 
    VIEW_HEIGHT_OFFSET, VIEW_WIDTH_OFFSET, VIEW_HSHIFT_OFFSET, MAX_ARROW_IMAGES, TEXT_LEFT_MARGIN, 
    HIGHLIGHT_AREA_MARGIN, CLIP_TEXT, RES_MENU_IMAGES, TEXT_RESOURCE_ID_NONE, MAX_MENU_WIDTH, 
    ITEM_UP_ARROW, ITEM_DOWN_ARROW, RES_PULL_ARROW, START_INDEX_NONE, HOT_ITEM_NONE } = require('./PopupMenu');
const { MessageDialog, MessageView, DialogBorderView, MessageDialogViewIDs, MessageDialogButtonText } = require('./MessageDialog');
const { MessageView: MessageViewStandalone } = require('./MessageView');

// Re-export everything for easy importing
module.exports = {
    // Core Framework
    IObserver,
    Subject,
    Application,
    AppStates,
    NoManagerError,
    
    // Views and Controllers
    View,
    ClickablePartsIDs,
    ViewBinding,
    Controller,
    ControllerPreferences,
    ControlAttributes,
    ControlStateAttributes,
    ControlState,
    ControlType,
        
    // UI Components
    Button,
    MAX_BUTTON_IMAGES,
    RES_DEFAULT_BUTTON_IMAGE_NAMES,
    Dialog,
    DialogResult,
    DialogFlags,
    Checkbox,
    CheckboxClickIDs,
    CBImages,
    EditText,
    EditTextClickIDs,
    LEFT_MARGIN,
    RIGHT_MARGIN,
    TEXT_HEIGHT_OFFSET,
    ListBox,
    ListBoxLine,
    ListBoxClickIDs,
    ListBoxSelectionIDs,
    Scrollbar,
    ScrollbarOrientation,
    ScrollbarClickIDs,
    ScrollbarImages,
    ModalController,
    TouchController,
    FLICK_DECAY_FACTOR,
    FLICK_MAX_MOUSE_UNMOVED_MS,
    FLICK_FRAME_RATE,
    ScrollingView,
    ScrollingViewBindType,
    RadioButton,
    MAX_RADIO_IMAGES,
    PopupMenu,
    ItemInfo,
    ITEM_SIZE_OFFSET,
    TEXT_WIDTH_OFFSET,
    IMAGE_HEIGHT_OFFSET,
    VIEW_HEIGHT_OFFSET,
    VIEW_WIDTH_OFFSET,
    VIEW_HSHIFT_OFFSET,
    MAX_ARROW_IMAGES,
    TEXT_LEFT_MARGIN,
    HIGHLIGHT_AREA_MARGIN,
    CLIP_TEXT,
    RES_MENU_IMAGES,
    TEXT_RESOURCE_ID_NONE,
    MAX_MENU_WIDTH,
    ITEM_UP_ARROW,
    ITEM_DOWN_ARROW,
    RES_PULL_ARROW,
    START_INDEX_NONE,
    HOT_ITEM_NONE,
    MessageDialog,
    MessageView,
    DialogBorderView,
    MessageDialogViewIDs,
    MessageDialogButtonText,
    MessageViewStandalone,
    
    // Framework version info
    VERSION: '1.0.0',
    DESCRIPTION: 'JavaScript port of PDG Application Framework'
};

// Also provide individual module exports for more granular imports
module.exports.Observer = require('./Observer');
module.exports.Application = require('./Application');
module.exports.View = require('./View');
module.exports.Controller = require('./Controller');
module.exports.ControlAttributes = require('./ControlAttributes');
module.exports.Button = require('./Button');
module.exports.Dialog = require('./Dialog');
module.exports.Checkbox = require('./Checkbox');
module.exports.EditText = require('./EditText');
module.exports.ListBox = require('./ListBox');
module.exports.Scrollbar = require('./Scrollbar');
module.exports.ModalController = require('./ModalController');
module.exports.TouchController = require('./TouchController');
module.exports.ScrollingView = require('./ScrollingView');
module.exports.RadioButton = require('./RadioButton');
module.exports.PopupMenu = require('./PopupMenu');
module.exports.MessageDialog = require('./MessageDialog');
module.exports.MessageView = require('./MessageView');
