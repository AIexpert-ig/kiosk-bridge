// ============================================================
// Dubai Luxury Kiosk -- WebSocket Relay Bridge
// relay.js  (CommonJS, no build step, runs directly on Render)
//
// Deploy as its own Render Web Service:
//   Build Command:  npm install
//   Start Command:  node relay.js
//
// Architecture:
//   MCP Orchestrator --WS--> /ws  (this server)  --Socket.IO--> Kiosk UI
//                       <-- ACK <------------------------------------------
//
// Env vars (set in Render Dashboard -> Environment):
//   PORT              injected automatically by Render
//   TELEGRAM_TOKEN    from @BotFather
//   TELEGRAM_CHAT_ID  from @userinfobot
// ============================================================

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const WebSocket  = require('ws');

const app        = express();
const httpServer = http.createServer(app);

// -- Socket.IO -> Kiosk UI ---------------------------------------------------
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 25000,
  pingTimeout:  60000,
});

let kioskSocket = null;

io.on('connection', function(socket) {
  kioskSocket = socket;
  console.log('[Relay] Kiosk connected --', socket.id);
  socket.on('disconnect', function(reason) {
    if (kioskSocket && kioskSocket.id === socket.id) kioskSocket = null;
    console.log('[Relay] Kiosk disconnected --', reason);
  });

  socket.on('BOOKING_CONFIRMED', function(data) {
    console.log('[Relay] BOOKING_CONFIRMED:', data.guest, '-', data.tourName);
    
    var token  = process.env.TELEGRAM_TOKEN;
    var chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    var now = new Date().toLocaleString('en-AE', {
      timeZone: 'Asia/Dubai', day: '2-digit', month: 'short',
      year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
    });

    var text = [
      '\uD83D\uDEA8 *New Kiosk Booking*',
      '',
      '\uD83D\uDC64 Guest: ' + (data.guest    || 'Unknown'),
      '\uD83C\uDFC4 Tour:  ' + (data.tourName || 'Unknown'),
      '\uD83D\uDDD3 Date:  ' + (data.date     || 'Not specified'),
      '\uD83D\uDD52 Time:  ' + now,
    ].join('\n');

    fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'Markdown' }),
    }).then(function(r) { return r.json(); }).then(function(j) {
      console.log('[Relay] Telegram booking alert:', j.ok ? 'sent' : j.description);
    }).catch(function(e) {
      console.error('[Relay] Telegram error:', e.message);
    });
  });
});
});

// -- Telegram Alert ----------------------------------------------------------
// Fires when an UPDATE_VIEW event is relayed to the kiosk.
// Silent if env vars are missing (does not crash the relay).
async function sendTelegramAlert(tourID, viewType, vibe) {
  var token  = process.env.TELEGRAM_TOKEN;
  var chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('[Relay] Telegram env vars not set -- skipping alert');
    return;
  }

  var now = new Date().toLocaleString('en-AE', {
    timeZone: 'Asia/Dubai',
    day:      '2-digit',
    month:    'short',
    year:     'numeric',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   true,
  });

  var text = [
    '\u{1F6A8} *New Kiosk Lead*',
    '',
    '\u{1F3C4} Tour: ' + (tourID  || 'Unknown'),
    '\u{1F3AC} View: ' + (viewType || 'Unknown'),
    '\u{1F308} Vibe: ' + (vibe     || 'standard'),
    '\u{1F552} Time: ' + now,
  ].join('\n');

  try {
    var url = 'https://api.telegram.org/bot' + token + '/sendMessage';
    var res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        chat_id:    chatId,
        text:       text,
        parse_mode: 'Markdown',
      }),
    });
    var json = await res.json();
    if (json.ok) {
      console.log('[Relay] Telegram alert sent -- tour:', tourID);
    } else {
      console.warn('[Relay] Telegram API error:', json.description);
    }
  } catch (err) {
    console.error('[Relay] Telegram fetch failed:', err.message);
  }
}

// -- WebSocket /ws -> MCP Orchestrator ---------------------------------------
const wss = new WebSocket.Server({ server: httpServer, path: '/ws' });

wss.on('connection', function(ws, req) {
  console.log('[Relay] MCP connected --', req.socket.remoteAddress);

  ws.on('message', function(raw) {
    var payload;
    try {
      payload = JSON.parse(raw.toString());
    } catch (e) {
      ws.send(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    console.log('[Relay] event:', payload.event);

    if (!kioskSocket || !kioskSocket.connected) {
      ws.send(JSON.stringify({ error: 'Kiosk not connected' }));
      return;
    }

    if (payload.event === 'UPDATE_VIEW') {
      var d        = payload.data || {};
      var viewType = d.viewType || 'home';
      var tourID   = d.tourID   || '';
      var vibe     = d.vibe     || null;

      var qrUrl = tourID
        ? 'https://rayna.com/book/' + encodeURIComponent(tourID)
        : 'https://rayna.com';

      // 1. Relay to kiosk
      kioskSocket.emit('COMMAND_UPDATE_UI', {
        viewType: viewType,
        tourName: tourID,
        qrUrl:    qrUrl,
        vibe:     vibe,
      });

      // 2. Fire Telegram alert (non-blocking)
      sendTelegramAlert(tourID, viewType, vibe);

      ws.send(JSON.stringify({ ack: true }));
      console.log('[Relay] Relayed COMMAND_UPDATE_UI -- tour:', tourID, 'vibe:', vibe);

    } else if (payload.event === 'LOG_EVENT') {
      console.log('[Relay] LOG_EVENT:', JSON.stringify(payload.data));
      ws.send(JSON.stringify({ ack: true }));

    } else {
      ws.send(JSON.stringify({ error: 'Unknown event: ' + payload.event }));
    }
  });

  ws.on('close', function(code) {
    console.log('[Relay] MCP disconnected -- code:', code);
  });
  ws.on('error', function(err) {
    console.error('[Relay] WS error:', err.message);
  });
});

// -- Health endpoint ---------------------------------------------------------
app.get('/health', function(_req, res) {
  res.json({
    status:          'ok',
    service:         'kiosk-relay-bridge',
    kioskConnected:  !!(kioskSocket && kioskSocket.connected),
    mcpClients:      wss.clients.size,
    telegramEnabled: !!(process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID),
    timestamp:       new Date().toISOString(),
  });
});

app.get('/', function(_req, res) {
  res.json({ service: 'Dubai Kiosk Relay Bridge', status: 'online' });
});

// -- Boot --------------------------------------------------------------------
var PORT = process.env.PORT || 3001;
httpServer.listen(PORT, function() {
  console.log('[Relay] Live on port', PORT);
  console.log('[Relay]   Telegram alerts:', (process.env.TELEGRAM_TOKEN ? 'ENABLED' : 'DISABLED -- set TELEGRAM_TOKEN + TELEGRAM_CHAT_ID'));
});
