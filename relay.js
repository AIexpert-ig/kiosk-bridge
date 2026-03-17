'use strict';

var express  = require('express');
var http     = require('http');
var cors     = require('cors');
var SocketIO = require('socket.io').Server;

var app        = express();
var httpServer = http.createServer(app);

app.use(cors());
app.use(express.json());

var io = new SocketIO(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 25000,
  pingTimeout:  60000
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

function getDubaiTime() {
  return new Date().toLocaleString('en-AE', {
    timeZone: 'Asia/Dubai',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

async function dispatchNotifications(data, source) {
  var guest     = data.guest    || 'Unknown';
  var tour      = data.tourName || data.tour || 'Unknown';
  var date      = data.date     || 'Not specified';
  var timestamp = getDubaiTime();
  source = source || data.source || 'kiosk';

  var msgText = [
    '\u{1F6A8} *New Kiosk Booking*',
    '',
    '\u{1F464} Guest:  ' + guest,
    '\u{1F3C4} Tour:   ' + tour,
    '\u{1F5D3} Date:   ' + date,
    '\u{1F50D} Source: ' + source,
    '\u{1F552} Time:   ' + timestamp
  ].join('\n');

  var emailHtml = '<h2>New Kiosk Booking</h2>'
    + '<table style="font-family:sans-serif;font-size:15px;border-collapse:collapse">'
    + '<tr><td style="padding:6px 12px;font-weight:bold">Guest</td><td style="padding:6px 12px">'   + guest     + '</td></tr>'
    + '<tr><td style="padding:6px 12px;font-weight:bold">Tour</td><td style="padding:6px 12px">'    + tour      + '</td></tr>'
    + '<tr><td style="padding:6px 12px;font-weight:bold">Date</td><td style="padding:6px 12px">'    + date      + '</td></tr>'
    + '<tr><td style="padding:6px 12px;font-weight:bold">Source</td><td style="padding:6px 12px">'  + source    + '</td></tr>'
    + '<tr><td style="padding:6px 12px;font-weight:bold">Time</td><td style="padding:6px 12px">'    + timestamp + '</td></tr>'
    + '</table>';

  var sendTelegram = async function() {
    var token  = process.env.TELEGRAM_TOKEN;
    var chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token)  throw new Error('TELEGRAM_TOKEN not set');
    if (!chatId) throw new Error('TELEGRAM_CHAT_ID not set');
    var res = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msgText, parse_mode: 'Markdown' })
    });
    var json = await res.json();
    if (!json.ok) throw new Error('Telegram API: ' + json.description);
    return 'telegram:ok';
  };

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

  var sendEmail = async function() {
    var apiKey  = process.env.RESEND_API_KEY;
    var emailTo = process.env.EMAIL_TO;
    if (!apiKey)  throw new Error('RESEND_API_KEY not set');
    if (!emailTo) throw new Error('EMAIL_TO not set');
    var res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from:    'kiosk@dubaikiosk.ai',
        to:      emailTo,
        subject: 'Booking: ' + tour + ' - ' + guest,
        html:    emailHtml
      })
    });
    if (!res.ok) {
      var body = await res.text();
      throw new Error('Resend HTTP ' + res.status + ': ' + body.substring(0, 120));
    }
    return 'email:ok';
  };

  var results = await Promise.allSettled([
    sendTelegram(),
    sendWhatsApp(),
    sendEmail()
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

app.post('/BOOKING_CONFIRMED', async function(req, res) {
  console.log('[HTTP] Manual trigger:', JSON.stringify(req.body));
  try {
    var results = await dispatchNotifications(req.body, 'manual');
    var failed  = results.filter(function(r) { return r.status === 'rejected'; }).length;
    res.status(failed === 3 ? 500 : 200).json({
      status: failed === 0 ? 'ok' : 'partial',
      results: results.map(function(r) {
        return r.status === 'fulfilled' ? r.value : ('FAILED: ' + r.reason.message);
      })
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/health', function(_req, res) {
  res.json({
    status:          'ok',
    service:         'kiosk-relay-bridge',
    kioskConnected:  !!(kioskSocket && kioskSocket.connected),
    telegramEnabled: !!(process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID),
    whatsappEnabled: !!(process.env.WHATSAPP_API_KEY),
    emailEnabled:    !!(process.env.RESEND_API_KEY && process.env.EMAIL_TO),
    timestamp:       getDubaiTime()
  });
});

app.get('/', function(_req, res) {
  res.json({ service: 'Dubai Kiosk Relay Bridge', status: 'online' });
});

var PORT = process.env.PORT || 10000;
httpServer.listen(PORT, function() {
  console.log('[Relay] Live on port', PORT);
  console.log('[Relay]   Telegram : ' + (process.env.TELEGRAM_TOKEN   ? 'ENABLED' : 'DISABLED'));
  console.log('[Relay]   WhatsApp : ' + (process.env.WHATSAPP_API_KEY ? 'ENABLED' : 'DISABLED (set WHATSAPP_API_KEY when ready)'));
  console.log('[Relay]   Email    : ' + (process.env.RESEND_API_KEY   ? 'ENABLED' : 'DISABLED'));
});
