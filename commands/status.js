const settings = require('../settings');

async function statusCommand(sock, chatId, message) {
    try {
        const text = `
🤖 *${settings.botName}* Status
━━━━━━━━━━━━━━━━━━━
⚡ *Engine:* Ultra-Fast Mini Edition
⏱️ *Uptime:* ${Math.floor(process.uptime())}s
👥 *Owner:* ${settings.ownerNumber}
⚡ *Status:* Online & Active!
━━━━━━━━━━━━━━━━━━━`.trim();

        await sock.sendMessage(chatId, { text }, { quoted: message });
    } catch (e) {}
}

module.exports = statusCommand;
