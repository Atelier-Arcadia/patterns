# Plan: Grimoire MCP Server

Status: Proposed
Feature: [Grimoire MCP Server](../features/2026-02-14-grimoire-mcp-mcp-server.md)

## Overview

Build a TypeScript MCP server that serves a hierarchical database of spells for LLM interactions. The server exposes two tools (`discover` and `match`) and supports both stdio and Streamable HTTP transports.

## Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/server` | MCP server SDK (McpServer, StdioServerTransport) |
| `@modelcontextprotocol/express` | Express middleware for Streamable HTTP transport |
| `express` | HTTP framework |
| `zod` | Input schema validation (peer dep of MCP SDK) |
| `yaml` | Parse YAML spell files |
| `typescript` | Language |
| `vitest` | Test framework |
| `tsx` | TypeScript execution for dev/scripts |

## Project Scaffold

- ESM (`"type": "module"` in package.json)
- TypeScript strict mode
- Vitest for testing
- `tsconfig.json` targeting ES2022 / NodeNext

## File Structure

```
src/
  server.ts          # McpServer setup + tool registration
  database.ts        # SpellDatabase class (loads and indexes spells)
  types.ts           # TypeScript types for domain, category, spell
  stdio.ts           # Entry point: stdio transport
  http.ts            # Entry point: Streamable HTTP transport
spells/
  software-engineering/
    _domain.yaml     # Domain metadata (name, description)
    features.yaml    # Category: spells for feature requests
    issues.yaml      # Category: spells for bug reports / issues
    data-structures.yaml  # Category: spells for data structure work
    algorithms.yaml  # Category: spells for algorithm design
tests/
  database.test.ts   # Unit tests for SpellDatabase
  tools.test.ts      # Unit tests for discover and match tool handlers
  integration.test.ts # Integration test using MCP in-memory transport
```

## Data Model

### Spell Database Format

Spells are stored as YAML files on disk, organized hierarchically:

```
spells/<domain-slug>/
  _domain.yaml          # Domain metadata
  <category-slug>.yaml  # Category with its spells
```

#### `_domain.yaml`

```yaml
name: Software Engineering
description: Spells for software development tasks
```

#### `<category>.yaml`

```yaml
name: Features
description: Spells for defining and requesting new features

spells:
  - label: create-feature-request
    description: Transform a loose feature idea into a structured feature request
    intention: The user wants to describe a new feature they'd like built
    template: |
      # Feature Request: {{title}}

      ## Problem Statement
      {{problem}}

      ## Proposed Solution
      {{solution}}

      ## Acceptance Criteria
      {{criteria}}
```

### TypeScript Types

```typescript
interface Spell {
  label: string;
  description: string;
  intention: string;
  template: string;
}

interface Category {
  name: string;
  slug: string;
  description: string;
  spells: Spell[];
}

interface Domain {
  name: string;
  slug: string;
  description: string;
  categories: Category[];
}
```

### SpellDatabase Class

```typescript
class SpellDatabase {
  constructor(spellsDir: string)
  async load(): Promise<void>
  getDomains(): Domain[]
  getDomain(slug: string): Domain | undefined
  getCategories(domainSlug: string): Category[]
  getSpells(domainSlug: string, categorySlugs: string[]): Spell[]
}
```

- Loads all YAML files from the spells directory on startup
- Derives slugs from directory/file names
- Indexes by domain and category for fast lookup

## MCP Tools

### `discover`

Given a domain, returns the list of known categories within that domain.

- **Input**: `{ domain: string }`
- **Output**: JSON array of `{ name: string, slug: string, description: string }`
- **Error**: Returns error content if domain is not found

### `match`

Given a domain and one or more categories, returns spells that match.

- **Input**: `{ domain: string, categories: string[] }`
- **Output**: JSON array of `{ label: string, description: string, intention: string, template: string }`
- **Error**: Returns error content if domain is not found or no categories match

## Transport Entry Points

### stdio (`src/stdio.ts`)

```typescript
const db = new SpellDatabase("./spells");
await db.load();
const server = createServer(db);
const transport = new StdioServerTransport();
await server.connect(transport);
```

### Streamable HTTP (`src/http.ts`)

```typescript
const db = new SpellDatabase("./spells");
await db.load();
const server = createServer(db);
const app = createMcpExpressApp(server);
app.listen(3001);
```

## Seed Data

The software engineering domain will be seeded with four categories:

1. **features** - Spells for feature requests and specifications
2. **issues** - Spells for bug reports and issue tracking
3. **data-structures** - Spells for designing and implementing data structures
4. **algorithms** - Spells for algorithm design and analysis

Each category will contain 2-3 example spells with realistic prompt templates.

## Testing Strategy

### Unit Tests: SpellDatabase (`tests/database.test.ts`)

- Loads spells from a test fixtures directory
- Returns domains list
- Returns categories for a valid domain
- Returns empty/error for unknown domain
- Returns matching spells for domain + categories
- Handles multiple categories in a single match call
- Handles unknown categories gracefully

### Unit Tests: Tool Handlers (`tests/tools.test.ts`)

- `discover` returns categories for known domain
- `discover` returns error for unknown domain
- `match` returns spells for valid domain + categories
- `match` returns error for unknown domain
- `match` returns empty for unmatched categories

### Integration Test (`tests/integration.test.ts`)

- Spin up server with in-memory transport
- Call `discover` tool via MCP client
- Call `match` tool via MCP client
- Verify end-to-end flow: discover then match

## Implementation Order

1. Project scaffold (package.json, tsconfig, vitest config)
2. Types (`src/types.ts`)
3. SpellDatabase with tests (RED then GREEN)
4. Seed YAML data files
5. Server + tool registration with tests (RED then GREEN)
6. stdio entry point
7. HTTP entry point
8. Integration tests
9. Manual testing with MCP Inspector or direct invocation
