// ============================================================
// kiosk-orchestrator-mcp | types.ts
// Dubai Luxury Kiosk — Shared Type Definitions
// ============================================================

export type ViewType = "home" | "tour_details" | "booking_qr";
export type VibeType = "luxury" | "adventure";

// ─── WebSocket Bridge Payloads ───────────────────────────────

export interface KioskViewPayload {
  event: "UPDATE_VIEW";
  timestamp: string;
  data: {
    viewType: ViewType;
    tourID: string;
    vibe: VibeType;
  };
}

export interface KioskEventPayload {
  event: "LOG_EVENT";
  timestamp: string;
  data: {
    eventType: string;
    duration: number;
    guestInterests: string[];
  };
}

export type KioskWSPayload = KioskViewPayload | KioskEventPayload;

// ─── Tool Responses ──────────────────────────────────────────

export interface KioskViewResult {
  status: "dispatched" | "error";
  viewType: ViewType;
  tourID: string;
  vibe: VibeType;
  timestamp: string;
  bridgeConfirmed: boolean;
  message: string;
}

export interface KioskEventResult {
  status: "dispatched" | "error";
  eventType: string;
  duration: number;
  guestInterests: string[];
  timestamp: string;
  bridgeConfirmed: boolean;
  message: string;
}

// ─── Bridge Config ────────────────────────────────────────────

export interface WSBridgeConfig {
  url: string;
  reconnectIntervalMs: number;
  timeoutMs: number;
}
