const chalk = require('chalk');
const settings = require('../settings');
const { sendButtons } = require('./interactiveHelper');
const { startFlow, getFlow, clearFlow } = require('./interactiveFlow');
const { getSessionMode, setSessionMode, isSessionOwner, getSessionPhone } = require('./modeManager');
const isAdmin = require('./isAdmin');
const isOwnerOrSudo = require('./isOwner');
const { isAntiLinkEnabled, setAntiLinkState } = require('./antiLink');
const { getAntiDeleteState, setAntiDeleteState } = require('./antiDelete');
const { listSessions, unpairSession } = require('./sessionManager');

// Command module handlers
const { autoreactCommand, isAutoreactEnabled } = require('../commands/autoreact');
const { autoreadCommand, isAutoreadEnabled } = require('../commands/autoread');
const { autotypingCommand, isAutotypingEnabled } = require('../commands/autotyping');
const antideleteCommand = require('../commands/antidelete');
const antilinkCommand = require('../commands/antilink');
const viewonceCommand = require('../commands/viewonce');
const muteCommand = require('../commands/mute');
const unmuteCommand = require('../commands/unmute');
const kickCommand = require('../commands/kick');
const banCommand = require('../commands/ban');
const unbanCommand = require('../commands/unban');
const { adminlockCommand } = require('../commands/adminlock');
const dpCommand = require('../commands/dp');
const tagAllCommand = require('../commands/tagall');
const hideTagCommand = require('../commands/hidetag');
const pingCommand = require('../commands/ping');
const statusCommand = require('../commands/status');
const jidCommand = require('../commands/jid');
const pairCommand = require('../commands/pair');
const pairlistCommand = require('../commands/pairlist');
const modeCommand = require('../commands/mode');
const gcsstatusCommand = require('../commands/gcsstatus');
const ownerCommand = require('../commands/owner');

// Debounce map for duplicate taps
const recentInteractions = new Map();
const DEBOUNCE_MS = 600;

function isDuplicateTap(chatId, senderId, actionId) {
    const key = `${chatId}:${senderId}:${actionId}`;
    const now = Date.now();
    if (recentInteractions.has(key)) {
        const last = recentInteractions.get(key);
        if (now - last < DEBOUNCE_MS) {
            return true;
        }
    }
    recentInteractions.set(key, now);
    setTimeout(() => recentInteractions.delete(key), DEBOUNCE_MS * 2);
    return false;
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / (24 * 60 * 60));
    seconds = seconds % (24 * 60 * 60);
    const hours = Math.floor(seconds / (60 * 60));
    seconds = seconds % (60 * 60);
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    let time = '';
    if (days > 0) time += `${days}d `;
    if (hours > 0) time += `${hours}h `;
    if (minutes > 0) time += `${minutes}m `;
    time += `${seconds}s`;
    return time.trim();
}

/**
 * 1. Main Interactive Menu
 */
async function sendMainMenu(sock, chatId, senderId, msg) {
    const currentMode = getSessionMode(sock);
    const sessionPhone = getSessionPhone(sock);
    const uptime = formatUptime(process.uptime());
    const autoreadOn = isAutoreadEnabled();
    const autoreactOn = isAutoreactEnabled();
    const autotypingOn = isAutotypingEnabled();
    const antideleteOn = getAntiDeleteState();

    const bodyText = 
`┏━━〔 👻 𝗚𝗛𝗢𝗦𝗧 𝗠𝗕𝗢𝗧 〕━━┓
┃ 📱 *Session:* +${sessionPhone}
┃ 🌐 *Mode:* ${currentMode.toUpperCase()}
┃ ⏱️ *Uptime:* ${uptime}
┗━━━━━━━━━━━━━━━━━━━━┛

🤖 *AUTOMATION STATUS*
• Auto-Read   : ${autoreadOn ? '🟢 ON' : '🔴 OFF'}
• Auto-React  : ${autoreactOn ? '🟢 ON' : '🔴 OFF'}
• Auto-Typing : ${autotypingOn ? '🟢 ON' : '🔴 OFF'}
• Anti-Delete : ${antideleteOn ? '🟢 ON' : '🔴 OFF'}

📂 *COMMAND CATEGORIES:*
1️⃣ Group Menu ➔ \`.group\`
2️⃣ Admin Menu ➔ \`.admin\`
3️⃣ Tools Menu ➔ \`.tools\`
4️⃣ Owner Menu ➔ \`.owner\`
5️⃣ Media Menu ➔ \`.download\`
6️⃣ Games Menu ➔ \`.games\`
0️⃣ Refresh    ➔ \`.menu\`

⚡ *QUICK ACTIONS:*
• \`.ping\` ➔ Response Speed
• \`.status\` ➔ Bot Info
• \`.owner\` ➔ Owner Contact

👉 _Tap a button below or reply with a number (1-6)_`.trim();

    const buttons = [
        { id: 'cat_group', text: '👥 Group Menu' },
        { id: 'cat_admin', text: '🛡️ Admin Menu' },
        { id: 'cat_tool', text: '🧰 Tools Menu' }
    ];

    await sendButtons(sock, chatId, {
        title: "〔 👻 𝗚𝗛𝗢𝗦𝗧 𝗠𝗕𝗢𝗧 〕",
        text: bodyText,
        footer: "Ghost MBot • Main Menu",
        buttons
    }, msg);
}

/**
 * 2. Group Menu
 */
async function sendGroupMenu(sock, chatId, senderId, msg) {
    const isGroup = chatId.endsWith('@g.us');
    const antilinkStatus = isGroup ? isAntiLinkEnabled(chatId) : false;

    const bodyText = 
`┏━━〔 👥 𝗚𝗥𝗢𝗨𝗣 𝗠𝗔𝗡𝗔𝗚𝗘𝗠𝗘𝗡𝗧 〕━━┓
┃ 💬 Chat     : ${isGroup ? 'Group Chat' : 'Private Chat'}
┃ 🛡️ Anti-Link: ${antilinkStatus ? '🟢 ON' : '🔴 OFF'}
┗━━━━━━━━━━━━━━━━━━━━━━━━━┛

👥 *GROUP COMMANDS:*
• \`.tagall\` ➔ Mention all group members
• \`.hidetag [msg]\` ➔ Ghost tag broadcast
• \`.mute [mins]\` ➔ Lock chat (e.g. \`.mute 15\`)
• \`.unmute\` ➔ Open group chat
• \`.antilink <on/off>\` ➔ Auto-remove link senders
• \`.kick [@user]\` ➔ Remove user from group

👉 _Tap a button below or type a command_`.trim();

    const buttons = [
        { id: 'ghost_action:tagall', text: '📢 Tag All' },
        { id: 'ghost_sub:antilink', text: '🛡️ Anti-Link' },
        { id: 'ghost_menu:main', text: '🏠 Main Menu' }
    ];

    await sendButtons(sock, chatId, {
        title: "〔 👥 𝗚𝗥𝗢𝗨𝗣 𝗠𝗘𝗡𝗨 〕",
        text: bodyText,
        footer: "Ghost MBot • Groups",
        buttons
    }, msg);
}

