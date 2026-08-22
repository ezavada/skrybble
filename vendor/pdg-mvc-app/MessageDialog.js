// -----------------------------------------------
// MessageDialog.js
// 
// JavaScript port of the MessageDialog class
// A simple dialog that shows a text message with buttons
//
// Ported from C++ by Assistant, 2024
// Original Copyright (c) 2004-2012, Dream Rock Studios, LLC
// -----------------------------------------------

const { Dialog, DialogFlags } = require('./Dialog');
const { View } = require('./View');
const { Button } = require('./Button');

/**
 * MessageDialog view IDs
 */
const MessageDialogViewIDs = {
    VIEW_ID_MESSAGE_VIEW: 1,
    VIEW_ID_BORDER: 2,
    VIEW_FIRST_BUTTON_ID: 100, // Add new buttons below this entry
    VIEW_ID_BUTTON_1: 101,
    VIEW_ID_BUTTON_2: 102,
    VIEW_LAST_BUTTON_ID: 199    // Add new buttons above this entry
};

/**
 * MessageDialog button text types
 */
const MessageDialogButtonText = {
    NONE: 0,
    OK: 1,
    CANCEL: 2,
    YES: 3,
    NO: 4,
    SAVE: 5,
    LOAD: 6
};

/**
 * MessageDialog that extends Dialog
 * Provides a simple dialog for displaying messages with buttons
 */
class MessageDialog extends Dialog {
    constructor(parentController, message, button1 = MessageDialogButtonText.NONE, button2 = MessageDialogButtonText.NONE) {
        // Convert button types to strings
        const buttonText1 = MessageDialog.getTextForButton(button1);
        const buttonText2 = MessageDialog.getTextForButton(button2);
        
        // Call parent constructor with string buttons
        super(parentController, 300, 150, DialogFlags.dialog_Standard, 
              MessageDialogViewIDs.VIEW_ID_BUTTON_1, 
              button2 !== MessageDialogButtonText.NONE ? MessageDialogViewIDs.VIEW_ID_BUTTON_2 : -1);
        
        this.resMgr = parentController.getApplication().getResourceManager();
        this.buttonClickedId = -1;
        this.messageCode = 0;
        
        this.setupDialog(message, buttonText1, buttonText2);
    }

    /**
     * Alternative constructor with custom button text
     * @param {Controller} parentController - Parent controller
     * @param {string} message - Message text
     * @param {string} buttonText1 - First button text
     * @param {string} buttonText2 - Second button text
     */
    static withCustomButtons(parentController, message, buttonText1, buttonText2) {
        const dialog = new MessageDialog(parentController, message, MessageDialogButtonText.NONE, MessageDialogButtonText.NONE);
        dialog.setupDialog(message, buttonText1, buttonText2);
        return dialog;
    }

    /**
     * Setup dialog with message and buttons
     * @param {string} message - Message text
     * @param {string} buttonText1 - First button text
     * @param {string} buttonText2 - Second button text
     */
    setupDialog(message, buttonText1, buttonText2) {
        const dialogRect = this.getDialogRect();
        
        // Create message view
        const messageRect = new pdg.Rect(
            dialogRect.left + 20,
            dialogRect.top + 20,
            dialogRect.right - 20,
            dialogRect.top + 80
        );
        
        const messageView = new MessageDialogView(this, messageRect, message);
        this.addView(messageView, MessageDialogViewIDs.VIEW_ID_MESSAGE_VIEW);
        
        // Create buttons
        const buttonHeight = 30;
        const buttonWidth = 80;
        const buttonSpacing = 20;
        const buttonY = dialogRect.bottom - 50;
        
        let buttonX = dialogRect.right - 20 - buttonWidth;
        
        // Add second button if specified
        if (buttonText2 && buttonText2 !== '') {
            const button2Rect = new pdg.Rect(buttonX, buttonY, buttonWidth, buttonHeight);
            // FIXME: Button creation is incorrectly ported from C++
            //const button2 = new Button(this, button2Rect, MessageDialogViewIDs.VIEW_ID_BUTTON_2);
            //this.addView(button2, MessageDialogViewIDs.VIEW_ID_BUTTON_2);
            
            buttonX -= buttonWidth + buttonSpacing;
        }
        
        // Add first button
        if (buttonText1 && buttonText1 !== '') {
            const button1Rect = new pdg.Rect(buttonX, buttonY, buttonWidth, buttonHeight);
            // FIXME: Button creation is incorrectly ported from C++
            //const button1 = new Button(this, button1Rect, MessageDialogViewIDs.VIEW_ID_BUTTON_1);
            //this.addView(button1, MessageDialogViewIDs.VIEW_ID_BUTTON_1);
        }
        
        // Add border view
        const borderRect = new pdg.Rect(
            dialogRect.left + 2,
            dialogRect.top + 2,
            dialogRect.width() - 4,
            dialogRect.height() - 4
        );
        const borderView = new MessageDialogBorderView(this, borderRect);
        this.addView(borderView, MessageDialogViewIDs.VIEW_ID_BORDER);
    }

