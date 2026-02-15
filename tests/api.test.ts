import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import { SqlitePatternStore } from "../src/sqlite-store.js";
import { createApiRouter } from "../src/api.js";

// Minimal request helper — avoids needing supertest dependency
async function req(
  app: express.Express,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      const url = `http://127.0.0.1:${addr.port}${path}`;
      const opts: RequestInit = {
        method,
        headers: { "Content-Type": "application/json" },
      };
      if (body !== undefined) {
        opts.body = JSON.stringify(body);
      }
      fetch(url, opts)
        .then(async (res) => {
          const json = await res.json().catch(() => null);
          server.close();
          resolve({ status: res.status, body: json });
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
});
