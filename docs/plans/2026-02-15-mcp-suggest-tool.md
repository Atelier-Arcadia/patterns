# Plan: MCP Suggest Tool

## 1. Schema & Type Changes
- Add `source` column to `submissions` table (nullable TEXT, for backwards compat with existing web submissions)
- Add `source` field to `Submission` and `SubmissionInput` types
- Update `SubmissionInput` in `SqlitePatternStore.addSubmission()` to persist `source`
- Update `mapSubmissionRow` to include `source`

## 2. Interface Extension
- Add submission methods to `PatternStore` interface (or create a new `SubmissionStore` interface) so `createServer()` can access them without depending on the concrete `SqlitePatternStore` class
- Update `createServer()` to accept the extended interface

## 3. New Tool Handler
- Create `createSuggestHandler` in `tools.ts` following the existing pattern
- Two modes via `type` field: `"new"` (requires domainSlug, categorySlug) and `"modify"` (requires targetPatternId)
- Required `source` field (string identifier for who/what is submitting)
- Returns the created submission as confirmation, or `isError: true` on validation failure

## 4. Register Tool in Server
- Add `suggest` tool in `server.ts` with Zod schema for all fields
- Description guides LLMs on when/how to use it

## 5. Update API (optional but consistent)
- Accept optional `source` in `POST /submissions` so web UI submissions can also carry it

## 6. Tests (TDD)
- **Unit tests** in `tests/tools.test.ts`: suggest-new happy path, suggest-modify happy path, missing required fields, missing source, invalid type
- **Integration test** in `tests/integration.test.ts`: full MCP client -> suggest -> verify submission exists
- **Store tests** in `tests/sqlite-store.test.ts`: `source` field persisted and retrieved correctly

## Execution Order (TDD)
1. Write failing tests for `source` on store layer -> implement schema + type changes
2. Write failing tests for `createSuggestHandler` -> implement handler
3. Write failing integration test -> wire up in `server.ts`
4. Debug with MCP Inspector