    /**
     * Get text for button type
     * @param {number} buttonType - Button type
     * @returns {string} Button text
     */
    static getTextForButton(buttonType) {
        switch (buttonType) {
            case MessageDialogButtonText.OK:
                return 'OK';
            case MessageDialogButtonText.CANCEL:
                return 'Cancel';
            case MessageDialogButtonText.YES:
                return 'Yes';
            case MessageDialogButtonText.NO:
                return 'No';
            case MessageDialogButtonText.SAVE:
                return 'Save';
            case MessageDialogButtonText.LOAD:
                return 'Load';
            default:
                return '';
        }
    }

    /**
     * Handle left click
     * @param {Object} mouseInfo - Mouse information
     * @param {View} view - The view that was clicked
     * @param {number} id - View ID
     * @param {number} part - Clicked part
     * @returns {boolean} true if handled
     */
    doLeftClick(mouseInfo, view, id, part) {
        // Handle button clicks
        if (id === MessageDialogViewIDs.VIEW_ID_BUTTON_1) {
            this.buttonClickedId = MessageDialogViewIDs.VIEW_ID_BUTTON_1;
            this.doClose();
            return true;
        } else if (id === MessageDialogViewIDs.VIEW_ID_BUTTON_2) {
            this.buttonClickedId = MessageDialogViewIDs.VIEW_ID_BUTTON_2;
            this.doClose();
            return true;
        }
        
        return super.doLeftClick(mouseInfo, view, id, part);
    }

    /**
     * Get button clicked ID
     * @returns {number} Button clicked ID
     */
    getButtonClickedId() {
        return this.buttonClickedId;
    }

    /**
     * Get message code
     * @returns {number} Message code
     */
    getMessageCode() {
        return this.messageCode;
    }

    /**
     * Set message code
     * @param {number} msgCode - Message code
     */
    setMessageCode(msgCode) {
        this.messageCode = msgCode;
    }

