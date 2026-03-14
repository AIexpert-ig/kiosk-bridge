"use strict";
// ============================================================
// kiosk-orchestrator-mcp | index.ts
// Dubai Luxury Kiosk — MCP Server Entry Point
//
// Supports two transports:
//   TRANSPORT=http  → Streamable HTTP (recommended for Render)
//   TRANSPORT=stdio → stdio (local dev / Claude Desktop)
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const express_1 = __importDefault(require("express"));
const constants_js_1 = require("./constants.js");
const updateKioskView_js_1 = require("./tools/updateKioskView.js");
const logKioskEvent_js_1 = require("./tools/logKioskEvent.js");
// ─── Server Initialisation ────────────────────────────────────
const server = new mcp_js_1.McpServer({
    name: constants_js_1.SERVER_NAME,
    version: constants_js_1.SERVER_VERSION,
});
// Register all kiosk tools
(0, updateKioskView_js_1.registerUpdateKioskView)(server);
(0, logKioskEvent_js_1.registerLogKioskEvent)(server);
// ─── Transport: Streamable HTTP (Render / remote) ─────────────
async function runHTTP() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    // Health check endpoint — used by Render's health probe
    app.get("/health", (_req, res) => {
        res.json({
            status: "ok",
            server: constants_js_1.SERVER_NAME,
            version: constants_js_1.SERVER_VERSION,
            timestamp: new Date().toISOString(),
        });
    });
    // MCP endpoint — one transport instance per request (stateless)
    app.post("/mcp", async (req, res) => {
        const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({
            sessionIdGenerator: undefined, // stateless mode
            enableJsonResponse: true,
        });
        res.on("close", () => transport.close());
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    });
    app.listen(constants_js_1.PORT, () => {
        console.error(`[KioskOrchestrator] MCP server running on http://localhost:${constants_js_1.PORT}/mcp`);
        console.error(`[KioskOrchestrator] Health check: http://localhost:${constants_js_1.PORT}/health`);
    });
}
// ─── Transport: stdio (local dev / Claude Desktop) ───────────
async function runStdio() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error(`[KioskOrchestrator] MCP server running via stdio`);
}
// ─── Bootstrap ───────────────────────────────────────────────
const transport = process.env.TRANSPORT ?? "stdio";
if (transport === "http") {
    runHTTP().catch((err) => {
        console.error("[KioskOrchestrator] HTTP server error:", err);
        process.exit(1);
    });
}
else {
    runStdio().catch((err) => {
        console.error("[KioskOrchestrator] stdio server error:", err);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map