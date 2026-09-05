const { getAntiDeleteState, setAntiDeleteState } = require('../lib/antiDelete');

async function antideleteCommand(sock, chatId, senderId, args, message) {
    const action = args[0] ? args[0].toLowerCase() : '';

    if (action === 'on' || action === 'enable') {
        setAntiDeleteState(true);
        await sock.sendMessage(chatId, { text: '✅ *Anti-Delete is now ENABLED!* Deleted messages will be forwarded to your private chat.' }, { quoted: message });
    } else if (action === 'off' || action === 'disable') {
        setAntiDeleteState(false);
        await sock.sendMessage(chatId, { text: '❌ *Anti-Delete is now DISABLED!*' }, { quoted: message });
    } else {
        const currentState = getAntiDeleteState();
        await sock.sendMessage(chatId, {
            text: `⚙️ *Anti-Delete Status:* ${currentState ? '🟢 ON' : '🔴 OFF'}\n\n*Usage:* \`.antidelete on\` or \`.antidelete off\``
        }, { quoted: message });
    }
}

module.exports = antideleteCommand;
