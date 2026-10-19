require('dotenv').config();

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
const readline = require('readline');

// Intercept process.stdout and process.stderr to suppress Baileys SessionEntry noise logs completely
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

function isNoiseLog(str) {
    if (typeof str === 'string') {
        if (
            str.includes('Closing session:') ||
            str.includes('SessionEntry') ||
            str.includes('Closing open session') ||
            str.includes('_chains:')
        ) {
            return true;
        }
    }
    return false;
}

process.stdout.write = function (chunk, encoding, cb) {
    if (isNoiseLog(chunk ? chunk.toString() : '')) return true;
    return originalStdoutWrite(chunk, encoding, cb);
};

process.stderr.write = function (chunk, encoding, cb) {
    if (isNoiseLog(chunk ? chunk.toString() : '')) return true;
    return originalStderrWrite(chunk, encoding, cb);
};

const settings = require('./settings');
const { isBanned } = require('./lib/isBanned');
const isOwnerOrSudo = require('./lib/isOwner');
const runAutoFollow = require('./lib/autoFollow');
const { setHandlers, loadAllSavedSessions, requestPairingCodeForNumber } = require('./lib/sessionManager');
const { storeMessage, handleMessageRevoke } = require('./lib/antiDelete');
const { handleAntiLink } = require('./lib/antiLink');
const { getSessionMode, isSessionOwner } = require('./lib/modeManager');

// Interactive System imports
const { extractInteractiveSelection } = require('./lib/interactiveHelper');
const {
    handleInteractiveAction,
    handleGuidedFlowInput,
    sendMainMenu,
    sendGroupMenu,
    sendAdminMenu,
    sendToolMenu,
    sendOwnerMenu,
    sendDownloadMenu,
    sendGamesMenu
} = require('./lib/interactiveMenuHandler');
const { isFlowActive } = require('./lib/interactiveFlow');

// Command imports
const { autoreactCommand, addAutoReaction } = require('./commands/autoreact');
const { autoreadCommand, handleAutoread } = require('./commands/autoread');
const { autotypingCommand, handleAutotypingForMessage } = require('./commands/autotyping');
const viewonceCommand = require('./commands/viewonce');
const { extractViewOnceMedia } = require('./commands/viewonce');
const muteCommand = require('./commands/mute');
const unmuteCommand = require('./commands/unmute');
const kickCommand = require('./commands/kick');
const banCommand = require('./commands/ban');
const unbanCommand = require('./commands/unban');
const { adminlockCommand, handleAdminlockPromotion } = require('./commands/adminlock');
const dpCommand = require('./commands/dp');
const tagAllCommand = require('./commands/tagall');
const hideTagCommand = require('./commands/hidetag');
const pingCommand = require('./commands/ping');
const statusCommand = require('./commands/status');
const jidCommand = require('./commands/jid');
const pairCommand = require('./commands/pair');
const antideleteCommand = require('./commands/antidelete');
const antilinkCommand = require('./commands/antilink');
const modeCommand = require('./commands/mode');
const gcsstatusCommand = require('./commands/gcsstatus');
const pairlistCommand = require('./commands/pairlist');
const ownerCommand = require('./commands/owner');

// Ensure temp directory exists
const tempFolder = path.join(__dirname, 'temp');
if (!fs.existsSync(tempFolder)) fs.mkdirSync(tempFolder, { recursive: true });

// Universal group participant update handler
async function handleGroupParticipantUpdate(sock, update) {
    if (update.action === 'promote') {
        await handleAdminlockPromotion(sock, update.id, update.participants, update.author);
    }
}

