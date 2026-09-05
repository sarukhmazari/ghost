const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const isAdmin = require('./isAdmin');
const isOwnerOrSudo = require('./isOwner');

const antilinkPath = path.join(__dirname, '../data/antilink.json');
const warningsPath = path.join(__dirname, '../data/warnings.json');

function getAntiLinkConfig() {
    try {
        if (!fs.existsSync(antilinkPath)) return {};
        return JSON.parse(fs.readFileSync(antilinkPath, 'utf8'));
    } catch (e) {
        return {};
    }
}

function setAntiLinkState(chatId, enabled) {
    const config = getAntiLinkConfig();
    config[chatId] = !!enabled;
    const dir = path.dirname(antilinkPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(antilinkPath, JSON.stringify(config, null, 2));
}

function getWarnings() {
    try {
        if (!fs.existsSync(warningsPath)) return {};
        return JSON.parse(fs.readFileSync(warningsPath, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveWarnings(warnings) {
    const dir = path.dirname(warningsPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2));
}

function isAntiLinkEnabled(chatId) {
    const config = getAntiLinkConfig();
    return !!config[chatId];
}

function containsAnyLink(text) {
    if (!text) return false;

    // Protocol / www links
    if (/(https?:\/\/|ftp:\/\/|www\.)/i.test(text)) return true;

    // Social / chat short links
    if (/(chat\.whatsapp\.com|wa\.me|whatsapp\.com|t\.me|telegram\.me|telegram\.org|discord\.gg|discord\.com|bit\.ly|tinyurl\.com|cutt\.ly|shorte\.st|lnk\.to)/i.test(text)) return true;

    // General domain pattern (word.tld)
    if (/([a-zA-Z0-9-]+\.)+(com|net|org|co|info|biz|io|me|app|xyz|dev|site|online|link|store|in|us|uk|ca|au|de|ru|fr|it|es|nl|br|mx|pk|id|tech|live|tv|cc|ai|gg|top|vip|space|club|pro|icu|best|fun|pw|win|shop|blog|click|ly|be|to|sh|cz)\b/i.test(text)) return true;

    return false;
}

function hasForbiddenLink(rawText) {
    if (!containsAnyLink(rawText)) return false;

    // Replace ONLY the allowed domains/protocols from the string, 
    // leaving any attached paths or text intact.
    // This prevents a bypass where a spammer attaches a bad link to a good one without spaces
    // e.g., "youtube.com/watch?v=123https://spam.com"
    const allowedRegex = /(https?:\/\/)?(www\.|m\.|music\.|web\.)?(youtube\.com|youtu\.be|facebook\.com|fb\.com|fb\.watch|fb\.me)/gi;

    const cleaned = rawText.replace(allowedRegex, ' ');

    // If cleaned text still has any link indicators (like a hidden https:// or another domain), it's forbidden!
    return containsAnyLink(cleaned);
}

async function handleAntiLink(sock, chatId, senderId, msg, rawText) {
    if (!chatId || !chatId.endsWith('@g.us')) return false;
    if (!isAntiLinkEnabled(chatId)) return false;

    // Ignore bot commands (e.g. .antilink on) from triggering anti-link check
    if (rawText.startsWith('.')) return false;

    // Check if message contains forbidden links
    if (!hasForbiddenLink(rawText)) return false;

    // Check admin status of sender & bot
    const { isBotAdmin, isSenderAdmin } = await isAdmin(sock, chatId, senderId);
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
    
    // Ignore if sender is group admin or bot owner/sudo
    if (isSenderAdmin || isOwner) {
        console.log(chalk.yellow(`🛡️ [ANTI-LINK] Link detected from Admin/Owner (${senderId.split('@')[0]}). Ignored.`));
        return false;
    }

    console.log(chalk.bold.red(`🚨 [ANTI-LINK] Forbidden link detected from non-admin member: ${senderId.split('@')[0]}`));

    // Delete link message immediately if bot is admin
    if (isBotAdmin) {
        try {
            await sock.sendMessage(chatId, { delete: msg.key });
            console.log(chalk.green(`🗑️ [ANTI-LINK] Deleted forbidden link message successfully.`));
        } catch (e) {
            console.error(chalk.red(`❌ [ANTI-LINK] Delete message failed:`), e.message);
        }
    } else {
        console.log(chalk.yellow(`⚠️ [ANTI-LINK] Bot is NOT an admin in this group! Cannot delete message.`));
    }

    // Track warning count
    const warnings = getWarnings();
    if (!warnings[chatId]) warnings[chatId] = {};
    
    warnings[chatId][senderId] = (warnings[chatId][senderId] || 0) + 1;
    const count = warnings[chatId][senderId];
    saveWarnings(warnings);

    const senderNum = senderId.split('@')[0].split(':')[0];

    if (count >= 3) {
        warnings[chatId][senderId] = 0;
        saveWarnings(warnings);

        if (isBotAdmin) {
            try {
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                await sock.sendMessage(chatId, {
                    text: `🚫 *@${senderNum} was kicked for sending links! (3/3 warnings)*`,
                    mentions: [senderId]
                });
            } catch (err) {
                await sock.sendMessage(chatId, {
                    text: `⚠️ *@${senderNum} reached 3/3 warnings, but kick failed.*`,
                    mentions: [senderId]
                });
            }
        } else {
            await sock.sendMessage(chatId, {
                text: `⚠️ *@${senderNum} reached 3/3 warnings for sending links. (Bot is not admin)*`,
                mentions: [senderId]
            });
        }
    } else {
        await sock.sendMessage(chatId, {
            text: `⚠️ *@${senderNum} Links are not allowed! Warning [${count}/3]*\n*(Only YouTube and Facebook links are permitted)*`,
            mentions: [senderId]
        });
    }

    return true;
}

module.exports = {
    isAntiLinkEnabled,
    setAntiLinkState,
    handleAntiLink
};
