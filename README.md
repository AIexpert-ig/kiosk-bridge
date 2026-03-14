# Kiosk Orchestrator MCP Server

**Dubai Luxury Travel Kiosk — Programmatic UI & Booking State Control**

MCP server that allows Claude (or any MCP client) to control the kiosk display and log guest interactions via a WebSocket bridge hosted on Render.

---

## Architecture

```
Claude / MCP Client
       │
       │  MCP (Streamable HTTP or stdio)
       ▼
kiosk-orchestrator-mcp-server
       │
       │  WebSocket (persistent, auto-reconnecting)
       ▼
Render WebSocket Bridge  ──►  Kiosk UI Renderer
```

---

## Tools

### `update_kiosk_view`
Switch the active screen on the kiosk.

| Parameter | Type | Values |
|-----------|------|--------|
| `viewType` | string | `'home'` \| `'tour_details'` \| `'booking_qr'` |
| `tourID` | string | Any tour identifier (or `''` for home) |
| `vibe` | string | `'luxury'` \| `'adventure'` |

### `log_kiosk_event`
Record a guest interaction event to the analytics bridge.

| Parameter | Type | Description |
|-----------|------|-------------|
| `eventType` | string | e.g. `'tour_viewed'`, `'qr_scanned'`, `'idle_timeout'` |
| `duration` | integer | Seconds (0 for instant events) |
| `guestInterests` | string[] | Interest tags e.g. `['desert_safari', 'dhow_cruise']` |

---

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file or set environment variables:

```bash
# Required: Your Render WebSocket bridge URL
WS_BRIDGE_URL=wss://your-kiosk-bridge.onrender.com/ws

# Optional: Transport mode (default: stdio)
TRANSPORT=http

# Optional: HTTP port (default: 3000)
PORT=3000
```

### 3. Build

```bash
npm run build
```

### 4. Run

**HTTP mode (Render / remote deployment):**
```bash
TRANSPORT=http WS_BRIDGE_URL=wss://your-bridge.onrender.com/ws npm start
```

**stdio mode (Claude Desktop / local dev):**
```bash
WS_BRIDGE_URL=wss://your-bridge.onrender.com/ws npm start
```

---

## Claude Desktop Config

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kiosk-orchestrator": {
      "command": "node",
      "args": ["/path/to/kiosk-orchestrator-mcp/dist/index.js"],
      "env": {
        "WS_BRIDGE_URL": "wss://your-kiosk-bridge.onrender.com/ws"
      }
    }
  }
}
```

---

## WebSocket Bridge Protocol

The server expects your Render bridge to send ACK messages in this format:

```json
{ "ack": true }
```

Or on error:

```json
{ "error": "Descriptive error message" }
```

### Outbound Payload Format

**`UPDATE_VIEW` payload:**
```json
{
  "event": "UPDATE_VIEW",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "data": {
    "viewType": "tour_details",
    "tourID": "TOUR-DSF-001",
    "vibe": "luxury"
  }
}
```

**`LOG_EVENT` payload:**
```json
{
  "event": "LOG_EVENT",
  "timestamp": "2025-01-15T10:30:05.000Z",
  "data": {
    "eventType": "tour_viewed",
    "duration": 45,
    "guestInterests": ["desert_safari", "luxury_hotel"]
  }
}
```

---

## Project Structure

```
kiosk-orchestrator-mcp/
├── src/
│   ├── index.ts                  # Entry point, transport selection
│   ├── types.ts                  # Shared TypeScript interfaces
│   ├── constants.ts              # Environment-driven config
│   ├── services/
│   │   └── wsBridge.ts          # Persistent WS client + dispatch()
│   ├── schemas/
│   │   └── kioskSchemas.ts      # Zod validation schemas
│   └── tools/
│       ├── updateKioskView.ts   # update_kiosk_view tool
│       └── logKioskEvent.ts     # log_kiosk_event tool
├── package.json
├── tsconfig.json
└── README.md
```

---

*Travel Expert™ | The AI Concierge — Luxury Travel | Storytelling | AI-Optimized Experiences™*