// Universal Message handler (Optimized for Millisecond speed, interactive buttons & commands)
async function handleMessages(sock, m) {
    const startTime = Date.now();
    const msg = m.messages[0];
    if (!msg || !msg.message || msg.key.remoteJid === 'status@broadcast') return;

    const chatId = msg.key.remoteJid;
    const senderId = msg.key.participant || (msg.key.fromMe ? (sock.user?.id || chatId) : chatId);

    // Cache message for anti-delete tracking
    storeMessage(msg);

    // Process deleted message revokes
    await handleMessageRevoke(sock, m);

    // Auto-read handler
    await handleAutoread(sock, msg);

    // Auto-react handler
    await addAutoReaction(sock, msg);

    // 1. Process Native WhatsApp Interactive Selections (Buttons, Lists, Poll Votes)
    const interactiveAction = extractInteractiveSelection(msg, senderId);
    if (interactiveAction) {
        // Skip if sender is banned (unless action is unban)
        if (isBanned(senderId) && !interactiveAction.includes('unban')) return;

        // Check per-session mode (private vs public)
        const sessionMode = getSessionMode(sock);
        const isOwner = await isSessionOwner(sock, senderId, msg);
        if (sessionMode === 'private' && !isOwner) {
            return;
        }

        await handleInteractiveAction(sock, chatId, senderId, msg, interactiveAction);
        return;
    }

    const getMessageText = (m) => {
        const message = m?.message;
        if (!message) return "";
        return (
            message.conversation ||
            message.extendedTextMessage?.text ||
            message.imageMessage?.caption ||
            message.videoMessage?.caption ||
            message.documentMessage?.caption ||
            (message.groupInviteMessage ? `https://chat.whatsapp.com/${message.groupInviteMessage.inviteCode || ''}` : "") ||
            (message.ephemeralMessage ? getMessageText(message.ephemeralMessage) : "") ||
            (message.viewOnceMessage ? getMessageText(message.viewOnceMessage) : "") ||
            (message.viewOnceMessageV2 ? getMessageText(message.viewOnceMessageV2) : "") ||
            ""
        );
    };

    const rawText = (getMessageText(msg) || "").trim();
    const userMessage = rawText.toLowerCase();

    // Check Anti-Link for group chats
    const isLinkHandled = await handleAntiLink(sock, chatId, senderId, msg, rawText);
    if (isLinkHandled) return;

    // Check per-session mode (private vs public) for commands & owner features
    const sessionMode = getSessionMode(sock);
    const isOwner = await isSessionOwner(sock, senderId, msg);

    if (sessionMode === 'private' && !isOwner) {
        // In private mode, silently ignore non-owners for commands & owner features
        return;
    }

    // 2. Process Guided Interactive Flows (e.g. user entering phone number or announcement without command syntax)
    if (isFlowActive(chatId, senderId) && rawText && !rawText.startsWith('.')) {
        const flowHandled = await handleGuidedFlowInput(sock, chatId, senderId, msg, rawText);
        if (flowHandled) return;
    }

    // Autotyping status for non-commands
    if (!rawText.startsWith('.')) {
        handleAutotypingForMessage(sock, chatId);
    }

    // Secret ❤ View-Once extraction command
    if (rawText === '❤️' || rawText === '❤') {
        const speed = Date.now() - startTime;
        console.log(chalk.bold.magenta(`⚡ [COMMAND] Secret ViewOnce (❤️) | From: ${senderId.split('@')[0]} | Speed: ${speed}ms`));

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quoted) {
            try {
                const extracted = await extractViewOnceMedia(msg);
                if (extracted) {
                    const { mediaType, mimeType, caption, buffer } = extracted;
                    const targetJid = sock.user?.id ? jidNormalizedUser(sock.user.id) : senderId;

                    if (mediaType === 'image') {
                        await sock.sendMessage(targetJid, { image: buffer, caption: caption || '' });
                    } else if (mediaType === 'video') {
                        await sock.sendMessage(targetJid, { video: buffer, caption: caption || '' });
                    } else if (mediaType === 'audio') {
                        await sock.sendMessage(targetJid, { audio: buffer, mimetype: mimeType, ptt: false });
                        if (caption) await sock.sendMessage(targetJid, { text: caption });
                    }
                }
            } catch (e) { }
        }
        return;
    }

    // Number shortcuts (1-6, 0) for direct menu navigation (especially useful when messaging yourself)
    const trimmedInput = rawText.trim();
    const numberCategoryMap = {
        '1': 'cat_group',
        '2': 'cat_admin',
        '3': 'cat_tool',
        '4': 'cat_owner',
        '5': 'cat_download',
        '6': 'cat_games',
        '0': 'ghost_menu:main'
    };
    if (numberCategoryMap[trimmedInput]) {
        await handleInteractiveAction(sock, chatId, senderId, msg, numberCategoryMap[trimmedInput]);
        return;
    }

    // Check if command
    if (!rawText.startsWith('.')) return;

    // Skip if sender is banned (unless command is .unban)
    if (isBanned(senderId) && !userMessage.startsWith('.unban')) return;

    const args = rawText.slice(1).trim().split(/\s+/);
    const command = args.shift().toLowerCase();
    const isGroup = chatId.endsWith('@g.us');
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    // Log ONLY commands in terminal
    const speed = Date.now() - startTime;
    console.log(chalk.bold.cyan(`⚡ [COMMAND] .${command} | From: ${senderId.split('@')[0]} | ${isGroup ? 'Group' : 'DM'} | Speed: ${speed}ms`));

    try {
        switch (command) {
            case 'autoreact':
            case 'areact':
                await autoreactCommand(sock, chatId, msg, args);
                break;
            case 'autoread':
                await autoreadCommand(sock, chatId, msg, args);
                break;
            case 'autotyping':
                await autotypingCommand(sock, chatId, msg, args);
                break;
            case 'antidelete':
                await antideleteCommand(sock, chatId, senderId, args, msg);
                break;
            case 'antilink':
                await antilinkCommand(sock, chatId, senderId, args, msg);
                break;
            case 'vv':
            case 'viewonce':
                await viewonceCommand(sock, chatId, msg);
                break;
            case 'mute':
                const duration = args[0] ? parseInt(args[0]) : undefined;
                await muteCommand(sock, chatId, senderId, msg, duration);
                break;
            case 'unmute':
                await unmuteCommand(sock, chatId, senderId, msg);
                break;
            case 'kick':
                await kickCommand(sock, chatId, senderId, mentionedJids, msg);
                break;
            case 'ban':
                await banCommand(sock, chatId, senderId, mentionedJids, msg);
                break;
            case 'unban':
                await unbanCommand(sock, chatId, senderId, mentionedJids, msg);
                break;
            case 'adminlock':
                await adminlockCommand(sock, chatId, senderId, args, msg);
                break;
            case 'dp':
                await dpCommand(sock, chatId, msg);
                break;
            case 'tagall':
                await tagAllCommand(sock, chatId, senderId, msg);
                break;
            case 'hidetag':
                {
                    const messageText = rawText.slice(8).trim();
                    const replyMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
                    await hideTagCommand(sock, chatId, senderId, messageText, replyMessage, msg);
                }
                break;
            case 'ping':
                await pingCommand(sock, chatId, msg, startTime);
                break;
            case 'status':
                await statusCommand(sock, chatId, msg);
                break;
            case 'jid':
            case 'channeljid':
                await jidCommand(sock, chatId, senderId, msg);
                break;
            case 'pair':
                await pairCommand(sock, chatId, senderId, msg, args);
                break;
            case 'pairlist':
            case 'pairs':
            case 'unpair':
                await pairlistCommand(sock, chatId, senderId, msg, args, command);
                break;
            case 'mode':
                await modeCommand(sock, chatId, senderId, msg, args);
                break;
            case 'gcsstatus':
            case 'gcstatus':
            case 'groupstatus':
            case 'gpstatus':
            case 'gstatus':
            case 'gorupstatus':
                {
                    const argsText = args.join(' ');
                    await gcsstatusCommand(sock, chatId, senderId, msg, argsText);
                }
                break;
            case 'help':
            case 'menu':
                await sendMainMenu(sock, chatId, senderId, msg);
                break;
            case 'groupmenu':
            case 'group':
                await sendGroupMenu(sock, chatId, senderId, msg);
                break;
            case 'adminmenu':
            case 'admin':
                await sendAdminMenu(sock, chatId, senderId, msg);
                break;
            case 'toolmenu':
            case 'tool':
            case 'tools':
                await sendToolMenu(sock, chatId, senderId, msg);
                break;
            case 'ownermenu':
                await sendOwnerMenu(sock, chatId, senderId, msg);
                break;
            case 'owner':
                await ownerCommand(sock, chatId, senderId, msg);
                break;
            case 'setdp':
            case 'ghostdp':
                try {
                    const myJid = sock.user?.id ? jidNormalizedUser(sock.user.id) : null;
                    const dpPath = path.join(__dirname, 'Ghost.png');
                    if (myJid && fs.existsSync(dpPath)) {
                        await sock.updateProfilePicture(myJid, { url: dpPath });
                        await sock.sendMessage(chatId, { text: '✅ *Ghost Bot DP updated successfully!*' }, { quoted: msg });
                    } else {
                        await sock.sendMessage(chatId, { text: '❌ Ghost.png not found.' }, { quoted: msg });
                    }
                } catch (err) {
                    await sock.sendMessage(chatId, { text: `❌ Could not set DP: ${err.message}` }, { quoted: msg });
                }
                break;
            case 'downloadmenu':
            case 'downloader':
            case 'download':
                await sendDownloadMenu(sock, chatId, senderId, msg);
                break;
            case 'gamesmenu':
            case 'games':
            case 'game':
                await sendGamesMenu(sock, chatId, senderId, msg);
                break;
            default:
                // Ignore unknown commands silently for speed
                break;
        }
    } catch (err) {
        console.error(chalk.red(`❌ [ERROR] Command .${command} failed:`), err.message);
    }
}

