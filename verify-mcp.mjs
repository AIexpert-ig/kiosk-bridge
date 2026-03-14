import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import axios from "axios";

const BASE_URL = "https://kiosk-bridge.onrender.com";

async function verify() {
  console.log(`Checking ${BASE_URL}...`);
  
  // Try SSE
  try {
    console.log("Testing SSE /sse...");
    const transport = new SSEClientTransport(new URL(`${BASE_URL}/sse`));
    const client = new Client({ name: "v", version: "1" }, { capabilities: {} });
    await client.connect(transport);
    const tools = await client.listTools();
    console.log("SSE Success!", JSON.stringify(tools, null, 2));
    process.exit(0);
  } catch (e) {
    console.log("SSE /sse failed:", e.message);
  }

  // Try Stateless MCP (what I built)
  try {
    console.log("Testing Stateless POST /mcp...");
    const res = await axios.post(`${BASE_URL}/mcp`, {
      jsonrpc: "2.0",
      id: 1,
      method: "listTools",
      params: {}
    });
    console.log("Stateless Success!", JSON.stringify(res.data, null, 2));
    process.exit(0);
  } catch (e) {
    console.log("Stateless POST /mcp failed:", e.response?.status || e.message);
  }
}

verify();
