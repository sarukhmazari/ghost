const isAdmin = require('../lib/isAdmin');
const { banUser } = require('../lib/isBanned');

async function banCommand(sock, chatId, senderId, mentionedJids, message) {
    const isOwner = message.key.fromMe;
    if (!isOwner) {
        const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '❌ Only admins/owners can use the ban command.' }, { quoted: message });
            return;
        }
    }

    let userToBan = null;
    if (mentionedJids && mentionedJids.length > 0) {
        userToBan = mentionedJids[0];
    } else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        userToBan = message.message.extendedTextMessage.contextInfo.participant;
    }

    if (!userToBan) {
        await sock.sendMessage(chatId, { text: '❌ Mention a user or reply to their message to ban them!' }, { quoted: message });
        return;
    }

    banUser(userToBan);
    await sock.sendMessage(chatId, {
        text: `🚫 User @${userToBan.split('@')[0]} has been banned from using the bot.`,
        mentions: [userToBan]
    }, { quoted: message });
}

module.exports = banCommand;
