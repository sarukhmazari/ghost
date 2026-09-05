const { jidNormalizedUser } = require('@whiskeysockets/baileys');

async function dpCommand(sock, chatId, message) {
    try {
        let jid;
        const quotedParticipant = message.message?.extendedTextMessage?.contextInfo?.participant;

        if (quotedParticipant) {
            jid = jidNormalizedUser(quotedParticipant);
        } else if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            jid = jidNormalizedUser(message.message.extendedTextMessage.contextInfo.mentionedJid[0]);
        } else {
            jid = jidNormalizedUser(message.key.participant || message.key.remoteJid);
        }

        if (!jid) {
            return await sock.sendMessage(chatId, { text: '❌ Could not determine user JID.' }, { quoted: message });
        }

        try {
            const ppUrl = await sock.profilePictureUrl(jid, 'image');
            if (!ppUrl) {
                return await sock.sendMessage(chatId, { text: '❌ This user has no DP or privacy settings hide it.' }, { quoted: message });
            }

            await sock.sendMessage(chatId, {
                image: { url: ppUrl },
                caption: `📸 Profile Picture of @${jid.split('@')[0]}`,
                mentions: [jid]
            }, { quoted: message });

        } catch (ppError) {
            await sock.sendMessage(chatId, { text: '❌ Could not fetch profile picture.' }, { quoted: message });
        }

    } catch (error) {
        await sock.sendMessage(chatId, { text: '❌ An error occurred while fetching DP.' }, { quoted: message });
    }
}

module.exports = dpCommand;
