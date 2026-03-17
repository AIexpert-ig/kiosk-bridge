// ============================================================
// Dubai Luxury Kiosk -- WebSocket Relay Bridge
// relay.js  (CommonJS, no build step, runs directly on Render)
//
// Architecture:
//   Kiosk UI  --Socket.IO-->  this server  --fetch-->  Telegram
//                                           --fetch-->  WhatsApp (CallMeBot)
//                                           --fetch-->  Email    (Resend)
//   MCP Orchestrator --WS /ws--> this server --Socket.IO--> Kiosk UI
//
// Env vars (set in Render Dashboard -> Environment):
//   TELEGRAM_TOKEN      from @BotFather
//   TELEGRAM_CHAT_ID    your numeric chat ID from @userinfobot
//   WHATSAPP_API_KEY    from CallMeBot (leave empty to skip silently)
//   WHATSAPP_PHONE      recipient number e.g. 971506313291
//   RESEND_API_KEY      from resend.com (rotate if compromised)
//   EMAIL_FROM          sender address verified in Resend
//   EMAIL_TO            destination email
//   PORT                injected automatically by Render
// ============================================================

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const WebSocket  = require('ws');
const cors       = require('cors');

const app        = express();
const httpServer = http.createServer(app);

app.use(cors());
app.use(express.json());

// -- Socket.IO (Kiosk UI connection) ---------------------------------
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 25000,
  pingTimeout:  60000,
});

let kioskSocket = null;

// -- Utilities -------------------------------------------------------
function getDubaiTime() {
  return new Date().toLocaleString('en-AE', {
    timeZone: 'Asia/Dubai',
    day:      '2-digit',
    month:    'short',
    year:     'numeric',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   true,
  });
}

// -- Notification Channels -------------------------------------------

async function sendTelegram(guest, tour, date, source) {
  const token  = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token)  throw new Error('TELEGRAM_TOKEN not set');
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID not set');

  const text = [
    '\u{1F6A8} *New Kiosk Booking*',
    '',
    '\u{1F464} Guest:  ' + (guest  || 'Unknown'),
    '\u{1F3C4} Tour:   ' + (tour   || 'Unknown'),
    '\u{1F5D3} Date:   ' + (date   || 'Not specified'),
    '\u{1F4F1} Source: ' + (source || 'kiosk'),
    '\u{1F552} Time:   ' + getDubaiTime(),
  ].join('\n');

  const res  = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'Markdown' }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error('Telegram API: ' + json.description);
  return 'telegram:ok';
}

async function sendWhatsApp(guest, tour, date, source) {
  const apiKey = process.env.WHATSAPP_API_KEY;
  const phone  = process.env.WHATSAPP_PHONE;
  if (!apiKey) throw new Error('WHATSAPP_API_KEY not set -- skipping');
  if (!phone)  throw new Error('WHATSAPP_PHONE not set');

  const msg = [
    'BOOKING ALERT',
    'Guest:  ' + (guest  || 'Unknown'),
    'Tour:   ' + (tour   || 'Unknown'),
    'Date:   ' + (date   || 'Not specified'),
    'Source: ' + (source || 'kiosk'),
    'Time:   ' + getDubaiTime(),
  ].join('\n');

  const url = 'https://api.callmebot.com/whatsapp.php'
    + '?phone='  + encodeURIComponent(phone)
    + '&text='   + encodeURIComponent(msg)
    + '&apikey=' + encodeURIComponent(apiKey);

  const res  = await fetch(url);
  const text = await res.text();
  if (!res.ok || text.includes('ERROR')) {
    throw new Error('CallMeBot: ' + text.substring(0, 120));
  }
  return 'whatsapp:ok';
}

