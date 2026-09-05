const isAdmin = require('../lib/isAdmin');
const { unbanUser } = require('../lib/isBanned');

async function unbanCommand(sock, chatId, senderId, mentionedJids, message) {
    const isOwner = message.key.fromMe;
    if (!isOwner) {
        const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '❌ Only admins/owners can use the unban command.' }, { quoted: message });
            return;
        }
    }

    let userToUnban = null;
    if (mentionedJids && mentionedJids.length > 0) {
        userToUnban = mentionedJids[0];
    } else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        userToUnban = message.message.extendedTextMessage.contextInfo.participant;
    }

    if (!userToUnban) {
        await sock.sendMessage(chatId, { text: '❌ Mention a user or reply to their message to unban them!' }, { quoted: message });
        return;
    }

    unbanUser(userToUnban);
    await sock.sendMessage(chatId, {
        text: `✅ User @${userToUnban.split('@')[0]} has been unbanned.`,
        mentions: [userToUnban]
    }, { quoted: message });
}

module.exports = unbanCommand;
