import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SqlitePatternStore } from "./sqlite-store.js";
import { createServer } from "./server.js";
import { createApiRouter } from "./api.js";
import { authStatus } from "./auth.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "patterns.db");

const PORT = parseInt(process.env.PORT ?? "3001", 10);

const store = new SqlitePatternStore(dbPath);
store.initialize();

const app = express();
app.use(express.json());

// Auth status middleware — sets req.isAdmin for all requests
app.use(authStatus);

// Serve the management web app
app.use(express.static(join(__dirname, "public")));

// Mount the REST API for CRUD operations
app.use("/api", createApiRouter(store));

// Map of active transports by session ID
const transports = new Map<string, StreamableHTTPServerTransport>();

app.all("/mcp", async (req, res) => {
  // Handle session initialization
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (req.method === "POST" && !sessionId) {
    // New session
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    const server = createServer(store);
    await server.connect(transport);

    // Store for future requests
    transport.sessionId && transports.set(transport.sessionId, transport);

    await transport.handleRequest(req, res);
    return;
  }

  if (sessionId) {
    const transport = transports.get(sessionId);
    if (transport) {
      await transport.handleRequest(req, res);
      return;
    }
  }

  // No valid session
  res.status(400).json({ error: "Invalid or missing session" });
});

app.listen(PORT, "127.0.0.1", () => {
  console.error(`Pattern Discovery MCP Server running on http://127.0.0.1:${PORT}/mcp`);
  console.error(`Pattern Manager UI available at http://127.0.0.1:${PORT}/`);
  if (process.env.ADMIN_SECRET) {
    console.error("Admin access: enabled (ADMIN_SECRET is set)");
  } else {
    console.error("Admin access: disabled (set ADMIN_SECRET to enable)");
  }
});