/**
 * 3. Admin Menu
 */
async function sendAdminMenu(sock, chatId, senderId, msg) {
    const currentMode = getSessionMode(sock);
    const sessionPhone = getSessionPhone(sock);

    const bodyText = 
`┏━━〔 🛡️ 𝗔𝗗𝗠𝗜𝗡 & 𝗦𝗘𝗖𝗨𝗥𝗜𝗧𝗬 〕━━┓
┃ 📱 Session : +${sessionPhone}
┃ 🔒 Mode    : ${currentMode.toUpperCase()}
┗━━━━━━━━━━━━━━━━━━━━━━━━━┛

🛡️ *ADMIN COMMANDS:*
• \`.mode <private/public>\` ➔ Toggle bot mode
• \`.adminlock <on/off>\` ➔ Unauthorized promotion blocker
• \`.ban [@user]\` ➔ Block user from using bot
• \`.unban [@user]\` ➔ Restore bot access

👉 _Tap a button below or type a command_`.trim();

    const buttons = [
        { id: 'ghost_sub:mode', text: '🌐 Bot Mode' },
        { id: 'ghost_sub:adminlock', text: '🛡️ Admin Lock' },
        { id: 'ghost_menu:main', text: '🏠 Main Menu' }
    ];

    await sendButtons(sock, chatId, {
        title: "〔 🛡️ 𝗔𝗗𝗠𝗜𝗡 𝗠𝗘𝗡𝗨 〕",
        text: bodyText,
        footer: "Ghost MBot • Admin",
        buttons
    }, msg);
}

/**
 * 4. Tool Menu
 */
async function sendToolMenu(sock, chatId, senderId, msg) {
    const autoreadOn = isAutoreadEnabled();
    const autoreactOn = isAutoreactEnabled();
    const autotypingOn = isAutotypingEnabled();
    const antideleteOn = getAntiDeleteState();

    const bodyText = 
`┏━━〔 🧰 𝗧𝗢𝗢𝗟𝗦 & 𝗔𝗨𝗧𝗢𝗠𝗔𝗧𝗜𝗢𝗡 〕━━┓
┃ 👁️ Auto-Read   : ${autoreadOn ? '🟢 ON' : '🔴 OFF'}
┃ 🎭 Auto-React  : ${autoreactOn ? '🟢 ON' : '🔴 OFF'}
┃ ⌨️ Auto-Typing : ${autotypingOn ? '🟢 ON' : '🔴 OFF'}
┃ 🗑️ Anti-Delete : ${antideleteOn ? '🟢 ON' : '🔴 OFF'}
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

🧰 *TOOL COMMANDS:*
• \`.autoread <on/off>\` ➔ Blue tick reader
• \`.autoreact <on/off>\` ➔ Auto emojis
• \`.autotyping <on/off>\` ➔ Typing indicator
• \`.antidelete <on/off>\` ➔ Anti-delete recovery
• \`.ping\` ➔ Test bot latency
• \`.status\` ➔ View uptime and RAM
• \`.jid\` ➔ Get chat ID

👉 _Tap a button below to configure_`.trim();

    const buttons = [
        { id: 'ghost_sub:autoread', text: '👁️ Auto-Read' },
        { id: 'ghost_sub:autoreact', text: '🎭 Auto-React' },
        { id: 'ghost_menu:main', text: '🏠 Main Menu' }
    ];

    await sendButtons(sock, chatId, {
        title: "〔 🧰 𝗧𝗢𝗢𝗟 𝗠𝗘𝗡𝗨 〕",
        text: bodyText,
        footer: "Ghost MBot • Tools",
        buttons
    }, msg);
}

/**
 * 5. Owner Menu
 */
async function sendOwnerMenu(sock, chatId, senderId, msg) {
    const sessions = listSessions();
    const ownerNum = settings.ownerNumber || '923232391033';

    const bodyText = 
`┏━━〔 👑 𝗢𝗪𝗡𝗘𝗥 & 𝗦𝗘𝗦𝗦𝗜𝗢𝗡𝗦 〕━━┓
┃ 👤 *Owner:* Sarukh Mazari (Ghost)
┃ 📞 *Number:* +92 323 2391033
┃ 💬 *WhatsApp:* wa.me/${ownerNum}
┃ 📱 *Sessions:* ${sessions.length} Connected
┗━━━━━━━━━━━━━━━━━━━━━━━━━┛

👑 *OWNER COMMANDS:*
• \`.owner\` ➔ Send owner contact card
• \`.pair <number>\` ➔ Generate link pairing code
• \`.pairlist\` ➔ View connected bot sessions
• \`.unpair <number>\` ➔ Disconnect a session

👉 _Tap a button below to proceed_`.trim();

    const buttons = [
        { id: 'ghost_flow:pair', text: '🔑 Pair Session' },
        { id: 'ghost_action:pairlist', text: '📱 Pair List' },
        { id: 'ghost_menu:main', text: '🏠 Main Menu' }
    ];

    await sendButtons(sock, chatId, {
        title: "〔 👑 𝗢𝗪𝗡𝗘𝗥 𝗠𝗘𝗡𝗨 〕",
        text: bodyText,
        footer: "Ghost MBot • Owner",
        buttons
    }, msg);
}

/**
 * 6. Download / Media Menu
 */
async function sendDownloadMenu(sock, chatId, senderId, msg) {
    const bodyText = 
`┏━━〔 📥 𝗠𝗘𝗗𝗜𝗔 & 𝗣𝗥𝗜𝗩𝗔𝗖𝗬 〕━━┓
┃ Unlock view-once photos and grab profile pictures
┗━━━━━━━━━━━━━━━━━━━━━━━━━┛

📥 *MEDIA COMMANDS:*
• \`.vv\` / \`.viewonce\` ➔ (Reply to view-once) Unlock media
• ❤️ (Heart emoji) ➔ (Reply to view-once) Secret forward to DM
• \`.dp [@user]\` ➔ Download user profile picture

👉 _Tap a button below or type a command_`.trim();

    const buttons = [
        { id: 'ghost_flow:dp', text: '📸 Download DP' },
        { id: 'ghost_action:ping', text: '⚡ Ping Speed' },
        { id: 'ghost_menu:main', text: '🏠 Main Menu' }
    ];

    await sendButtons(sock, chatId, {
        title: "〔 📥 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 𝗠𝗘𝗡𝗨 〕",
        text: bodyText,
        footer: "Ghost MBot • Downloader",
        buttons
    }, msg);
}

