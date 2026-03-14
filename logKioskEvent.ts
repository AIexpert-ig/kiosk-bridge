// ============================================================
// kiosk-orchestrator-mcp | tools/logKioskEvent.ts
// Dubai Luxury Kiosk — Tool: log_kiosk_event
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dispatch } from "../services/wsBridge.js";
import { LogKioskEventSchema } from "../schemas/kioskSchemas.js";
import { KioskEventPayload, KioskEventResult } from "../types.js";

export function registerLogKioskEvent(server: McpServer): void {
  server.registerTool(
    "log_kiosk_event",
    {
      title: "Log Kiosk Event",
      description: `Record a guest interaction event from the Dubai luxury kiosk and forward it to the analytics bridge.

This tool dispatches a structured event payload through the WebSocket bridge. Events are consumed
by the analytics pipeline on Render for real-time guest behavior tracking and preference modelling.

Args:
  - eventType (string): Category of interaction. Examples: 'tour_viewed', 'qr_scanned',
      'idle_timeout', 'language_switch', 'booking_started', 'video_played'.
  - duration (integer): Seconds spent on this interaction. Use 0 for instantaneous events.
  - guestInterests (string[]): Interest tags detected during the interaction.
      Examples: ['desert_safari', 'dhow_cruise', 'luxury_hotel', 'wadi_adventure'].
      Pass an empty array [] if no interests are trackable.

Returns:
  Structured object with schema:
  {
    "status": "dispatched" | "error",
    "eventType": string,
    "duration": number,
    "guestInterests": string[],
    "timestamp": string,           // ISO 8601 UTC
    "bridgeConfirmed": boolean,    // true if WS bridge ACK received
    "message": string              // Human-readable summary
  }

Examples:
  - Guest watched Desert Safari video for 45 seconds:
    { eventType: "video_played", duration: 45, guestInterests: ["desert_safari"] }
  - Guest scanned QR code instantly:
    { eventType: "qr_scanned", duration: 0, guestInterests: ["dhow_cruise", "luxury_hotel"] }
  - Kiosk went idle:
    { eventType: "idle_timeout", duration: 120, guestInterests: [] }

Error Handling:
  - Returns status "error" if the WS bridge is not connected or times out (5s)
  - Events with status "error" should be retried by the orchestrating agent`,
      inputSchema: LogKioskEventSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ eventType, duration, guestInterests }) => {
      const timestamp = new Date().toISOString();

      const payload: KioskEventPayload = {
        event: "LOG_EVENT",
        timestamp,
        data: { eventType, duration, guestInterests },
      };

      const { confirmed, error: bridgeError } = await dispatch(payload);

      const result: KioskEventResult = {
        status: confirmed ? "dispatched" : "error",
        eventType,
        duration,
        guestInterests,
        timestamp,
        bridgeConfirmed: confirmed,
        message: confirmed
          ? `Event logged → ${eventType} | Duration: ${duration}s | Interests: [${guestInterests.join(", ") || "none"}]`
          : `Dispatch failed: ${bridgeError ?? "Unknown bridge error"}`,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
      };
    }
  );
}
