import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function verify() {
  const url = "http://localhost:3007/sse";
  console.log(`Connecting to ${url}...`);
  
  const transport = new SSEClientTransport(new URL(url));
  const client = new Client(
    { name: "theme-verifier", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log("Connected successfully!");

  console.log("Listing tools...");
  const tools = await client.listTools();
  console.log("Tools:", JSON.stringify(tools, null, 2));

  console.log("Triggering Luxury Desert Safari tour details...");
  try {
    const result = await client.callTool({
      name: "update_kiosk_view",
      arguments: {
        viewType: "tour_details",
        tourID: "desert-safari",
        tourName: "Luxury Desert Safari",
        vibe: "luxury",
        qrUrl: "https://example.com/safari"
      }
    });
    console.log("Tool result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.log("Tool execution failed (expected if bridge not connected):", err.message);
  }
  
  process.exit(0);
}

verify().catch(console.error);
