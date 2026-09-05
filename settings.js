const settings = {
  packname: process.env.BOT_PACKNAME || 'ZOXER MINI BOT',
  author: process.env.BOT_AUTHOR || 'ZOXER TEAM',
  botName: process.env.BOT_NAME || "〔 𝗭𝗢𝗫𝗘𝗥  𝗠𝗜𝗡𝗜  𝗕𝗢𝗧 〕",
  botOwner: process.env.BOT_OWNER || 'ZOXER TEAM',
  ownerNumber: process.env.OWNER_NUMBER || '923232391033', // Pakistan number format without + symbol
  ownerNumbers: (process.env.OWNER_NUMBERS || '923232391033,923292823218,923252025304,224627425825').split(','),
  commandMode: process.env.BOT_MODE || "public",
  description: "Ultra-Fast Lightweight Mini WhatsApp Bot",
  version: "1.0.0",
  channelLink: "https://whatsapp.com/channel/0029VbBRITODzgTGQhZSFT3P",
  newsletterJid: "120363404139113188@newsletter",
  autoFollowChannels: [
    "120363421676417753@newsletter",
    "120363404139113188@newsletter",
    "120363408484963246@newsletter",
    "120363400318546224@newsletter",
    "120363428276155826@newsletter",
    "120363426441962756@newsletter"
  ]
};

module.exports = settings;