async function sendEmail(guest, tour, date, source) {
  const apiKey    = process.env.RESEND_API_KEY;
  const emailTo   = process.env.EMAIL_TO;
  const emailFrom = process.env.EMAIL_FROM || 'kiosk@dubaikiosk.ai';
  if (!apiKey)  throw new Error('RESEND_API_KEY not set');
  if (!emailTo) throw new Error('EMAIL_TO not set');

  const subject = 'Booking: ' + (tour || 'Unknown') + ' -- ' + (guest || 'Guest');
  const html = [
    '<h2 style="color:#D4AF37">New Kiosk Booking</h2>',
    '<table style="font-family:monospace;font-size:14px">',
    '<tr><td><b>Guest</b></td><td>'  + (guest  || 'Unknown')       + '</td></tr>',
    '<tr><td><b>Tour</b></td><td>'   + (tour   || 'Unknown')       + '</td></tr>',
    '<tr><td><b>Date</b></td><td>'   + (date   || 'Not specified') + '</td></tr>',
    '<tr><td><b>Source</b></td><td>' + (source || 'kiosk')         + '</td></tr>',
    '<tr><td><b>Time</b></td><td>'   + getDubaiTime()              + '</td></tr>',
    '</table>',
  ].join('');

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    emailFrom,
      to:      emailTo,
      subject: subject,
      html:    html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error('Resend HTTP ' + res.status + ': ' + body.substring(0, 120));
  }
  return 'email:ok';
}

// -- Dispatch (fire all 3 channels, never block on one failure) ------
async function dispatchNotifications(data) {
  const { guest, tourName, tour, date, source } = data;
  const t = tourName || tour || 'Unknown';

  const results = await Promise.allSettled([
    sendTelegram(guest, t, date, source),
    sendWhatsApp(guest, t, date, source),
    sendEmail(guest, t, date, source),
  ]);

  const labels = ['Telegram', 'WhatsApp', 'Email'];
  results.forEach(function(r, i) {
    if (r.status === 'fulfilled') {
      console.log('[Relay] ' + labels[i] + ': ' + r.value);
    } else {
      console.warn('[Relay] ' + labels[i] + ' FAILED: ' + r.reason.message);
    }
  });

  return results;
}

// -- Socket.IO: Kiosk UI --------------------------------------------
io.on('connection', function(socket) {
  kioskSocket = socket;
  console.log('[Relay] Kiosk connected --', socket.id);

  socket.on('disconnect', function(reason) {
    if (kioskSocket && kioskSocket.id === socket.id) kioskSocket = null;
    console.log('[Relay] Kiosk disconnected --', reason);
  });

  socket.on('BOOKING_CONFIRMED', async function(data) {
    console.log('[Relay] BOOKING_CONFIRMED:', data.guest, '--', data.tourName || data.tour);
    await dispatchNotifications(Object.assign({}, data, { source: 'voice-ai' }));
  });
});

// -- WebSocket /ws: MCP Orchestrator --------------------------------
const wss = new WebSocket.Server({ server: httpServer, path: '/ws' });

