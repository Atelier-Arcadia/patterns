import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import { SqlitePatternStore } from "../src/sqlite-store.js";
import { createApiRouter } from "../src/api.js";
import { authStatus, clearSessions } from "../src/auth.js";

// Minimal request helper — avoids needing supertest dependency
async function req(
  app: express.Express,
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<{ status: number; body: any; headers: Headers }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      const url = `http://127.0.0.1:${addr.port}${path}`;
      const opts: RequestInit = {
        method,
        headers: { "Content-Type": "application/json", ...headers },
      };
      if (body !== undefined) {
        opts.body = JSON.stringify(body);
      }
      fetch(url, opts)
        .then(async (res) => {
          const json = await res.json().catch(() => null);
          server.close();
          resolve({ status: res.status, body: json, headers: res.headers });
        })
        .catch((err) => {
          server.close();
          reject(err);
        });
    });
  });
}

describe("API Router", () => {
  let store: SqlitePatternStore;
  let app: express.Express;

  beforeAll(() => {
    store = new SqlitePatternStore(":memory:");
    store.initialize();
    app = express();
    app.use(express.json());
    app.use(authStatus);
    app.use("/api", createApiRouter(store));
  });

  afterAll(() => {
    store.close();
  });

  // Seed fresh data before each test
  beforeEach(() => {
    // Clear all domains (cascades to categories and patterns)
    for (const d of store.getDomains()) {
      store.deleteDomain(d.slug);
    }
    // Clear submissions by re-initializing (submissions table uses IF NOT EXISTS)
    for (const s of store.getSubmissions()) {
      // Just let them accumulate — tests that need clean state seed their own
    }
  });

  // -- Domains --

  describe("GET /api/domains", () => {
    it("returns empty array when no domains exist", async () => {
      const res = await req(app, "GET", "/api/domains");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("returns all domains with nested data", async () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });

      const res = await req(app, "GET", "/api/domains");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].slug).toBe("eng");
      expect(res.body[0].categories).toHaveLength(1);
    });
  });

  describe("POST /api/domains", () => {
    it("creates a domain", async () => {
      const res = await req(app, "POST", "/api/domains", {
        slug: "eng",
        name: "Engineering",
        description: "Eng patterns",
      });
      expect(res.status).toBe(201);
      expect(res.body.slug).toBe("eng");

      const domain = store.getDomain("eng");
      expect(domain).toBeDefined();
    });

    it("returns 400 for missing fields", async () => {
      const res = await req(app, "POST", "/api/domains", { slug: "eng" });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 409 for duplicate slug", async () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      const res = await req(app, "POST", "/api/domains", {
        slug: "eng",
        name: "Other",
        description: "Other",
      });
      expect(res.status).toBe(409);
    });
  });

  describe("PUT /api/domains/:slug", () => {
    it("updates a domain", async () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });

      const res = await req(app, "PUT", "/api/domains/eng", {
        name: "Software Engineering",
      });
      expect(res.status).toBe(200);
      expect(store.getDomain("eng")!.name).toBe("Software Engineering");
    });

    it("returns 404 for nonexistent domain", async () => {
      const res = await req(app, "PUT", "/api/domains/nonexistent", {
        name: "X",
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/domains/:slug", () => {
    it("deletes a domain", async () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });

      const res = await req(app, "DELETE", "/api/domains/eng");
      expect(res.status).toBe(200);
      expect(store.getDomain("eng")).toBeUndefined();
    });

    it("returns 404 for nonexistent domain", async () => {
      const res = await req(app, "DELETE", "/api/domains/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  // -- Categories --

  describe("POST /api/domains/:slug/categories", () => {
    it("creates a category", async () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });

      const res = await req(app, "POST", "/api/domains/eng/categories", {
        slug: "features",
        name: "Features",
        description: "Feature patterns",
      });
      expect(res.status).toBe(201);
      expect(res.body.slug).toBe("features");

      const categories = store.getCategories("eng");
      expect(categories).toHaveLength(1);
    });

    it("returns 404 for nonexistent domain", async () => {
      const res = await req(app, "POST", "/api/domains/nonexistent/categories", {
        slug: "features",
        name: "Features",
        description: "Features",
      });
      expect(res.status).toBe(404);
    });

    it("returns 400 for missing fields", async () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      const res = await req(app, "POST", "/api/domains/eng/categories", {
        slug: "features",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/domains/:slug/categories/:catSlug", () => {
    it("updates a category", async () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });

      const res = await req(app, "PUT", "/api/domains/eng/categories/features", {
        name: "Feature Requests",
      });
      expect(res.status).toBe(200);
      expect(store.getCategories("eng")[0].name).toBe("Feature Requests");
    });

    it("returns 404 for nonexistent category", async () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      const res = await req(app, "PUT", "/api/domains/eng/categories/nonexistent", {
        name: "X",
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/domains/:slug/categories/:catSlug", () => {
    it("deletes a category", async () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });

      const res = await req(app, "DELETE", "/api/domains/eng/categories/features");
      expect(res.status).toBe(200);
      expect(store.getCategories("eng")).toHaveLength(0);
    });

    it("returns 404 for nonexistent category", async () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      const res = await req(app, "DELETE", "/api/domains/eng/categories/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  // -- Patterns --

  describe("POST /api/domains/:slug/categories/:catSlug/patterns", () => {
    it("creates a pattern", async () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });

      const res = await req(app, "POST", "/api/domains/eng/categories/features/patterns", {
        label: "create-feature",
        description: "Create a feature",
        intention: "User wants a feature",
        template: "# Feature: {{name}}",
      });
      expect(res.status).toBe(201);
      expect(res.body.label).toBe("create-feature");

      const patterns = store.getPatterns("eng", ["features"]);
      expect(patterns).toHaveLength(1);
    });

    it("returns 404 for nonexistent category", async () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      const res = await req(app, "POST", "/api/domains/eng/categories/nonexistent/patterns", {
        label: "x",
        description: "x",
        intention: "x",
        template: "x",
      });
      expect(res.status).toBe(404);
    });

    it("returns 400 for missing fields", async () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });
      const res = await req(app, "POST", "/api/domains/eng/categories/features/patterns", {
        label: "x",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/patterns/:id", () => {
    it("updates a pattern", async () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });
      store.addPattern("eng", "features", {
        label: "p1",
        description: "d",
        intention: "i",
        template: "t",
      });
      const id = store.getPatternsWithIds("eng", ["features"])[0].id;

      const res = await req(app, "PUT", `/api/patterns/${id}`, {
        label: "updated-label",
      });
      expect(res.status).toBe(200);
      expect(store.getPatternsWithIds("eng", ["features"])[0].label).toBe("updated-label");
    });

    it("returns 404 for nonexistent pattern", async () => {
      const res = await req(app, "PUT", "/api/patterns/99999", {
        label: "x",
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/patterns/:id", () => {
    it("deletes a pattern", async () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });
      store.addPattern("eng", "features", {
        label: "p1",
        description: "d",
        intention: "i",
        template: "t",
      });
      const id = store.getPatternsWithIds("eng", ["features"])[0].id;

      const res = await req(app, "DELETE", `/api/patterns/${id}`);
      expect(res.status).toBe(200);
      expect(store.getPatterns("eng", ["features"])).toHaveLength(0);
    });

    it("returns 404 for nonexistent pattern", async () => {
      const res = await req(app, "DELETE", "/api/patterns/99999");
      expect(res.status).toBe(404);
    });
  });

  // -- Auth --

  describe("GET /api/auth/status", () => {
    it("returns not authenticated when no session cookie", async () => {
      const res = await req(app, "GET", "/api/auth/status");
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
    });

    it("returns adminConfigured based on ADMIN_SECRET env var", async () => {
      const res = await req(app, "GET", "/api/auth/status");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("adminConfigured");
    });
  });

  describe("POST /api/auth/login", () => {
    afterEach(() => {
      clearSessions();
      delete process.env.ADMIN_SECRET;
    });

    it("returns 401 when ADMIN_SECRET is not configured", async () => {
      delete process.env.ADMIN_SECRET;
      const res = await req(app, "POST", "/api/auth/login", { secret: "anything" });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/not configured/i);
    });

    it("returns 401 for wrong secret", async () => {
      process.env.ADMIN_SECRET = "correct-secret";
      const res = await req(app, "POST", "/api/auth/login", { secret: "wrong" });
      expect(res.status).toBe(401);
    });

    it("returns 200 and sets session cookie for correct secret", async () => {
      process.env.ADMIN_SECRET = "correct-secret";
      const res = await req(app, "POST", "/api/auth/login", { secret: "correct-secret" });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      const setCookie = res.headers.get("set-cookie");
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain("session=");
    });
  });

  describe("POST /api/auth/logout", () => {
    afterEach(() => {
      clearSessions();
      delete process.env.ADMIN_SECRET;
    });

    it("clears the session cookie", async () => {
      process.env.ADMIN_SECRET = "secret";

      // Login first
      const loginRes = await req(app, "POST", "/api/auth/login", { secret: "secret" });
      const setCookie = loginRes.headers.get("set-cookie")!;
      const sessionToken = setCookie.split("session=")[1].split(";")[0];

      // Logout
      const res = await req(app, "POST", "/api/auth/logout", undefined, {
        Cookie: `session=${sessionToken}`,
      });
      expect(res.status).toBe(200);

      // Verify session is invalidated
      const statusRes = await req(app, "GET", "/api/auth/status", undefined, {
        Cookie: `session=${sessionToken}`,
      });
      expect(statusRes.body.authenticated).toBe(false);
    });
  });

  // -- Submissions --

  describe("POST /api/submissions", () => {
    it("creates a 'new' submission without auth", async () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });

      const res = await req(app, "POST", "/api/submissions", {
        type: "new",
        domainSlug: "eng",
        categorySlug: "features",
        label: "new-pattern",
        description: "A new pattern",
        intention: "User wants this",
        template: "# Template",
      });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body.status).toBe("pending");
    });

    it("creates a 'modify' submission without auth", async () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });
      store.addPattern("eng", "features", {
        label: "p1",
        description: "d",
        intention: "i",
        template: "t",
      });
      const patternId = store.getPatternsWithIds("eng", ["features"])[0].id;

      const res = await req(app, "POST", "/api/submissions", {
        type: "modify",
        targetPatternId: patternId,
        label: "improved-p1",
        description: "Better desc",
        intention: "Better intention",
        template: "Better template",
      });
      expect(res.status).toBe(201);
      expect(res.body.type).toBe("modify");
    });

    it("returns 400 for missing fields", async () => {
      const res = await req(app, "POST", "/api/submissions", {
        type: "new",
        label: "x",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/submissions (admin)", () => {
    afterEach(() => {
      clearSessions();
      delete process.env.ADMIN_SECRET;
    });

    it("returns 401 without admin auth", async () => {
      const res = await req(app, "GET", "/api/submissions");
      expect(res.status).toBe(401);
    });

    it("returns submissions when authenticated as admin", async () => {
      process.env.ADMIN_SECRET = "secret";

      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });

      store.addSubmission({
        type: "new",
        domainSlug: "eng",
        categorySlug: "features",
        label: "s1",
        description: "d",
        intention: "i",
        template: "t",
      });

      // Login
      const loginRes = await req(app, "POST", "/api/auth/login", { secret: "secret" });
      const setCookie = loginRes.headers.get("set-cookie")!;
      const token = setCookie.split("session=")[1].split(";")[0];

      const res = await req(app, "GET", "/api/submissions", undefined, {
        Cookie: `session=${token}`,
      });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("POST /api/submissions/:id/review (admin)", () => {
    afterEach(() => {
      clearSessions();
      delete process.env.ADMIN_SECRET;
    });

    it("returns 401 without admin auth", async () => {
      const res = await req(app, "POST", "/api/submissions/1/review", { decision: "accepted" });
      expect(res.status).toBe(401);
    });

    it("accepts a submission when authenticated as admin", async () => {
      process.env.ADMIN_SECRET = "secret";

      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });

      const subId = store.addSubmission({
        type: "new",
        domainSlug: "eng",
        categorySlug: "features",
        label: "approved-pattern",
        description: "d",
        intention: "i",
        template: "t",
      });

      // Login
      const loginRes = await req(app, "POST", "/api/auth/login", { secret: "secret" });
      const setCookie = loginRes.headers.get("set-cookie")!;
      const token = setCookie.split("session=")[1].split(";")[0];

      const res = await req(app, "POST", `/api/submissions/${subId}/review`, { decision: "accepted" }, {
        Cookie: `session=${token}`,
      });
      expect(res.status).toBe(200);

      // Pattern should have been created
      const patterns = store.getPatterns("eng", ["features"]);
      expect(patterns.some((p) => p.label === "approved-pattern")).toBe(true);
    });

    it("rejects a submission when authenticated as admin", async () => {
      process.env.ADMIN_SECRET = "secret";

      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });

      const subId = store.addSubmission({
        type: "new",
        domainSlug: "eng",
        categorySlug: "features",
        label: "rejected-pattern",
        description: "d",
        intention: "i",
        template: "t",
      });

      // Login
      const loginRes = await req(app, "POST", "/api/auth/login", { secret: "secret" });
      const setCookie = loginRes.headers.get("set-cookie")!;
      const token = setCookie.split("session=")[1].split(";")[0];

      const res = await req(app, "POST", `/api/submissions/${subId}/review`, { decision: "rejected" }, {
        Cookie: `session=${token}`,
      });
      expect(res.status).toBe(200);

      // Submission should be rejected
      const sub = store.getSubmission(subId);
      expect(sub!.status).toBe("rejected");

      // Pattern should NOT have been created
      const patterns = store.getPatterns("eng", ["features"]);
      expect(patterns.some((p) => p.label === "rejected-pattern")).toBe(false);
    });

    it("auto-creates domain and category when accepting submission with nonexistent domain", async () => {
      process.env.ADMIN_SECRET = "secret";

      const subId = store.addSubmission({
        type: "new",
        domainSlug: "brand-new",
        categorySlug: "brand-cat",
        label: "auto-created-pattern",
        description: "d",
        intention: "i",
        template: "t",
      });

      const loginRes = await req(app, "POST", "/api/auth/login", { secret: "secret" });
      const setCookie = loginRes.headers.get("set-cookie")!;
      const token = setCookie.split("session=")[1].split(";")[0];

      const res = await req(app, "POST", `/api/submissions/${subId}/review`, { decision: "accepted" }, {
        Cookie: `session=${token}`,
      });
      expect(res.status).toBe(200);

      // Domain and category should have been auto-created
      const domain = store.getDomain("brand-new");
      expect(domain).toBeDefined();
      expect(domain!.name).toBe("Brand New");

      const categories = store.getCategories("brand-new");
      expect(categories).toHaveLength(1);
      expect(categories[0].slug).toBe("brand-cat");

      // Pattern should have been created
      const patterns = store.getPatterns("brand-new", ["brand-cat"]);
      expect(patterns).toHaveLength(1);
      expect(patterns[0].label).toBe("auto-created-pattern");
    });
  });

  describe("GET /api/submissions impact enrichment", () => {
    afterEach(() => {
      clearSessions();
      delete process.env.ADMIN_SECRET;
    });

    it("returns impact data for pending submission with nonexistent domain", async () => {
      process.env.ADMIN_SECRET = "secret";

      store.addSubmission({
        type: "new",
        domainSlug: "unknown-domain",
        categorySlug: "unknown-cat",
        label: "s1",
        description: "d",
        intention: "i",
        template: "t",
      });

      const loginRes = await req(app, "POST", "/api/auth/login", { secret: "secret" });
      const setCookie = loginRes.headers.get("set-cookie")!;
      const token = setCookie.split("session=")[1].split(";")[0];

      const res = await req(app, "GET", "/api/submissions", undefined, {
        Cookie: `session=${token}`,
      });
      expect(res.status).toBe(200);

      const sub = res.body.find((s: any) => s.domainSlug === "unknown-domain");
      expect(sub).toBeDefined();
      expect(sub.impact).toBeDefined();
      expect(sub.impact.newDomain).toEqual({ slug: "unknown-domain", name: "Unknown Domain" });
      expect(sub.impact.newCategory).toEqual({ slug: "unknown-cat", name: "Unknown Cat" });
    });

    it("returns null impact for submission with existing domain and category", async () => {
      process.env.ADMIN_SECRET = "secret";

      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });

      store.addSubmission({
        type: "new",
        domainSlug: "eng",
        categorySlug: "features",
        label: "s1",
        description: "d",
        intention: "i",
        template: "t",
      });

      const loginRes = await req(app, "POST", "/api/auth/login", { secret: "secret" });
      const setCookie = loginRes.headers.get("set-cookie")!;
      const token = setCookie.split("session=")[1].split(";")[0];

      const res = await req(app, "GET", "/api/submissions", undefined, {
        Cookie: `session=${token}`,
      });
      expect(res.status).toBe(200);

      const sub = res.body.find((s: any) => s.domainSlug === "eng");
      expect(sub).toBeDefined();
      expect(sub.impact.newDomain).toBeNull();
      expect(sub.impact.newCategory).toBeNull();
    });
  });
});
