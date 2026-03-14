// ============================================================
// kiosk-orchestrator-mcp | services/wsBridge.ts
// Dubai Luxury Kiosk — WebSocket Bridge Client
//
// Maintains a persistent, auto-reconnecting WS connection to
// the Render-hosted bridge. Tool handlers call dispatch() which
// is fire-and-confirm: it waits for a bridge ACK or times out.
// ============================================================

import WebSocket from "ws";
import {
  WS_BRIDGE_URL,
  WS_RECONNECT_INTERVAL_MS,
  WS_DISPATCH_TIMEOUT_MS,
} from "../constants.js";
import { KioskWSPayload } from "../types.js";

// ─── Bridge State ─────────────────────────────────────────────

type BridgeState = "connecting" | "open" | "closed";

let ws: WebSocket | null = null;
let state: BridgeState = "closed";
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Connection Management ────────────────────────────────────

function connect(): void {
  if (state === "connecting" || state === "open") return;

  state = "connecting";
  const socket = new WebSocket(WS_BRIDGE_URL);

  socket.on("open", () => {
    ws = socket;
    state = "open";
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    console.error(`[KioskBridge] Connected → ${WS_BRIDGE_URL}`);
  });

  socket.on("close", (code, reason) => {
    ws = null;
    state = "closed";
    console.error(
      `[KioskBridge] Disconnected (code=${code}, reason=${reason.toString()}). Reconnecting in ${WS_RECONNECT_INTERVAL_MS}ms…`
    );
    scheduleReconnect();
  });

  socket.on("error", (err) => {
    console.error(`[KioskBridge] WebSocket error: ${err.message}`);
    // 'close' event will fire after error — reconnect handled there
  });
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, WS_RECONNECT_INTERVAL_MS);
}

// ─── Dispatch ─────────────────────────────────────────────────

/**
 * Fire a structured payload to the WS bridge.
 * Returns true if the bridge acknowledged within timeout, false otherwise.
 * Never throws — errors surface as { confirmed: false }.
 */
export async function dispatch(
  payload: KioskWSPayload
): Promise<{ confirmed: boolean; error?: string }> {
  if (!ws || state !== "open") {
    return { confirmed: false, error: "Bridge not connected" };
  }

  const serialized = JSON.stringify(payload);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ confirmed: false, error: "Bridge ACK timeout" });
    }, WS_DISPATCH_TIMEOUT_MS);

    // Listen for one ACK message
    const onMessage = (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString()) as { ack?: boolean; error?: string };
        if (msg.ack === true) {
          clearTimeout(timer);
          ws?.off("message", onMessage);
          resolve({ confirmed: true });
        } else if (msg.error) {
          clearTimeout(timer);
          ws?.off("message", onMessage);
          resolve({ confirmed: false, error: msg.error });
        }
      } catch {
        // Non-JSON message — ignore and keep waiting
      }
    };

    ws!.on("message", onMessage);

    ws!.send(serialized, (err) => {
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
