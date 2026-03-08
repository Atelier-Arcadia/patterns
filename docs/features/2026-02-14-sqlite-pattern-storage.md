# Feature: SQLite Spell Storage

Status: Not started

Replace the current YAML-file-based spell storage with a SQLite database while preserving the existing Domain > Category > Spell hierarchy. The relational schema should mirror the current file structure so that the same data relationships are maintained. The existing `SpellDatabase` class interface (`getDomains`, `getDomain`, `getCategories`, `getSpells`) should continue to work with the new backend.

Current file structure being replaced:
- `<spellsDir>/<domain-slug>/_domain.yaml` (domain metadata: name, description)
- `<spellsDir>/<domain-slug>/<category-slug>.yaml` (category metadata + embedded spells array)

Proposed SQLite schema (3 tables):
- **domains** — `id`, `slug` (unique), `name`, `description`
- **categories** — `id`, `domain_id` (FK), `slug`, `name`, `description`
- **spells** — `id`, `category_id` (FK), `label`, `description`, `intention`, `template`

Done Criteria:
* [ ] SQLite database is created and managed via `better-sqlite3` (or equivalent synchronous driver)
* [ ] Schema has `domains`, `categories`, and `spells` tables with appropriate foreign keys
* [ ] A migration or seed utility can import existing YAML spells into the database
* [ ] `SpellDatabase` class (or a new implementation) exposes the same query interface: `getDomains()`, `getDomain(slug)`, `getCategories(domainSlug)`, `getSpells(domainSlug, categorySlugs)`
* [ ] All existing tests pass against the new SQLite-backed implementation
* [ ] New unit tests cover CRUD operations on the SQLite store
* [ ] The YAML loading path can be retired or kept as a fallback (decide during planning)
