# Plan: Discover Tool — List All Domains

Date: 2026-02-15
Status: approved
Feature: docs/features/2026-02-15-discover-list-all-domains.md

## Summary

Make the `discover` MCP tool's `domain` parameter optional. When omitted, return all available domain slugs and labels so callers can enumerate the full pattern hierarchy from the top down.

## Changes

### 1. `src/tools.ts` — `createDiscoverHandler`
- Change args type from `{ domain: string }` to `{ domain?: string }`
- When `domain` is undefined/empty: call `db.getDomains()`, map each to `{ name, slug, description }`, return as JSON
- When `domain` is provided: existing behavior unchanged (return categories for that domain)

### 2. `src/server.ts` — Zod schema
- Change `domain: z.string()` to `domain: z.string().optional()`
- Update tool description to mention that omitting `domain` lists all available domains

### 3. `tests/tools.test.ts` — New unit tests
- `discover` with no domain returns all domains
- `discover` with no domain returns slug, name, description for each domain
- Existing tests for domain-specific discover remain unchanged

### 4. `tests/integration.test.ts` — New integration test
- Call `discover` with no arguments via MCP client, verify domain list returned
- End-to-end: discover domains, then discover categories for a returned domain

## No regressions
- All existing tests pass unchanged
- The `domain` parameter remains functional when provided
