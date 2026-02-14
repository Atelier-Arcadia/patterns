# MCP Server Development Skill

Build MCP (Model Context Protocol) servers in TypeScript using the official SDK.

## What is MCP?

MCP is an open-source, JSON-RPC 2.0-based protocol for connecting AI applications to external data sources, tools, and workflows. It provides a standardized interface between AI hosts (Claude Code, VS Code, Claude Desktop) and capability-providing servers.

## Architecture

MCP uses a three-tier model:

- **Host**: The AI application. Creates and manages multiple MCP clients, enforces security policies, handles user authorization, coordinates AI/LLM integration.
- **Client**: One per server connection. Handles protocol negotiation, routes messages bidirectionally, maintains security boundaries between servers.
- **Server**: The program you build. Exposes tools, resources, and prompts. Operates independently with focused responsibilities. Cannot see the full conversation or other servers.

Servers are isolated from each other by design. The host orchestrates all cross-server coordination.

## Core Primitives

### Tools (Model-Controlled)

Executable functions the LLM can discover and invoke. Each tool has a name, description, Zod input schema, and async handler.

- Discovery: `tools/list`
- Execution: `tools/call`
- Tools may require user consent before execution
- Return `content` arrays (text, images, resource links)

### Resources (Application-Controlled)

Data sources that provide contextual information. Can be static (fixed URI) or dynamic (URI templates with parameters).

- Discovery: `resources/list`, `resources/templates/list`
- Retrieval: `resources/read`
- Subscription: `resources/subscribe`
- Include metadata: title, description, MIME type

### Prompts (User-Controlled)

Reusable interaction templates. Require explicit user invocation (not auto-triggered).

- Discovery: `prompts/list`
- Retrieval: `prompts/get`
- Include title, description, argument schema
- Return message arrays

### Client-Side Primitives (Server Can Request)

- **Sampling**: Request LLM completions from the host
- **Elicitation**: Request user input during execution
- **Logging**: Send structured log messages to the client

## Lifecycle

1. **Initialize**: Client sends `initialize` with protocol version + capabilities
2. **Capability Negotiation**: Server responds with its capabilities
3. **Initialized**: Client sends `notifications/initialized`
4. **Operation**: JSON-RPC message exchange per negotiated capabilities
5. **Shutdown**: Transport-level connection termination

Both sides MUST only use capabilities that were successfully negotiated. The client SHOULD NOT send non-ping requests before the server responds to initialize. The server SHOULD NOT send non-ping/logging requests before receiving the initialized notification.

### Capability Declaration

Server capabilities: `prompts`, `resources`, `tools`, `logging`, `completions`, `tasks` (experimental).

Sub-capabilities: `listChanged` (notification support for prompts/resources/tools), `subscribe` (resources only).

## Transports

### stdio (Local Servers)

- Client launches server as a subprocess
- JSON-RPC messages over stdin/stdout, newline-delimited
- Messages MUST NOT contain embedded newlines
- Server MUST NOT write non-MCP content to stdout
- Server MAY write logging to stderr
- Typically serves a single client
- Preferred for local CLI tools, Claude Desktop integrations

### Streamable HTTP (Remote Servers)

- Server provides a single HTTP endpoint (e.g. `https://example.com/mcp`)
- Client sends JSON-RPC via HTTP POST
- Server responds with `application/json` or `text/event-stream` (SSE)
- Client MUST include `Accept: application/json, text/event-stream`
- Supports session management via `MCP-Session-Id` header
- Session IDs must be cryptographically secure (UUID, JWT, etc.)
- Supports resumability via SSE event IDs and `Last-Event-ID`
- Can serve many clients simultaneously

#### Security Requirements for Streamable HTTP

- MUST validate `Origin` header to prevent DNS rebinding (403 if invalid)
- SHOULD bind to localhost (127.0.0.1) when running locally
- SHOULD implement proper authentication

## TypeScript SDK

**Package**: `@modelcontextprotocol/sdk` ([npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk))

**Repository**: https://github.com/modelcontextprotocol/typescript-sdk

