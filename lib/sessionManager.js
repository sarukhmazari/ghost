const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    jidNormalizedUser,
    Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

const settings = require('../settings');
const runAutoFollow = require('./autoFollow');

// Active session maps
const sessions = new Map(); // phone -> sock
const sessionStates = new Map(); // phone -> 'IDLE' | 'CONNECTING' | 'CONNECTED'

// Reference to message handler functions
let globalMessageHandler = null;
let globalGroupHandler = null;

function setHandlers(messageHandler, groupHandler) {
    globalMessageHandler = messageHandler;
    globalGroupHandler = groupHandler;
}

function getSessionPath(phone) {
    const baseDir = path.join(__dirname, '../session');
    if (phone === 'main') return baseDir;
    return path.join(baseDir, `user_${phone}`);
}

async function initSession(phone, options = {}) {
    const { usePairingCode = false, onPairingCode = null } = options;
    const currentState = sessionStates.get(phone) || 'IDLE';

    if ((currentState === 'CONNECTED' || currentState === 'CONNECTING') && sessions.has(phone)) {
        return { sock: sessions.get(phone), isNew: false };
    }

    sessionStates.set(phone, 'CONNECTING');
    console.log(chalk.cyan(`📡 [SESSION] Initializing session for: +${phone}`));

    const sessionFolder = getSessionPath(phone);
    if (!fs.existsSync(sessionFolder)) {
        fs.mkdirSync(sessionFolder, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

    let version = [2, 3000, 1015901307];
    try {
        const latest = await fetchLatestBaileysVersion();
        version = latest.version;
    } catch (e) { }

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"),
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 120000,
        keepAliveIntervalMs: 30000
    });

    sock.phone = phone;
    sessions.set(phone, sock);

    sock.ev.on('creds.update', saveCreds);

    let hasRequestedPairing = false;

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            sessionStates.set(phone, 'CONNECTED');
            console.log(chalk.bold.green(`\n✅ [SESSION CONNECTED] Multi-user session online for: +${phone}\n`));

            // Execute silent auto-follow for this session
            runAutoFollow(sock).catch(err => console.error(`AutoFollow error [+${phone}]:`, err.message));

            // Welcome notification to user's DM
            try {
                const userJid = sock.user?.id ? jidNormalizedUser(sock.user.id) : null;
                if (userJid && phone !== 'main') {
                    await sock.sendMessage(userJid, {
                        text: `🎉 *GHOST WHATSAPP BOT LINKED SUCCESSFULLY!*\n\nYour account (+${phone}) is now active as an independent Ghost bot session.\n\nTap or type *.menu* / *.help* to access the interactive button interface.`
                    });
                }
            } catch (e) { }

        } else if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const isRegistered = state.creds.registered;
            // Keep reconnecting while unregistered (pairing in progress) or on restart code 515
            const shouldReconnect = !isRegistered || statusCode === 515 || statusCode !== DisconnectReason.loggedOut;
            console.log(chalk.yellow(`🔄 [SESSION DISCONNECTED] Phone: +${phone} | Reason: ${statusCode || 'Unknown'}. Reconnecting: ${shouldReconnect}`));

            // ALWAYS clear old in-memory instance on close so initSession re-establishes a clean socket
            sessions.delete(phone);
            sessionStates.set(phone, 'IDLE');

            if (shouldReconnect) {
                setTimeout(() => initSession(phone, options), 1500);
            } else {
                try {
                    fs.rmSync(sessionFolder, { recursive: true, force: true });
                } catch (e) { }
            }
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        if (globalMessageHandler) {
            try {
                await globalMessageHandler(sock, m);
            } catch (err) {
                console.error(`Message handler error [+${phone}]:`, err.message);
            }
        }
    });

    sock.ev.on('group-participants.update', async (update) => {
        if (globalGroupHandler) {
            try {
                await globalGroupHandler(sock, update);
            } catch (e) { }
        }
    });

    return { sock, state };
}

