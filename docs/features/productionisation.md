# Feature: Production Readiness

Status: Not started

The Patterns MCP server needs hardening and operational tooling to be deployable as a reliable, secure production service. Currently the codebase has a solid foundation (clean TypeScript, 116 passing tests, dual MCP + REST interface), but lacks the security, observability, and deployment infrastructure needed for real-world use.

## Scope

This feature covers five areas, ordered by priority:

### 1. Security Hardening

The HTTP server is currently open to abuse if exposed publicly.

* [ ] Add rate limiting (e.g. `express-rate-limit`) on all endpoints
* [ ] Configure CORS to restrict allowed origins
* [ ] Add security headers via `helmet`
* [ ] Enforce request body size limits
* [ ] Sanitize user-submitted content (pattern templates, descriptions) to prevent stored XSS
* [ ] Add CSRF protection for admin cookie-based auth
* [ ] Implement session expiry (tokens currently live forever until restart)
* [ ] Add HTTPS/TLS support or document reverse proxy setup

### 2. Observability & Operations

The server uses `console.error` only and has no health monitoring.

* [ ] Add structured logging (e.g. `pino`) with configurable log levels
* [ ] Add `GET /health` endpoint returning service status and DB connectivity
* [ ] Add graceful shutdown handling (SIGTERM/SIGINT)
* [ ] Add request ID tracing for correlating logs across a request lifecycle
* [ ] Add basic metrics endpoint or logging (request count, latency, error rate)

### 3. Deployment & Infrastructure

There is no containerisation or CI/CD configuration.

* [ ] Create a Dockerfile with multi-stage build
* [ ] Create docker-compose.yml for local production-like setup
* [ ] Add GitHub Actions CI pipeline (build, test, lint)
* [ ] Add `.env.example` documenting all environment variables
* [ ] Add database backup/restore scripts
* [ ] Persist sessions to DB instead of in-memory store (sessions lost on restart)

### 4. Code Quality Tooling

No linting or formatting is enforced.

* [ ] Add ESLint config with TypeScript rules
* [ ] Add Prettier config
* [ ] Add git hooks via `husky` + `lint-staged` for pre-commit checks
* [ ] Add test coverage reporting (vitest coverage)
* [ ] Add dependency vulnerability scanning (e.g. `npm audit` in CI)

### 5. Documentation

No README or deployment guide exists.

* [ ] Write README.md covering setup, configuration, and usage
* [ ] Document all REST API endpoints (consider OpenAPI spec)
* [ ] Write deployment guide with reverse proxy examples
* [ ] Document MCP tool interface for LLM consumers
* [ ] Add troubleshooting / FAQ section

## Out of Scope

* Migration away from SQLite (sufficient for expected scale)
* Multi-user auth system (single admin secret is fine for now)
* Pattern versioning / history tracking (future feature)
* API versioning (premature at this stage)

Done Criteria:
* [ ] All security hardening items implemented and tested
* [ ] Health endpoint returns 200 with DB status
* [ ] Server shuts down gracefully on SIGTERM
* [ ] Structured logs with configurable level
* [ ] Docker build succeeds and container runs correctly
* [ ] CI pipeline passes on PR
* [ ] README exists and covers setup through deployment
* [ ] Existing 116+ tests still pass
* [ ] No new `npm audit` high/critical vulnerabilities
