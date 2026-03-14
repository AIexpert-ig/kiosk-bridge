"use strict";
// ============================================================
// kiosk-orchestrator-mcp | index.ts
// Dubai Luxury Kiosk — MCP Server Entry Point
//
// Supports two transports:
//   TRANSPORT=http  → Streamable HTTP (recommended for Render)
//   TRANSPORT=stdio → stdio (local dev / Claude Desktop)
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const streamableHttp = __importStar(require("@modelcontextprotocol/sdk/server/streamableHttp.js"));
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
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
    // MCP Health check endpoint
    app.get("/health", (_req, res) => {
        res.json({
            status: "ok",
            server: constants_js_1.SERVER_NAME,
            version: constants_js_1.SERVER_VERSION,
            timestamp: new Date().toISOString(),
        });
    });
    // MCP endpoint — one transport instance per request (stateless)
    app.post("/mcp", express_1.default.json(), async (req, res) => {
        const transport = new streamableHttp.StreamableHTTPServerTransport({
            sessionIdGenerator: undefined, // stateless mode
            enableJsonResponse: true,
        });
        res.on("close", () => transport.close());
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    });
    // ─── SSE Transport Support ──────────────────────────────────
    let sseTransport = null;
    app.get("/sse", async (_req, res) => {
        sseTransport = new sse_js_1.SSEServerTransport("/message", res);
        await server.connect(sseTransport);
    });
    app.post("/message", express_1.default.json(), async (req, res) => {
        if (!sseTransport) {
            res.status(400).send("No active SSE connection");
            return;
        }
        await sseTransport.handlePostMessage(req, res);
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