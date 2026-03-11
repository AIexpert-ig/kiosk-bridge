const express  = require('express');
const http     = require('http');
const https    = require('https'); // Required: Render's self-URL is https://
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
// KEEP-ALIVE  (FIXED — https module, hardcoded Render URL)
//
// Root cause of the crash:
//   http.get() throws ERR_INVALID_PROTOCOL on https:// URLs.
//   Render's RENDER_EXTERNAL_URL is always https://.
//
// Fix:
//   Use the `https` module. Hardcode the Render URL as a safe
//   fallback so the server never tries to ping http://localhost
//   in a production environment where that would fail silently.
// ─────────────────────────────────────────────────────────────
const RENDER_URL   = 'https://kiosk-bridge.onrender.com';
const SELF_URL     = process.env.RENDER_EXTERNAL_URL || RENDER_URL;
const PING_URL     = `${SELF_URL}/health`;
const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes

function keepAlivePing() {
    // Always use https — Render does not serve plain http
    https.get(PING_URL, (res) => {
        res.resume(); // Consume body to release the socket
        console.log(`💓 Keep-alive: ${res.statusCode} — ${new Date().toISOString()}`);
    }).on('error', (err) => {
        // Log but never crash — a failed ping is not fatal
        console.error(`❌ Keep-alive failed: ${err.message}`);
    });
}

setInterval(keepAlivePing, PING_INTERVAL);

// ─────────────────────────────────────────────────────────────
// SOCKET LIFECYCLE
// ─────────────────────────────────────────────────────────────
let connectedKiosks = new Set();

io.on('connection', (socket) => {
    connectedKiosks.add(socket.id);
    console.log(`✅ Kiosk connected  | ID: ${socket.id} | Total: ${connectedKiosks.size}`);

    socket.on('disconnect', (reason) => {
        connectedKiosks.delete(socket.id);
        console.log(`🔌 Kiosk disconnected | ID: ${socket.id} | Reason: ${reason} | Remaining: ${connectedKiosks.size}`);
    });
});

// ─────────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.status(200).json({
        status:    'online',
        kiosks:    connectedKiosks.size,
        uptime:    Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
    });
});

// ─────────────────────────────────────────────────────────────
// VAPI WEBHOOK
//
// Critical: Vapi times out tool calls in ~5 s.
// Always send res.status(201) BEFORE emitting to the socket.
// ─────────────────────────────────────────────────────────────
app.post('/vapi-webhook', (req, res) => {
    const payload = req.body;
    if (!payload?.message) return res.status(200).send('OK');

    const { type, toolCalls } = payload.message;

    // AI state relay — forward speech events to the kiosk display
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

    let args = toolCall.function.arguments;
    if (typeof args === 'string') {
        try { args = JSON.parse(args); }
        catch (e) {
            console.error('❌ Malformed tool arguments:', e.message);
            return res.status(201).json({
                results: [{ toolCallId: toolCall.id, result: 'Display update failed: malformed arguments.' }]
            });
        }
    }

    console.log(`🚀 UI trigger | viewType="${args.viewType}" | vibe="${args.vibe}" | kiosks=${connectedKiosks.size}`);

    // Respond to Vapi FIRST — then emit. Never block the response.
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
    console.log(`💓 Keep-alive target: ${PING_URL}`);
});
