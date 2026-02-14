# MCP Server Debug Testing Skill

End-to-end debug testing for MCP servers using the MCP Inspector CLI.

## When to Use

Use this skill during the **debug stage** of development to verify an MCP server works correctly against its real database/state, beyond what unit and integration tests cover.

## Prerequisites

- The MCP server must have a stdio entrypoint (e.g. `src/stdio.ts`)
- `@modelcontextprotocol/sdk` must be installed
- The Inspector CLI is invoked via `npx @modelcontextprotocol/inspector` (installed on demand)

## Tool: MCP Inspector CLI

The Inspector CLI allows invoking MCP methods against a running server without needing the server registered as an MCP connection.

### Base Command

```bash
npx @modelcontextprotocol/inspector --cli <server-command> --method <method> [--tool-name <name>] [--tool-arg <key>=<value>]...
```

Where `<server-command>` is whatever launches the server on stdio, e.g. `npx tsx src/stdio.ts`.

### Common Methods

| Method | Purpose | Extra Flags |
|--------|---------|-------------|
| `tools/list` | List all registered tools and their schemas | None |
| `tools/call` | Invoke a specific tool | `--tool-name`, `--tool-arg` |
| `resources/list` | List static resources | None |
| `resources/read` | Read a resource | `--resource-uri` |
| `prompts/list` | List available prompts | None |
| `prompts/get` | Get a prompt | `--prompt-name`, `--prompt-arg` |

### Passing Arguments

- String args: `--tool-arg key=value`
- Array args: `--tool-arg 'key=["item1","item2"]'`
- Object args: `--tool-arg 'key={"nested":"value"}'`

## Debug Testing Procedure

Given a set of **test scenarios** (provided by the caller), execute each one and verify the output.

### Step 1: Discover Available Capabilities

```bash
npx @modelcontextprotocol/inspector --cli <server-command> --method tools/list
```

Verify the returned tool names, descriptions, and input schemas match expectations.

### Step 2: Test Happy Paths

For each tool, invoke it with valid arguments and verify:
- The response has `content` with the expected structure
- `isError` is absent or falsy
- The data matches what's expected given the current database/state

### Step 3: Test Error Paths

For each tool, invoke it with invalid arguments and verify:
- `isError` is `true`
- The error message is descriptive and safe (no stack traces)

### Step 4: Test Multi-Step Workflows

If the tools compose (e.g. discover then match), chain them:
1. Call the first tool, parse its output
2. Use values from the output as input to the next tool
3. Verify the final result is coherent

### Step 5: Test Edge Cases

- Empty inputs (empty arrays, empty strings)
- Nonexistent identifiers
- Boundary values

## Output Format

Report results as a table:

| Scenario | Command Summary | Result |
|----------|----------------|--------|
| List tools | `tools/list` | pass/fail |
| Happy path: [description] | `tools/call --tool-name X ...` | pass/fail |
| Error path: [description] | `tools/call --tool-name X ...` | pass/fail |
| Workflow: [description] | chained calls | pass/fail |

## Example: Testing This Server

```bash
# List tools
npx @modelcontextprotocol/inspector --cli npx tsx src/stdio.ts --method tools/list

# Happy path: discover categories
npx @modelcontextprotocol/inspector --cli npx tsx src/stdio.ts \
  --method tools/call --tool-name discover \
  --tool-arg domain=software-engineering

# Happy path: match patterns in a category
npx @modelcontextprotocol/inspector --cli npx tsx src/stdio.ts \
  --method tools/call --tool-name match \
  --tool-arg domain=software-engineering \
  --tool-arg 'categories=["features"]'

# Happy path: match across multiple categories
npx @modelcontextprotocol/inspector --cli npx tsx src/stdio.ts \
  --method tools/call --tool-name match \
  --tool-arg domain=software-engineering \
  --tool-arg 'categories=["algorithms","issues"]'

# Error path: nonexistent domain on discover
npx @modelcontextprotocol/inspector --cli npx tsx src/stdio.ts \
  --method tools/call --tool-name discover \
  --tool-arg domain=nonexistent

# Error path: nonexistent domain on match
npx @modelcontextprotocol/inspector --cli npx tsx src/stdio.ts \
  --method tools/call --tool-name match \
  --tool-arg domain=nonexistent \
  --tool-arg 'categories=["features"]'
```

## Tips

- Pipe through `| tail -N` to skip npm install warnings on first run
- Use `timeout 15` prefix if worried about a server hanging
- The inspector installs on first use via npx; subsequent runs are fast
- Stderr output from the server (e.g. "Server running on stdio") is normal
- Always test with the **real database**, not just `:memory:` — that's what unit tests are for
