# Feature: Pattern Discovery MCP Server

Status: Not started

Build an MCP server in TypeScript that serves a hierarchical database of "patterns" for LLM interactions. A pattern is a mapping from an intention (what the user wants to accomplish) to a structured prompt (a well-formatted template an LLM can work with effectively). The server enables agents to discover relevant patterns based on domain and category, then apply them to reframe user prompts into higher-quality structured requests.

## Concepts

- **Pattern**: A mapping from an "intention" to a "prompt". Example: the `create-task` skill maps a natural language task description into a well-structured feature request or bug report.
- **Domain**: A top-level knowledge area (e.g. software engineering, design, research, project management).
- **Category**: A subdivision within a domain (e.g. "features", "issues", "data structures", "algorithms" within the software engineering domain).

## MCP Tools

### `discover`

Given a domain, returns the list of known categories within that domain.

- **Input**: `domain: string`
- **Output**: List of category names and descriptions

### `match`

Given a domain and one or more categories, returns patterns that match.

- **Input**: `domain: string`, `categories: string[]`
- **Output**: List of matching patterns with labels, descriptions, and prompt templates

## Example Interaction

1. User prompts their agent: "Implement a binary tree for storing these data"
2. Agent calls `discover` with `domain = "software engineering"`
3. Server returns categories: "features", "issues", "data structures", "algorithms", etc.
4. Agent identifies "data structures" and "features" as relevant
5. Agent calls `match` with `domain = "software engineering"`, `categories = ["features", "data structures"]`
6. Server returns patterns: "recording a feature request", "implementing data structures"
7. Agent applies the matched patterns to reframe the user's prompt into structured output
8. Agent presents a plan to the user incorporating the pattern templates and asks for confirmation

## Design Goals

- Users can afford to put in less effort structuring prompts; the patterns handle the structuring
- Hierarchical discovery (domain -> category -> pattern) lets agents narrow down relevant patterns efficiently
- The pattern database is extensible: new domains, categories, and patterns can be added over time

Done Criteria:
* [ ] MCP server is implemented in TypeScript using `@modelcontextprotocol/server` SDK
* [ ] Server exposes a `discover` tool that accepts a domain and returns its categories
* [ ] Server exposes a `match` tool that accepts a domain and categories and returns matching patterns
* [ ] Pattern data model supports domains, categories, and pattern definitions (intention + prompt template)
* [ ] At least one domain is seeded with categories and example patterns (e.g. software engineering)
* [ ] Server runs via stdio transport for local use
* [ ] Server runs via Streamable HTTP transport for remote use
* [ ] Pattern database is stored in a format that is easy to extend (e.g. files on disk, JSON/YAML)
