const { jidNormalizedUser } = require('@whiskeysockets/baileys');

const groupCache = new Map();

exports.getGroupMetadata = async (sock, jid) => {
    if (groupCache.has(jid)) {
        return groupCache.get(jid);
    }

    try {
        const metadata = await sock.groupMetadata(jid);
        groupCache.set(jid, metadata);

        // Cache for 60 seconds
        setTimeout(() => groupCache.delete(jid), 60000);
        return metadata;
    } catch (error) {
        console.error('Error fetching group metadata:', error);
        throw error;
    }
};

exports.getAdminStatus = async (sock, chatId, senderId) => {
    try {
        const metadata = await exports.getGroupMetadata(sock, chatId);
        const rawBotId = sock.user?.id ? jidNormalizedUser(sock.user.id) : null;
        const botIdNum = rawBotId ? rawBotId.split('@')[0].split(':')[0] : null;

        const rawSenderId = senderId ? jidNormalizedUser(senderId) : null;
        const senderIdNum = rawSenderId ? rawSenderId.split('@')[0].split(':')[0] : null;

        let isBotAdmin = false;
        let isSenderAdmin = false;

        if (metadata && metadata.participants) {
            for (const p of metadata.participants) {
                const pNum = p.id.split('@')[0].split(':')[0];
                if (p.admin === 'admin' || p.admin === 'superadmin') {
                    if (botIdNum && pNum === botIdNum) {
                        isBotAdmin = true;
                    }
                    if (senderIdNum && pNum === senderIdNum) {
                        isSenderAdmin = true;
                    }
                }
            }
        }
        return { isBotAdmin, isSenderAdmin };
    } catch (e) {
        return { isBotAdmin: false, isSenderAdmin: false };
    }
};
