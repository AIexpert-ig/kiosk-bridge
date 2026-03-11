const express  = require('express');
const http     = require('http');
const https    = require('https'); // FIX: keep-alive must use https for Render's https URL
const { Server } = require('socket.io');

const app = express();
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout:  20000,
    pingInterval: 10000,
});

// ─────────────────────────────────────────────────────────────
// UPGRADE 1: Keep-Alive Self-Ping  (FIXED)
//
// ROOT CAUSE OF CRASH:
//   process.env.RENDER_EXTERNAL_URL is an https:// URL.
//   The previous code used the `http` module to request it.
//   Node's http.get() throws ERR_INVALID_PROTOCOL when given
//   an https:// URL — you must use the `https` module instead.
//
// FIX:
//   Parse the URL. Route to `https` module if protocol is https:,
//   fall back to `http` for local development (http://localhost:…).
// ─────────────────────────────────────────────────────────────
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

function keepAlivePing() {
    // Choose the correct module based on URL scheme
    const requester = SELF_URL.startsWith('https') ? https : http;

    requester.get(`${SELF_URL}/health`, (res) => {
        console.log(`💓 Keep-alive ping: ${res.statusCode} — ${new Date().toISOString()}`);
        // Consume response body to free the socket; if ignored, Node keeps it open
        res.resume();
    }).on('error', (err) => {
        // Log but do NOT crash — a failed ping is not fatal
        console.error(`❌ Keep-alive ping failed: ${err.message}`);
    });
}

setInterval(keepAlivePing, KEEP_ALIVE_INTERVAL_MS);

// ─────────────────────────────────────────────────────────────
// SOCKET LIFECYCLE
// ─────────────────────────────────────────────────────────────
let connectedKiosks = new Set();

io.on('connection', (socket) => {
    connectedKiosks.add(socket.id);
    console.log(`✅ Kiosk connected. ID: ${socket.id} | Total: ${connectedKiosks.size}`);

    socket.on('disconnect', (reason) => {
        connectedKiosks.delete(socket.id);
        console.log(`🔌 Kiosk disconnected. ID: ${socket.id} | Reason: ${reason} | Remaining: ${connectedKiosks.size}`);
    });
});

// ─────────────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.status(200).json({
        status:    'online',
        kiosks:    connectedKiosks.size,
        uptime:    process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// ─────────────────────────────────────────────────────────────
// VAPI WEBHOOK
//
// Critical constraint: Vapi has a ~5 s timeout on tool responses.
// Rule: send res.status(201) FIRST, then emit to socket.
// Never await the socket emit before responding to Vapi.
// ─────────────────────────────────────────────────────────────
app.post('/vapi-webhook', (req, res) => {
    const payload = req.body;

    if (!payload?.message) {
        return res.status(200).send('OK');
    }

    const { type, toolCalls } = payload.message;

    // Relay AI state transitions to the kiosk display
    if (type === 'speech-update') {
        const state = payload.message.role === 'assistant' ? 'THINKING' : 'LISTENING';
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
            results: [{ toolCallId: toolCall.id, result: `Unhandled tool: ${toolCall.function.name}` }]
        });
    }

    // Parse arguments — Vapi sometimes sends as string, sometimes as object
    let args = toolCall.function.arguments;
    if (typeof args === 'string') {
        try {
            args = JSON.parse(args);
        } catch (e) {
            console.error('❌ Failed to parse tool arguments:', e.message);
            return res.status(201).json({
                results: [{ toolCallId: toolCall.id, result: 'Display update failed: malformed arguments.' }]
            });
        }
    }

    console.log(`🚀 UI trigger: viewType="${args.viewType || 'default'}" | vibe="${args.vibe || 'none'}" | kiosks=${connectedKiosks.size}`);

    // ── RESPOND TO VAPI FIRST — then emit to kiosk ──
    // This is the most important latency pattern in the whole system.
    // Vapi's clock is already ticking. Get the 201 out immediately.
    res.status(201).json({
        results: [{ toolCallId: toolCall.id, result: 'Display updated.' }]
    });

    io.emit('COMMAND_UPDATE_UI', args);
    io.emit('AI_STATE_UPDATE', { state: 'EXECUTING' });
});

// ─────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Bridge running on port ${PORT}`);
    console.log(`💓 Keep-alive target: ${SELF_URL} (${SELF_URL.startsWith('https') ? 'https module' : 'http module'})`);
});
