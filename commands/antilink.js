const { isAntiLinkEnabled, setAntiLinkState } = require('../lib/antiLink');
const isAdmin = require('../lib/isAdmin');
const isOwnerOrSudo = require('../lib/isOwner');

async function antilinkCommand(sock, chatId, senderId, args, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '❌ This command can only be used in group chats!' }, { quoted: message });
        return;
    }

    const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
    if (!isSenderAdmin && !isOwner) {
        await sock.sendMessage(chatId, { text: '❌ Only group admins or bot owner can enable/disable Anti-Link!' }, { quoted: message });
        return;
    }

    const action = args[0] ? args[0].toLowerCase() : '';

    if (action === 'on' || action === 'enable') {
        setAntiLinkState(chatId, true);
        await sock.sendMessage(chatId, { text: '✅ *Anti-Link is now ENABLED for this group!*\n\n📌 *Allowed:* YouTube & TikTok links (`youtube.com`, `youtu.be`, `tiktok.com`)\n🚫 *Forbidden:* All website links, WhatsApp group/channel links, FB & social media links.' }, { quoted: message });
    } else if (action === 'off' || action === 'disable') {
        setAntiLinkState(chatId, false);
        await sock.sendMessage(chatId, { text: '❌ *Anti-Link is now DISABLED for this group!*' }, { quoted: message });
    } else {
        const { sendAntilinkSubMenu } = require('../lib/interactiveMenuHandler');
        return await sendAntilinkSubMenu(sock, chatId, senderId, message);
    }
}

module.exports = antilinkCommand;