> **IMPORTANT**: The SDK is published as a single unified package `@modelcontextprotocol/sdk`.
> The old split packages (`@modelcontextprotocol/server`, `@modelcontextprotocol/client`,
> `@modelcontextprotocol/express`, etc.) no longer exist on npm.

### Installation

```bash
npm install @modelcontextprotocol/sdk zod
```

`zod` is a required peer dependency for schema validation.

### Import Map

All imports use subpath exports from the unified `@modelcontextprotocol/sdk` package:

| Export | Import Path |
|--------|-------------|
| `McpServer` | `@modelcontextprotocol/sdk/server/mcp.js` |
| `StdioServerTransport` | `@modelcontextprotocol/sdk/server/stdio.js` |
| `StreamableHTTPServerTransport` | `@modelcontextprotocol/sdk/server/streamableHttp.js` |
| `Client` | `@modelcontextprotocol/sdk/client/index.js` |
| `InMemoryTransport` | `@modelcontextprotocol/sdk/inMemory.js` |

### McpServer - High-Level API

`McpServer` is the main class. Instantiate it, register primitives, connect a transport.

### Defining Tools

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "my-server",
  version: "1.0.0",
});

server.tool(
  "toolName",
  "Tool description",
  { param: z.string() },
  async (args) => {
    // Implementation
    return { content: [{ type: "text", text: "result" }] };
  }
);
```

Tools can return `resource_link` content items so clients fetch large data on demand.

### Defining Resources

- **Static**: Fixed URIs pointing to specific data
- **Dynamic**: Use `ResourceTemplate` with path parameters and completion support

### Defining Prompts

Prompts include title, description, argument schema (Zod), and a handler that returns message arrays.

### Completions

Prompts and resources support autocompletion via the `completable()` wrapper function, which accepts a predicate for filtering suggestions.

### Logging

Declare `logging` capability on the server instance, then call `ctx.mcpReq.log(level, data)` within handlers.

### Transport Setup

#### stdio

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "my-server", version: "1.0.0" });
// ... register tools ...
const transport = new StdioServerTransport();
await server.connect(transport);
```

#### Streamable HTTP

```typescript
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});

const server = new McpServer({ name: "my-server", version: "1.0.0" });
// ... register tools ...
await server.connect(transport);

// Wire into Express, Hono, or any HTTP framework:
app.all("/mcp", async (req, res) => {
  await transport.handleRequest(req, res);
});
```

- **Stateful**: Provide `sessionIdGenerator` for session tracking
- **Stateless**: Pass `sessionIdGenerator: undefined`
- **JSON-only mode**: Set `enableJsonResponse: true` (disables SSE, rejects GET with 405)

#### In-Memory (for Testing)

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);

const client = new Client({ name: "test-client", version: "1.0.0" });
await client.connect(clientTransport);
```

### Advanced Features

| Feature | Purpose |
|---------|---------|
| Web Standard Transport | Deploy to Cloudflare Workers, Deno, Bun |
| Session Management | Per-session routing, initialization, cleanup |
| Resumability | Replay missed SSE events via event stores |
| CORS | Browser client support with MCP header exposure |
| Tool Annotations | Mark tools as read-only or destructive |
| Elicitation | Request user input during tool execution |
| Sampling | Request LLM completions from the host |
| Tasks (experimental) | Long-running polling operations |

## Security Checklist for Server Builders

- Validate `Origin` headers on HTTP transports
- Bind to localhost for local servers
- Use cryptographically secure session IDs
- Never do token passthrough (always validate tokens were issued for your server)
- Start with minimal scopes, elevate progressively
- Use stdio transport for local servers to limit access surface
- Return structured error content, not stack traces
- Use Zod schemas to validate all inputs

## Key References

- [MCP Specification](https://modelcontextprotocol.io/specification/latest)
- [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [SDK on npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [SDK API Docs](https://modelcontextprotocol.github.io/typescript-sdk/)
- [SDK Server Guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md)
- [Example Servers](https://github.com/modelcontextprotocol/servers)
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector) (debugging tool)
