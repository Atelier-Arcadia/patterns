import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PatternStore } from "./types.js";
import { createDiscoverHandler, createMatchHandler } from "./tools.js";

/**
 * Creates and configures the MCP server with discover and match tools.
 */
export function createServer(db: PatternStore): McpServer {
  const server = new McpServer({
    name: "pattern-discovery",
    version: "0.1.0",
  });

  const discoverHandler = createDiscoverHandler(db);
  const matchHandler = createMatchHandler(db);

  server.tool(
    "discover",
    "Given a domain, returns the list of known categories within that domain. Use this to explore what patterns are available before matching.",
    { domain: z.string().describe("The domain slug to discover categories for (e.g. 'software-engineering')") },
    async (args) => discoverHandler(args)
  );

  server.tool(
    "match",
    "Given a domain and one or more categories, returns patterns that match. Each pattern includes a label, description, intention, and prompt template.",
    {
      domain: z.string().describe("The domain slug to search within"),
      categories: z.array(z.string()).describe("Category slugs to match patterns from"),
    },
    async (args) => matchHandler(args)
  );

  return server;
}
