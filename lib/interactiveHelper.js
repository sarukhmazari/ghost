const {
    proto,
    generateWAMessageFromContent,
    jidNormalizedUser
} = require('@whiskeysockets/baileys');
const {
    sendButtons: ryuuSendButtons,
    sendInteractiveMessage: ryuuSendInteractiveMessage
} = require('@ryuu-reinzz/button-helper');
const fs = require('fs');
const path = require('path');
const settings = require('../settings');

/**
 * Extracts interactive button selection from incoming message.
 */
function extractInteractiveSelection(rawMsg, senderId = null) {
    if (!rawMsg) return null;
    let m = rawMsg.message;
    if (!m) return null;

    // Unwrap wrappers if message was delivered inside viewOnce or ephemeral
    if (m.ephemeralMessage) m = m.ephemeralMessage.message || m;
    if (m.viewOnceMessage) m = m.viewOnceMessage.message || m;
    if (m.viewOnceMessageV2) m = m.viewOnceMessageV2.message || m;
    if (m.documentWithCaptionMessage) m = m.documentWithCaptionMessage.message || m;

    // 1. Native Flow interactive response (Modern WhatsApp Native Buttons)
    if (m.interactiveResponseMessage) {
        const nf = m.interactiveResponseMessage.nativeFlowResponseMessage;
        if (nf?.paramsJson) {
            try {
                const parsed = JSON.parse(nf.paramsJson);
                const extracted = parsed.id || parsed.selected_row_id || parsed.row_id || parsed.selectedId;
                if (extracted) return String(extracted).trim();
            } catch (e) {}
        }
        if (m.interactiveResponseMessage.body?.text) {
            return m.interactiveResponseMessage.body.text.trim();
        }
    }

    // 2. Buttons response message (Legacy Quick Reply)
    if (m.buttonsResponseMessage?.selectedButtonId) {
        return m.buttonsResponseMessage.selectedButtonId.trim();
    }
    if (m.buttonsResponseMessage?.selectedDisplayText) {
        return m.buttonsResponseMessage.selectedDisplayText.trim();
    }

    // 3. Template button reply message
    if (m.templateButtonReplyMessage?.selectedId) {
        return m.templateButtonReplyMessage.selectedId.trim();
    }
    if (m.templateButtonReplyMessage?.selectedDisplayText) {
        return m.templateButtonReplyMessage.selectedDisplayText.trim();
    }

    // 4. List response message
    if (m.listResponseMessage?.singleSelectReply?.selectedRowId) {
        return m.listResponseMessage.singleSelectReply.selectedRowId.trim();
    }

    return null;
}

/**
 * Sends native WhatsApp interactive messages.
 * Automatically handles interactiveButtons, single_select lists, and quick_replies.
 */
async function sendButtons(sock, chatId, options = {}, quoted = null) {
    const {
        title = '〔 👻 𝗚𝗛𝗢𝗦𝗧 𝗠𝗕𝗢𝗧 〕',
        text = '',
        body = '',
        footer = '👻 Ghost MBot',
        buttons = [],
        interactiveButtons = null
    } = options;

    const mainText = text || body || 'Please choose an option below:';
    const targetChatId = chatId ? jidNormalizedUser(chatId) : chatId;

    try {
        if (interactiveButtons && Array.isArray(interactiveButtons) && interactiveButtons.length > 0) {
            return await ryuuSendInteractiveMessage(sock, targetChatId, {
                title,
                text: mainText,
                footer,
                interactiveButtons
            }, { quoted: quoted || undefined });
        }

        const formattedButtons = buttons.map((b, i) => {
            const label = b.text || b.displayText || b.title || ('Option ' + (i + 1));
            const actionId = b.id || b.buttonId || ('btn_' + (i + 1));
            return {
                id: actionId,
                text: label
            };
        });

        return await ryuuSendButtons(sock, targetChatId, {
            title,
            text: mainText,
            footer,
            buttons: formattedButtons
        }, { quoted: quoted || undefined });

    } catch (err) {
        console.error('sendButtons error:', err.message);

        return await sock.sendMessage(targetChatId, {
            text: `*${title}*\n\n${mainText}\n\n_${footer}_`
        }, { quoted: quoted || undefined });
    }
}

module.exports = {
    extractInteractiveSelection,
    sendButtons,
    sendInteractiveMessage: ryuuSendInteractiveMessage
};
