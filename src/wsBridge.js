"use strict";
// ============================================================
// kiosk-orchestrator-mcp | services/wsBridge.ts
// Dubai Luxury Kiosk — WebSocket Bridge Client
//
// Maintains a persistent, auto-reconnecting WS connection to
// the Render-hosted bridge. Tool handlers call dispatch() which
// is fire-and-confirm: it waits for a bridge ACK or times out.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatch = dispatch;
const ws_1 = __importDefault(require("ws"));
const constants_js_1 = require("./constants.js");
let ws = null;
let state = "closed";
let reconnectTimer = null;
// ─── Connection Management ────────────────────────────────────
function connect() {
    if (state === "connecting" || state === "open")
        return;
    state = "connecting";
    const socket = new ws_1.default(constants_js_1.WS_BRIDGE_URL);
    socket.on("open", () => {
        ws = socket;
        state = "open";
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        console.error(`[KioskBridge] Connected → ${constants_js_1.WS_BRIDGE_URL}`);
    });
    socket.on("close", (code, reason) => {
        ws = null;
        state = "closed";
        console.error(`[KioskBridge] Disconnected (code=${code}, reason=${reason.toString()}). Reconnecting in ${constants_js_1.WS_RECONNECT_INTERVAL_MS}ms…`);
        scheduleReconnect();
    });
    socket.on("error", (err) => {
        console.error(`[KioskBridge] WebSocket error: ${err.message}`);
        // 'close' event will fire after error — reconnect handled there
    });
}
function scheduleReconnect() {
    if (reconnectTimer)
        return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
    }, constants_js_1.WS_RECONNECT_INTERVAL_MS);
}
// ─── Dispatch ─────────────────────────────────────────────────
/**
 * Fire a structured payload to the WS bridge.
 * Returns true if the bridge acknowledged within timeout, false otherwise.
 * Never throws — errors surface as { confirmed: false }.
 */
async function dispatch(payload) {
    if (!ws || state !== "open") {
        return { confirmed: false, error: "Bridge not connected" };
    }
    const serialized = JSON.stringify(payload);
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            resolve({ confirmed: false, error: "Bridge ACK timeout" });
        }, constants_js_1.WS_DISPATCH_TIMEOUT_MS);
        // Listen for one ACK message
        const onMessage = (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                if (msg.ack === true) {
                    clearTimeout(timer);
                    ws?.off("message", onMessage);
                    resolve({ confirmed: true });
                }
                else if (msg.error) {
                    clearTimeout(timer);
                    ws?.off("message", onMessage);
                    resolve({ confirmed: false, error: msg.error });
                }
            }
            catch {
                // Non-JSON message — ignore and keep waiting
            }
        };
        ws.on("message", onMessage);
        ws.send(serialized, (err) => {
            if (err) {
                clearTimeout(timer);
                ws?.off("message", onMessage);
                resolve({ confirmed: false, error: err.message });
            }
        });
    });
}
// ─── Initialise on import ─────────────────────────────────────
connect();
