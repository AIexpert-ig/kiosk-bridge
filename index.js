const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.json());
const server = http.createServer(app);

const io = new Server(server, { 
    cors: { origin: "*", methods: ["GET", "POST"] } 
});

io.on('connection', (socket) => {
    console.log('✅ Kiosk Connected to Bridge. ID:', socket.id);
});

app.post('/vapi-webhook', async (req, res) => {
    const payload = req.body;
    if (payload.message && payload.message.type === "tool-calls") {
        const toolCall = payload.message.toolCalls[0];
        if (toolCall.function.name === "updateKioskDisplay") {
            const args = JSON.parse(toolCall.function.arguments);
            console.log("🚀 AI Triggered UI Change:", args.viewType);
            io.emit('COMMAND_UPDATE_UI', {
                viewType: args.viewType,
                tourName: args.tourName || "Dubai Attraction",
                qrUrl: args.qrUrl || "https://visitdubai.com"
            });
            return res.status(201).json({
                results: [{
                    toolCallId: toolCall.id,
                    result: "Display successfully updated on the kiosk screen."
                }]
            });
        }
    }
    res.status(200).send("Event acknowledged.");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Dubai Kiosk Bridge running on port ${PORT}`);
});
