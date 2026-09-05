const fs = require('fs');
const path = require('path');
const settings = require('../settings');
const isOwnerOrSudo = require('./isOwner');

const modesFilePath = path.join(__dirname, '../data/session_modes.json');

function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true });
    }
}

function loadModes() {
    try {
        if (!fs.existsSync(modesFilePath)) return {};
        const content = fs.readFileSync(modesFilePath, 'utf8');
        return JSON.parse(content || '{}');
    } catch (e) {
        console.error('Error reading session_modes.json:', e.message);
        return {};
    }
}

function saveModes(modes) {
    try {
        ensureDirectoryExistence(modesFilePath);
        fs.writeFileSync(modesFilePath, JSON.stringify(modes, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving session_modes.json:', e.message);
    }
}

function getSessionPhone(sock) {
    if (sock?.user?.id) {
        const phone = sock.user.id.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
        if (phone) return phone;
    }
    if (sock?.phone && sock.phone !== 'main') {
        return sock.phone.replace(/[^0-9]/g, '');
    }
    const defaultOwner = (settings.ownerNumber || '923232391033').replace(/[^0-9]/g, '');
    return defaultOwner;
}

function getSessionId(sock) {
    return getSessionPhone(sock);
}

function getSessionMode(sock) {
    const sessionId = getSessionId(sock);
    const modes = loadModes();
    if (modes[sessionId]) {
        return modes[sessionId];
    }
    return settings.commandMode || 'public';
}

function setSessionMode(sock, mode) {
    const sessionId = getSessionId(sock);
    const modes = loadModes();
    modes[sessionId] = mode;
    saveModes(modes);
    return { sessionId, mode };
}

async function isSessionOwner(sock, senderId, msg = null) {
    // Message sent directly from the session owner account / device
    if (msg?.key?.fromMe) {
        return true;
    }

    if (!senderId) return false;

    // A group JID (xxx@g.us) cannot be a valid user senderId
    if (typeof senderId === 'string' && senderId.endsWith('@g.us')) {
        return false;
    }

    const senderNum = senderId.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
    const sessionPhone = getSessionPhone(sock);

    // Connected WhatsApp number of this socket is the direct owner of this session
    if (sessionPhone && senderNum === sessionPhone) {
        return true;
    }

    // Check against socket user id and lid
    if (sock?.user) {
        if (sock.user.id) {
            const botNum = sock.user.id.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
            if (botNum && senderNum === botNum) return true;
        }
        if (sock.user.lid) {
            const botLid = sock.user.lid.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
            if (botLid && senderNum === botLid) return true;
        }
    }

    // Fallback/additional check against primary owners list or sudo users
    const isGlobalOwner = await isOwnerOrSudo(senderId, sock);
    if (isGlobalOwner) {
        return true;
    }

    return false;
}

module.exports = {
    getSessionPhone,
    getSessionId,
    getSessionMode,
    setSessionMode,
    isSessionOwner
};
