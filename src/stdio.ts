import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SqliteGrimoire } from "./sqlite-store.js";
import { createServer } from "./server.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "grimoire.db");

const store = new SqliteGrimoire(dbPath);
store.initialize();

const server = createServer(store);
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("Grimoire MCP Server running on stdio");
