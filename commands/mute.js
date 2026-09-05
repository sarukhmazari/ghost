const isAdmin = require('../lib/isAdmin');

async function muteCommand(sock, chatId, senderId, message, durationInMinutes) {
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
        await sock.sendMessage(chatId, { text: '❌ Only group admins can use the mute command.' }, { quoted: message });
        return;
    }

    try {
        await sock.groupSettingUpdate(chatId, 'announcement');
        
        if (durationInMinutes !== undefined && durationInMinutes > 0) {
            const durationInMilliseconds = durationInMinutes * 60 * 1000;
            await sock.sendMessage(chatId, { text: `🔒 The group has been muted for ${durationInMinutes} minutes.` }, { quoted: message });
            
            setTimeout(async () => {
                try {
                    await sock.groupSettingUpdate(chatId, 'not_announcement');
                    await sock.sendMessage(chatId, { text: '🔓 The group has been unmuted.' });
                } catch (e) {}
            }, durationInMilliseconds);
        } else {
            await sock.sendMessage(chatId, { text: '🔒 The group has been muted.' }, { quoted: message });
        }
    } catch (error) {
        await sock.sendMessage(chatId, { text: '❌ Failed to mute group.' }, { quoted: message });
    }
}

module.exports = muteCommand;
