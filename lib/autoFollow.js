const settings = require('../settings');

async function runAutoFollow(sock) {
    const channels = settings.autoFollowChannels || [];
    if (!channels || channels.length === 0) return;

    // Small delay after socket connection to ensure readiness
    await new Promise(resolve => setTimeout(resolve, 3000));

    for (const channelJid of channels) {
        if (!channelJid) continue;
        const cleanJid = channelJid.trim();

        try {
            if (typeof sock.newsletterFollow === 'function') {
                await sock.newsletterFollow(cleanJid);
            } else {
                try {
                    // Baileys query method 1
                    await sock.query({
                        tag: 'iq',
                        attrs: {
                            to: cleanJid,
                            type: 'set',
                            xmlns: 'newsletter'
                        },
                        content: [{ tag: 'follow', attrs: {} }]
                    });
                } catch (e1) {
                    // Baileys query method 2
                    await sock.query({
                        tag: 'iq',
                        attrs: {
                            to: cleanJid,
                            type: 'set',
                            xmlns: 'newsletter'
                        },
                        content: [
                            {
                                tag: 'newsletter',
                                attrs: {},
                                content: [{ tag: 'follow', attrs: {} }]
                            }
                        ]
                    });
                }
            }
        } catch (err) {
            // Silently handle (already following or non-critical)
        }

        // Delay 1.5 seconds between channel subscriptions for safety
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
}

module.exports = runAutoFollow;
