"use strict";
// ============================================================
// kiosk-orchestrator-mcp | tools/updateKioskView.ts
// Dubai Luxury Kiosk — Tool: update_kiosk_view
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUpdateKioskView = registerUpdateKioskView;
const wsBridge_js_1 = require("../wsBridge.js");
const kioskSchemas_js_1 = require("../kioskSchemas.js");
function registerUpdateKioskView(server) {
    server.registerTool("update_kiosk_view", {
        title: "Update Kiosk View",
        description: "Switch the active screen displayed on the Dubai luxury travel kiosk.",
        inputSchema: kioskSchemas_js_1.UpdateKioskViewSchema,
    }, async ({ viewType, tourID, vibe }) => {
        const timestamp = new Date().toISOString();
        const payload = {
            event: "UPDATE_VIEW",
            timestamp,
            data: { viewType, tourID, vibe },
        };
        const { confirmed, error: bridgeError } = await (0, wsBridge_js_1.dispatch)(payload);
        const result = {
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
    });
}
//# sourceMappingURL=updateKioskView.js.map