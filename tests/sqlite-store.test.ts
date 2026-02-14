import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqlitePatternStore } from "../src/sqlite-store.js";
import type { Domain, Category, Pattern } from "../src/types.js";

describe("SqlitePatternStore", () => {
  let store: SqlitePatternStore;

  beforeEach(() => {
    store = new SqlitePatternStore(":memory:");
    store.initialize();
  });

  afterEach(() => {
    store.close();
  });

  describe("initialize", () => {
    it("creates tables without error", () => {
      // If we got here, initialize() succeeded in beforeEach
      expect(store).toBeDefined();
    });

    it("is idempotent — can be called multiple times", () => {
      expect(() => store.initialize()).not.toThrow();
    });
  });

  describe("addDomain / getDomains / getDomain", () => {
    it("returns empty array when no domains exist", () => {
      expect(store.getDomains()).toEqual([]);
    });

    it("adds and retrieves a domain", () => {
      store.addDomain({ slug: "engineering", name: "Engineering", description: "Eng patterns" });

      const domains = store.getDomains();
      expect(domains).toHaveLength(1);
      expect(domains[0].slug).toBe("engineering");
      expect(domains[0].name).toBe("Engineering");
      expect(domains[0].description).toBe("Eng patterns");
      expect(domains[0].categories).toEqual([]);
    });

    it("retrieves a domain by slug", () => {
      store.addDomain({ slug: "engineering", name: "Engineering", description: "Eng patterns" });

      const domain = store.getDomain("engineering");
      expect(domain).toBeDefined();
      expect(domain!.name).toBe("Engineering");
    });

    it("returns undefined for unknown domain slug", () => {
      expect(store.getDomain("nonexistent")).toBeUndefined();
    });

    it("supports multiple domains", () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addDomain({ slug: "design", name: "Design", description: "Design" });

      expect(store.getDomains()).toHaveLength(2);
    });

    it("rejects duplicate domain slugs", () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      expect(() =>
        store.addDomain({ slug: "eng", name: "Other", description: "Other" })
      ).toThrow();
    });
  });

  describe("addCategory / getCategories", () => {
    beforeEach(() => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
    });

    it("returns empty array when no categories exist for a domain", () => {
      expect(store.getCategories("eng")).toEqual([]);
    });

    it("adds and retrieves categories for a domain", () => {
      store.addCategory("eng", { slug: "features", name: "Features", description: "Feature patterns" });
      store.addCategory("eng", { slug: "bugs", name: "Bugs", description: "Bug patterns" });

      const categories = store.getCategories("eng");
      expect(categories).toHaveLength(2);

      const slugs = categories.map((c) => c.slug).sort();
      expect(slugs).toEqual(["bugs", "features"]);
    });

    it("returns category metadata correctly", () => {
      store.addCategory("eng", { slug: "features", name: "Features", description: "Feature patterns" });

      const categories = store.getCategories("eng");
      expect(categories[0].name).toBe("Features");
      expect(categories[0].description).toBe("Feature patterns");
      expect(categories[0].patterns).toEqual([]);
    });

    it("returns empty array for unknown domain", () => {
      expect(store.getCategories("nonexistent")).toEqual([]);
    });
  });

  describe("addPattern / getPatterns", () => {
    beforeEach(() => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Feature patterns" });
      store.addCategory("eng", { slug: "bugs", name: "Bugs", description: "Bug patterns" });
    });

    it("adds and retrieves patterns for a category", () => {
      store.addPattern("eng", "features", {
        label: "create-feature",
        description: "Create a feature",
        intention: "User wants a feature",
        template: "# Feature: {{name}}",
      });

      const patterns = store.getPatterns("eng", ["features"]);
      expect(patterns).toHaveLength(1);
      expect(patterns[0].label).toBe("create-feature");
      expect(patterns[0].description).toBe("Create a feature");
      expect(patterns[0].intention).toBe("User wants a feature");
      expect(patterns[0].template).toBe("# Feature: {{name}}");
    });

    it("returns patterns from multiple categories", () => {
      store.addPattern("eng", "features", {
        label: "create-feature",
        description: "Create a feature",
        intention: "User wants a feature",
        template: "# Feature",
      });
      store.addPattern("eng", "bugs", {
        label: "report-bug",
        description: "Report a bug",
        intention: "User found a bug",
        template: "# Bug",
      });

      const patterns = store.getPatterns("eng", ["features", "bugs"]);
      expect(patterns).toHaveLength(2);
      const labels = patterns.map((p) => p.label).sort();
      expect(labels).toEqual(["create-feature", "report-bug"]);
    });

    it("returns empty array for unknown domain", () => {
      expect(store.getPatterns("nonexistent", ["features"])).toEqual([]);
    });

    it("returns empty array for unknown categories", () => {
      expect(store.getPatterns("eng", ["nonexistent"])).toEqual([]);
    });

    it("ignores unknown categories and returns known ones", () => {
      store.addPattern("eng", "features", {
        label: "create-feature",
        description: "Create a feature",
        intention: "User wants a feature",
        template: "# Feature",
      });

      const patterns = store.getPatterns("eng", ["features", "nonexistent"]);
      expect(patterns).toHaveLength(1);
      expect(patterns[0].label).toBe("create-feature");
    });
  });

  describe("getDomain includes categories with patterns", () => {
    it("returns full domain with nested categories and patterns", () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Feature patterns" });
      store.addPattern("eng", "features", {
        label: "create-feature",
        description: "Create a feature",
        intention: "User wants a feature",
        template: "# Feature: {{name}}",
      });

      const domain = store.getDomain("eng");
      expect(domain).toBeDefined();
      expect(domain!.categories).toHaveLength(1);
      expect(domain!.categories[0].slug).toBe("features");
      expect(domain!.categories[0].patterns).toHaveLength(1);
      expect(domain!.categories[0].patterns[0].label).toBe("create-feature");
    });
  });
});
