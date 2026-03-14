import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function verify() {
  console.log("Connecting via stdio...");
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    env: { TRANSPORT: "stdio" }
  });

  const client = new Client(
    { name: "theme-verifier", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log("Connected successfully!");

  console.log("Listing tools...");
  const tools = await client.listTools();
  console.log("Tools:", JSON.stringify(tools, null, 2));
  
  process.exit(0);
}

verify().catch(console.error);
