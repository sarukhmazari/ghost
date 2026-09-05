const fs = require('fs');
const path = require('path');
const { downloadMediaMessage, jidNormalizedUser } = require('@whiskeysockets/baileys');

const configPath = path.join(__dirname, '../data/antidelete.json');
const msgStore = new Map(); // id -> msg object

function getAntiDeleteState() {
    try {
        if (!fs.existsSync(configPath)) return false;
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return !!data.enabled;
    } catch (e) {
        return false;
    }
}

function setAntiDeleteState(enabled) {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ enabled }, null, 2));
}

function storeMessage(msg) {
    if (!msg || !msg.key || !msg.key.id) return;
    msgStore.set(msg.key.id, msg);

    // Maintain max 1000 messages in memory store
    if (msgStore.size > 1000) {
        const firstKey = msgStore.keys().next().value;
        msgStore.delete(firstKey);
    }
}

async function handleMessageRevoke(sock, m) {
    if (!getAntiDeleteState()) return;

    const msg = m.messages[0];
    if (!msg || !msg.message) return;

    const protocolMsg = msg.message.protocolMessage;
    if (!protocolMsg || (protocolMsg.type !== 0 && protocolMsg.type !== 'REVOKE')) return;

    const deletedId = protocolMsg.key?.id;
    if (!deletedId || !msgStore.has(deletedId)) return;

    const originalMsg = msgStore.get(deletedId);
    const chatId = originalMsg.key.remoteJid;
    const senderId = originalMsg.key.participant || chatId;
    const isGroup = chatId.endsWith('@g.us');
    const senderNum = senderId.split('@')[0];

    const getMessageText = (m) => {
        const message = m?.message;
        if (!message) return "";
        return (
            message.conversation ||
            message.extendedTextMessage?.text ||
            message.imageMessage?.caption ||
            message.videoMessage?.caption ||
            (message.ephemeralMessage ? getMessageText(message.ephemeralMessage) : "") ||
            (message.viewOnceMessage ? getMessageText(message.viewOnceMessage) : "") ||
            (message.viewOnceMessageV2 ? getMessageText(message.viewOnceMessageV2) : "") ||
            ""
        );
    };

    const textContent = getMessageText(originalMsg);
    const timeStr = new Date().toLocaleTimeString();

    const targetJid = sock.user?.id ? jidNormalizedUser(sock.user.id) : null;
    if (!targetJid) return;

    const header = `🗑️ *DELETED MESSAGE DETECTED*\n\n👤 *From:* @${senderNum}\n📍 *Chat:* ${isGroup ? 'Group Chat' : 'Private DM'}\n🕒 *Time:* ${timeStr}`;

    // Check if media message
    const messageObj = originalMsg.message;
    const isMedia = messageObj?.imageMessage || messageObj?.videoMessage || messageObj?.audioMessage || messageObj?.stickerMessage || messageObj?.documentMessage;

    if (isMedia) {
        try {
            const buffer = await downloadMediaMessage(originalMsg, 'buffer', {});
            const caption = `${header}\n\n💬 *Caption:* ${textContent || 'None'}`;
            
            if (messageObj.imageMessage) {
                await sock.sendMessage(targetJid, { image: buffer, caption, mentions: [senderId] });
            } else if (messageObj.videoMessage) {
                await sock.sendMessage(targetJid, { video: buffer, caption, mentions: [senderId] });
            } else if (messageObj.audioMessage) {
                await sock.sendMessage(targetJid, { text: caption, mentions: [senderId] });
                await sock.sendMessage(targetJid, { audio: buffer, mimetype: messageObj.audioMessage.mimetype, ptt: !!messageObj.audioMessage.ptt });
            } else if (messageObj.stickerMessage) {
                await sock.sendMessage(targetJid, { text: caption, mentions: [senderId] });
                await sock.sendMessage(targetJid, { sticker: buffer });
            } else if (messageObj.documentMessage) {
                await sock.sendMessage(targetJid, { document: buffer, mimetype: messageObj.documentMessage.mimetype, fileName: messageObj.documentMessage.fileName || 'document', caption });
            }
        } catch (err) {
            await sock.sendMessage(targetJid, { text: `${header}\n\n💬 *Text:* ${textContent || '[Failed to download deleted media]'}\n\n⚠️ *Error downloading media:* ${err.message}`, mentions: [senderId] });
        }
    } else {
        await sock.sendMessage(targetJid, { text: `${header}\n\n💬 *Deleted Message:* ${textContent || '[No text / Unknown type]'}`, mentions: [senderId] });
    }
}

module.exports = {
    getAntiDeleteState,
    setAntiDeleteState,
    storeMessage,
    handleMessageRevoke
};
