const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const configPath = path.join(__dirname, '..', 'data', 'autotyping.json');

function initConfig() {
    if (!fs.existsSync(configPath)) {
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify({ enabled: false }, null, 2));
    }
    return JSON.parse(fs.readFileSync(configPath));
}

async function autotypingCommand(sock, chatId, message, args = []) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        
        if (!message.key.fromMe && !isOwner) {
            return sock.sendMessage(chatId, { text: '❌ This command is only available for the owner!' }, { quoted: message });
        }
        
        const config = initConfig();
        
        if (args.length > 0) {
            const action = args[0].toLowerCase();
            if (action === 'on' || action === 'enable') {
                config.enabled = true;
            } else if (action === 'off' || action === 'disable') {
                config.enabled = false;
            } else {
                return sock.sendMessage(chatId, { text: '❌ Use: .autotyping on/off' }, { quoted: message });
            }
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            await sock.sendMessage(chatId, { text: `✅ Auto-typing has been ${config.enabled ? 'ENABLED' : 'DISABLED'}!` }, { quoted: message });
        } else {
            const { sendAutotypingSubMenu } = require('../lib/interactiveMenuHandler');
            return await sendAutotypingSubMenu(sock, chatId, senderId, message);
        }
    } catch (error) {
        console.error('Error in autotyping command:', error);
        await sock.sendMessage(chatId, { text: '❌ Error processing command!' }, { quoted: message });
    }
}

function isAutotypingEnabled() {
    try { return initConfig().enabled; } catch (error) { return false; }
}

async function handleAutotypingForMessage(sock, chatId) {
    if (isAutotypingEnabled()) {
        try {
            await sock.sendPresenceUpdate('composing', chatId);
        } catch (error) {}
    }
}

module.exports = { autotypingCommand, isAutotypingEnabled, handleAutotypingForMessage };