    /**
     * Show dialog and wait for result
     * @returns {Promise<number>} Button clicked ID
     */
    showModal() {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            super.showModal();
        });
    }

    /**
     * Handle dialog close
     */
    doClose() {
        if (this.resolvePromise) {
            this.resolvePromise(this.buttonClickedId);
            this.resolvePromise = null;
        }
        super.doClose();
    }

    /**
     * Create OK dialog
     * @param {Controller} parentController - Parent controller
     * @param {string} message - Message text
     * @returns {MessageDialog} OK dialog
     */
    static createOKDialog(parentController, message) {
        return new MessageDialog(parentController, message, MessageDialogButtonText.OK);
    }

    /**
     * Create Yes/No dialog
     * @param {Controller} parentController - Parent controller
     * @param {string} message - Message text
     * @returns {MessageDialog} Yes/No dialog
     */
    static createYesNoDialog(parentController, message) {
        return new MessageDialog(parentController, message, MessageDialogButtonText.YES, MessageDialogButtonText.NO);
    }

    /**
     * Create OK/Cancel dialog
     * @param {Controller} parentController - Parent controller
     * @param {string} message - Message text
     * @returns {MessageDialog} OK/Cancel dialog
     */
    static createOKCancelDialog(parentController, message) {
        return new MessageDialog(parentController, message, MessageDialogButtonText.OK, MessageDialogButtonText.CANCEL);
    }

    /**
     * Create Save/Cancel dialog
     * @param {Controller} parentController - Parent controller
     * @param {string} message - Message text
     * @returns {MessageDialog} Save/Cancel dialog
     */
    static createSaveCancelDialog(parentController, message) {
        return new MessageDialog(parentController, message, MessageDialogButtonText.SAVE, MessageDialogButtonText.CANCEL);
    }

    /**
     * Show OK dialog
     * @param {Controller} parentController - Parent controller
     * @param {string} message - Message text
     * @returns {Promise<number>} Button clicked ID
     */
    static showOKDialog(parentController, message) {
        const dialog = MessageDialog.createOKDialog(parentController, message);
        return dialog.showModal();
    }

    /**
     * Show Yes/No dialog
     * @param {Controller} parentController - Parent controller
     * @param {string} message - Message text
     * @returns {Promise<number>} Button clicked ID
     */
    static showYesNoDialog(parentController, message) {
        const dialog = MessageDialog.createYesNoDialog(parentController, message);
        return dialog.showModal();
    }

    /**
     * Show OK/Cancel dialog
     * @param {Controller} parentController - Parent controller
     * @param {string} message - Message text
     * @returns {Promise<number>} Button clicked ID
     */
    static showOKCancelDialog(parentController, message) {
        const dialog = MessageDialog.createOKCancelDialog(parentController, message);
        return dialog.showModal();
    }

    /**
     * Show Save/Cancel dialog
     * @param {Controller} parentController - Parent controller
     * @param {string} message - Message text
     * @returns {Promise<number>} Button clicked ID
     */
    static showSaveCancelDialog(parentController, message) {
        const dialog = MessageDialog.createSaveCancelDialog(parentController, message);
        return dialog.showModal();
    }
}

/**
 * MessageView for displaying text in MessageDialog
 */
class MessageDialogView extends View {
    constructor(controller, rect, message) {
        super(controller, rect);
        this.message = message;
        this.textSize = 12;
        this.textColor = new pdg.Color(0.0, 0.0, 0.0, 1.0);
    }

    /**
     * Draw the message
     */
    drawSelf(port, frameNum) {
        const viewArea = this.getViewArea();
        
        // Draw background
        var backgroundAttrs = new pdg.Attributes().fillColor(new pdg.Color(1.0, 1.0, 1.0, 1.0));
        port.drawRect(viewArea, backgroundAttrs);
        
        // Draw message text
        const textPoint = new pdg.Point(
            viewArea.left + 10,
            viewArea.top + viewArea.height() / 2 + this.textSize / 2
        );
        var textAttrs = new pdg.Attributes().textSize(this.textSize).textStyle(pdg.textStyle_Centered).fillColor(this.textColor);
        port.drawText(this.message, textPoint, textAttrs);
    }

    /**
     * Set message text
     * @param {string} message - New message text
     */
    setMessage(message) {
        this.message = message;
    }

    /**
     * Set text size
     * @param {number} size - Text size
     */
    setTextSize(size) {
        this.textSize = size;
    }

    /**
     * Set text color
     * @param {Object} color - Text color
     */
    setTextColor(color) {
        this.textColor = color;
    }
}

/**
 * MessageDialogBorderView for drawing border around MessageDialog
 */
class MessageDialogBorderView extends View {
    constructor(controller, rect) {
        super(controller, rect);
        this.borderColor = new pdg.Color(0.3, 0.3, 0.3, 1.0);
        this.borderWidth = 2;
    }

    /**
     * Draw the border
     */
    drawSelf(port, frameNum) {
        const viewArea = this.getViewArea();
        
        // Draw border
        var borderAttrs = new pdg.Attributes().lineColor(this.borderColor).lineThickness(this.borderWidth);
        port.drawRect(viewArea, borderAttrs);
    }

    /**
     * Set border color
     * @param {Object} color - Border color
     */
    setBorderColor(color) {
        this.borderColor = color;
    }

    /**
     * Set border width
     * @param {number} width - Border width
     */
    setBorderWidth(width) {
        this.borderWidth = width;
    }
}

module.exports = {
    MessageDialog,
    MessageDialogView,
    MessageDialogBorderView,
    MessageDialogViewIDs,
    MessageDialogButtonText
};
