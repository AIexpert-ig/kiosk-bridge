import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function listTools() {
  const transport = new SSEClientTransport(new URL("https://your-bridge.onrender.com/sse"));
  const client = new Client(
    { name: "theme-verifier", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  const tools = await client.listTools();
  console.log(JSON.stringify(tools, null, 2));
  process.exit(0);
}

listTools().catch(console.error);
