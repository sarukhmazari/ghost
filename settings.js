global.categories = {
  main: { emoji: '🏠', title: 'Main Menu', label: 'main' },
  download: { emoji: '📥', title: 'Download Menu', label: 'downloader' },
  group: { emoji: '👥', title: 'Group Menu', label: 'group' },
  admin: { emoji: '🛡️', title: 'Admin Menu', label: 'admin' },
  tool: { emoji: '🧰', title: 'Tool Menu', label: 'tools' },
  games: { emoji: '🎮', title: 'Games Menu', label: 'games' },
  owner: { emoji: '👑', title: 'Owner Menu', label: 'owner' }
};

const settings = {
  packname: process.env.BOT_PACKNAME || 'GHOST MBOT',
  author: process.env.BOT_AUTHOR || 'GHOST',
  botName: process.env.BOT_NAME || "GHOST MBOT",
  botOwner: process.env.BOT_OWNER || 'GHOST',
  ownerNumber: process.env.OWNER_NUMBER || '923232391033', // Pakistan number format without + symbol
  ownerNumbers: (process.env.OWNER_NUMBERS || '923232391033').split(','),
  commandMode: process.env.BOT_MODE || "public",
  description: "Ghost MBot - Advanced WhatsApp Bot Engine",
  version: "2.0.0",
  channelLink: "https://whatsapp.com/channel/0029VbBRITODzgTGQhZSFT3P",
  newsletterJid: "120363404139113188@newsletter",
  autoFollowChannels: [
    "120363404139113188@newsletter"
  ]
};

module.exports = settings;
