// ============================================================
// Dubai Luxury Kiosk -- WebSocket Relay Bridge
// relay.js  (CommonJS, no build step, runs directly on Render)
//
// Deploy as a SEPARATE Render Web Service from the MCP orchestrator:
//   Build Command:  npm install
//   Start Command:  node relay.js
//
// Architecture:
//   MCP Orchestrator --WS--> /ws  (this server)  --Socket.IO--> Kiosk UI
//                       <-- ACK <------------------------------------------
// ============================================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingInterval: 25000,
    pingTimeout: 60000,
});

let kioskSocket = null;

io.on('connection', function (socket) {
    kioskSocket = socket;
    console.log('[Relay] Kiosk connected --', socket.id);
    socket.on('disconnect', function (reason) {
        if (kioskSocket && kioskSocket.id === socket.id) kioskSocket = null;
        console.log('[Relay] Kiosk disconnected --', reason);
    });
});

const wss = new WebSocket.Server({ server: httpServer, path: '/ws' });

wss.on('connection', function (ws, req) {
    console.log('[Relay] MCP connected --', req.socket.remoteAddress);

    ws.on('message', function (raw) {
        var payload;
        try { payload = JSON.parse(raw.toString()); }
        catch (e) { ws.send(JSON.stringify({ error: 'Invalid JSON' })); return; }

        console.log('[Relay] event:', payload.event);

        if (!kioskSocket || !kioskSocket.connected) {
            ws.send(JSON.stringify({ error: 'Kiosk not connected' })); return;
        }

        if (payload.event === 'UPDATE_VIEW') {
            var d = payload.data || {};
            kioskSocket.emit('COMMAND_UPDATE_UI', {
                viewType: d.viewType || 'home',
                tourName: d.tourID || '',
                qrUrl: d.tourID ? 'https://rayna.com/book/' + encodeURIComponent(d.tourID) : 'https://rayna.com',
                vibe: d.vibe || null,
            });
            ws.send(JSON.stringify({ ack: true }));
        } else if (payload.event === 'LOG_EVENT') {
            console.log('[Relay] LOG_EVENT:', JSON.stringify(payload.data));
            ws.send(JSON.stringify({ ack: true }));
        } else {
            ws.send(JSON.stringify({ error: 'Unknown event: ' + payload.event }));
        }
    });

    ws.on('close', function (code) { console.log('[Relay] MCP disconnected -- code:', code); });
    ws.on('error', function (err) { console.error('[Relay] WS error:', err.message); });
});

app.get('/health', function (_req, res) {
    res.json({
        status: 'ok', service: 'kiosk-relay-bridge',
        kioskConnected: !!(kioskSocket && kioskSocket.connected),
        mcpClients: wss.clients.size,
        timestamp: new Date().toISOString(),
    });
});

app.get('/', function (_req, res) {
    res.json({ service: 'Dubai Kiosk Relay Bridge', status: 'online' });
});

var PORT = process.env.PORT || 3001;
httpServer.listen(PORT, function () {
    console.log('[Relay] Live on port', PORT);
});