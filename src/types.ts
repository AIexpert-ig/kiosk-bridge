// ============================================================
// kiosk-orchestrator-mcp | types.ts
// Dubai Luxury Kiosk — Shared Type Definitions
// ============================================================

export type ViewType = "home" | "tour_details" | "booking_qr";
export type VibeType = "luxury" | "adventure";

// ─── WebSocket Bridge Payloads ───────────────────────────────

export type KioskViewPayload = {
  event: "UPDATE_VIEW";
  timestamp: string;
  data: {
    viewType: ViewType;
    tourID: string;
    vibe: VibeType;
  };
};

export type KioskEventPayload = {
  event: "LOG_EVENT";
  timestamp: string;
  data: {
    eventType: string;
    duration: number;
    guestInterests: string[];
  };
};

export type KioskWSPayload = KioskViewPayload | KioskEventPayload;

// ─── Tool Responses ──────────────────────────────────────────

export type KioskViewResult = {
  status: "dispatched" | "error";
  viewType: ViewType;
  tourID: string;
  vibe: VibeType;
  timestamp: string;
  bridgeConfirmed: boolean;
  message: string;
};

export type KioskEventResult = {
  status: "dispatched" | "error";
  eventType: string;
  duration: number;
  guestInterests: string[];
  timestamp: string;
  bridgeConfirmed: boolean;
  message: string;
};

// ─── Bridge Config ────────────────────────────────────────────

export type WSBridgeConfig = {
  url: string;
  reconnectIntervalMs: number;
  timeoutMs: number;
};