/**
 * 7. Games Menu
 */
async function sendGamesMenu(sock, chatId, senderId, msg) {
    const bodyText = 
`┏━━〔 🎮 𝗚𝗔𝗠𝗘𝗦 & 𝗦𝗣𝗘𝗘𝗗 〕━━┓
┃ Test bot latency and millisecond response speed
┗━━━━━━━━━━━━━━━━━━━━━━━┛`.trim();

    const buttons = [
        { id: 'ghost_action:ping', text: '⚡ Speed Test' },
        { id: 'ghost_action:status', text: '📊 System Status' },
        { id: 'ghost_menu:main', text: '🏠 Main Menu' }
    ];

    await sendButtons(sock, chatId, {
        title: "〔 🎮 𝗚𝗔𝗠𝗘𝗦 𝗠𝗘𝗡𝗨 〕",
        text: bodyText,
        footer: "Ghost MBot • Speed",
        buttons
    }, msg);
}

/**
 * 8. Mute Duration Selector Menu
 */
async function sendMuteDurationMenu(sock, chatId, senderId, msg) {
    const bodyText = 
`┏━━〔 🔒 𝗠𝗨𝗧𝗘 𝗚𝗥𝗢𝗨𝗣 〕━━┓
┃ Choose lock duration for this group chat:
┗━━━━━━━━━━━━━━━━━━━━━┛

⏱️ *QUICK DURATIONS:*
• \`.mute 5\` ➔ 5 Minutes
• \`.mute 15\` ➔ 15 Minutes
• \`.mute 30\` ➔ 30 Minutes
• \`.mute 60\` ➔ 1 Hour
• \`.unmute\` ➔ Open chat now

👉 _Tap a button below to mute or unmute_`.trim();

    const buttons = [
        { id: 'ghost_action:mute_15', text: '⏱️ Mute 15m' },
        { id: 'ghost_action:unmute', text: '🔓 Unmute Chat' },
        { id: 'cat_group', text: '👥 Group Menu' }
    ];

    await sendButtons(sock, chatId, {
        title: "〔 🔒 𝗠𝗨𝗧𝗘 𝗚𝗥𝗢𝗨𝗣 〕",
        text: bodyText,
        footer: "Ghost MBot • Mute",
        buttons
    }, msg);
}

// ==========================================
// Sub-Menus for Toggleable Features (ON / OFF)
// ==========================================

async function sendAutoreadSubMenu(sock, chatId, senderId, msg) {
    const isEnabled = isAutoreadEnabled();
    const text = 
`┏━━〔 👁️ 𝗔𝗨𝗧𝗢-𝗥𝗘𝗔𝗗 〕━━┓
┃ 📌 *Current Status:* ${isEnabled ? '🟢 ENABLED (ON)' : '🔴 DISABLED (OFF)'}
┗━━━━━━━━━━━━━━━━━━━━┛
Automatically mark all incoming messages as read with blue ticks.

Select an action below:`.trim();

    const buttons = [
        { id: 'ghost_set:autoread_on', text: '🟢 Turn ON' },
        { id: 'ghost_set:autoread_off', text: '🔴 Turn OFF' },
        { id: 'ghost_menu:main', text: '🏠 Main Menu' }
    ];

    await sendButtons(sock, chatId, {
        title: "〔 👁️ 𝗔𝗨𝗧𝗢-𝗥𝗘𝗔𝗗 〕",
        text,
        footer: "Ghost MBot • Automation",
        buttons
    }, msg);
}

async function sendAutoreactSubMenu(sock, chatId, senderId, msg) {
    const isEnabled = isAutoreactEnabled();
    const text = 
`┏━━〔 🎭 𝗔𝗨𝗧𝗢-𝗥𝗘𝗔𝗖𝗧 〕━━┓
┃ 📌 *Current Status:* ${isEnabled ? '🟢 ENABLED (ON)' : '🔴 DISABLED (OFF)'}
┗━━━━━━━━━━━━━━━━━━━━┛
Automatically react to incoming messages with emojis.

Select an action below:`.trim();

    const buttons = [
        { id: 'ghost_set:autoreact_on', text: '🟢 Turn ON' },
        { id: 'ghost_set:autoreact_off', text: '🔴 Turn OFF' },
        { id: 'ghost_menu:main', text: '🏠 Main Menu' }
    ];

    await sendButtons(sock, chatId, {
        title: "〔 🎭 𝗔𝗨𝗧𝗢-𝗥𝗘𝗔𝗖𝗧 〕",
        text,
        footer: "Ghost MBot • Automation",
        buttons
    }, msg);
}

async function sendAutotypingSubMenu(sock, chatId, senderId, msg) {
    const isEnabled = isAutotypingEnabled();
    const text = 
`┏━━〔 ⌨️ 𝗔𝗨𝗧𝗢-𝗧𝗬𝗣𝗜𝗡𝗚 〕━━┓
┃ 📌 *Current Status:* ${isEnabled ? '🟢 ENABLED (ON)' : '🔴 DISABLED (OFF)'}
┗━━━━━━━━━━━━━━━━━━━━┛
Automatically simulate composing/typing status presence.

Select an action below:`.trim();

    const buttons = [
        { id: 'ghost_set:autotyping_on', text: '🟢 Turn ON' },
        { id: 'ghost_set:autotyping_off', text: '🔴 Turn OFF' },
        { id: 'ghost_menu:main', text: '🏠 Main Menu' }
    ];

    await sendButtons(sock, chatId, {
        title: "〔 ⌨️ 𝗔𝗨𝗧𝗢-𝗧𝗬𝗣𝗜𝗡𝗚 〕",
        text,
        footer: "Ghost MBot • Automation",
        buttons
    }, msg);
}

async function sendAntideleteSubMenu(sock, chatId, senderId, msg) {
    const isEnabled = getAntiDeleteState();
    const text = 
`┏━━〔 🗑️ 𝗔𝗡𝗧𝗜-𝗗𝗘𝗟𝗘𝗧𝗘 〕━━┓
┃ 📌 *Current Status:* ${isEnabled ? '🟢 ENABLED (ON)' : '🔴 DISABLED (OFF)'}
┗━━━━━━━━━━━━━━━━━━━━┛
Automatically capture deleted messages and forward them to your private chat.

Select an action below:`.trim();

    const buttons = [
        { id: 'ghost_set:antidelete_on', text: '🟢 Turn ON' },
        { id: 'ghost_set:antidelete_off', text: '🔴 Turn OFF' },
        { id: 'ghost_menu:main', text: '🏠 Main Menu' }
    ];

    await sendButtons(sock, chatId, {
        title: "〔 🗑️ 𝗔𝗡𝗧𝗜-𝗗𝗘𝗟𝗘𝗧𝗘 〕",
        text,
        footer: "Ghost MBot • Security",
        buttons
    }, msg);
}

