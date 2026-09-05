const path = require('path');
const fs = require('fs');
const settings = require('../settings');

async function helpCommand(sock, chatId, message) {
    const helpText = `
╭━━━〔 𝗭𝗢𝗫𝗘𝗥 𝗠𝗜𝗡𝗜 𝗕𝗢𝗧 〕━━━╮

┏━━〔 ⚙️ 𝗔𝗨𝗧𝗢𝗠𝗔𝗧𝗜𝗢𝗡 〕
┃
┃  ◉ .autoreact <on/off>
┃  ◉ .autoread <on/off>
┃  ◉ .autotyping <on/off>
┃  ◉ .antidelete <on/off>
┃
┗━━━━━━━━━━━━━━━━━━━━━━

┏━━〔 👁️ 𝗠𝗘𝗗𝗜𝗔 & 𝗣𝗥𝗜𝗩𝗔𝗖𝗬 〕
┃
┃  ◉ .vv / .viewonce [public/private]
┃  ◉ .dp [@user / reply]
┃  ◉ ❤️ Secret View-Once Grab
┃
┗━━━━━━━━━━━━━━━━━━━━━━

┏━━〔 👥 𝗚𝗥𝗢𝗨𝗣 𝗠𝗔𝗡𝗔𝗚𝗘𝗠𝗘𝗡𝗧 〕
┃
┃  ◉ .tagall
┃  ◉ .hidetag [message / reply]
┃  ◉ .mute [minutes]
┃  ◉ .unmute
┃  ◉ .kick [@user / reply]
┃  ◉ .antilink <on/off>
┃
┗━━━━━━━━━━━━━━━━━━━━━━

┏━━〔 🛡️ 𝗔𝗗𝗠𝗜𝗡 & 𝗖𝗢𝗡𝗧𝗥𝗢𝗟 〕
┃
┃  ◉ .mode <private/public>
┃  ◉ .adminlock <on/off>
┃  ◉ .ban [@user / reply]
┃  ◉ .unban [@user / reply]
┃
┗━━━━━━━━━━━━━━━━━━━━━━

┏━━〔 📡 𝗦𝗬𝗦𝗧𝗘𝗠 〕
┃
┃  ◉ .pair <number>
┃  ◉ .pairlist / .pairs
┃  ◉ .unpair <number>
┃  ◉ .ping
┃  ◉ .status
┃  ◉ .help
┃
┗━━━━━━━━━━━━━━━━━━━━━━

╰━━━〔 ⚡ 𝗨𝗟𝗧𝗥𝗔-𝗙𝗔𝗦𝗧 〕━━━╯
       𝗥𝗘𝗦𝗣𝗢𝗡𝗦𝗘 𝗘𝗡𝗚𝗜𝗡𝗘
          𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗯𝘆 𝗭𝗢𝗫𝗘𝗥`.trim();

    const menuImagePath = path.join(__dirname, '../ZoxerMini.png');

    const contextInfo = {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: settings.newsletterJid || "120363404139113188@newsletter",
            serverMessageId: 100,
            newsletterName: "𝗭𝗢𝗫𝗘𝗥 𝗢𝗙𝗙𝗜𝗖𝗜𝗔🇱"
        },
        externalAdReply: {
            title: "𝗭𝗢𝗫𝗘𝗥 𝗠𝗜𝗡𝗜 𝗕𝗢𝗧 𝗦𝗬𝗦𝗧𝗘𝗠",
            body: "Click below to join our official channel",
            thumbnailUrl: "https://files.catbox.moe/0v258l.jpg",
            sourceUrl: settings.channelLink || "https://whatsapp.com/channel/0029VbBRITODzgTGQhZSFT3P",
            mediaType: 1,
            renderLargerThumbnail: false
        }
    };

    let messagePayload;
    if (fs.existsSync(menuImagePath)) {
        messagePayload = {
            image: fs.readFileSync(menuImagePath),
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

module.exports = helpCommand;
