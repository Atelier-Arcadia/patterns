# Plan: Admin Authentication & Public Pattern Submissions

## Overview

Add two user modes to the Pattern Manager: **admin** (authenticated via secret) and **contributor** (unauthenticated). Contributors can browse patterns read-only and submit proposals. Admins see the full current UI plus a review queue for submissions.

## Decisions

- **No `ADMIN_SECRET` = no admin access.** If the env var is not set, the server runs in contributor-only mode. The login endpoint returns an error explaining that admin access is not configured. This is the safe default — admin must be explicitly enabled.
- **Anonymous submissions.** Contributors do not provide a name or handle. Submissions are evaluated purely on content.
- **No user accounts or persistent sessions.** A shared admin secret + in-memory session tokens. Tokens expire on server restart.

## 1. Database Layer — New `submissions` table

Add a `submissions` table to SQLite:

```sql
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('new', 'modify')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
  -- For 'modify': which pattern is being modified
  target_pattern_id INTEGER,
  -- For 'new': which domain/category to add to
  domain_slug TEXT,
  category_slug TEXT,
  -- The proposed content
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  intention TEXT NOT NULL,
  template TEXT NOT NULL,
  -- Metadata
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  FOREIGN KEY (target_pattern_id) REFERENCES patterns(id) ON DELETE SET NULL
);
```

New store methods: `addSubmission()`, `getSubmissions(status?)`, `getSubmission(id)`, `reviewSubmission(id, 'accepted' | 'rejected')` (accepting a 'new' submission creates the pattern; accepting a 'modify' updates the target pattern).

## 2. API Layer — New endpoints

**Public (no auth):**
- `POST /api/submissions` — Submit a new pattern proposal or modification
- `GET /api/domains` — Keep as-is (read-only for everyone)

**Admin-only (requires auth):**
- `POST /api/auth/login` — Validate secret, set a session cookie
- `POST /api/auth/logout` — Clear the session
- `GET /api/auth/status` — Check if currently authenticated (also returns whether admin is configured at all)
- `GET /api/submissions` — List submissions (filterable by status)
- `POST /api/submissions/:id/review` — Accept or reject a submission
- All existing mutation endpoints (POST/PUT/DELETE on domains, categories, patterns) — protected behind auth middleware

**Auth mechanism**: Compare provided secret against `ADMIN_SECRET` env var. If `ADMIN_SECRET` is not set, login always fails and admin features are unavailable. Use a simple randomly-generated session token stored in-memory (Map), set via `Set-Cookie`. No database session table needed for a single-admin app.

## 3. Frontend — Two modes

The single `index.html` will detect auth status on load (`GET /api/auth/status`) and render accordingly:

**Contributor mode** (not authenticated):
- Browse domains/categories/patterns (read-only, no Edit/Delete buttons)
- "Login" button in header opens a simple password prompt (hidden if admin is not configured)
- "+ Suggest" button replaces "+ New" — opens a form to submit a proposal (new or modify)
- Can see their submission was received (success toast)

**Admin mode** (authenticated):
- Everything the current UI has (full CRUD)
- "Submissions" tab/button in header showing pending count badge
- Submissions view: list of pending submissions with Accept/Reject buttons
- Each submission card shows the proposed content + whether it's new or a modification
- Logout button

## 4. Files to create/modify

| File | Action |
|------|--------|
| `src/types.ts` | Add `Submission` interface |
| `src/sqlite-store.ts` | Add `submissions` table + CRUD methods |
| `src/auth.ts` | **New** — Auth middleware + session management |
| `src/api.ts` | Add submission endpoints, protect mutation routes |
| `src/http.ts` | Wire up cookie parsing, auth middleware |
| `src/public/index.html` | Dual-mode UI |
| `tests/sqlite-store.test.ts` | Tests for submission store methods |
| `tests/api.test.ts` | Tests for submission + auth endpoints |

## 5. TDD Order

1. Store layer tests for submissions (RED then GREEN)
2. Auth middleware tests (RED then GREEN)
3. API endpoint tests for submissions + protected routes (RED then GREEN)
4. Frontend changes (manual testing)

## 6. Security Notes

- **No `ADMIN_SECRET` = no admin.** The server starts fine but admin login is impossible. This is the safe default.
- Session tokens are random UUIDs, stored in-memory, expire on server restart
- No rate limiting needed for v1 (single admin, small scale)
