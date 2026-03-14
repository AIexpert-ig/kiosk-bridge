// ============================================================
// kiosk-orchestrator-mcp | index.ts
// Dubai Luxury Kiosk — MCP Server Entry Point
//
// Supports two transports:
//   TRANSPORT=http  → Streamable HTTP (recommended for Render)
//   TRANSPORT=stdio → stdio (local dev / Claude Desktop)
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express, { Request, Response } from "express";

import { SERVER_NAME, SERVER_VERSION, PORT } from "./constants.js";
import { registerUpdateKioskView } from "./tools/updateKioskView.js";
import { registerLogKioskEvent } from "./tools/logKioskEvent.js";

// ─── Server Initialisation ────────────────────────────────────

const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
});

// Register all kiosk tools
registerUpdateKioskView(server);
registerLogKioskEvent(server);

// ─── Transport: Streamable HTTP (Render / remote) ─────────────

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  // Health check endpoint — used by Render's health probe
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      server: SERVER_NAME,
      version: SERVER_VERSION,
      timestamp: new Date().toISOString(),
    });
  });

  // MCP endpoint — one transport instance per request (stateless)
  app.post("/mcp", async (req: Request, res: Response) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless mode
      enableJsonResponse: true,
    });

    res.on("close", () => transport.close());

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.listen(PORT, () => {
    console.error(
      `[KioskOrchestrator] MCP server running on http://localhost:${PORT}/mcp`
    );
    console.error(
      `[KioskOrchestrator] Health check: http://localhost:${PORT}/health`
    );
  });
}

// ─── Transport: stdio (local dev / Claude Desktop) ───────────

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[KioskOrchestrator] MCP server running via stdio`);
}

// ─── Bootstrap ───────────────────────────────────────────────

const transport = process.env.TRANSPORT ?? "stdio";

if (transport === "http") {
  runHTTP().catch((err: unknown) => {
    console.error("[KioskOrchestrator] HTTP server error:", err);
    process.exit(1);
  });
} else {
  runStdio().catch((err: unknown) => {
    console.error("[KioskOrchestrator] stdio server error:", err);
    process.exit(1);
  });
}