async function sendAntilinkSubMenu(sock, chatId, senderId, msg) {
    const isGroup = chatId.endsWith('@g.us');
    const isEnabled = isGroup ? isAntiLinkEnabled(chatId) : false;
    const text = 
`┏━━〔 🛡️ 𝗔𝗡𝗧𝗜-𝗟𝗜𝗡𝗞 〕━━┓
┃ 📌 *Current Status:* ${isEnabled ? '🟢 ENABLED (ON)' : '🔴 DISABLED (OFF)'}
┗━━━━━━━━━━━━━━━━━━━━┛
Automatically detect forbidden links with 3-warning auto-kick.

Select an action below:`.trim();

    const buttons = [
        { id: 'ghost_set:antilink_on', text: '🟢 Turn ON' },
        { id: 'ghost_set:antilink_off', text: '🔴 Turn OFF' },
        { id: 'cat_group', text: '👥 Group Menu' }
    ];

    await sendButtons(sock, chatId, {
        title: "〔 🛡️ 𝗔𝗡𝗧𝗜-𝗟𝗜𝗡𝗞 〕",
        text,
        footer: "Ghost MBot • Group Protection",
        buttons
    }, msg);
}

async function sendModeSubMenu(sock, chatId, senderId, msg) {
    const currentMode = getSessionMode(sock);
    const sessionPhone = getSessionPhone(sock);
    const text = 
`┏━━〔 🌐 𝗕𝗢𝗧 𝗠𝗢𝗗𝗘 〕━━┓
┃ 📱 Session: +${sessionPhone}
┃ 📌 Current: ${currentMode.toUpperCase()}
┗━━━━━━━━━━━━━━━━━━━━┛
• *Private:* Only bot owner (+${sessionPhone}) can use commands
• *Public:* All users can use public commands

Choose an option below:`.trim();

    const buttons = [
        { id: 'ghost_set:mode_private', text: '🔒 Private Mode' },
        { id: 'ghost_set:mode_public', text: '🌐 Public Mode' },
        { id: 'cat_admin', text: '🛡️ Admin Menu' }
    ];

    await sendButtons(sock, chatId, {
        title: "〔 🌐 𝗕𝗢𝗧 𝗠𝗢𝗗𝗘 〕",
        text,
        footer: "Ghost MBot • Access Control",
        buttons
    }, msg);
}

async function sendAdminlockSubMenu(sock, chatId, senderId, msg) {
    const text = 
`┏━━〔 🛡️ 𝗔𝗗𝗠𝗜𝗡 𝗟𝗢𝗖𝗞 〕━━┓
┃ Protect group admin hierarchy
┗━━━━━━━━━━━━━━━━━━━━━┛
Automatically demote any unauthorized promotions by rogue admins.

Choose an option below:`.trim();

    const buttons = [
        { id: 'ghost_set:adminlock_on', text: '🛡️ Turn ON' },
        { id: 'ghost_set:adminlock_off', text: '🔓 Turn OFF' },
        { id: 'cat_admin', text: '🛡️ Admin Menu' }
    ];

    await sendButtons(sock, chatId, {
        title: "〔 🛡️ 𝗔𝗗𝗠𝗜𝗡 𝗟𝗢𝗖𝗞 〕",
        text,
        footer: "Ghost MBot • Admin Security",
        buttons
    }, msg);
}

async function sendViewonceSubMenu(sock, chatId, senderId, msg) {
    const text = 
`┏━━〔 👁️ 𝗩𝗜𝗘𝗪-𝗢𝗡𝗖𝗘 〕━━┓
┃ Extract disappearing photos & videos
┗━━━━━━━━━━━━━━━━━━━━━┛
• Reply to any view-once media with the grab button below
• Or reply with ❤️ heart emoji to secretly receive it in DM!

Choose an action below:`.trim();

    const buttons = [
        { id: 'ghost_action:vv', text: '👁️ Grab View-Once' },
        { id: 'ghost_action:vv_guide', text: '❤️ Secret VV Guide' },
        { id: 'cat_download', text: '📥 Download Menu' }
    ];

    await sendButtons(sock, chatId, {
        title: "〔 👁️ 𝗩𝗜𝗘𝗪-𝗢𝗡𝗖𝗘 〕",
        text,
        footer: "Ghost MBot • Media Tools",
        buttons
    }, msg);
}

/**
 * Maps raw text or button label to an internal interactive action identifier.
 */
function resolveButtonActionFromText(text) {
    if (!text || typeof text !== 'string') return null;
    const clean = text.toLowerCase().trim();

    // Menu Navigation
    if (clean.includes('group menu') || clean === 'group' || clean === '1') return 'cat_group';
    if (clean.includes('admin menu') || clean === 'admin' || clean === '2') return 'cat_admin';
    if (clean.includes('tool menu') || clean.includes('tools') || clean === '3') return 'cat_tool';
    if (clean.includes('owner menu') || clean === 'owner' || clean === '4') return 'cat_owner';
    if (clean.includes('download') || clean.includes('media menu') || clean === '5') return 'cat_download';
    if (clean.includes('games menu') || clean.includes('game') || clean === '6') return 'cat_games';
    if (clean.includes('main menu') || clean === 'menu' || clean === 'help' || clean === '0') return 'ghost_menu:main';

    // Actions & Tools
    if (clean.includes('tag all')) return 'ghost_action:tagall';
    if (clean.includes('speed test') || clean.includes('ping')) return 'ghost_action:ping';
    if (clean.includes('system status') || clean.includes('bot status')) return 'ghost_action:status';
    if (clean.includes('pair list')) return 'ghost_action:pairlist';
    if (clean.includes('pair session') || clean.includes('pair new')) return 'ghost_flow:pair';
    if (clean.includes('owner info') || clean.includes('owner contact')) return 'ghost_action:owner';
    if (clean.includes('anti-link')) return 'ghost_sub:antilink';
    if (clean.includes('bot mode')) return 'ghost_sub:mode';
    if (clean.includes('admin lock')) return 'ghost_sub:adminlock';
    if (clean.includes('auto-read')) return 'ghost_sub:autoread';
    if (clean.includes('auto-react')) return 'ghost_sub:autoreact';
    if (clean.includes('auto-typing')) return 'ghost_sub:autotyping';
    if (clean.includes('anti-delete')) return 'ghost_sub:antidelete';
    if (clean.includes('download dp')) return 'ghost_flow:dp';
    if (clean.includes('unmute')) return 'ghost_action:unmute';
    if (clean.includes('mute 15')) return 'ghost_action:mute_15';

    return null;
}

