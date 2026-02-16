---
name: mcp-verify-tools
description: Verify MCP tools work correctly by connecting an in-process client to the server and calling each tool. Use during Stage 4 (debugging) to manually validate tool behavior against the real database.
---

# Verify MCP Tools

Connect a debug client to the pattern-discovery MCP server via InMemoryTransport and exercise each tool against the production database.

## Prerequisites

- Node.js and `tsx` available
- `patterns.db` exists (run the HTTP server at least once to initialize)
- Dependencies installed (`node_modules` present)

## Script

Create a temporary file `debug-verify.ts` in the patterns project root:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./src/server.js";
import { SqlitePatternStore } from "./src/sqlite-store.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "patterns.db");

const store = new SqlitePatternStore(dbPath);
store.initialize();

const server = createServer(store);
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);

const client = new Client({ name: "debug-client", version: "1.0.0" });
await client.connect(clientTransport);

// --- Verify tools/list ---
console.log("=== tools/list ===");
const tools = await client.listTools();
for (const t of tools.tools) {
  const required = (t.inputSchema as any).required || [];
  console.log(`  ${t.name} — required: [${required.join(", ")}]`);
}
console.log();

// --- Verify discover (no args) ---
console.log("=== discover (no args) — list all domains ===");
const domainsResult = await client.callTool({ name: "discover", arguments: {} });
console.log("isError:", domainsResult.isError ?? false);
const domains = JSON.parse((domainsResult.content as any)[0].text);
console.log(`Found ${domains.length} domain(s):`);
for (const d of domains) {
  console.log(`  - ${d.slug}: ${d.name}`);
}
console.log();

// --- Verify discover (with domain) ---
if (domains.length > 0) {
  const slug = domains[0].slug;
  console.log(`=== discover (domain: "${slug}") — list categories ===`);
  const catResult = await client.callTool({ name: "discover", arguments: { domain: slug } });
  console.log("isError:", catResult.isError ?? false);
  const categories = JSON.parse((catResult.content as any)[0].text);
  console.log(`Found ${categories.length} category(ies):`);
  for (const c of categories) {
    console.log(`  - ${c.slug}: ${c.name}`);
  }
  console.log();

  // --- Verify match ---
  if (categories.length > 0) {
    const catSlugs = categories.map((c: any) => c.slug);
    console.log(`=== match (domain: "${slug}", categories: [${catSlugs.join(", ")}]) ===`);
    const matchResult = await client.callTool({ name: "match", arguments: { domain: slug, categories: catSlugs } });
    console.log("isError:", matchResult.isError ?? false);
    const patterns = JSON.parse((matchResult.content as any)[0].text);
    console.log(`Found ${patterns.length} pattern(s):`);
    for (const p of patterns) {
      console.log(`  - ${p.label}: ${p.description}`);
    }
    console.log();
  }
}

// --- Verify error cases ---
console.log("=== discover (invalid domain) — expect error ===");
const errResult = await client.callTool({ name: "discover", arguments: { domain: "nonexistent-xyz" } });
console.log("isError:", errResult.isError);
console.log("message:", (errResult.content as any)[0].text);
console.log();

console.log("=== All checks complete ===");

await client.close();
store.close();
```

## Execution

```bash
cd /Users/asher/Code/Atelier/patterns
npx tsx debug-verify.ts
```

## Expected Output

- `tools/list` shows all 3 tools (discover, match, suggest) with correct required fields
- `discover` with no args returns domains with `slug`, `name`, `description`
- `discover` with a valid domain returns categories
- `match` returns patterns for given domain + categories
- `discover` with invalid domain returns `isError: true`

## Cleanup

```bash
rm debug-verify.ts
```

## Adapting for New Tools

To verify a new tool, add a section to the script following the pattern:

```typescript
console.log("=== tool-name (scenario description) ===");
const result = await client.callTool({ name: "tool-name", arguments: { ... } });
console.log("isError:", result.isError ?? false);
const data = JSON.parse((result.content as any)[0].text);
// Assert expected shape/values
console.log();
```
