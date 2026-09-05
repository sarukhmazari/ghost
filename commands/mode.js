const { getSessionMode, setSessionMode, isSessionOwner, getSessionPhone } = require('../lib/modeManager');

async function modeCommand(sock, chatId, senderId, message, args) {
    const isOwner = await isSessionOwner(sock, senderId, message);
    const sessionPhone = getSessionPhone(sock);

    if (!isOwner) {
        await sock.sendMessage(chatId, {
            text: `❌ *Access Denied:* Only the owner of this bot session (+${sessionPhone}) can change the session mode.`
        }, { quoted: message });
        return;
    }

    const inputArg = args[0] ? args[0].toLowerCase() : '';
    const currentMode = getSessionMode(sock);

    if (inputArg !== 'private' && inputArg !== 'public') {
        await sock.sendMessage(chatId, {
            text: `❌ *Usage:*\n\`.mode private\`\n\`.mode public\`\n\n📌 *Current Session Mode (+${sessionPhone}):* \`${currentMode}\``
        }, { quoted: message });
        return;
    }

    const { mode } = setSessionMode(sock, inputArg);

    const modeEmoji = mode === 'private' ? '🔒' : '🌐';
    const responseText = `
╭━━━〔 ⚙️ 𝗦𝗘𝗦𝗦𝗜𝗢𝗡 𝗠𝗢𝗗𝗘 〕━━━╮

📱 *Session:* +${sessionPhone}
${modeEmoji} *New Mode:* \`${mode.toUpperCase()}\`

${mode === 'private' 
    ? '🔒 *Private Mode Active:* This session will now respond ONLY to its owner.' 
    : '🌐 *Public Mode Active:* This session will now respond to all users according to normal command permissions.'}

╰━━━━━━━━━━━━━━━━━━━━━━╯`.trim();

    await sock.sendMessage(chatId, { text: responseText }, { quoted: message });
}

module.exports = modeCommand;