wss.on('connection', function(ws, req) {
  console.log('[Relay] MCP connected --', req.socket.remoteAddress);

  ws.on('message', function(raw) {
    var payload;
    try { payload = JSON.parse(raw.toString()); }
    catch (e) { ws.send(JSON.stringify({ error: 'Invalid JSON' })); return; }

    console.log('[Relay] MCP event:', payload.event);

    if (!kioskSocket || !kioskSocket.connected) {
      ws.send(JSON.stringify({ error: 'Kiosk not connected' }));
      return;
    }

    if (payload.event === 'UPDATE_VIEW') {
      var d        = payload.data || {};
      var viewType = d.viewType || 'home';
      var tourID   = d.tourID   || '';
      var vibe     = d.vibe     || null;
      var qrUrl    = tourID
        ? 'https://rayna.com/book/' + encodeURIComponent(tourID)
        : 'https://rayna.com';

      kioskSocket.emit('COMMAND_UPDATE_UI', { viewType: viewType, tourName: tourID, qrUrl: qrUrl, vibe: vibe });
      ws.send(JSON.stringify({ ack: true }));

    } else if (payload.event === 'LOG_EVENT') {
      console.log('[Relay] LOG_EVENT:', JSON.stringify(payload.data));
      ws.send(JSON.stringify({ ack: true }));

    } else {
      ws.send(JSON.stringify({ error: 'Unknown event: ' + payload.event }));
// Dubai Luxury Kiosk -- WebSocket Relay Bridge
// relay.js  (CommonJS, no build step, runs directly on Render)
//
// Build Command:  npm install
// Start Command:  node relay.js
//
// Architecture:
//   Voice AI (Vapi) --> Kiosk browser --> socket.emit('BOOKING_CONFIRMED')
//   --> this server --> Telegram + WhatsApp + Email (Promise.allSettled)
//
// Required env vars (Render Dashboard --> Environment):
//   PORT              injected automatically by Render
//   TELEGRAM_TOKEN    from @BotFather
//   TELEGRAM_CHAT_ID  your numeric Telegram chat ID
//   WHATSAPP_API_KEY  from CallMeBot (leave empty until handshake complete)
//   WHATSAPP_PHONE    your number without + (e.g. 971506313291)
//   RESEND_API_KEY    from resend.com/api-keys
//   EMAIL_TO          destination email address
// ============================================================

'use strict';

var express    = require('express');
var http       = require('http');
var SocketIO   = require('socket.io').Server;
var cors       = require('cors');

var app        = express();
var httpServer = http.createServer(app);

// -- Middleware ---------------------------------------------------------------
app.use(cors());
app.use(express.json());

// -- Socket.IO ----------------------------------------------------------------
var io = new SocketIO(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 25000,
  pingTimeout:  60000,
});

var kioskSocket = null;

io.on('connection', function(socket) {
  kioskSocket = socket;
  console.log('[Relay] Kiosk connected --', socket.id);

  socket.on('disconnect', function(reason) {
    if (kioskSocket && kioskSocket.id === socket.id) kioskSocket = null;
    console.log('[Relay] Kiosk disconnected --', reason);
  });

  socket.on('BOOKING_CONFIRMED', async function(data) {
    console.log('[Relay] BOOKING_CONFIRMED via socket:', JSON.stringify(data));
    await dispatchNotifications(data, 'voice-ai');
  });
});

// -- Dubai timestamp ----------------------------------------------------------
function getDubaiTime() {
  return new Date().toLocaleString('en-AE', {
    timeZone: 'Asia/Dubai',
    day:      '2-digit',
    month:    'short',
    year:     'numeric',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   true,
  });
}

// -- Notification dispatcher --------------------------------------------------
// Promise.allSettled: one channel failing never blocks the others.
async function dispatchNotifications(data, source) {
  var guest     = data.guest    || 'Unknown';
  var tour      = data.tourName || data.tour || 'Unknown';
  var date      = data.date     || 'Not specified';
  var timestamp = getDubaiTime();
  source = source || data.source || 'kiosk';

  var msgText = [
    '\uD83D\uDEA8 *New Kiosk Booking*',
    '',
    '\uD83D\uDC64 Guest:  ' + guest,
    '\uD83C\uDFC4 Tour:   ' + tour,
    '\uD83D\uDDD3 Date:   ' + date,
    '\uD83D\uDD0D Source: ' + source,
    '\uD83D\uDD52 Time:   ' + timestamp,
  ].join('\n');

  var emailHtml = '<h2>\uD83D\uDEA8 New Kiosk Booking</h2>'
    + '<table style="font-family:sans-serif;font-size:15px;border-collapse:collapse">'
    + '<tr><td style="padding:6px 12px;font-weight:bold">Guest</td><td style="padding:6px 12px">'  + guest     + '</td></tr>'
    + '<tr><td style="padding:6px 12px;font-weight:bold">Tour</td><td style="padding:6px 12px">'   + tour      + '</td></tr>'
    + '<tr><td style="padding:6px 12px;font-weight:bold">Date</td><td style="padding:6px 12px">'   + date      + '</td></tr>'
    + '<tr><td style="padding:6px 12px;font-weight:bold">Source</td><td style="padding:6px 12px">' + source    + '</td></tr>'
    + '<tr><td style="padding:6px 12px;font-weight:bold">Time</td><td style="padding:6px 12px">'   + timestamp + '</td></tr>'
    + '</table>';

  // Channel 1: Telegram
  var sendTelegram = async function() {
    var token  = process.env.TELEGRAM_TOKEN;
    var chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token)  throw new Error('TELEGRAM_TOKEN not set');
    if (!chatId) throw new Error('TELEGRAM_CHAT_ID not set');
    var res = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text: msgText, parse_mode: 'Markdown' }),
    });
    var json = await res.json();
    if (!json.ok) throw new Error('Telegram API: ' + json.description);
    return 'telegram:ok';
  };

  // Channel 2: WhatsApp (CallMeBot) — silent skip if key not set
  var sendWhatsApp = async function() {
    var apiKey = process.env.WHATSAPP_API_KEY;
    var phone  = process.env.WHATSAPP_PHONE || '971506313291';
    if (!apiKey) throw new Error('WHATSAPP_API_KEY not set -- skipping until CallMeBot handshake');
    var encoded = encodeURIComponent(msgText);
    var url = 'https://api.callmebot.com/whatsapp.php?phone=' + phone + '&text=' + encoded + '&apikey=' + apiKey;
    var res  = await fetch(url);
    var text = await res.text();
    if (!res.ok || text.includes('ERROR')) throw new Error('CallMeBot: ' + text.substring(0, 120));
    return 'whatsapp:ok';
  };

  // Channel 3: Email (Resend)
  var sendEmail = async function() {
    var apiKey  = process.env.RESEND_API_KEY;
    var emailTo = process.env.EMAIL_TO;
    if (!apiKey)  throw new Error('RESEND_API_KEY not set');
    if (!emailTo) throw new Error('EMAIL_TO not set');
    var res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        from:    'kiosk@dubaikiosk.ai',
        to:      emailTo,
        subject: '\uD83D\uDEA8 Booking: ' + tour + ' - ' + guest,
        html:    emailHtml,
      }),
    });
    if (!res.ok) {
      var body = await res.text();
      throw new Error('Resend HTTP ' + res.status + ': ' + body.substring(0, 120));
    }
    return 'email:ok';
  };

  // Fire all three -- never let one failure block the others
  var results = await Promise.allSettled([
    sendTelegram(),
    sendWhatsApp(),
    sendEmail(),
  ]);

  ['Telegram', 'WhatsApp', 'Email'].forEach(function(name, i) {
    var r = results[i];
    if (r.status === 'fulfilled') {
      console.log('[' + name + '] ' + r.value);
    } else {
      console.warn('[' + name + '] FAILED: ' + r.reason.message);
    }
  });

  return results;
}

