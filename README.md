# @atelier/patterns

A local MCP server that gives LLMs access to a hierarchical pattern database. Patterns are organized into **domains > categories > patterns**, and LLMs can discover, match, and suggest new patterns through three simple tools.

> **This project is intended for local use only and is not production-ready.** Auth is session-based and in-memory, there's no rate limiting, and the SQLite database lives on disk alongside the code. Treat it as a personal development tool.

## Quick Start

```bash
npm install
```

### As an MCP server (stdio)

The most common way to use this. Clone the repository and then add it to your MCP client config (e.g. Claude Code, Claude Desktop):

```json
{
  "mcpServers": {
    "patterns": {
      "command": "npx",
      "args": ["tsx", "path/to/src/stdio.ts"]
    }
  }
}
```

Or run directly:

```bash
npm run start:stdio
```

### With the web UI (HTTP)

Starts both the MCP endpoint and a management web app:

```bash
ADMIN_SECRET=your-secret npm run start:http
```

- **Web UI**: http://127.0.0.1:3001
- **MCP endpoint**: http://127.0.0.1:3001/mcp

Set `PORT` to change the default port.

## MCP Tools

| Tool | Description |
|------|-------------|
| `discover` | Given a domain, returns its available categories |
| `match` | Given a domain + categories, returns matching patterns with templates |
| `suggest` | Submit a new pattern suggestion with source tracking |

## How It Works

Patterns are stored in a local SQLite database (`patterns.db`). Each pattern has a **label**, **description**, **intention** (what the user wants), and a **template** (structured prompt).

The typical flow:

1. LLM calls `discover` with a domain (e.g. `"software-engineering"`)
2. Server returns the domain's categories
3. LLM calls `match` with relevant categories
4. Server returns patterns with templates the LLM can apply

The web UI provides full CRUD for managing domains, categories, and patterns, plus a review workflow for community-submitted suggestions.

## Development

```bash
npm run build          # compile TypeScript
npm test               # run tests
npm run test:watch     # run tests in watch mode
```

## Tech Stack

TypeScript, MCP SDK, Express 5, better-sqlite3, Zod, Vitest
