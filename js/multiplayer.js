/* ============================================
   VENUE RIVALS - Ably Multiplayer Transport
   ============================================ */

const Multiplayer = (() => {
    async function createSession({ apiKey, roomCode, role, onEvent }) {
        if (!window.Ably?.Realtime) {
            throw new Error('Ably SDK not loaded.');
        }

        const clientId = `${role}-${Math.random().toString(36).slice(2, 9)}`;
        const realtime = new Ably.Realtime({ key: apiKey, clientId });
        await new Promise((resolve, reject) => {
            realtime.connection.once('connected', resolve);
            realtime.connection.once('failed', () => reject(new Error('Unable to connect to Ably.')));
        });

        const channel = realtime.channels.get(`venue-rivals:${roomCode}`);
        await channel.attach();

        channel.subscribe('event', (msg) => {
            if (typeof onEvent === 'function') onEvent(msg.data || {});
        });

        const session = {
            role,
            roomCode,
            clientId,
            publish(type, payload = {}) {
                return channel.publish('event', { type, payload, sender: clientId, ts: Date.now() });
            },
            close() {
                channel.detach();
                realtime.close();
            },
        };

        return session;
    }

    return { createSession };
})();
