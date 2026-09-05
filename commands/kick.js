const isAdmin = require('../lib/isAdmin');

async function kickCommand(sock, chatId, senderId, mentionedJids, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '❌ This command works only in groups.' }, { quoted: message });
        return;
    }

    const isOwner = message.key.fromMe;
    if (!isOwner) {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { text: '❌ Please make the bot an admin first.' }, { quoted: message });
            return;
        }

        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '❌ Only group admins can use the kick command.' }, { quoted: message });
            return;
        }
    }

    let usersToKick = [];
    
    if (mentionedJids && mentionedJids.length > 0) {
        usersToKick = [...new Set(mentionedJids)];
    }
    
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    if (contextInfo?.participant && !usersToKick.includes(contextInfo.participant)) {
        usersToKick.push(contextInfo.participant);
    }
    
    const textArgs = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').split(/\s+/).slice(1);
    for (const arg of textArgs) {
        if (arg.length > 5 && !isNaN(arg.replace(/[^0-9]/g, ''))) {
            const jid = arg.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            if (!usersToKick.includes(jid)) {
                usersToKick.push(jid);
            }
        }
    }

    if (usersToKick.length === 0) {
        await sock.sendMessage(chatId, { text: '❌ Mention a user or reply to their message to kick!' }, { quoted: message });
        return;
    }

    try {
        await sock.groupParticipantsUpdate(chatId, usersToKick, "remove");
        const usernames = usersToKick.map(jid => `@${jid.split('@')[0]}`);
        await sock.sendMessage(chatId, { 
            text: `👢 ${usernames.join(', ')} has been kicked!`,
            mentions: usersToKick
        });
    } catch (error) {
        await sock.sendMessage(chatId, { text: '❌ Failed to kick user(s)!' }, { quoted: message });
    }
}

module.exports = kickCommand;
