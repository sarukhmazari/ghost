const settings = require('../settings');

function formatTime(seconds) {
    const days = Math.floor(seconds / (24 * 60 * 60));
    seconds = seconds % (24 * 60 * 60);
    const hours = Math.floor(seconds / (60 * 60));
    seconds = seconds % (60 * 60);
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);

    let time = '';
    if (days > 0) time += `${days}d `;
    if (hours > 0) time += `${hours}h `;
    if (minutes > 0) time += `${minutes}m `;
    if (seconds > 0 || time === '') time += `${seconds}s`;

    return time.trim();
}

async function pingCommand(sock, chatId, message, startTime) {
    try {
        const latency = Date.now() - startTime;
        const uptimeFormatted = formatTime(process.uptime());

        const botInfo = `
┏━━〔 ⚡ 𝗚𝗛𝗢𝗦𝗧 𝗠𝗕𝗢𝗧 〕━━┓
┃ 🚀 *Latency:* ${latency} ms
┃ ⏱️ *Uptime:* ${uptimeFormatted}
┃ ⚡ *Status:* Online & Active
┗━━━━━━━━━━━━━━━━━━┛`.trim();

        await sock.sendMessage(chatId, { text: botInfo }, { quoted: message });

    } catch (error) {
        await sock.sendMessage(chatId, { text: '❌ Failed to get ping status.' });
    }
}

module.exports = pingCommand;
