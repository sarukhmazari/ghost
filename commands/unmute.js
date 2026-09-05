const isAdmin = require('../lib/isAdmin');

async function unmuteCommand(sock, chatId, senderId, message) {
    try {
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { text: '❌ This command works only in groups.' }, { quoted: message });
            return;
        }

        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        
        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { text: '❌ Please make the bot an admin first.' }, { quoted: message });
            return;
        }

        if (!isSenderAdmin && !message.key.fromMe) {
            await sock.sendMessage(chatId, { text: '❌ Only group admins can use this command.' }, { quoted: message });
            return;
        }

        await sock.groupSettingUpdate(chatId, 'not_announcement');
        await sock.sendMessage(chatId, { text: '🔓 *Group Unmuted Successfully!*' }, { quoted: message });

    } catch (error) {
        await sock.sendMessage(chatId, { text: '❌ Failed to unmute group.' }, { quoted: message });
    }
}

module.exports = unmuteCommand;
