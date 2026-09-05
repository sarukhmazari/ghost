const adminCache = new Map();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes cache for super-fast responses

async function isAdmin(sock, chatId, senderId) {
    if (!chatId || !chatId.endsWith('@g.us')) {
        return { isSenderAdmin: false, isBotAdmin: false };
    }
    try {
        const now = Date.now();
        let metadata;
        
        if (adminCache.has(chatId) && (now - adminCache.get(chatId).timestamp < CACHE_TTL)) {
            metadata = adminCache.get(chatId).metadata;
        } else {
            metadata = await sock.groupMetadata(chatId);
            adminCache.set(chatId, { metadata, timestamp: now });
        }

        const participants = metadata.participants || [];

        const botId = sock.user?.id || '';
        const botLid = sock.user?.lid || '';
        const botNumber = botId.includes(':') ? botId.split(':')[0] : (botId.includes('@') ? botId.split('@')[0] : botId);
        const botLidNumeric = botLid.includes(':') ? botLid.split(':')[0] : (botLid.includes('@') ? botLid.split('@')[0] : botLid);

        const senderNumber = senderId.includes(':') ? senderId.split(':')[0] : (senderId.includes('@') ? senderId.split('@')[0] : senderId);
        const senderIdWithoutSuffix = senderId.includes('@') ? senderId.split('@')[0] : senderId;

        const isBotAdmin = participants.some(p => {
            const pPhoneNumber = p.phoneNumber ? p.phoneNumber.split('@')[0] : '';
            const pId = p.id ? p.id.split('@')[0] : '';
            const pLid = p.lid ? p.lid.split('@')[0] : '';
            const pLidNumeric = pLid.includes(':') ? pLid.split(':')[0] : pLid;
            
            const botMatches = (
                botId === p.id || 
                botId === p.lid || 
                botLid === p.lid || 
                botLidNumeric === pLidNumeric || 
                botNumber === pPhoneNumber || 
                botNumber === pId
            );
            
            return botMatches && (p.admin === 'admin' || p.admin === 'superadmin');
        });

        const isSenderAdmin = participants.some(p => {
            const pPhoneNumber = p.phoneNumber ? p.phoneNumber.split('@')[0] : '';
            const pId = p.id ? p.id.split('@')[0] : '';
            const pLid = p.lid ? p.lid.split('@')[0] : '';
            
            const senderMatches = (
                senderId === p.id || 
                senderId === p.lid || 
                senderNumber === pPhoneNumber || 
                senderNumber === pId || 
                senderIdWithoutSuffix === pPhoneNumber || 
                senderIdWithoutSuffix === pId || 
                (pLid && senderIdWithoutSuffix === pLid)
            );
            
            return senderMatches && (p.admin === 'admin' || p.admin === 'superadmin');
        });

        return { isSenderAdmin, isBotAdmin };
    } catch (err) {
        console.error('❌ Error in isAdmin:', err.message);
        return { isSenderAdmin: false, isBotAdmin: false };
    }
}

module.exports = isAdmin;
