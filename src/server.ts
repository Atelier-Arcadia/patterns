import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PatternStore, SubmissionStore } from "./types.js";
import { createDiscoverHandler, createMatchHandler, createSuggestHandler } from "./tools.js";

/**
 * Creates and configures the MCP server with discover, match, and suggest tools.
 */
export function createServer(db: PatternStore & SubmissionStore): McpServer {
  const server = new McpServer({
    name: "pattern-discovery",
    version: "0.1.0",
  });

  const discoverHandler = createDiscoverHandler(db);
  const matchHandler = createMatchHandler(db);
  const suggestHandler = createSuggestHandler(db);

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

  server.tool(
    "suggest",
    "Submit a suggestion to add a new pattern or edit an existing one. Suggestions are queued for admin review. Requires a source identifier to attribute the origin of the suggestion.",
    {
      type: z.enum(["new", "modify"]).describe("'new' to suggest a new pattern, 'modify' to suggest changes to an existing one"),
      domainSlug: z.string().optional().describe("Domain slug for 'new' suggestions (e.g. 'software-engineering')"),
      categorySlug: z.string().optional().describe("Category slug for 'new' suggestions (e.g. 'features')"),
      targetPatternId: z.number().optional().describe("Pattern ID to modify (required for 'modify' type)"),
      label: z.string().describe("Short identifier for the pattern (e.g. 'error-handling')"),
      description: z.string().describe("Human-readable description of the pattern"),
      intention: z.string().describe("What the user intends when this pattern applies"),
      template: z.string().describe("The prompt template content"),
      source: z.string().describe("Identifier for who/what is submitting (e.g. 'claude-code:user123')"),
    },
    async (args) => suggestHandler(args)
  );

  return server;
}
