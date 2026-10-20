const {
    proto,
    generateWAMessageFromContent,
    jidNormalizedUser,
    isJidGroup
} = require('@whiskeysockets/baileys');
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
 * Uses viewOnceMessage + messageContextInfo wrapper with biz & bot binary nodes,
 * which forces WhatsApp Android, iOS, and Web to render interactive buttons natively.
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
        let formattedButtons = [];

        if (interactiveButtons && Array.isArray(interactiveButtons) && interactiveButtons.length > 0) {
            formattedButtons = interactiveButtons.map((btn, i) => {
                if (btn.name && btn.buttonParamsJson) return btn;
                return {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: btn.text || btn.displayText || `Option ${i + 1}`,
                        id: btn.id || `btn_${i + 1}`
                    })
                };
            });
        } else if (Array.isArray(buttons) && buttons.length > 0) {
            formattedButtons = buttons.map((b, i) => {
                if (b.name && b.buttonParamsJson) return b;
                const label = b.text || b.displayText || b.title || `Option ${i + 1}`;
                const actionId = b.id || b.buttonId || `btn_${i + 1}`;
                return {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: label,
                        id: actionId
                    })
                };
            });
        }

        const interactiveMessage = {
            body: { text: mainText },
            footer: { text: footer || '👻 Ghost MBot' },
            header: {
                title: title || '',
                hasMediaAttachment: false
            },
            nativeFlowMessage: {
                buttons: formattedButtons
            }
        };

        const userJid = sock.user?.id ? jidNormalizedUser(sock.user.id) : (sock.authState?.creds?.me?.id || undefined);

        const messageContent = generateWAMessageFromContent(targetChatId, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2
                    },
                    interactiveMessage
                }
            }
        }, {
            userJid,
            quoted: quoted || undefined
        });

        const isGroup = isJidGroup ? isJidGroup(targetChatId) : targetChatId.endsWith('@g.us');
        const isPrivate = !isGroup;

        const additionalNodes = [
            {
                tag: 'biz',
                attrs: {},
                content: [{
                    tag: 'interactive',
                    attrs: { type: 'native_flow', v: '1' },
                    content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
                }]
            }
        ];
        if (isPrivate) {
            additionalNodes.push({ tag: 'bot', attrs: { biz_bot: '1' } });
        }

        return await sock.relayMessage(targetChatId, messageContent.message, {
            messageId: messageContent.key.id,
            additionalNodes
        });

    } catch (err) {
        console.error('Interactive sendButtons error:', err.message);

        // Fallback to sending standard clean text message
        return await sock.sendMessage(targetChatId, {
            text: `*${title}*\n\n${mainText}\n\n_${footer}_`
        }, { quoted: quoted || undefined });
    }
}

module.exports = {
    extractInteractiveSelection,
    sendButtons
};