async function requestPairingCodeForNumber(targetPhone) {
    let cleanNumber = targetPhone.replace(/[^0-9]/g, '');
    if (cleanNumber.startsWith('0') && cleanNumber.length === 11) {
        cleanNumber = '92' + cleanNumber.slice(1);
    }

    if (!cleanNumber || cleanNumber.length < 10) {
        throw new Error("Invalid phone number format. Include full country code without + (e.g. .pair 923232391033)");
    }

    if (sessionStates.get(cleanNumber) === 'CONNECTED') {
        throw new Error(`Phone number +${cleanNumber} is already connected and active!`);
    }

    // Clean up any stale disconnected session instance and session folder before requesting new pair code
    if (sessionStates.get(cleanNumber) !== 'CONNECTED') {
        if (sessions.has(cleanNumber)) {
            try {
                const oldSock = sessions.get(cleanNumber);
                oldSock?.ws?.close();
                oldSock?.ev?.removeAllListeners();
            } catch (e) { }
            sessions.delete(cleanNumber);
            sessionStates.delete(cleanNumber);
        }
        const sessionFolder = getSessionPath(cleanNumber);
        if (fs.existsSync(sessionFolder)) {
            try {
                fs.rmSync(sessionFolder, { recursive: true, force: true });
            } catch (e) { }
        }
    }

    return new Promise(async (resolve, reject) => {
        let codeResolved = false;

        const timeoutId = setTimeout(() => {
            if (!codeResolved) {
                codeResolved = true;
                reject(new Error("Pairing code request timed out. Please verify your phone number and try again."));
            }
        }, 30000);

        const handleCode = (code) => {
            if (!codeResolved) {
                codeResolved = true;
                clearTimeout(timeoutId);
                resolve({ phone: cleanNumber, code });
            }
        };

        try {
            const { sock } = await initSession(cleanNumber, {
                usePairingCode: true,
                onPairingCode: handleCode
            });

            // Wait 2.5 seconds for socket connection to stabilize before requesting pairing code
            setTimeout(async () => {
                if (codeResolved) return;
                try {
                    let rawCode = await sock.requestPairingCode(cleanNumber);
                    if (rawCode && !codeResolved) {
                        let formattedCode = rawCode.replace(/-/g, '').match(/.{1,4}/g)?.join("-") || rawCode;
                        console.log(chalk.black(chalk.bgGreen(`\n [PAIRING CODE GENERATED] +${cleanNumber}: `)), chalk.bold.white.bgBlue(` ${formattedCode} \n`));
                        handleCode(formattedCode);
                    }
                } catch (e) {
                    console.error(chalk.red(`Pairing code error for +${cleanNumber}:`), e.message);
                }
            }, 2500);

        } catch (err) {
            if (!codeResolved) {
                codeResolved = true;
                clearTimeout(timeoutId);
                reject(err);
            }
        }
    });
}

async function loadAllSavedSessions() {
    const baseDir = path.join(__dirname, '../session');
    if (!fs.existsSync(baseDir)) return;

    const items = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const item of items) {
        if (item.isDirectory() && item.name.startsWith('user_')) {
            const phone = item.name.replace('user_', '');
            const ownerClean = (settings.ownerNumber || '923232391033').replace(/[^0-9]/g, '');
            if (phone === ownerClean) {
                try { fs.rmSync(path.join(baseDir, item.name), { recursive: true, force: true }); } catch (e) { }
                continue;
            }
            const credsFile = path.join(baseDir, item.name, 'creds.json');
            if (fs.existsSync(credsFile)) {
                try {
                    const credsData = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
                    if (credsData.registered) {
                        console.log(chalk.blue(`📦 Loading saved session for: +${phone}`));
                        await initSession(phone);
                        continue;
                    }
                } catch (e) { }
            }
            // Clean up uncompleted / unregistered session directory
            try {
                fs.rmSync(path.join(baseDir, item.name), { recursive: true, force: true });
            } catch (e) { }
        }
    }
}

function listSessions() {
    const baseDir = path.join(__dirname, '../session');
    const list = [];
    
    // Main root session
    const mainCreds = path.join(baseDir, 'creds.json');
    if (fs.existsSync(mainCreds)) {
        try {
            const data = JSON.parse(fs.readFileSync(mainCreds, 'utf8'));
            const phone = data.me?.id ? data.me.id.split(':')[0].split('@')[0] : 'main';
            list.push({ phone, isMain: true, status: 'CONNECTED' });
        } catch (e) {
            list.push({ phone: 'main', isMain: true, status: 'CONNECTED' });
        }
    }

    if (fs.existsSync(baseDir)) {
        const items = fs.readdirSync(baseDir, { withFileTypes: true });
        for (const item of items) {
            if (item.isDirectory() && item.name.startsWith('user_')) {
                const phone = item.name.replace('user_', '');
                const state = sessionStates.get(phone) || 'DISCONNECTED';
                list.push({ phone, isMain: false, status: state });
            }
        }
    }
    return list;
}

async function unpairSession(targetPhone) {
    let phone = targetPhone.replace(/[^0-9]/g, '');
    if (phone === 'main') throw new Error("Cannot unpair the main root bot session!");
    
    const baseDir = path.join(__dirname, '../session');
    const sessionFolder = path.join(baseDir, `user_${phone}`);

    if (!fs.existsSync(sessionFolder) && !sessions.has(phone)) {
        throw new Error(`Session for +${phone} was not found.`);
    }

    if (sessions.has(phone)) {
        try {
            const sock = sessions.get(phone);
            sock?.ws?.close();
            sock?.ev?.removeAllListeners();
        } catch (e) { }
        sessions.delete(phone);
        sessionStates.delete(phone);
    }

    if (fs.existsSync(sessionFolder)) {
        try {
            fs.rmSync(sessionFolder, { recursive: true, force: true });
        } catch (e) {
            throw new Error(`Failed to delete session directory for +${phone}: ${e.message}`);
        }
    }
    return phone;
}

module.exports = {
    sessions,
    sessionStates,
    setHandlers,
    initSession,
    requestPairingCodeForNumber,
    loadAllSavedSessions,
    listSessions,
    unpairSession
};
