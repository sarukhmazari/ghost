const path = require('path');
const fs = require('fs');
const settings = require('../settings');
const { sendMainMenu } = require('../lib/interactiveMenuHandler');

async function helpCommand(sock, chatId, message) {
    const senderId = message.key.participant || (message.key.fromMe ? (sock.user?.id || chatId) : chatId);

    try {
        // Send the native interactive button & list menu
        await sendMainMenu(sock, chatId, senderId, message);
    } catch (interactiveError) {
        console.error('Interactive menu error, falling back to text menu:', interactiveError);

        const helpText = `
┏━━〔 👻 𝗚𝗛𝗢𝗦𝗧 𝗠𝗕𝗢𝗧 〕━━┓
┃ 📱 Owner : 923232391033
┃ ⚡ Engine: Ghost Core
┗━━━━━━━━━━━━━━━━━━━━┛

🤖 *AUTOMATION*
• .autoreact <on/off>
• .autoread <on/off>
• .autotyping <on/off>
• .antidelete <on/off>

👥 *GROUP*
• .tagall
• .hidetag [text/reply]
• .mute [minutes]
• .unmute
• .antilink <on/off>
• .kick [@user]

🛡️ *ADMIN*
• .mode <private/public>
• .adminlock <on/off>
• .ban [@user]
• .unban [@user]

📥 *MEDIA*
• .vv / .viewonce
• .dp [@user]
• ❤️ (Reply to View-Once)

👑 *SYSTEM & OWNER*
• .owner (Contact 923232391033)
• .pair <number>
• .pairlist
• .unpair <number>
• .ping
• .status
• .jid`.trim();

        const menuImagePath = path.join(__dirname, '../Ghost.png');
        const fallbackImagePath = path.join(__dirname, '../ghost.jpg');
        const finalImage = fs.existsSync(menuImagePath) ? menuImagePath : (fs.existsSync(fallbackImagePath) ? fallbackImagePath : null);

        const contextInfo = {
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: settings.newsletterJid || "120363404139113188@newsletter",
                serverMessageId: 100,
                newsletterName: "👻 𝗚𝗛𝗢𝗦𝗧 𝗢𝗙𝗙𝗜𝗖𝗜𝗔🇱"
            },
            externalAdReply: {
                title: "〔 👻 𝗚𝗛𝗢𝗦𝗧 𝗠𝗕𝗢𝗧 〕",
                body: "Official Ghost MBot WhatsApp Bot",
                thumbnailUrl: "https://files.catbox.moe/0v258l.jpg",
                sourceUrl: settings.channelLink || "https://whatsapp.com/channel/0029VbBRITODzgTGQhZSFT3P",
                mediaType: 1,
                renderLargerThumbnail: false
            }
        };

        let messagePayload;
        if (finalImage && fs.existsSync(finalImage)) {
            messagePayload = {
                image: fs.readFileSync(finalImage),
                caption: helpText,
                contextInfo
            };
        } else {
            messagePayload = {
                text: helpText,
                contextInfo
            };
        }

        await sock.sendMessage(chatId, messagePayload, { quoted: message });
    }
}

module.exports = helpCommand;
