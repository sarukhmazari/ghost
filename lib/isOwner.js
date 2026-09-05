const settings = require('../settings');

async function isOwnerOrSudo(senderId, sock = null, chatId = null) {
    if (!senderId) return false;

    // Auto-allow bot account itself
    if (sock?.user?.id) {
        const botId = sock.user.id.split(':')[0];
        const selfId = senderId.split(':')[0];
        if (botId === selfId) return true;
    }
    if (sock?.user?.lid) {
        const botLid = sock.user.lid.split(':')[0].split('@')[0];
        const selfLid = senderId.split(':')[0].split('@')[0];
        if (botLid === selfLid) return true;
    }
    
    const ownerNumbers = settings.ownerNumbers || [settings.ownerNumber];
    const senderIdClean = senderId.split(':')[0].split('@')[0];
    
    const isDirectOwner = ownerNumbers.some(num => {
        const cleanNum = num.replace(/[^0-9]/g, '');
        return senderId === (cleanNum + "@s.whatsapp.net") || senderIdClean === cleanNum || senderId.includes(cleanNum);
    });

    if (isDirectOwner) return true;

    // Check against session owner / phone number
    if (sock?.user?.id) {
        const botNum = sock.user.id.split(':')[0].split('@')[0];
        if (senderIdClean === botNum) return true;
    }
    
    return false;
}

module.exports = isOwnerOrSudo;
