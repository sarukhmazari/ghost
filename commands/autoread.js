const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const configPath = path.join(__dirname, '..', 'data', 'autoread.json');

function initConfig() {
    if (!fs.existsSync(configPath)) {
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify({ enabled: false }, null, 2));
    }
    return JSON.parse(fs.readFileSync(configPath));
}

async function autoreadCommand(sock, chatId, message, args = []) {
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
                config.enabled = true;
            } else if (action === 'off' || action === 'disable') {
                config.enabled = false;
            } else {
                return sock.sendMessage(chatId, { text: '❌ Use: .autoread on/off' }, { quoted: message });
            }
        } else {
            config.enabled = !config.enabled;
        }
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        await sock.sendMessage(chatId, { text: `✅ Auto-read is now ${config.enabled ? 'ENABLED' : 'DISABLED'}!` }, { quoted: message });
    } catch (error) {
        console.error('Error in autoread command:', error);
        await sock.sendMessage(chatId, { text: '❌ Error processing command!' }, { quoted: message });
    }
}

function isAutoreadEnabled() {
    try { return initConfig().enabled; } catch (error) { return false; }
}

async function handleAutoread(sock, message) {
    if (isAutoreadEnabled()) {
        try {
            const key = { remoteJid: message.key.remoteJid, id: message.key.id, participant: message.key.participant };
            await sock.readMessages([key]);
            return true;
        } catch (e) {}
    }
    return false;
}

module.exports = { autoreadCommand, isAutoreadEnabled, handleAutoread };
