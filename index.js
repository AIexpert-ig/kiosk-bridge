const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    // Upgrade: More aggressive ping to keep Render awake and detect dead clients faster
    pingTimeout: 20000,
    pingInterval: 10000,
});

// ─────────────────────────────────────────────
// UPGRADE 1: Keep-Alive Self-Ping
// Render Free Tier sleeps after 15 min of inactivity.
// This pings the server itself every 10 minutes to keep it alive.
// In production, replace with a proper Render paid tier or UptimeRobot.
// ─────────────────────────────────────────────
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

setInterval(() => {
    http.get(`${SELF_URL}/health`, (res) => {
        console.log(`💓 Keep-alive ping: ${res.statusCode}`);
    }).on('error', (err) => {
        console.error('❌ Keep-alive ping failed:', err.message);
    });
}, KEEP_ALIVE_INTERVAL_MS);

// ─────────────────────────────────────────────
// SOCKET LIFECYCLE — Track connected kiosks
// ─────────────────────────────────────────────
let connectedKiosks = new Set();

io.on('connection', (socket) => {
    connectedKiosks.add(socket.id);
    console.log(`✅ Kiosk Connected. ID: ${socket.id} | Total: ${connectedKiosks.size}`);

    socket.on('disconnect', (reason) => {
        connectedKiosks.delete(socket.id);
        console.log(`🔌 Kiosk Disconnected. ID: ${socket.id} | Reason: ${reason} | Remaining: ${connectedKiosks.size}`);
    });

    // Upgrade 3: Relay AI state changes from Vapi to the kiosk
    socket.on('AI_STATE', (state) => {
        console.log(`🤖 AI State Change: ${state}`);
    });
});

// ─────────────────────────────────────────────
// UPGRADE 1: Health Check Endpoint
// Used by keep-alive ping. Also useful for Render's health check config.
// ─────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'online',
        kiosks: connectedKiosks.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// ─────────────────────────────────────────────
// VAPI WEBHOOK — Main event handler
// Critical path: Vapi has a ~5s timeout on tool responses.
// Rule: Send res.status(201) FIRST. Do side effects AFTER.
// ─────────────────────────────────────────────
app.post('/vapi-webhook', async (req, res) => {
    const payload = req.body;

    if (!payload?.message) {
        return res.status(200).send('OK');
    }

    const { type, toolCalls } = payload.message;

    // ── UPGRADE 3: Relay AI state changes to kiosk ──
    if (type === 'speech-update') {
        const role = payload.message.role;
        const state = role === 'assistant' ? 'THINKING' : 'LISTENING';
        io.emit('AI_STATE_UPDATE', { state });
        return res.status(200).send('OK');
    }

    if (type === 'tool-calls-result') {
        io.emit('AI_STATE_UPDATE', { state: 'IDLE' });
        return res.status(200).send('OK');
    }

    if (type !== 'tool-calls' || !toolCalls?.length) {
        return res.status(200).send('OK');
    }

    const toolCall = toolCalls[0];

    if (toolCall.function.name !== 'updateKioskDisplay') {
        return res.status(200).json({
            results: [{
                toolCallId: toolCall.id,
                result: `Tool '${toolCall.function.name}' is not handled by this bridge.`,
            }]
        });
    }

    // ── UPGRADE 1: Parse arguments safely ──
    let args = toolCall.function.arguments;
    if (typeof args === 'string') {
        try {
            args = JSON.parse(args);
        } catch (e) {
            console.error('❌ Failed to parse tool arguments:', e.message);
            // Still respond to Vapi so it doesn't hang — send a graceful error result
            return res.status(201).json({
                results: [{
                    toolCallId: toolCall.id,
                    result: 'Display update failed: malformed arguments.',
                }]
            });
        }
    }

    console.log(`🚀 Triggering UI: viewType="${args.viewType || 'default'}" | vibe="${args.vibe || 'none'}" | kiosks="${connectedKiosks.size}"`);

    // ── UPGRADE 1: Send Vapi response IMMEDIATELY, then emit to kiosk ──
    // This is the most important latency fix. Vapi gets its 201 without
    // waiting for the socket to finish emitting to potentially slow clients.
    res.status(201).json({
        results: [{
            toolCallId: toolCall.id,
            result: 'Display updated.',
        }]
    });

    // Emit AFTER the response is sent — non-blocking
    io.emit('COMMAND_UPDATE_UI', args);

    // Upgrade 3: Signal kiosk that tool is executing
    io.emit('AI_STATE_UPDATE', { state: 'EXECUTING' });
});

// ─────────────────────────────────────────────
// SERVER START
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Bridge running on port ${PORT}`);
    console.log(`💓 Keep-alive targeting: ${SELF_URL}`);
});
