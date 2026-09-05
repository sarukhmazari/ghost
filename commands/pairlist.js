const { listSessions, unpairSession } = require('../lib/sessionManager');
const isOwnerOrSudo = require('../lib/isOwner');

/**
 * .pairlist / .unpair command module
 * Restricted exclusively to root bot owner / main connected bot session
 */
async function pairlistCommand(sock, chatId, senderId, message, args = [], commandName = 'pairlist') {
    try {
        // Ensure ONLY root owner / main session can use this
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        if (!isOwner && !message.key.fromMe) {
            return await sock.sendMessage(chatId, {
                text: '❌ *Access Denied:* Only the root bot owner can manage paired sessions.'
            }, { quoted: message });
        }

        const cmd = commandName.toLowerCase();

        if (cmd === 'unpair') {
            const target = args[0] ? args[0].trim() : '';
            if (!target) {
                return await sock.sendMessage(chatId, {
                    text: '❌ *Usage:* `.unpair <phone_number>`\n\n*Example:* `.unpair 923292823218`'
                }, { quoted: message });
            }

            try {
                const removedPhone = await unpairSession(target);
                return await sock.sendMessage(chatId, {
                    text: `✅ *Session Unpaired Successfully!*\n\n📱 *Removed Number:* +${removedPhone}`
                }, { quoted: message });
            } catch (err) {
                return await sock.sendMessage(chatId, {
                    text: `❌ *Unpair Failed:* ${err.message}`
                }, { quoted: message });
            }
        }

        // Default: list all paired numbers
        const sessionsList = listSessions();
        if (sessionsList.length === 0) {
            return await sock.sendMessage(chatId, {
                text: '📱 *No paired sessions found.*'
            }, { quoted: message });
        }

        let text = `╭━━━〔 📱 *ZOXER PAIR LIST* 〕━━━╮\n\n`;
        sessionsList.forEach((s, idx) => {
            const label = s.isMain ? '👑 Root Main Bot' : '📱 Linked Session';
            const statusIcon = s.status === 'CONNECTED' ? '🟢 Online' : '🔴 Offline';
            text += `*${idx + 1}.* +${s.phone}\n   ├ *Type:* ${label}\n   └ *Status:* ${statusIcon}\n\n`;
        });
        text += `📌 *Total Sessions:* ${sessionsList.length}\n`;
        text += `💡 *To unpair a session:* \`.unpair <number>\`\n`;
        text += `╰━━━━━━━━━━━━━━━━━━━━━━╯`;

        await sock.sendMessage(chatId, { text: text.trim() }, { quoted: message });

    } catch (error) {
        console.error('Pairlist command error:', error);
        await sock.sendMessage(chatId, {
            text: `❌ Error managing pair list: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = pairlistCommand;