/**
 * Main Interactive Action Dispatcher
 */
async function handleInteractiveAction(sock, chatId, senderId, msg, rawActionId) {
    const startTime = Date.now();
    let actionId = rawActionId;

    // Resolve if actionId is human text or button display text
    const resolved = resolveButtonActionFromText(rawActionId);
    if (resolved) {
        actionId = resolved;
    }

    console.log(chalk.bold.magenta(`⚡ [BUTTON CLICK] ${actionId} (raw: ${rawActionId}) | From: ${senderId.split('@')[0]}`));

    // Debounce check
    if (isDuplicateTap(chatId, senderId, actionId)) {
        console.log(chalk.yellow(`⏳ [DEBOUNCE] Ignored rapid duplicate tap: ${actionId}`));
        return;
    }

    try {
        // --- Category Navigation Menus ---
        if (actionId === 'ghost_menu:main' || actionId === 'menu' || actionId === 'help' || actionId === 'cat_main' || actionId === '.mainmenu') {
            return await sendMainMenu(sock, chatId, senderId, msg);
        }
        if (actionId === 'cat_group' || actionId === '.groupmenu') {
            return await sendGroupMenu(sock, chatId, senderId, msg);
        }
        if (actionId === 'cat_admin' || actionId === '.adminmenu') {
            return await sendAdminMenu(sock, chatId, senderId, msg);
        }
        if (actionId === 'cat_tool' || actionId === '.toolmenu') {
            return await sendToolMenu(sock, chatId, senderId, msg);
        }
        if (actionId === 'cat_owner' || actionId === '.ownermenu') {
            return await sendOwnerMenu(sock, chatId, senderId, msg);
        }
        if (actionId === 'cat_download' || actionId === '.downloadmenu') {
            return await sendDownloadMenu(sock, chatId, senderId, msg);
        }
        if (actionId === 'cat_games' || actionId === '.gamesmenu') {
            return await sendGamesMenu(sock, chatId, senderId, msg);
        }
        if (actionId === 'ghost_menu:mute_options') {
            return await sendMuteDurationMenu(sock, chatId, senderId, msg);
        }

        // --- Sub-menu Openers (Show ON / OFF buttons) ---
        if (actionId === 'ghost_sub:autoread') {
            return await sendAutoreadSubMenu(sock, chatId, senderId, msg);
        }
        if (actionId === 'ghost_sub:autoreact') {
            return await sendAutoreactSubMenu(sock, chatId, senderId, msg);
        }
        if (actionId === 'ghost_sub:autotyping') {
            return await sendAutotypingSubMenu(sock, chatId, senderId, msg);
        }
        if (actionId === 'ghost_sub:antidelete') {
            return await sendAntideleteSubMenu(sock, chatId, senderId, msg);
        }
        if (actionId === 'ghost_sub:antilink') {
            return await sendAntilinkSubMenu(sock, chatId, senderId, msg);
        }
        if (actionId === 'ghost_sub:mode') {
            return await sendModeSubMenu(sock, chatId, senderId, msg);
        }
        if (actionId === 'ghost_sub:adminlock') {
            return await sendAdminlockSubMenu(sock, chatId, senderId, msg);
        }
        if (actionId === 'ghost_sub:viewonce') {
            return await sendViewonceSubMenu(sock, chatId, senderId, msg);
        }

        // --- Toggle Execution Actions (Execute ON / OFF choice directly without issue) ---
        if (actionId === 'ghost_set:autoread_on') {
            await autoreadCommand(sock, chatId, msg, ['on']);
            return await sendButtons(sock, chatId, {
                title: "〔 👁️ 𝗔𝗨𝗧𝗢-𝗥𝗘𝗔𝗗 〕",
                text: "✅ *Auto-Read is now ENABLED!*\nAll incoming messages will be automatically marked as read (Blue Ticks).",
                footer: "Ghost MBot • Automation",
                buttons: [
                    { id: 'ghost_sub:autoread', text: '⚙️ Settings' },
                    { id: 'ghost_menu:main', text: '🏠 Main Menu' }
                ]
            }, msg);
        }

        if (actionId === 'ghost_set:autoread_off') {
            await autoreadCommand(sock, chatId, msg, ['off']);
            return await sendButtons(sock, chatId, {
                title: "〔 👁️ 𝗔𝗨𝗧𝗢-𝗥𝗘𝗔𝗗 〕",
                text: "🔴 *Auto-Read is now DISABLED!*\nMessages will no longer be auto-read.",
                footer: "Ghost MBot • Automation",
                buttons: [
                    { id: 'ghost_sub:autoread', text: '⚙️ Settings' },
                    { id: 'ghost_menu:main', text: '🏠 Main Menu' }
                ]
            }, msg);
        }

        if (actionId === 'ghost_set:autoreact_on') {
            await autoreactCommand(sock, chatId, msg, ['on']);
            return await sendButtons(sock, chatId, {
                title: "〔 🎭 𝗔𝗨𝗧𝗢-𝗥𝗘𝗔𝗖𝗧 〕",
                text: "✅ *Auto-React is now ENABLED!*\nBot will automatically react to incoming messages with emojis.",
                footer: "Ghost MBot • Automation",
                buttons: [
                    { id: 'ghost_sub:autoreact', text: '⚙️ Settings' },
                    { id: 'ghost_menu:main', text: '🏠 Main Menu' }
                ]
            }, msg);
        }

        if (actionId === 'ghost_set:autoreact_off') {
            await autoreactCommand(sock, chatId, msg, ['off']);
            return await sendButtons(sock, chatId, {
                title: "〔 🎭 𝗔𝗨𝗧𝗢-𝗥𝗘𝗔𝗖𝗧 〕",
                text: "🔴 *Auto-React is now DISABLED!*\nAutomatic reactions are turned off.",
                footer: "Ghost MBot • Automation",
                buttons: [
                    { id: 'ghost_sub:autoreact', text: '⚙️ Settings' },
                    { id: 'ghost_menu:main', text: '🏠 Main Menu' }
                ]
            }, msg);
        }

        if (actionId === 'ghost_set:autotyping_on') {
            await autotypingCommand(sock, chatId, msg, ['on']);
            return await sendButtons(sock, chatId, {
                title: "〔 ⌨️ 𝗔𝗨𝗧𝗢-𝗧𝗬𝗣𝗜𝗡𝗚 〕",
                text: "✅ *Auto-Typing is now ENABLED!*\nBot will simulate typing presence.",
                footer: "Ghost MBot • Automation",
                buttons: [
                    { id: 'ghost_sub:autotyping', text: '⚙️ Settings' },
                    { id: 'ghost_menu:main', text: '🏠 Main Menu' }
                ]
            }, msg);
        }

        if (actionId === 'ghost_set:autotyping_off') {
            await autotypingCommand(sock, chatId, msg, ['off']);
            return await sendButtons(sock, chatId, {
                title: "〔 ⌨️ 𝗔𝗨𝗧𝗢-𝗧𝗬𝗣𝗜𝗡𝗚 〕",
                text: "🔴 *Auto-Typing is now DISABLED!*\nFake typing presence turned off.",
                footer: "Ghost MBot • Automation",
                buttons: [
                    { id: 'ghost_sub:autotyping', text: '⚙️ Settings' },
                    { id: 'ghost_menu:main', text: '🏠 Main Menu' }
                ]
            }, msg);
        }

        if (actionId === 'ghost_set:antidelete_on') {
            await antideleteCommand(sock, chatId, senderId, ['on'], msg);
            return await sendButtons(sock, chatId, {
                title: "〔 🗑️ 𝗔𝗡𝗧𝗜-𝗗𝗘𝗟𝗘𝗧𝗘 〕",
                text: "✅ *Anti-Delete is now ENABLED!*\nDeleted messages and media will be forwarded to your DM.",
                footer: "Ghost MBot • Security",
                buttons: [
                    { id: 'ghost_sub:antidelete', text: '⚙️ Settings' },
                    { id: 'ghost_menu:main', text: '🏠 Main Menu' }
                ]
            }, msg);
        }

        if (actionId === 'ghost_set:antidelete_off') {
            await antideleteCommand(sock, chatId, senderId, ['off'], msg);
            return await sendButtons(sock, chatId, {
                title: "〔 🗑️ 𝗔𝗡𝗧𝗜-𝗗𝗘𝗟𝗘𝗧𝗘 〕",
                text: "🔴 *Anti-Delete is now DISABLED!*",
                footer: "Ghost MBot • Security",
                buttons: [
                    { id: 'ghost_sub:antidelete', text: '⚙️ Settings' },
                    { id: 'ghost_menu:main', text: '🏠 Main Menu' }
                ]
            }, msg);
        }

        if (actionId === 'ghost_set:antilink_on') {
            await antilinkCommand(sock, chatId, senderId, ['on'], msg);
            return await sendButtons(sock, chatId, {
                title: "〔 🛡️ 𝗔𝗡𝗧𝗜-𝗟𝗜𝗡𝗞 〕",
                text: "✅ *Anti-Link is now ENABLED for this group!*\n3 warnings system is active.",
                footer: "Ghost MBot • Group Protection",
                buttons: [
                    { id: 'ghost_sub:antilink', text: '⚙️ Settings' },
                    { id: 'cat_group', text: '👥 Group Menu' }
                ]
            }, msg);
        }

        if (actionId === 'ghost_set:antilink_off') {
            await antilinkCommand(sock, chatId, senderId, ['off'], msg);
            return await sendButtons(sock, chatId, {
                title: "〔 🛡️ 𝗔𝗡𝗧𝗜-𝗟𝗜𝗡𝗞 〕",
                text: "🔴 *Anti-Link is now DISABLED for this group!*",
                footer: "Ghost MBot • Group Protection",
                buttons: [
                    { id: 'ghost_sub:antilink', text: '⚙️ Settings' },
                    { id: 'cat_group', text: '👥 Group Menu' }
                ]
            }, msg);
        }

        if (actionId === 'ghost_set:mode_private') {
            await modeCommand(sock, chatId, senderId, msg, ['private']);
            return await sendButtons(sock, chatId, {
                title: "〔 🔒 𝗣𝗥𝗜𝗩𝗔𝗧𝗘 𝗠𝗢𝗗𝗘 〕",
                text: "🔒 *Private Mode Active!*\nThis session will now respond ONLY to its owner.",
                footer: "Ghost MBot • Access Control",
                buttons: [
                    { id: 'ghost_sub:mode', text: '🌐 Change Mode' },
                    { id: 'ghost_menu:main', text: '🏠 Main Menu' }
                ]
            }, msg);
        }

        if (actionId === 'ghost_set:mode_public') {
            await modeCommand(sock, chatId, senderId, msg, ['public']);
            return await sendButtons(sock, chatId, {
                title: "〔 🌐 𝗣𝗨𝗕𝗟𝗜𝗖 𝗠𝗢𝗗𝗘 〕",
                text: "🌐 *Public Mode Active!*\nThis session will now respond to all authorized users.",
                footer: "Ghost MBot • Access Control",
                buttons: [
                    { id: 'ghost_sub:mode', text: '🌐 Change Mode' },
                    { id: 'ghost_menu:main', text: '🏠 Main Menu' }
                ]
            }, msg);
        }

        if (actionId === 'ghost_set:adminlock_on') {
            await adminlockCommand(sock, chatId, senderId, ['on'], msg);
            return await sendButtons(sock, chatId, {
                title: "〔 🛡️ 𝗔𝗗𝗠𝗜𝗡 𝗟𝗢𝗖𝗞 〕",
                text: "🔒 *Admin Lock is now ON!*\nUnauthorized promotions will be demoted automatically.",
                footer: "Ghost MBot • Security",
                buttons: [
                    { id: 'ghost_sub:adminlock', text: '⚙️ Settings' },
                    { id: 'cat_admin', text: '🛡️ Admin Menu' }
                ]
            }, msg);
        }

        if (actionId === 'ghost_set:adminlock_off') {
            await adminlockCommand(sock, chatId, senderId, ['off'], msg);
            return await sendButtons(sock, chatId, {
                title: "〔 🛡️ 𝗔𝗗𝗠𝗜𝗡 𝗟𝗢𝗖𝗞 〕",
                text: "🔓 *Admin Lock is now OFF.*",
                footer: "Ghost MBot • Security",
                buttons: [
                    { id: 'ghost_sub:adminlock', text: '⚙️ Settings' },
                    { id: 'cat_admin', text: '🛡️ Admin Menu' }
                ]
            }, msg);
        }

        // --- Guided Interactive Flow Triggers ---
        if (actionId === 'ghost_flow:pair') {
            startFlow(chatId, senderId, 'PAIR_PHONE');
            return await sock.sendMessage(chatId, {
                text: `┏━━〔 🔑 𝗣𝗔𝗜𝗥𝗜𝗡𝗚 𝗔𝗦𝗦𝗜𝗦𝗧𝗔𝗡𝗧 〕━━┓\n\n📱 *Enter WhatsApp Phone Number*\n\nPlease reply with the phone number with country code (e.g. \`923232391033\`).\n\n_Type *cancel* to abort._\n┗━━━━━━━━━━━━━━━━━━━━━━┛`
            }, { quoted: msg });
        }

        if (actionId === 'ghost_flow:hidetag') {
            const isGroup = chatId.endsWith('@g.us');
            if (!isGroup) {
                return await sock.sendMessage(chatId, { text: '❌ HideTag works only in groups.' }, { quoted: msg });
            }
            const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
            if (!isBotAdmin) {
                return await sock.sendMessage(chatId, { text: '❌ Please make Ghost Bot an admin first.' }, { quoted: msg });
            }
            if (!isSenderAdmin && !msg.key.fromMe) {
                return await sock.sendMessage(chatId, { text: '❌ Only group admins can use HideTag.' }, { quoted: msg });
            }

            const replyMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
            if (replyMessage) {
                return await hideTagCommand(sock, chatId, senderId, '', replyMessage, msg);
            }

            startFlow(chatId, senderId, 'HIDETAG_TEXT');
            return await sock.sendMessage(chatId, {
                text: `┏━━〔 📢 𝗛𝗜𝗗𝗘𝗧𝗔𝗚 𝗕𝗥𝗢𝗔𝗗𝗖𝗔𝗦𝗧 〕━━┓\n\n📢 *Send Announcement Text*\n\nPlease reply with the message you wish to broadcast to all group members invisibly.\n\n_Type *cancel* to abort._\n┗━━━━━━━━━━━━━━━━━━━━━━┛`
            }, { quoted: msg });
        }

        if (actionId === 'ghost_flow:kick') {
            const isGroup = chatId.endsWith('@g.us');
            if (!isGroup) {
                return await sock.sendMessage(chatId, { text: '❌ Kick works only in groups.' }, { quoted: msg });
            }
            const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (quotedParticipant) {
                return await kickCommand(sock, chatId, senderId, [quotedParticipant], msg);
            }
            startFlow(chatId, senderId, 'KICK_TARGET');
            return await sock.sendMessage(chatId, {
                text: `┏━━〔 👢 𝗞𝗜𝗖𝗞 𝗠𝗘𝗠𝗕𝗘𝗥 〕━━┓\n\n👢 Reply to the target user's message, mention them (e.g. \`@user\`), or send their phone number.\n\n_Type *cancel* to abort._\n┗━━━━━━━━━━━━━━━━━━━━━━┛`
            }, { quoted: msg });
        }

        if (actionId === 'ghost_flow:ban') {
            const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (quotedParticipant) {
                return await banCommand(sock, chatId, senderId, [quotedParticipant], msg);
            }
            startFlow(chatId, senderId, 'BAN_TARGET');
            return await sock.sendMessage(chatId, {
                text: `┏━━〔 🚫 𝗕𝗔𝗡 𝗨𝗦𝗘𝗥 〕━━┓\n\n🚫 Mention the user (e.g. \`@user\`) or send their phone number to ban them from using the bot.\n\n_Type *cancel* to abort._\n┗━━━━━━━━━━━━━━━━━━━━━━┛`
            }, { quoted: msg });
        }

        if (actionId === 'ghost_flow:unban') {
            const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (quotedParticipant) {
                return await unbanCommand(sock, chatId, senderId, [quotedParticipant], msg);
            }
            startFlow(chatId, senderId, 'UNBAN_TARGET');
            return await sock.sendMessage(chatId, {
                text: `┏━━〔 🟢 𝗨𝗡𝗕𝗔𝗡 𝗨𝗦𝗘𝗥 〕━━┓\n\n🟢 Mention the user or send their phone number to restore bot access.\n\n_Type *cancel* to abort._\n┗━━━━━━━━━━━━━━━━━━━━━━┛`
            }, { quoted: msg });
        }

        if (actionId === 'ghost_flow:dp') {
            return await dpCommand(sock, chatId, msg);
        }

        // --- Instant Execution Actions ---
        if (actionId === 'ghost_action:ping') {
            await pingCommand(sock, chatId, msg, startTime);
            return;
        }

        if (actionId === 'ghost_action:status') {
            await statusCommand(sock, chatId, msg);
            return;
        }

        if (actionId === 'ghost_action:jid') {
            await jidCommand(sock, chatId, senderId, msg);
            return;
        }

        if (actionId === 'ghost_action:owner') {
            return await ownerCommand(sock, chatId, senderId, msg);
        }

        // Group Actions
        if (actionId === 'ghost_action:tagall') {
            return await tagAllCommand(sock, chatId, senderId, msg);
        }

        if (actionId === 'ghost_action:unmute') {
            return await unmuteCommand(sock, chatId, senderId, msg);
        }

        if (actionId.startsWith('ghost_action:mute_')) {
            const minutes = parseInt(actionId.replace('ghost_action:mute_', '')) || 0;
            return await muteCommand(sock, chatId, senderId, msg, minutes > 0 ? minutes : undefined);
        }

        // Media & Privacy
        if (actionId === 'ghost_action:vv') {
            return await viewonceCommand(sock, chatId, msg);
        }

        if (actionId === 'ghost_action:vv_guide') {
            const guideText = 
`┏━━〔 ❤️ 𝗦𝗘𝗖𝗥𝗘𝗧 𝗩𝗜𝗘𝗪-𝗢𝗡𝗖𝗘 〕━━┓
┃ 1. Reply to ANY View-Once media
┃ 2. Send the ❤️ emoji (single heart)
┃ 3. Ghost Bot extracts the media
┃    and sends it to your DM with zero trace!
┗━━━━━━━━━━━━━━━━━━━━━━━━┛`.trim();
            return await sock.sendMessage(chatId, { text: guideText }, { quoted: msg });
        }

        // Owner Actions
        if (actionId === 'ghost_action:pairlist') {
            return await pairlistCommand(sock, chatId, senderId, msg, [], 'pairlist');
        }

        if (actionId === 'ghost_flow:unpair') {
            startFlow(chatId, senderId, 'UNPAIR_PHONE');
            return await sock.sendMessage(chatId, {
                text: `┏━━〔 ❌ 𝗨𝗡𝗣𝗔𝗜𝗥 𝗦𝗘𝗦𝗦𝗜𝗢𝗡 〕━━┓\n\n📱 *Enter Phone Number to Unpair*\n\nPlease reply with the number you wish to remove (e.g. \`923232391033\`).\n\n_Type *cancel* to abort._\n┗━━━━━━━━━━━━━━━━━━━━━━┛`
            }, { quoted: msg });
        }

        if (actionId === 'ghost_action:gcsstatus') {
            return await gcsstatusCommand(sock, chatId, senderId, msg, '');
        }

        // Direct command executions if button id is a command
        if (actionId.startsWith('.')) {
            const rawCmd = actionId.slice(1).trim();
            const parts = rawCmd.split(/\s+/);
            const cmd = parts[0].toLowerCase();
            const cmdArgs = parts.slice(1);

            switch (cmd) {
                case 'tagall': return await tagAllCommand(sock, chatId, senderId, msg);
                case 'ping': return await pingCommand(sock, chatId, msg, startTime);
                case 'status': return await statusCommand(sock, chatId, msg);
                case 'jid': return await jidCommand(sock, chatId, senderId, msg);
                case 'unmute': return await unmuteCommand(sock, chatId, senderId, msg);
                case 'mute': return await muteCommand(sock, chatId, senderId, msg, cmdArgs[0] ? parseInt(cmdArgs[0]) : undefined);
                case 'mode': return await modeCommand(sock, chatId, senderId, msg, cmdArgs);
                case 'adminlock': return await adminlockCommand(sock, chatId, senderId, cmdArgs, msg);
                case 'vv': case 'viewonce': return await viewonceCommand(sock, chatId, msg);
                case 'dp': return await dpCommand(sock, chatId, msg);
                case 'owner': return await ownerCommand(sock, chatId, senderId, msg);
                case 'pairlist': return await pairlistCommand(sock, chatId, senderId, msg, cmdArgs, 'pairlist');
                case 'unpair': return await pairlistCommand(sock, chatId, senderId, msg, cmdArgs, 'unpair');
                case 'autoread': return await autoreadCommand(sock, chatId, msg, cmdArgs);
                case 'autoreact': case 'areact': return await autoreactCommand(sock, chatId, msg, cmdArgs);
                case 'autotyping': return await autotypingCommand(sock, chatId, msg, cmdArgs);
                case 'antidelete': return await antideleteCommand(sock, chatId, senderId, cmdArgs, msg);
                case 'antilink': return await antilinkCommand(sock, chatId, senderId, cmdArgs, msg);
                case 'gcsstatus': case 'gcstatus': case 'groupstatus': case 'gpstatus': case 'gstatus':
                    return await gcsstatusCommand(sock, chatId, senderId, msg, cmdArgs.join(' '));
                case 'kick': return await kickCommand(sock, chatId, senderId, msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [], msg);
                case 'ban': return await banCommand(sock, chatId, senderId, msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [], msg);
                case 'unban': return await unbanCommand(sock, chatId, senderId, msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [], msg);
                case 'hidetag': {
                    const replyMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
                    return await hideTagCommand(sock, chatId, senderId, cmdArgs.join(' '), replyMessage, msg);
                }
                case 'menu': case 'help': return await sendMainMenu(sock, chatId, senderId, msg);
                default: break;
            }
        }

    } catch (err) {
        console.error(`Interactive action [${actionId}] error:`, err);
        await sock.sendMessage(chatId, { text: `❌ Failed to execute action: ${err.message}` }, { quoted: msg });
    }
}

