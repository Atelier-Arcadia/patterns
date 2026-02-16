# Plan: Auto-create domains and categories when approving suggestions

Status: In progress

## Overview

When a pattern suggestion references a domain or category that doesn't yet exist, approving that suggestion should automatically create the new domain or category. The web UI should prominently indicate when approving a suggestion will result in new domains or categories being created.

## Increments

### Increment 1: Store-layer auto-creation in `reviewSubmission`

- Add `slugToName()` helper (`"software-engineering"` -> `"Software Engineering"`)
- Add `ensureDomainExists()` and `ensureCategoryExists()` private helpers
- Modify `reviewSubmission()` to call these before `addPattern()`, wrapped in a transaction
- Update breaking test at line 687 (expects throw -> should expect auto-creation)
- 6 new store-level tests

### Increment 2: `getSubmissionImpact()` preview method

- New `SubmissionImpact` interface in `types.ts`
- New `getSubmissionImpact(id)` method on store returns `{ newDomain, newCategory }`
- 5 new tests

### Increment 3: API enrichment

- Enrich `GET /submissions` response with `impact` field for pending "new" submissions
- 3 new API tests

### Increment 4: API integration test for full approval flow

- 2 new tests validating auto-creation works through the REST API end-to-end

### Increment 5: Web UI warnings

- CSS `.impact-warning` badges on submission cards
- Enhanced confirmation dialog mentioning new domains/categories

## Files Modified

| File | Changes |
|------|---------|
| `src/sqlite-store.ts` | Auto-creation helpers, modify `reviewSubmission`, add `getSubmissionImpact` |
| `src/types.ts` | Add `SubmissionImpact` interface |
| `src/api.ts` | Enrich submissions response with impact |
| `src/public/index.html` | Warning badges + confirmation dialog |
| `tests/sqlite-store.test.ts` | ~11 new tests, 1 modified test |
| `tests/api.test.ts` | ~5 new tests |
