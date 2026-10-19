const settings = require('../settings');

async function statusCommand(sock, chatId, message) {
    try {
        const text = `
┏━━〔 🤖 𝗚𝗛𝗢𝗦𝗧 𝗠𝗕𝗢𝗧 𝗦𝗧𝗔𝗧𝗨𝗦 〕━━┓
┃ ⚡ *Engine:* Ghost Ultra-Fast Core
┃ ⏱️ *Uptime:* ${Math.floor(process.uptime())}s
┃ 👑 *Owner:* ${settings.ownerNumber}
┃ 🟢 *Status:* Online & Responsive
┗━━━━━━━━━━━━━━━━━━━━━━━┛`.trim();

        await sock.sendMessage(chatId, { text }, { quoted: message });
    } catch (e) {}
}

module.exports = statusCommand;
