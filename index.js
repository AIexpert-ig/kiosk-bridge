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
    console.log('✅ Kiosk Connected. ID:', socket.id);
});

app.post('/vapi-webhook', async (req, res) => {
    const payload = req.body;
    
    // Check if this is a tool call
    if (payload.message && payload.message.type === "tool-calls") {
        const toolCall = payload.message.toolCalls[0];
        
        if (toolCall.function.name === "updateKioskDisplay") {
            // Fix: Vapi sometimes sends arguments as an object already
            let args = toolCall.function.arguments;
            if (typeof args === 'string') {
                try { args = JSON.parse(args); } catch (e) { console.error("Parse error"); }
            }

            console.log("🚀 Triggering UI:", args.viewType || "Default");

            // Send to Android Kiosk
            io.emit('COMMAND_UPDATE_UI', args);

            // Respond to Vapi immediately to stop the "No Result" error
            return res.status(201).json({
                results: [{
                    toolCallId: toolCall.id,
                    result: "Display updated."
                }]
            });
        }
    }
    res.status(200).send("OK");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Bridge running on port ${PORT}`));