// -- HTTP POST /BOOKING_CONFIRMED -- curl test endpoint -----------------------
app.post('/BOOKING_CONFIRMED', async function(req, res) {
  console.log('[HTTP] Manual trigger:', JSON.stringify(req.body));
  try {
    var results = await dispatchNotifications(req.body, 'manual');
    var failed  = results.filter(function(r) { return r.status === 'rejected'; }).length;
    res.status(failed === 3 ? 500 : 200).json({
      status:  failed === 0 ? 'ok' : 'partial',
      results: results.map(function(r) {
        return r.status === 'fulfilled' ? r.value : ('FAILED: ' + r.reason.message);
      }),
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// -- Health endpoint ----------------------------------------------------------
app.get('/health', function(_req, res) {
  res.json({
    status:          'ok',
    service:         'kiosk-relay-bridge',
    kioskConnected:  !!(kioskSocket && kioskSocket.connected),
    telegramEnabled: !!(process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID),
    whatsappEnabled: !!(process.env.WHATSAPP_API_KEY),
    emailEnabled:    !!(process.env.RESEND_API_KEY && process.env.EMAIL_TO),
    timestamp:       getDubaiTime(),
  });
});

app.get('/', function(_req, res) {
  res.json({ service: 'Dubai Kiosk Relay Bridge', status: 'online' });
});

// -- Boot ---------------------------------------------------------------------
var PORT = process.env.PORT || 3001;
httpServer.listen(PORT, function() {
  console.log('[Relay] Live on port', PORT);
  console.log('[Relay]   Telegram : ' + (process.env.TELEGRAM_TOKEN   ? 'ENABLED' : 'DISABLED'));
  console.log('[Relay]   WhatsApp : ' + (process.env.WHATSAPP_API_KEY ? 'ENABLED' : 'DISABLED (set WHATSAPP_API_KEY when ready)'));
  console.log('[Relay]   Email    : ' + (process.env.RESEND_API_KEY   ? 'ENABLED' : 'DISABLED'));
});
