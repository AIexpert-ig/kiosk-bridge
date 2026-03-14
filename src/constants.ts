// ============================================================
// kiosk-orchestrator-mcp | constants.ts
// Dubai Luxury Kiosk — Shared Constants
// ============================================================

export const WS_BRIDGE_URL =
  process.env.WS_BRIDGE_URL ?? "wss://your-kiosk-bridge.onrender.com/ws";

export const WS_RECONNECT_INTERVAL_MS = 3_000;
export const WS_DISPATCH_TIMEOUT_MS = 5_000;

export const SERVER_NAME = "kiosk-orchestrator-mcp-server";
export const SERVER_VERSION = "1.0.0";

export const PORT = process.env.PORT || 3000;
