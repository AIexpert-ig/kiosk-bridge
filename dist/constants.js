"use strict";
// ============================================================
// kiosk-orchestrator-mcp | constants.ts
// Dubai Luxury Kiosk — Shared Constants
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.PORT = exports.SERVER_VERSION = exports.SERVER_NAME = exports.WS_DISPATCH_TIMEOUT_MS = exports.WS_RECONNECT_INTERVAL_MS = exports.WS_BRIDGE_URL = void 0;
exports.WS_BRIDGE_URL = process.env.WS_BRIDGE_URL ?? "wss://your-kiosk-bridge.onrender.com/ws";
exports.WS_RECONNECT_INTERVAL_MS = 3_000;
exports.WS_DISPATCH_TIMEOUT_MS = 5_000;
exports.SERVER_NAME = "kiosk-orchestrator-mcp-server";
exports.SERVER_VERSION = "1.0.0";
exports.PORT = process.env.PORT || 3000;
//# sourceMappingURL=constants.js.map