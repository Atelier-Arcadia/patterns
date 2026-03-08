# Plan: SQLite Spell Storage

## Approach

Introduce a `Grimoire` interface that both the existing YAML backend and new SQLite backend implement. This keeps the YAML path available as a fallback/import source while the SQLite backend becomes the primary storage.

## Steps

### 1. Define `Grimoire` interface (`src/types.ts`)

- Extract the query methods from `SpellDatabase` into an interface: `getDomains()`, `getDomain(slug)`, `getCategories(domainSlug)`, `getSpells(domainSlug, categorySlugs)`
- Make existing `SpellDatabase` implement it

### 2. Install `better-sqlite3`

- Add `better-sqlite3` + `@types/better-sqlite3` as dependencies

### 3. Create `SqliteGrimoire` (`src/sqlite-store.ts`)

- Schema: `domains(id, slug UNIQUE, name, description)`, `categories(id, domain_id FK, slug, name, description)`, `spells(id, category_id FK, label, description, intention, template)`
- Constructor takes a database file path (or `:memory:` for testing)
- `initialize()` creates tables with `CREATE TABLE IF NOT EXISTS`
- Implements all `Grimoire` interface methods

### 4. Create YAML import utility (`src/import-yaml.ts`)

- Reads existing YAML files using the current `SpellDatabase.load()` logic
- Inserts all domains, categories, and spells into a `SqliteGrimoire`
- Can be run as a standalone script

### 5. Update entrypoints (`src/stdio.ts`, `src/http.ts`)

- Switch from `SpellDatabase` to `SqliteGrimoire`
- On first run, if DB doesn't exist, auto-import from YAML

### 6. Tests (TDD)

- New `tests/sqlite-store.test.ts` -- unit tests for CRUD and queries against `:memory:` DB
- Existing tests continue to pass (regression)
- New `tests/import-yaml.test.ts` -- verify import utility correctly transfers fixture data

## Files Modified

- `src/types.ts` -- add `Grimoire` interface
- `src/database.ts` -- implement `Grimoire`
- `src/sqlite-store.ts` -- new file
- `src/import-yaml.ts` -- new file
- `src/stdio.ts` -- use SQLite store
- `src/http.ts` -- use SQLite store
- `tests/sqlite-store.test.ts` -- new file
- `tests/import-yaml.test.ts` -- new file
- `package.json` -- add `better-sqlite3`

## What stays the same

- `tools.ts` and `server.ts` accept `Grimoire` interface (type change only)
- All existing test assertions remain valid
- YAML files preserved on disk as source-of-truth for initial data
