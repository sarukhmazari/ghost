const fs = require('fs');
const path = require('path');

const bannedPath = path.join(__dirname, '..', 'data', 'banned.json');

function isBanned(userId) {
    if (!userId) return false;
    try {
        if (!fs.existsSync(bannedPath)) {
            if (!fs.existsSync(path.dirname(bannedPath))) {
                fs.mkdirSync(path.dirname(bannedPath), { recursive: true });
            }
            fs.writeFileSync(bannedPath, '[]', 'utf8');
            return false;
        }
        const raw = fs.readFileSync(bannedPath, 'utf8').trim();
        if (!raw) return false;
        const bannedUsers = JSON.parse(raw);
        return Array.isArray(bannedUsers) ? bannedUsers.includes(userId) : !!bannedUsers[userId];
    } catch (error) {
        return false;
    }
}

function banUser(userId) {
    try {
        if (!fs.existsSync(path.dirname(bannedPath))) {
            fs.mkdirSync(path.dirname(bannedPath), { recursive: true });
        }
        let list = [];
        if (fs.existsSync(bannedPath)) {
            try { list = JSON.parse(fs.readFileSync(bannedPath, 'utf8')); } catch(e){}
        }
        if (!Array.isArray(list)) list = [];
        if (!list.includes(userId)) {
            list.push(userId);
            fs.writeFileSync(bannedPath, JSON.stringify(list, null, 2), 'utf8');
        }
        return true;
    } catch (e) {
        return false;
    }
}

function unbanUser(userId) {
    try {
        if (!fs.existsSync(bannedPath)) return true;
        let list = [];
        try { list = JSON.parse(fs.readFileSync(bannedPath, 'utf8')); } catch(e){}
        if (!Array.isArray(list)) return true;
        list = list.filter(u => u !== userId);
        fs.writeFileSync(bannedPath, JSON.stringify(list, null, 2), 'utf8');
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = { isBanned, banUser, unbanUser };
