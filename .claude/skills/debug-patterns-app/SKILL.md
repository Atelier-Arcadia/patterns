# Debug: Patterns Application

How to run, test, and debug the Pattern Discovery application end-to-end.

## Architecture Overview

The application has three surfaces that share a single SQLite database (`patterns.db`):

| Surface | Entrypoint | Purpose |
|---------|-----------|---------|
| MCP stdio server | `npx tsx src/stdio.ts` | Read-only pattern discovery for AI hosts |
| HTTP server | `npx tsx src/http.ts` (or `npm run start:http`) | Hosts all three: MCP over HTTP, REST API, and web UI |
| Web management UI | Served at `/` by the HTTP server | Browser-based CRUD for patterns |

The HTTP server binds to `127.0.0.1:3001` by default (configurable via `PORT` env var).

## Starting the Application

```bash
# HTTP mode (API + web UI + MCP over HTTP)
npm run start:http
# or: npx tsx src/http.ts

# Stdio mode (MCP only, for Claude Code / inspector testing)
npm run start:stdio
# or: npx tsx src/stdio.ts
```

The HTTP server logs to stderr:
```
Pattern Discovery MCP Server running on http://127.0.0.1:3001/mcp
Pattern Manager UI available at http://127.0.0.1:3001/
```

## Running Tests

```bash
# All tests
npx vitest run

# Specific test suites
npx vitest run tests/sqlite-store.test.ts   # Store layer (43 tests)
npx vitest run tests/tools.test.ts          # MCP tool handlers (8 tests)
npx vitest run tests/api.test.ts            # REST API endpoints (23 tests)
npx vitest run tests/integration.test.ts    # MCP client integration (5 tests)
```

All tests use `:memory:` SQLite databases so they don't touch `patterns.db`.

## Debug Surface 1: MCP Tools (stdio)

Use the MCP Inspector CLI to test tools against the real database:

```bash
# List tools
npx @modelcontextprotocol/inspector --cli npx tsx src/stdio.ts --method tools/list

# Discover categories in a domain
npx @modelcontextprotocol/inspector --cli npx tsx src/stdio.ts \
  --method tools/call --tool-name discover \
  --tool-arg domain=software-engineering

# Match patterns
npx @modelcontextprotocol/inspector --cli npx tsx src/stdio.ts \
  --method tools/call --tool-name match \
  --tool-arg domain=software-engineering \
  --tool-arg 'categories=["features"]'
```

**What to verify:**
- `tools/list` returns exactly two tools: `discover` and `match`
- `discover` returns categories as JSON array with `name`, `slug`, `description`
- `match` returns patterns as JSON array with `label`, `description`, `intention`, `template`
- Invalid domain returns `isError: true` with a descriptive message

## Debug Surface 2: REST API

Start the HTTP server, then test with curl. The API is mounted at `/api`.

### Domains

```bash
# List all domains (includes nested categories and patterns with ids)
curl -s http://127.0.0.1:3001/api/domains | python3 -m json.tool

# Create a domain
curl -s -X POST http://127.0.0.1:3001/api/domains \
  -H 'Content-Type: application/json' \
  -d '{"slug":"test","name":"Test","description":"Test domain"}'

# Update a domain
curl -s -X PUT http://127.0.0.1:3001/api/domains/test \
  -H 'Content-Type: application/json' \
  -d '{"name":"Updated Name"}'

# Delete a domain (cascades to categories and patterns)
curl -s -X DELETE http://127.0.0.1:3001/api/domains/test
```

### Categories

```bash
# Create a category
curl -s -X POST http://127.0.0.1:3001/api/domains/{domainSlug}/categories \
  -H 'Content-Type: application/json' \
  -d '{"slug":"cat","name":"Category","description":"A category"}'

# Update a category
curl -s -X PUT http://127.0.0.1:3001/api/domains/{domainSlug}/categories/{catSlug} \
  -H 'Content-Type: application/json' \
  -d '{"name":"New Name"}'

# Delete a category (cascades to patterns)
curl -s -X DELETE http://127.0.0.1:3001/api/domains/{domainSlug}/categories/{catSlug}
```

### Patterns

```bash
# Create a pattern
curl -s -X POST http://127.0.0.1:3001/api/domains/{domainSlug}/categories/{catSlug}/patterns \
  -H 'Content-Type: application/json' \
  -d '{"label":"my-pattern","description":"Desc","intention":"Intent","template":"# Template"}'

# Update a pattern (by numeric id)
curl -s -X PUT http://127.0.0.1:3001/api/patterns/{id} \
  -H 'Content-Type: application/json' \
  -d '{"label":"updated-label"}'

# Delete a pattern (by numeric id)
curl -s -X DELETE http://127.0.0.1:3001/api/patterns/{id}
```

