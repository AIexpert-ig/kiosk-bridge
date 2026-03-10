{\rtf1\ansi\ansicpg1252\cocoartf2868
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 const express = require('express');\
const http = require('http');\
const \{ Server \} = require('socket.io');\
\
const app = express();\
app.use(express.json());\
const server = http.createServer(app);\
\
// Initialize WebSockets with open CORS for your Android App to connect\
const io = new Server(server, \{ \
    cors: \{ origin: "*", methods: ["GET", "POST"] \} \
\});\
\
// Log when a kiosk connects\
io.on('connection', (socket) => \{\
    console.log('\uc0\u9989  Kiosk Connected to Bridge. ID:', socket.id);\
    \
    socket.on('disconnect', () => \{\
        console.log('\uc0\u10060  Kiosk Disconnected.');\
    \});\
\});\
\
// Vapi Webhook Endpoint\
app.post('/vapi-webhook', async (req, res) => \{\
    const payload = req.body;\
\
    // Logic: Identify if this is a tool call from the AI\
    if (payload.message && payload.message.type === "tool-calls") \{\
        const toolCall = payload.message.toolCalls[0];\
        \
        if (toolCall.function.name === "updateKioskDisplay") \{\
            const args = JSON.parse(toolCall.function.arguments);\
            \
            console.log("\uc0\u55357 \u56960  AI Triggered UI Change:", args.viewType);\
\
            // EMIT THE COMMAND TO THE ANDROID APP\
            io.emit('COMMAND_UPDATE_UI', \{\
                viewType: args.viewType,\
                tourName: args.tourName || "Dubai Attraction",\
                qrUrl: args.qrUrl || "https://visitdubai.com"\
            \});\
\
            // RESPOND TO VAPI\
            return res.status(201).json(\{\
                results: [\{\
                    toolCallId: toolCall.id,\
                    result: "Display successfully updated on the kiosk screen."\
                \}]\
            \});\
        \}\
    \}\
\
    // Default response for other Vapi events\
    res.status(200).send("Event acknowledged.");\
\});\
\
const PORT = process.env.PORT || 3000;\
server.listen(PORT, () => \{\
    console.log(`\uc0\u55357 \u56960  Dubai Kiosk Bridge running on port $\{PORT\}`);\
\});}