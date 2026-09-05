async function jidCommand(sock, chatId, senderId, message) {
    try {
        const contextInfo = 
            message.message?.extendedTextMessage?.contextInfo ||
            message.message?.imageMessage?.contextInfo ||
            message.message?.videoMessage?.contextInfo ||
            message.message?.contextInfo;

        let response = `📍 *CURRENT CHAT JID:*\n\`${chatId}\`\n\n👤 *YOUR JID:*\n\`${senderId}\``;

        // Check if replying to or forwarding from a channel
        const newsletterInfo = contextInfo?.forwardedNewsletterMessageInfo;
        if (newsletterInfo && newsletterInfo.newsletterJid) {
            response += `\n\n📢 *DETECTED CHANNEL JID:*\nName: *${newsletterInfo.newsletterName || 'Channel'}*\nJID: \`${newsletterInfo.newsletterJid}\``;
        }

        // If used directly inside a WhatsApp channel
        if (chatId.endsWith('@newsletter')) {
            response += `\n\n📢 *THIS IS A WHATSAPP CHANNEL!*`;
        }

        await sock.sendMessage(chatId, { text: response }, { quoted: message });
    } catch (error) {
        console.error('Error in jid command:', error);
        await sock.sendMessage(chatId, { text: `📍 *JID:* \`${chatId}\`` }, { quoted: message });
    }
}

module.exports = jidCommand;
