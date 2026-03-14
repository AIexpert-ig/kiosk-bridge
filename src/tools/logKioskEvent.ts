// ============================================================
// kiosk-orchestrator-mcp | tools/logKioskEvent.ts
// Dubai Luxury Kiosk — Tool: log_kiosk_event
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dispatch } from "../wsBridge.js";
import { LogKioskEventSchema } from "../kioskSchemas.js";
import { KioskEventPayload, KioskEventResult } from "../types.js";

export function registerLogKioskEvent(server: McpServer): void {
  (server.registerTool as any)(
    "log_kiosk_event",
    {
      title: "Log Kiosk Event",
      description: "Record a guest interaction event from the Dubai luxury kiosk.",
      inputSchema: LogKioskEventSchema,
    },
    async ({ eventType, duration, guestInterests }: any) => {
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