### Expected Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success (GET, PUT, DELETE) |
| 201 | Created (POST) |
| 400 | Missing required fields |
| 404 | Entity not found |
| 409 | Duplicate slug (domain creation) |

### Error Response Format

```json
{ "error": "Descriptive error message" }
```

**What to verify:**
- `GET /api/domains` returns full hierarchy with pattern `id` fields present
- CRUD lifecycle works: create, read, update, delete
- Cascade deletes work: deleting a domain removes its categories and patterns
- Proper error codes for missing fields (400), nonexistent entities (404), duplicates (409)

## Debug Surface 3: Web UI

Open `http://127.0.0.1:3001/` in a browser.

### Manual Test Checklist

1. **Domain list loads** — Main page shows domain cards with name, slug, description, counts
2. **Navigate into domain** — Click a domain card, breadcrumb shows `Domains / Domain Name`, categories display
3. **Navigate into category** — Click a category card, breadcrumb shows `Domains / Domain / Category`, patterns display with intention and template preview
4. **Breadcrumb navigation** — Click breadcrumb links to go back up the hierarchy
5. **Create domain** — Click "+ New" on domains page, fill form, verify it appears
6. **Create category** — Navigate into a domain, click "+ New", fill form, verify it appears
7. **Create pattern** — Navigate into a category, click "+ New", fill all 4 fields including textarea template
8. **Edit domain** — Click "Edit" button on a domain card, change name, verify update
9. **Edit category** — Click "Edit" on a category, verify update
10. **Edit pattern** — Click "Edit" on a pattern, modify template, verify update
11. **Delete pattern** — Click "Delete" on a pattern, confirm dialog, verify removal
12. **Delete category** — Click "Delete" on a category, confirm, verify cascade (patterns gone)
13. **Delete domain** — Click "Delete" on a domain, confirm, verify cascade (categories + patterns gone)
14. **Empty states** — Delete all items at a level, verify "No X yet" message appears
15. **Form cancel** — Open a form, click Cancel or click outside the overlay, verify no changes

## Full End-to-End Debug Script

This script starts the server, exercises all API endpoints, and cleans up:

```bash
# Start server in background
npx tsx src/http.ts &
SERVER_PID=$!
sleep 2

# Verify server is up
curl -sf http://127.0.0.1:3001/ > /dev/null && echo "UI: OK" || echo "UI: FAIL"

# Test CRUD lifecycle
echo "=== Create ==="
curl -s -X POST http://127.0.0.1:3001/api/domains \
  -H 'Content-Type: application/json' \
  -d '{"slug":"debug-test","name":"Debug Test","description":"Temporary"}'

curl -s -X POST http://127.0.0.1:3001/api/domains/debug-test/categories \
  -H 'Content-Type: application/json' \
  -d '{"slug":"cat1","name":"Category 1","description":"Test category"}'

curl -s -X POST http://127.0.0.1:3001/api/domains/debug-test/categories/cat1/patterns \
  -H 'Content-Type: application/json' \
  -d '{"label":"pat1","description":"d","intention":"i","template":"t"}'

echo "=== Read ==="
curl -s http://127.0.0.1:3001/api/domains | python3 -m json.tool | head -20

echo "=== Get pattern ID ==="
PAT_ID=$(curl -s http://127.0.0.1:3001/api/domains | \
  python3 -c "import json,sys; ds=json.load(sys.stdin); d=next(x for x in ds if x['slug']=='debug-test'); print(d['categories'][0]['patterns'][0]['id'])")
echo "Pattern ID: $PAT_ID"

echo "=== Update ==="
curl -s -X PUT "http://127.0.0.1:3001/api/patterns/$PAT_ID" \
  -H 'Content-Type: application/json' \
  -d '{"label":"updated"}'

echo "=== Delete (cascade) ==="
curl -s -X DELETE http://127.0.0.1:3001/api/domains/debug-test

echo "=== Error handling ==="
curl -s -X POST http://127.0.0.1:3001/api/domains -H 'Content-Type: application/json' -d '{"slug":"x"}'
curl -s -X DELETE http://127.0.0.1:3001/api/domains/nonexistent

# Cleanup
kill $SERVER_PID 2>/dev/null
```

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `SQLITE_ERROR: no such table` | Database not initialized | Server calls `store.initialize()` on startup; delete `patterns.db` and restart |
| Port 3001 already in use | Previous server still running | `kill` the old process or use `PORT=3002 npx tsx src/http.ts` |
| Pattern edit/delete buttons don't work | Pattern IDs missing from API response | Verify `getPatternsForCategoryId` includes `id` in SELECT |
| Foreign key cascade not working | `PRAGMA foreign_keys` not enabled | Check `this.db.pragma("foreign_keys = ON")` in constructor |
| Web UI shows stale data after mutation | Navigation didn't refetch | Each navigation function calls `GET /api/domains` to refresh |