/**
 * Handles incoming conversational input for an ongoing guided flow.
 */
async function handleGuidedFlowInput(sock, chatId, senderId, msg, rawText) {
    const flow = getFlow(chatId, senderId);
    if (!flow) return false;

    const trimmed = rawText.trim();
    if (trimmed.toLowerCase() === 'cancel' || trimmed.toLowerCase() === 'stop') {
        clearFlow(chatId, senderId);
        await sock.sendMessage(chatId, { text: '❌ *Action cancelled.*' }, { quoted: msg });
        return true;
    }

    try {
        switch (flow.type) {
            case 'PAIR_PHONE': {
                clearFlow(chatId, senderId);
                const numberOnly = trimmed.replace(/[^0-9]/g, '');
                if (numberOnly.length < 10) {
                    await sock.sendMessage(chatId, { text: '❌ Invalid phone number. Please include country code (e.g. `923232391033`).' }, { quoted: msg });
                    return true;
                }
                await pairCommand(sock, chatId, senderId, msg, [numberOnly]);
                return true;
            }

            case 'UNPAIR_PHONE': {
                clearFlow(chatId, senderId);
                const numberOnly = trimmed.replace(/[^0-9]/g, '');
                if (!numberOnly) {
                    await sock.sendMessage(chatId, { text: '❌ Please provide a valid phone number.' }, { quoted: msg });
                    return true;
                }
                await pairlistCommand(sock, chatId, senderId, msg, [numberOnly], 'unpair');
                return true;
            }

            case 'HIDETAG_TEXT': {
                clearFlow(chatId, senderId);
                const replyMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
                await hideTagCommand(sock, chatId, senderId, trimmed, replyMessage, msg);
                return true;
            }

            case 'KICK_TARGET': {
                clearFlow(chatId, senderId);
                const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await kickCommand(sock, chatId, senderId, mentionedJids, msg);
                return true;
            }

            case 'BAN_TARGET': {
                clearFlow(chatId, senderId);
                const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await banCommand(sock, chatId, senderId, mentionedJids, msg);
                return true;
            }

            case 'UNBAN_TARGET': {
                clearFlow(chatId, senderId);
                const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await unbanCommand(sock, chatId, senderId, mentionedJids, msg);
                return true;
            }

            default:
                clearFlow(chatId, senderId);
                return false;
        }
    } catch (e) {
        console.error('Error handling guided flow input:', e);
        clearFlow(chatId, senderId);
        await sock.sendMessage(chatId, { text: `❌ Flow error: ${e.message}` }, { quoted: msg });
        return true;
    }
}

module.exports = {
    sendMainMenu,
    sendGroupMenu,
    sendAdminMenu,
    sendToolMenu,
    sendOwnerMenu,
    sendDownloadMenu,
    sendGamesMenu,
    sendMuteDurationMenu,
    sendAutoreadSubMenu,
    sendAutoreactSubMenu,
    sendAutotypingSubMenu,
    sendAntideleteSubMenu,
    sendAntilinkSubMenu,
    sendModeSubMenu,
    sendAdminlockSubMenu,
    sendViewonceSubMenu,
    handleInteractiveAction,
    handleGuidedFlowInput,
    resolveButtonActionFromText
};
