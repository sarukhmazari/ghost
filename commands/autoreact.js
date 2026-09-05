const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const configPath = path.join(__dirname, '..', 'data', 'react.json');

const defaultData = {
    autoreact: false,
    reactEmojis: ["🪀", "🥏", "🤩", "💔", "🤍", "🥵", "🔥", "⚡"]
};

function initConfig() {
    try {
        if (!fs.existsSync(configPath)) {
            fs.mkdirSync(path.dirname(configPath), { recursive: true });
            fs.writeFileSync(configPath, JSON.stringify(defaultData, null, 2));
        }
        return JSON.parse(fs.readFileSync(configPath));
    } catch (err) {
        return defaultData;
    }
}

async function autoreactCommand(sock, chatId, message, args = []) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        if (!message.key.fromMe && !isOwner) {
            return sock.sendMessage(chatId, { text: '❌ This command is only for the owner!' }, { quoted: message });
        }

        const config = initConfig();

        if (args.length > 0) {
            const action = args[0].toLowerCase();
            if (action === 'on' || action === 'enable') {
                config.autoreact = true;
            } else if (action === 'off' || action === 'disable') {
                config.autoreact = false;
            } else {
                return sock.sendMessage(chatId, { text: '❌ Use: .autoreact on/off' }, { quoted: message });
            }
        } else {
            config.autoreact = !config.autoreact;
        }

        if (!config.reactEmojis) config.reactEmojis = defaultData.reactEmojis;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        await sock.sendMessage(chatId, { text: `✅ Auto-react is now ${config.autoreact ? 'ENABLED' : 'DISABLED'}` }, { quoted: message });
    } catch (error) {
        console.error(error);
        await sock.sendMessage(chatId, { text: '❌ Error occurred!' }, { quoted: message });
    }
}

function isAutoreactEnabled() {
    try { return initConfig().autoreact; } catch { return false; }
}

async function addAutoReaction(sock, message) {
    try {
        if (!isAutoreactEnabled() || !message?.key?.id || message.key.fromMe) return;
        const remoteJid = message.key.remoteJid;
        if (!remoteJid || remoteJid === 'status@broadcast') return;

        const config = initConfig();
        const emojis = Array.isArray(config.reactEmojis) && config.reactEmojis.length > 0 ? config.reactEmojis : defaultData.reactEmojis;
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];

        await sock.sendMessage(remoteJid, {
            react: { text: emoji, key: message.key }
        });
    } catch (err) {}
}

module.exports = { autoreactCommand, isAutoreactEnabled, addAutoReaction };
