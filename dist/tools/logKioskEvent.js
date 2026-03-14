"use strict";
// ============================================================
// kiosk-orchestrator-mcp | tools/logKioskEvent.ts
// Dubai Luxury Kiosk — Tool: log_kiosk_event
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerLogKioskEvent = registerLogKioskEvent;
const wsBridge_js_1 = require("../wsBridge.js");
const kioskSchemas_js_1 = require("../kioskSchemas.js");
function registerLogKioskEvent(server) {
    server.registerTool("log_kiosk_event", {
        title: "Log Kiosk Event",
        description: "Record a guest interaction event from the Dubai luxury kiosk.",
        inputSchema: kioskSchemas_js_1.LogKioskEventSchema,
    }, async ({ eventType, duration, guestInterests }) => {
        const timestamp = new Date().toISOString();
        const payload = {
            event: "LOG_EVENT",
            timestamp,
            data: { eventType, duration, guestInterests },
        };
        const { confirmed, error: bridgeError } = await (0, wsBridge_js_1.dispatch)(payload);
        const result = {
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
    });
}
//# sourceMappingURL=logKioskEvent.js.map