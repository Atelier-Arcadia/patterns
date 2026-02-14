import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SqlitePatternStore } from "./sqlite-store.js";
import { createServer } from "./server.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "patterns.db");

const store = new SqlitePatternStore(dbPath);
store.initialize();

const server = createServer(store);
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("Pattern Discovery MCP Server running on stdio");
