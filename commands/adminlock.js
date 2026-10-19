const fs = require('fs');
const path = require('path');
const settings = require('../settings');

const lockPath = path.join(__dirname, '..', 'data', 'adminlock.json');

function getLockData() {
    try {
        if (fs.existsSync(lockPath)) {
            return JSON.parse(fs.readFileSync(lockPath, 'utf8'));
        }
    } catch (e) {}
    return {};
}

function setLockData(data) {
    try {
        if (!fs.existsSync(path.dirname(lockPath))) {
            fs.mkdirSync(path.dirname(lockPath), { recursive: true });
        }
        fs.writeFileSync(lockPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {}
}

async function adminlockCommand(sock, chatId, senderId, args, message) {
    try {
        const ownerNumbers = settings.ownerNumbers || [settings.ownerNumber];
        const senderNumber = senderId.split('@')[0].split(':')[0];
        const isOwner = ownerNumbers.some(num => num.replace(/[^0-9]/g, '') === senderNumber.replace(/[^0-9]/g, ''));

        if (!isOwner && !message.key.fromMe) {
            await sock.sendMessage(chatId, { text: '❌ This command can only be used by the Bot Owner.' }, { quoted: message });
            return;
        }

        const data = getLockData();
        const action = args[0]?.toLowerCase();

        if (action === 'on') {
            data[chatId] = true;
            setLockData(data);
            await sock.sendMessage(chatId, { text: '🔒 *Admin Lock is now ON.*\n\nUnauthorized promotions will be demoted automatically.' }, { quoted: message });
        } else if (action === 'off') {
            data[chatId] = false;
            setLockData(data);
            await sock.sendMessage(chatId, { text: '🔓 *Admin Lock is now OFF.*' }, { quoted: message });
        } else {
            const { sendAdminlockSubMenu } = require('../lib/interactiveMenuHandler');
            return await sendAdminlockSubMenu(sock, chatId, senderId, message);
        }
    } catch (error) {
        console.error('Error in adminlock command:', error);
    }
}

async function handleAdminlockPromotion(sock, groupId, participants, author) {
    try {
        const data = getLockData();
        if (!data[groupId]) return;

        const normalizeJid = (jid) => typeof jid === 'string' ? jid.split(':')[0] : (jid?.id || "").split(':')[0];
        const authorJid = normalizeJid(author);
        if (!authorJid) return;

        const getPhone = (jid) => normalizeJid(jid).split('@')[0].replace(/[^0-9]/g, '');
        const authorPhone = getPhone(authorJid);

        const authorized = new Set();
        authorized.add(settings.ownerNumber.replace(/[^0-9]/g, ''));
        if (Array.isArray(settings.ownerNumbers)) {
            settings.ownerNumbers.forEach(n => authorized.add(n.replace(/[^0-9]/g, '')));
        }
        authorized.add(getPhone(sock.user.id));
        if (sock.user.lid) authorized.add(getPhone(sock.user.lid));

        if (authorized.has(authorPhone)) return;

        const demoteSet = new Set();
        demoteSet.add(authorJid);
        participants.forEach(p => demoteSet.add(normalizeJid(p)));

        const demoteList = Array.from(demoteSet).filter(j => j && j.length > 5 && !authorized.has(getPhone(j)));

        if (demoteList.length > 0) {
            await sock.groupParticipantsUpdate(groupId, demoteList, 'demote');
            await sock.sendMessage(groupId, { 
                text: `🚨 *ADMIN LOCK:* Unauthorized promotion detected.\nPromoter @${authorPhone} and targets demoted.`,
                mentions: demoteList.filter(j => j.includes('@'))
            });
        }
    } catch (error) {
        console.error('Error in handleAdminlockPromotion:', error);
    }
}

module.exports = { adminlockCommand, handleAdminlockPromotion };