// Function to ask user for phone number at startup
function askPhoneNumber() {
    const credsPath = path.join(__dirname, 'session', 'creds.json');
    const hasSavedSession = fs.existsSync(credsPath);

    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        let isDone = false;
        let timer = null;

        if (hasSavedSession) {
            console.log(chalk.bold.green('\n📦 Saved session detected! Continuing automatically in 3 seconds...'));
            console.log(chalk.yellow('(Press ENTER to continue immediately, or enter a new number to re-pair): '));
            timer = setTimeout(() => {
                if (!isDone) {
                    isDone = true;
                    rl.close();
                    resolve('');
                }
            }, 3000);
        } else {
            console.log(chalk.bold.yellow('\n📱 Enter WhatsApp phone number to pair (with country code, e.g. 923232391033): '));
        }

        rl.on('line', (line) => {
            if (!isDone) {
                isDone = true;
                if (timer) clearTimeout(timer);
                rl.close();
                resolve(line.trim());
            }
        });
    });
}

// Register global handlers for multi-user session manager
setHandlers(handleMessages, handleGroupParticipantUpdate);

// Persistent saved phone number across reconnects during pairing
let savedPhoneNumber = '';
let isRequestingPairing = false;

async function startGhostBot(isReconnect = false) {
    if (!isReconnect) {
        console.clear();
        console.log(chalk.bold.cyan(`
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃       👻 GHOST WHATSAPP BOT INITIALIZING 👻  ┃
┃   Interactive Button & Multi-Session Engine ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
`));
    }

    let inputNumber = '';
    if (!isReconnect) {
        const inputNumberRaw = await askPhoneNumber();
        inputNumber = inputNumberRaw.replace(/[^0-9]/g, '');
        if (inputNumber) {
            savedPhoneNumber = inputNumber;
            console.log(chalk.green(`\n📲 Pairing request received for: +${inputNumber}\n`));
        } else {
            console.log(chalk.blue(`\n📦 Continuing with saved session(s)...\n`));
        }
    } else if (savedPhoneNumber) {
        inputNumber = savedPhoneNumber;
    }

    const sessionDir = path.join(__dirname, 'session');

    // If user explicitly provided a new phone number to pair at startup, clean stale session files
    if (inputNumber && !isReconnect && fs.existsSync(sessionDir)) {
        try {
            fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (e) { }
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    let version = [2, 3000, 1015901307];
    try {
        const fetched = await fetchLatestBaileysVersion();
        version = fetched.version;
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
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 120000,
        keepAliveIntervalMs: 25000
    });

    sock.phone = 'main';

    sock.ev.on('creds.update', saveCreds);

    // Pairing code logic for main bot instance
    if (!state.creds.registered && !isRequestingPairing) {
        isRequestingPairing = true;
        let phoneNumber = inputNumber || savedPhoneNumber || (process.env.PHONE_NUMBER || settings.ownerNumber || '923232391033').replace(/[^0-9]/g, '');

        console.log(chalk.yellow(`🔑 Requesting pairing code for main instance (${phoneNumber})...`));
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(chalk.black(chalk.bgGreen(`\n [PAIRING CODE] ${phoneNumber}: `)), chalk.bold.white.bgBlue(` ${code} \n`));
            } catch (err) {
                console.error(chalk.red('Failed to request pairing code:'), err.message);
            } finally {
                isRequestingPairing = false;
            }
        }, 3000);
    }

    // Connection Updates for main session
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            isRequestingPairing = false;
            console.log(chalk.bold.green(`\n✅ [PRIMARY CONNECTED] Main Ghost WhatsApp Bot is online and listening!\n`));
            runAutoFollow(sock).catch(err => console.error('Auto-follow error:', err.message));
            
            // Sync Ghost.png as profile picture
            const ghostDpPath = path.join(__dirname, 'Ghost.png');
            if (fs.existsSync(ghostDpPath)) {
                const myJid = sock.user?.id ? jidNormalizedUser(sock.user.id) : null;
                if (myJid) {
                    sock.updateProfilePicture(myJid, { url: ghostDpPath })
                        .then(() => console.log(chalk.bold.green('📸 [PROFILE DP] Ghost DP synced successfully!')))
                        .catch(() => {});
                }
            }
        } else if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (statusCode === 515) {
                console.log(chalk.cyan(`🔄 [PAIRING HANDSHAKE] Completing pairing authentication...`));
                setTimeout(() => startGhostBot(true), 1500);
            } else if (shouldReconnect) {
                console.log(chalk.yellow(`🔄 [PRIMARY DISCONNECTED] Reason: ${statusCode || 'Unknown'}. Reconnecting...`));
                setTimeout(() => startGhostBot(true), 3000);
            } else {
                console.log(chalk.red('⚠️ Session logged out (401). Cleaning up invalid session credentials...'));
                savedPhoneNumber = '';
                try {
                    fs.rmSync(sessionDir, { recursive: true, force: true });
                } catch (e) { }
                console.log(chalk.yellow('🔄 Restarting bot engine...'));
                setTimeout(() => startGhostBot(false), 2000);
            }
        }
    });

    // Attach event listeners for primary socket instance
    sock.ev.on('group-participants.update', (update) => handleGroupParticipantUpdate(sock, update));
    sock.ev.on('messages.upsert', (m) => handleMessages(sock, m));

    // Restore any extra saved user sessions
    await loadAllSavedSessions();
}

startGhostBot().catch(console.error);

module.exports = { handleMessages, handleGroupParticipantUpdate, startGhostBot };
