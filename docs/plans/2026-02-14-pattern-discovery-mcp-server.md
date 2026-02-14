# Plan: Pattern Discovery MCP Server

Status: Proposed
Feature: [Pattern Discovery MCP Server](../features/2026-02-14-pattern-discovery-mcp-server.md)

## Overview

Build a TypeScript MCP server that serves a hierarchical database of patterns for LLM interactions. The server exposes two tools (`discover` and `match`) and supports both stdio and Streamable HTTP transports.

## Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/server` | MCP server SDK (McpServer, StdioServerTransport) |
| `@modelcontextprotocol/express` | Express middleware for Streamable HTTP transport |
| `express` | HTTP framework |
| `zod` | Input schema validation (peer dep of MCP SDK) |
| `yaml` | Parse YAML pattern files |
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
  database.ts        # PatternDatabase class (loads and indexes patterns)
  types.ts           # TypeScript types for domain, category, pattern
  stdio.ts           # Entry point: stdio transport
  http.ts            # Entry point: Streamable HTTP transport
patterns/
  software-engineering/
    _domain.yaml     # Domain metadata (name, description)
    features.yaml    # Category: patterns for feature requests
    issues.yaml      # Category: patterns for bug reports / issues
    data-structures.yaml  # Category: patterns for data structure work
    algorithms.yaml  # Category: patterns for algorithm design
tests/
  database.test.ts   # Unit tests for PatternDatabase
  tools.test.ts      # Unit tests for discover and match tool handlers
  integration.test.ts # Integration test using MCP in-memory transport
```

## Data Model

### Pattern Database Format

Patterns are stored as YAML files on disk, organized hierarchically:

```
patterns/<domain-slug>/
  _domain.yaml          # Domain metadata
  <category-slug>.yaml  # Category with its patterns
```

#### `_domain.yaml`

```yaml
name: Software Engineering
description: Patterns for software development tasks
```

#### `<category>.yaml`

```yaml
name: Features
description: Patterns for defining and requesting new features

patterns:
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
interface Pattern {
  label: string;
  description: string;
  intention: string;
  template: string;
}

interface Category {
  name: string;
  slug: string;
  description: string;
  patterns: Pattern[];
}

interface Domain {
  name: string;
  slug: string;
  description: string;
  categories: Category[];
}
```

### PatternDatabase Class

```typescript
class PatternDatabase {
  constructor(patternsDir: string)
  async load(): Promise<void>
  getDomains(): Domain[]
  getDomain(slug: string): Domain | undefined
  getCategories(domainSlug: string): Category[]
  getPatterns(domainSlug: string, categorySlugs: string[]): Pattern[]
}
```

- Loads all YAML files from the patterns directory on startup
- Derives slugs from directory/file names
- Indexes by domain and category for fast lookup

## MCP Tools

### `discover`

Given a domain, returns the list of known categories within that domain.

- **Input**: `{ domain: string }`
- **Output**: JSON array of `{ name: string, slug: string, description: string }`
- **Error**: Returns error content if domain is not found

### `match`

Given a domain and one or more categories, returns patterns that match.

- **Input**: `{ domain: string, categories: string[] }`
- **Output**: JSON array of `{ label: string, description: string, intention: string, template: string }`
- **Error**: Returns error content if domain is not found or no categories match

## Transport Entry Points

### stdio (`src/stdio.ts`)

```typescript
const db = new PatternDatabase("./patterns");
await db.load();
const server = createServer(db);
const transport = new StdioServerTransport();
await server.connect(transport);
```

### Streamable HTTP (`src/http.ts`)

```typescript
const db = new PatternDatabase("./patterns");
await db.load();
const server = createServer(db);
const app = createMcpExpressApp(server);
app.listen(3001);
```

## Seed Data

The software engineering domain will be seeded with four categories:

1. **features** - Patterns for feature requests and specifications
2. **issues** - Patterns for bug reports and issue tracking
3. **data-structures** - Patterns for designing and implementing data structures
4. **algorithms** - Patterns for algorithm design and analysis

Each category will contain 2-3 example patterns with realistic prompt templates.

## Testing Strategy

### Unit Tests: PatternDatabase (`tests/database.test.ts`)

- Loads patterns from a test fixtures directory
- Returns domains list
- Returns categories for a valid domain
- Returns empty/error for unknown domain
- Returns matching patterns for domain + categories
- Handles multiple categories in a single match call
- Handles unknown categories gracefully

### Unit Tests: Tool Handlers (`tests/tools.test.ts`)

- `discover` returns categories for known domain
- `discover` returns error for unknown domain
- `match` returns patterns for valid domain + categories
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
3. PatternDatabase with tests (RED then GREEN)
4. Seed YAML data files
5. Server + tool registration with tests (RED then GREEN)
6. stdio entry point
7. HTTP entry point
8. Integration tests
9. Manual testing with MCP Inspector or direct invocation
