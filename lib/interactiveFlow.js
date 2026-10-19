/**
 * Manages guided interactive conversational flows (e.g. asking for a phone number to pair,
 * asking for hidetag broadcast text, asking for kick target, etc.).
 * 
 * Flows are strictly scoped per chat & per sender to ensure no user ever interferes
 * with another user's interaction.
 */

const activeFlows = new Map();
const FLOW_TIMEOUT_MS = 60 * 1000; // 60 seconds expiration

function getFlowKey(chatId, senderId) {
    const cleanSender = (senderId || '').split(':')[0].split('@')[0];
    return `${chatId}:${cleanSender}`;
}

function startFlow(chatId, senderId, type, metadata = {}) {
    const key = getFlowKey(chatId, senderId);
    
    // Clear any existing timer
    if (activeFlows.has(key)) {
        clearTimeout(activeFlows.get(key).timer);
    }

    const timer = setTimeout(() => {
        activeFlows.delete(key);
    }, FLOW_TIMEOUT_MS);

    activeFlows.set(key, {
        type,
        metadata,
        timestamp: Date.now(),
        timer
    });
}

function getFlow(chatId, senderId) {
    const key = getFlowKey(chatId, senderId);
    return activeFlows.get(key) || null;
}

function clearFlow(chatId, senderId) {
    const key = getFlowKey(chatId, senderId);
    if (activeFlows.has(key)) {
        clearTimeout(activeFlows.get(key).timer);
        activeFlows.delete(key);
        return true;
    }
    return false;
}

function isFlowActive(chatId, senderId) {
    return !!getFlow(chatId, senderId);
}

module.exports = {
    startFlow,
    getFlow,
    clearFlow,
    isFlowActive
};
