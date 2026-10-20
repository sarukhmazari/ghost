const settings = require('../settings');

async function ownerCommand(sock, chatId, senderId, message) {
    try {
        const ownerNum = settings.ownerNumber || '923232391033';
        const formattedNum = `+${ownerNum.slice(0, 2)} ${ownerNum.slice(2, 5)} ${ownerNum.slice(5)}`;
        
        const ownerText = `
┏━━〔 👑 𝗚𝗛𝗢𝗦𝗧 𝗢𝗪𝗡𝗘𝗥 〕━━┓
┃ 👤 *Name:* Sarukh Mazari (Ghost)
┃ 📞 *Number:* ${formattedNum}
┃ 📱 *WhatsApp:* wa.me/${ownerNum}
┃ 🌐 *Status:* Online & Active
┗━━━━━━━━━━━━━━━━━━━━┛

Need assistance, pairing, or custom setup?
Contact the owner directly via the contact card above!`.trim();

        // Send contact vCard
        const vcard = 'BEGIN:VCARD\n'
            + 'VERSION:3.0\n' 
            + 'FN:Sarukh Mazari (Ghost)\n'
            + 'ORG:Ghost Bot;\n'
            + `TEL;type=CELL;type=VOICE;waid=${ownerNum}:${formattedNum}\n`
            + 'END:VCARD';

        try {
            await sock.sendMessage(chatId, {
                contacts: {
                    displayName: 'Sarukh Mazari (Ghost)',
                    contacts: [{ vcard }]
                }
            }, { quoted: message });
        } catch (contactErr) {
            console.error('Failed to send vCard contact:', contactErr.message);
        }

        await sock.sendMessage(chatId, { text: ownerText }, { quoted: message });

    } catch (error) {
        console.error('Owner command error:', error);
        await sock.sendMessage(chatId, { text: `👑 *Bot Owner:* +923232391033\nwa.me/923232391033` }, { quoted: message });
    }
}

module.exports = ownerCommand;
