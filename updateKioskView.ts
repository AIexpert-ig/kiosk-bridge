// ============================================================
// kiosk-orchestrator-mcp | tools/updateKioskView.ts
// Dubai Luxury Kiosk — Tool: update_kiosk_view
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dispatch } from "../services/wsBridge.js";
import { UpdateKioskViewSchema } from "../schemas/kioskSchemas.js";
import { KioskViewPayload, KioskViewResult } from "../types.js";

export function registerUpdateKioskView(server: McpServer): void {
  server.registerTool(
    "update_kiosk_view",
    {
      title: "Update Kiosk View",
      description: `Switch the active screen displayed on the Dubai luxury travel kiosk.

This tool sends a view-change command through the WebSocket bridge to the kiosk UI renderer.
The kiosk applies the new view and vibe theme immediately — zero-latency target via the Render bridge.

Args:
  - viewType ('home' | 'tour_details' | 'booking_qr'): The screen to activate on the kiosk.
  - tourID (string): The tour identifier to bind to the current view. Pass '' on 'home'.
  - vibe ('luxury' | 'adventure'): Visual palette to apply ('luxury' = gold/dark, 'adventure' = vibrant).

Returns:
  Structured object with schema:
  {
    "status": "dispatched" | "error",
    "viewType": string,
    "tourID": string,
    "vibe": string,
    "timestamp": string,           // ISO 8601 UTC
    "bridgeConfirmed": boolean,    // true if WS bridge ACK received
    "message": string              // Human-readable summary
  }

Examples:
  - Show Desert Safari tour details in luxury mode:
    { viewType: "tour_details", tourID: "TOUR-DSF-001", vibe: "luxury" }
  - Return to home screen:
    { viewType: "home", tourID: "", vibe: "luxury" }
  - Display QR booking screen for adventure tour:
    { viewType: "booking_qr", tourID: "TOUR-ADV-042", vibe: "adventure" }

Error Handling:
  - Returns status "error" if the WS bridge is not connected or times out (5s)
  - bridgeConfirmed: false indicates the command was formatted correctly but bridge did not ACK`,
      inputSchema: UpdateKioskViewSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ viewType, tourID, vibe }) => {
      const timestamp = new Date().toISOString();

      const payload: KioskViewPayload = {
        event: "UPDATE_VIEW",
        timestamp,
        data: { viewType, tourID, vibe },
      };

      const { confirmed, error: bridgeError } = await dispatch(payload);

      const result: KioskViewResult = {
        status: confirmed ? "dispatched" : "error",
        viewType,
        tourID,
        vibe,
        timestamp,
        bridgeConfirmed: confirmed,
        message: confirmed
          ? `Kiosk view updated → ${viewType} | Tour: ${tourID || "N/A"} | Vibe: ${vibe}`
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
