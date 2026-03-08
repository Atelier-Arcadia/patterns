# Plan: Spell Management Web App

## Overview

Add a web-based management UI for the Domain > Category > Spell hierarchy. The work divides into three layers: store mutations, REST API, and frontend.

## Layer 1: Store Mutations

Extend `SqliteGrimoire` with update and delete methods. The `Grimoire` interface stays read-only (it's the MCP query contract); mutation methods live only on the concrete class.

### New methods on `SqliteGrimoire`:

```
updateDomain(slug, changes: { name?, description? }): void
deleteDomain(slug): void
updateCategory(domainSlug, categorySlug, changes: { name?, description? }): void
deleteCategory(domainSlug, categorySlug): void
updateSpell(id, changes: { label?, description?, intention?, template? }): void
deleteSpell(id): void
```

**Note**: Spells need an `id` for update/delete since they don't have a unique slug. The `getSpells` and related methods should be extended to return `id` as well.

### Tests (RED first):
- `sqlite-store.test.ts`: Add describe blocks for each new method
- Test updates modify only specified fields
- Test deletes cascade correctly
- Test error cases (update/delete nonexistent entities)

## Layer 2: REST API

Create `src/api.ts` — an Express Router with JSON endpoints.

### Endpoints:

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/domains` | List all domains (with categories + spells) |
| POST | `/api/domains` | Create domain |
| PUT | `/api/domains/:slug` | Update domain |
| DELETE | `/api/domains/:slug` | Delete domain (cascades) |
| POST | `/api/domains/:slug/categories` | Create category |
| PUT | `/api/domains/:slug/categories/:catSlug` | Update category |
| DELETE | `/api/domains/:slug/categories/:catSlug` | Delete category (cascades) |
| POST | `/api/domains/:slug/categories/:catSlug/spells` | Create spell |
| PUT | `/api/spells/:id` | Update spell |
| DELETE | `/api/spells/:id` | Delete spell |

All endpoints return JSON. Errors return `{ error: string }` with appropriate status codes.

### Tests:
- `api.test.ts`: Test each endpoint using supertest or direct Express request simulation
- Test happy paths, validation errors, 404s, cascade deletes

## Layer 3: Frontend

Create `src/public/index.html` — a single self-contained HTML file with embedded CSS and JavaScript. No build step.

### Design:
- **Navigation**: Breadcrumb bar at top (Home > Domain > Category)
- **Main view**: Shows the current level's items as cards
- **CRUD actions**:
  - "New" button at each level opens an inline form
  - Edit button on each card toggles inline editing
  - Delete button with browser `confirm()` dialog
- **Spell detail**: Template field uses a `<textarea>` for multi-line editing

### Serving:
- Mount `express.static` on `/` pointing to `src/public/`
- The existing `/mcp` route continues to work alongside

## Layer 4: Wire Up

Modify `src/http.ts` to:
1. Import and mount the API router at `/api`
2. Serve static files from `src/public/`

## Execution Order

1. Store mutations + tests (RED then GREEN)
2. REST API + tests (RED then GREEN)
3. Frontend HTML file
4. Wire into `http.ts`
5. Manual testing via browser

## Files Changed/Created

- `src/sqlite-store.ts` — add mutation methods, return ids on spells
- `src/api.ts` — new, REST router
- `src/public/index.html` — new, self-contained frontend
- `src/http.ts` — mount API + static serving
- `tests/sqlite-store.test.ts` — extend with mutation tests
- `tests/api.test.ts` — new, API endpoint tests
