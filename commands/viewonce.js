const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

const vvMode = new Map();
const modePath = path.join(__dirname, '..', 'data', 'vvMode.json');

function loadVVMode() {
    try {
        if (fs.existsSync(modePath)) {
            const data = JSON.parse(fs.readFileSync(modePath));
            for (const [user, mode] of Object.entries(data)) {
                vvMode.set(user, mode);
            }
        }
    } catch (e) {}
}

function saveVVMode() {
    try {
        const data = {};
        for (const [user, mode] of vvMode) {
            data[user] = mode;
        }
        if (!fs.existsSync(path.dirname(modePath))) {
            fs.mkdirSync(path.dirname(modePath), { recursive: true });
        }
        fs.writeFileSync(modePath, JSON.stringify(data));
    } catch (e) {}
}

loadVVMode();

async function extractViewOnceMedia(message) {
    try {
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) return null;

        const vOnce = quoted.viewOnceMessageV2?.message || quoted.viewOnceMessage?.message || quoted;
        const quotedImage = vOnce.imageMessage;
        const quotedVideo = vOnce.videoMessage;
        const quotedAudio = vOnce.audioMessage;

        let mediaContent, mediaType, mimeType, caption;
        if (quotedImage && (quotedImage.viewOnce || vOnce === quoted.viewOnceMessage?.message || vOnce === quoted.viewOnceMessageV2?.message)) {
            mediaContent = quotedImage;
            mediaType = 'image';
            mimeType = 'image/jpeg';
            caption = quotedImage.caption || '';
        } else if (quotedVideo && (quotedVideo.viewOnce || vOnce === quoted.viewOnceMessage?.message || vOnce === quoted.viewOnceMessageV2?.message)) {
            mediaContent = quotedVideo;
            mediaType = 'video';
            mimeType = 'video/mp4';
            caption = quotedVideo.caption || '';
        } else if (quotedAudio && (quotedAudio.viewOnce || vOnce === quoted.viewOnceMessage?.message || vOnce === quoted.viewOnceMessageV2?.message)) {
            mediaContent = quotedAudio;
            mediaType = 'audio';
            mimeType = 'audio/mpeg';
            caption = '';
        } else {
            return null;
        }

        if (!mediaContent.mediaKey) return null;
        
        const stream = await downloadContentFromMessage(mediaContent, mediaType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        return { mediaContent, mediaType, mimeType, caption, buffer };
    } catch (error) {
        return null;
    }
}

async function viewonceCommand(sock, chatId, message) {
    try {
        const userJid = message.key.participant || message.key.remoteJid;
        if (!userJid) {
            return await sock.sendMessage(chatId, { text: '❌ Unable to identify user.' }, { quoted: message });
        }

        const text = (
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            ''
        ).trim().toLowerCase();

        const args = text.split(/\s+/);
        const subCommand = args[1];

        if (subCommand === 'private' || subCommand === 'public') {
            const newMode = subCommand;
            vvMode.set(userJid, newMode);
            saveVVMode();

            const responseText = newMode === 'private' ?
                '🔒 VV mode set to PRIVATE for you only' :
                '🌐 VV mode set to PUBLIC for you only';

            return await sock.sendMessage(chatId, { text: responseText }, { quoted: message });
        }

        const extracted = await extractViewOnceMedia(message);
        if (!extracted) {
            return await sock.sendMessage(chatId, { text: '❌ Reply to a view-once message' }, { quoted: message });
        }

        const { mediaType, mimeType, caption, buffer } = extracted;
        const mode = vvMode.get(userJid) || 'public';

        if (mode === 'private') {
            try {
                if (mediaType === 'image') {
                    await sock.sendMessage(userJid, { image: buffer, caption: `📝 Caption: ${caption || 'None'}` });
                } else if (mediaType === 'video') {
                    await sock.sendMessage(userJid, { video: buffer, caption: `📝 Caption: ${caption || 'None'}` });
                } else if (mediaType === 'audio') {
                    await sock.sendMessage(userJid, { audio: buffer, mimetype: mimeType, ptt: false });
                    await sock.sendMessage(userJid, { text: `📝 Caption: ${caption || 'None'}` });
                }
                await sock.sendMessage(chatId, { text: '✅ Sent privately to you' });
                return;
            } catch (e) {
                return await sock.sendMessage(chatId, { text: '❌ Failed to send media privately' });
            }
        }

        const options = { quoted: message };
        if (mediaType === 'image') {
            await sock.sendMessage(chatId, { image: buffer, caption: caption }, options);
        } else if (mediaType === 'video') {
            await sock.sendMessage(chatId, { video: buffer, caption: caption }, options);
        } else if (mediaType === 'audio') {
            await sock.sendMessage(chatId, { audio: buffer, mimetype: mimeType, ptt: false }, options);
        }
    } catch (error) {
        await sock.sendMessage(chatId, { text: '❌ Failed to process command!' });
    }
}

module.exports = viewonceCommand;
module.exports.extractViewOnceMedia = extractViewOnceMedia;
