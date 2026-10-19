const { requestPairingCodeForNumber } = require('../lib/sessionManager');

async function pairCommand(sock, chatId, senderId, message, args) {
    try {
        let rawNumber = args.join('');
        if (!rawNumber) {
            await sock.sendMessage(chatId, {
                text: `❌ *Usage:* \`.pair <phone_number>\`\n\n*Example:* \`.pair 923232391033\` (include country code without +)`
            }, { quoted: message });
            return;
        }

        let cleanNumber = rawNumber.replace(/[^0-9]/g, '');
        if (cleanNumber.startsWith('0') && cleanNumber.length === 11) {
            cleanNumber = '92' + cleanNumber.slice(1);
        }

        if (cleanNumber.length < 10) {
            await sock.sendMessage(chatId, {
                text: `❌ Invalid phone number format. Please include full country code (e.g., \`.pair 923232391033\`).`
            }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `⏳ *Generating pairing code for +${cleanNumber}...*`
        }, { quoted: message });

        const result = await requestPairingCodeForNumber(cleanNumber);

        const responseText = `
╭━━━〔 🔑 𝗚𝗛𝗢𝗦𝗧 𝗣𝗔𝗜𝗥𝗜𝗡𝗚 〕━━━╮

📱 *Target Number:* +${result.phone}
🔑 *Pairing Code:* \`${result.code}\`

*Instructions:*
1. Open WhatsApp on +${result.phone}
2. Go to *Linked Devices* > *Link a Device*
3. Select *Link with phone number instead*
4. Enter code: *${result.code}*

⚡ *Code expires in 60 seconds.*
╰━━━━━━━━━━━━━━━━━━━━━━╯`.trim();

        await sock.sendMessage(chatId, { text: responseText }, { quoted: message });

    } catch (error) {
        console.error('Pair command error:', error);
        await sock.sendMessage(chatId, {
            text: `❌ *Pairing Error:* ${error.message || 'Failed to generate pairing code. Please try again.'}`
        }, { quoted: message });
    }
}

module.exports = pairCommand;
