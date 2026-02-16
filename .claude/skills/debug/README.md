# Pattern Discovery Debug Skills

Skills for verifying the pattern-discovery MCP server during Stage 4 (debugging).

## Skills

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `mcp-verify-tools` | Connect a debug client and exercise all MCP tools against the real DB | After implementing or modifying any MCP tool |

## Approach

These skills use `InMemoryTransport` to connect a client directly to the server in-process. This avoids the complexity of HTTP/SSE transport while still exercising the full MCP protocol path (Zod schema validation, tool dispatch, handler logic, store queries).

The debug script is written to a temporary file, executed with `npx tsx`, and removed after verification.

## Adding New Skills

Follow the format in `mcp-verify-tools.md`:
1. Frontmatter with `name` and `description`
2. Prerequisites
3. Script content (full TypeScript)
4. Execution command
5. Expected output
6. Cleanup steps
