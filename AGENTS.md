# AGENTS.md

Instructions for LLMs working on the Pattern Discovery MCP server.

## What This Project Is

An MCP server that exposes a hierarchical pattern database. Patterns are organized as **domains > categories > patterns** and stored in SQLite. The server provides three tools (`discover`, `match`, `suggest`) that LLMs use to find and apply structured prompt templates.

This project runs locally and is not production-ready.

## Project Structure

```
src/
├── server.ts          # Creates the McpServer, registers the three tools
├── tools.ts           # Handler logic for discover, match, suggest
├── types.ts           # Core interfaces: Domain, Category, Pattern, Submission, PatternStore, SubmissionStore
├── sqlite-store.ts    # SQLite implementation of all store interfaces + full CRUD
├── stdio.ts           # Entrypoint: stdio transport (for MCP clients)
├── http.ts            # Entrypoint: HTTP transport (MCP + REST API + web UI)
├── api.ts             # Express REST API for CRUD operations
├── auth.ts            # Simple session-based admin auth
└── public/
    └── index.html     # Single-page management web UI

tests/
├── sqlite-store.test.ts   # Store layer tests
├── tools.test.ts          # MCP tool handler tests
├── api.test.ts            # REST API endpoint tests
└── integration.test.ts    # End-to-end MCP client/server tests
```

### Key Interfaces (src/types.ts)

- **`PatternStore`** — read-only: `getDomains()`, `getDomain(slug)`, `getCategories(domainSlug)`, `getPatterns(domainSlug, categorySlugs)`
- **`SubmissionStore`** — submissions: `addSubmission(input)`, `getSubmission(id)`, `getSubmissions(status?)`
- **`SqlitePatternStore`** implements both interfaces plus full CRUD for the admin API

### Data Model

- **Domain**: `{ slug, name, description, categories[] }`
- **Category**: `{ slug, name, description, patterns[] }`
- **Pattern**: `{ label, description, intention, template }`
- **Submission**: `{ type, status, domainSlug?, categorySlug?, label, description, intention, template, source }`

### MCP Tools

| Tool | Input | Output |
|------|-------|--------|
| `discover` | `{ domain: string }` | Array of categories in that domain |
| `match` | `{ domain: string, categories: string[] }` | Array of matching patterns with templates |
| `suggest` | `{ type, label, description, intention, template, source, ... }` | Confirmation with submission ID |

## Running Tests

All tests use in-memory SQLite — they never touch `patterns.db`.

```bash
# Run all tests
npm test

# Run a specific suite
npx vitest run tests/sqlite-store.test.ts
npx vitest run tests/tools.test.ts
npx vitest run tests/api.test.ts
npx vitest run tests/integration.test.ts

# Watch mode
npm run test:watch
```

Always run `npm test` after making changes to verify nothing is broken.

## Debugging with .claude/skills

This project has three Claude Code skills in `.claude/skills/` that are essential for development and debugging. Use them liberally.

### mcp-debug — MCP Inspector Testing

**Location**: `.claude/skills/mcp-debug/SKILL.md`

Use the MCP Inspector CLI to test tools against the **real database** (not the in-memory test DB). This catches issues that unit tests miss — wrong data, schema mismatches, broken queries against real state.

```bash
# List all registered tools
npx @modelcontextprotocol/inspector --cli npx tsx src/stdio.ts --method tools/list

# Test discover
npx @modelcontextprotocol/inspector --cli npx tsx src/stdio.ts \
  --method tools/call --tool-name discover \
  --tool-arg domain=software-engineering

# Test match with array argument
npx @modelcontextprotocol/inspector --cli npx tsx src/stdio.ts \
  --method tools/call --tool-name match \
  --tool-arg domain=software-engineering \
  --tool-arg 'categories=["features"]'

# Test error path
npx @modelcontextprotocol/inspector --cli npx tsx src/stdio.ts \
  --method tools/call --tool-name discover \
  --tool-arg domain=nonexistent
```

**When to use**: After changing tool handlers, query logic, or the database schema. Always verify both happy paths and error paths.

### debug-patterns-app — Full Application Debugging

**Location**: `.claude/skills/debug-patterns-app/SKILL.md`

Covers all three application surfaces: MCP stdio, REST API, and web UI. Includes:

- **REST API testing** with curl commands for all CRUD endpoints
- **Expected status codes**: 200 (success), 201 (created), 400 (missing fields), 404 (not found), 409 (duplicate slug)
- **Full end-to-end debug script** that starts the server, exercises all endpoints, and cleans up
- **Web UI manual test checklist** (15 items covering navigation, CRUD, edge cases)
- **Common issues table** mapping symptoms to causes and fixes

**When to use**: After changing the API, store layer, or web UI. The debug script is especially useful for verifying CRUD lifecycle and cascade deletes work correctly.

Key things to verify:
- `GET /api/domains` returns the full hierarchy with pattern `id` fields
- Cascade deletes work (deleting a domain removes its categories and patterns)
- Error responses return proper status codes and `{ "error": "message" }` format

### mcp-dev — MCP SDK Reference

**Location**: `.claude/skills/mcp-dev/SKILL.md`

Reference material for building MCP servers with the TypeScript SDK. Covers:

- MCP architecture (host/client/server model)
- Tool, resource, and prompt definitions
- Transport setup (stdio, streamable HTTP, in-memory for tests)
- SDK import paths (all from `@modelcontextprotocol/sdk`)
- Security checklist

**When to use**: When adding new MCP tools, changing transport configuration, or working with the MCP SDK APIs.

## Suggesting New Patterns

Patterns can be suggested via the `suggest` MCP tool or the web UI's public submission form. When you identify a useful, repeatable pattern during development:

1. **Check if it already exists**: Use `discover` to browse domains/categories, then `match` to see existing patterns
2. **Submit via the suggest tool**:
   - `type`: `"new"` for a new pattern, `"modify"` to change an existing one
   - `domainSlug` / `categorySlug`: Where the pattern belongs (for `"new"`)
   - `targetPatternId`: Which pattern to modify (for `"modify"`)
   - `label`: Short kebab-case identifier (e.g. `"error-handling"`)
   - `description`: What the pattern does
   - `intention`: What the user is trying to accomplish when this pattern applies
   - `template`: The structured prompt template content
   - `source`: Attribution string (e.g. `"claude-code:session-id"`)

Submissions are queued as `"pending"` and require admin review.

## Conventions

- TypeScript strict mode, ES2022 target, NodeNext module resolution
- Zod for all input validation (MCP tool schemas and API request bodies)
- Express 5 for the HTTP server
- SQLite with WAL mode and foreign keys enabled
- Tests use Vitest with in-memory SQLite databases
- All source files use `.js` extensions in imports (TypeScript NodeNext requirement)
