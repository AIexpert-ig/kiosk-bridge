// ============================================================
// kiosk-orchestrator-mcp | tools/updateKioskView.ts
// Dubai Luxury Kiosk — Tool: update_kiosk_view
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dispatch } from "../wsBridge.js";
import { UpdateKioskViewSchema } from "../kioskSchemas.js";
import { KioskViewPayload, KioskViewResult } from "../types.js";

export function registerUpdateKioskView(server: McpServer): void {
  (server.registerTool as any)(
    "update_kiosk_view",
    {
      title: "Update Kiosk View",
      description: "Switch the active screen displayed on the Dubai luxury travel kiosk.",
      inputSchema: UpdateKioskViewSchema,
    },
    async ({ viewType, tourID, vibe }: any) => {
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
