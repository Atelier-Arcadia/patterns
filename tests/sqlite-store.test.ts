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

  // === NEW: Mutation methods ===

  describe("updateDomain", () => {
    beforeEach(() => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
    });

    it("updates domain name", () => {
      store.updateDomain("eng", { name: "Software Engineering" });
      const domain = store.getDomain("eng");
      expect(domain!.name).toBe("Software Engineering");
      expect(domain!.description).toBe("Eng"); // unchanged
    });

    it("updates domain description", () => {
      store.updateDomain("eng", { description: "Updated description" });
      const domain = store.getDomain("eng");
      expect(domain!.name).toBe("Engineering"); // unchanged
      expect(domain!.description).toBe("Updated description");
    });

    it("updates both name and description", () => {
      store.updateDomain("eng", { name: "New Name", description: "New Desc" });
      const domain = store.getDomain("eng");
      expect(domain!.name).toBe("New Name");
      expect(domain!.description).toBe("New Desc");
    });

    it("throws for nonexistent domain", () => {
      expect(() => store.updateDomain("nonexistent", { name: "X" })).toThrow();
    });
  });

  describe("deleteDomain", () => {
    beforeEach(() => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
    });

    it("deletes a domain", () => {
      store.deleteDomain("eng");
      expect(store.getDomain("eng")).toBeUndefined();
      expect(store.getDomains()).toHaveLength(0);
    });

    it("cascades to categories and patterns", () => {
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });
      store.addPattern("eng", "features", {
        label: "p1",
        description: "d",
        intention: "i",
        template: "t",
      });

      store.deleteDomain("eng");
      expect(store.getCategories("eng")).toEqual([]);
      expect(store.getPatterns("eng", ["features"])).toEqual([]);
    });

    it("throws for nonexistent domain", () => {
      expect(() => store.deleteDomain("nonexistent")).toThrow();
    });
  });

  describe("updateCategory", () => {
    beforeEach(() => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Feature patterns" });
    });

    it("updates category name", () => {
      store.updateCategory("eng", "features", { name: "Feature Requests" });
      const categories = store.getCategories("eng");
      expect(categories[0].name).toBe("Feature Requests");
      expect(categories[0].description).toBe("Feature patterns"); // unchanged
    });

    it("updates category description", () => {
      store.updateCategory("eng", "features", { description: "Updated" });
      const categories = store.getCategories("eng");
      expect(categories[0].description).toBe("Updated");
      expect(categories[0].name).toBe("Features"); // unchanged
    });

    it("throws for nonexistent domain", () => {
      expect(() => store.updateCategory("nonexistent", "features", { name: "X" })).toThrow();
    });

    it("throws for nonexistent category", () => {
      expect(() => store.updateCategory("eng", "nonexistent", { name: "X" })).toThrow();
    });
  });

  describe("deleteCategory", () => {
    beforeEach(() => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });
    });

    it("deletes a category", () => {
      store.deleteCategory("eng", "features");
      expect(store.getCategories("eng")).toHaveLength(0);
    });

    it("cascades to patterns", () => {
      store.addPattern("eng", "features", {
        label: "p1",
        description: "d",
        intention: "i",
        template: "t",
      });
      store.deleteCategory("eng", "features");
      expect(store.getPatterns("eng", ["features"])).toEqual([]);
    });

    it("throws for nonexistent category", () => {
      expect(() => store.deleteCategory("eng", "nonexistent")).toThrow();
    });
  });

  describe("getPatternsWithIds", () => {
    beforeEach(() => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });
    });

    it("returns patterns with numeric ids", () => {
      store.addPattern("eng", "features", {
        label: "p1",
        description: "d1",
        intention: "i1",
        template: "t1",
      });
      store.addPattern("eng", "features", {
        label: "p2",
        description: "d2",
        intention: "i2",
        template: "t2",
      });

      const patterns = store.getPatternsWithIds("eng", ["features"]);
      expect(patterns).toHaveLength(2);
      expect(patterns[0]).toHaveProperty("id");
      expect(typeof patterns[0].id).toBe("number");
      expect(patterns[0].label).toBe("p1");
      expect(patterns[1].label).toBe("p2");
    });

    it("returns empty array for unknown domain", () => {
      expect(store.getPatternsWithIds("nonexistent", ["features"])).toEqual([]);
    });
  });

  describe("updatePattern", () => {
    let patternId: number;

    beforeEach(() => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });
      store.addPattern("eng", "features", {
        label: "p1",
        description: "Original desc",
        intention: "Original intention",
        template: "Original template",
      });
      const patterns = store.getPatternsWithIds("eng", ["features"]);
      patternId = patterns[0].id;
    });

    it("updates pattern label", () => {
      store.updatePattern(patternId, { label: "new-label" });
      const patterns = store.getPatternsWithIds("eng", ["features"]);
      expect(patterns[0].label).toBe("new-label");
      expect(patterns[0].description).toBe("Original desc"); // unchanged
    });

    it("updates pattern description", () => {
      store.updatePattern(patternId, { description: "New desc" });
      const patterns = store.getPatternsWithIds("eng", ["features"]);
      expect(patterns[0].description).toBe("New desc");
    });

    it("updates pattern intention", () => {
      store.updatePattern(patternId, { intention: "New intention" });
      const patterns = store.getPatternsWithIds("eng", ["features"]);
      expect(patterns[0].intention).toBe("New intention");
    });

    it("updates pattern template", () => {
      store.updatePattern(patternId, { template: "New template" });
      const patterns = store.getPatternsWithIds("eng", ["features"]);
      expect(patterns[0].template).toBe("New template");
    });

    it("updates multiple fields at once", () => {
      store.updatePattern(patternId, { label: "x", description: "y", intention: "z", template: "w" });
      const patterns = store.getPatternsWithIds("eng", ["features"]);
      expect(patterns[0].label).toBe("x");
      expect(patterns[0].description).toBe("y");
      expect(patterns[0].intention).toBe("z");
      expect(patterns[0].template).toBe("w");
    });

    it("throws for nonexistent pattern id", () => {
      expect(() => store.updatePattern(99999, { label: "x" })).toThrow();
    });
  });

  describe("deletePattern", () => {
    let patternId: number;

    beforeEach(() => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });
      store.addPattern("eng", "features", {
        label: "p1",
        description: "d",
        intention: "i",
        template: "t",
      });
      const patterns = store.getPatternsWithIds("eng", ["features"]);
      patternId = patterns[0].id;
    });

    it("deletes a pattern by id", () => {
      store.deletePattern(patternId);
      const patterns = store.getPatterns("eng", ["features"]);
      expect(patterns).toHaveLength(0);
    });

    it("throws for nonexistent pattern id", () => {
      expect(() => store.deletePattern(99999)).toThrow();
    });

    it("only deletes the targeted pattern", () => {
      store.addPattern("eng", "features", {
        label: "p2",
        description: "d2",
        intention: "i2",
        template: "t2",
      });

      store.deletePattern(patternId);
      const patterns = store.getPatterns("eng", ["features"]);
      expect(patterns).toHaveLength(1);
      expect(patterns[0].label).toBe("p2");
    });
  });

  // === Submissions ===

  describe("addSubmission / getSubmissions / getSubmission", () => {
    beforeEach(() => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });
    });

    it("returns empty array when no submissions exist", () => {
      expect(store.getSubmissions()).toEqual([]);
    });

    it("creates a 'new' submission and retrieves it", () => {
      const id = store.addSubmission({
        type: "new",
        domainSlug: "eng",
        categorySlug: "features",
        label: "proposed-pattern",
        description: "A proposed pattern",
        intention: "User wants to propose",
        template: "# Proposed",
      });

      expect(typeof id).toBe("number");

      const sub = store.getSubmission(id);
      expect(sub).toBeDefined();
      expect(sub!.type).toBe("new");
      expect(sub!.status).toBe("pending");
      expect(sub!.domainSlug).toBe("eng");
      expect(sub!.categorySlug).toBe("features");
      expect(sub!.targetPatternId).toBeNull();
      expect(sub!.label).toBe("proposed-pattern");
      expect(sub!.description).toBe("A proposed pattern");
      expect(sub!.intention).toBe("User wants to propose");
      expect(sub!.template).toBe("# Proposed");
      expect(sub!.submittedAt).toBeDefined();
      expect(sub!.reviewedAt).toBeNull();
    });

    it("creates a 'modify' submission referencing an existing pattern", () => {
      store.addPattern("eng", "features", {
        label: "existing",
        description: "d",
        intention: "i",
        template: "t",
      });
      const patternId = store.getPatternsWithIds("eng", ["features"])[0].id;

      const id = store.addSubmission({
        type: "modify",
        targetPatternId: patternId,
        label: "improved-existing",
        description: "Better description",
        intention: "Better intention",
        template: "Better template",
      });

      const sub = store.getSubmission(id);
      expect(sub!.type).toBe("modify");
      expect(sub!.targetPatternId).toBe(patternId);
      expect(sub!.label).toBe("improved-existing");
    });

    it("returns all submissions via getSubmissions()", () => {
      store.addSubmission({
        type: "new",
        domainSlug: "eng",
        categorySlug: "features",
        label: "s1",
        description: "d",
        intention: "i",
        template: "t",
      });
      store.addSubmission({
        type: "new",
        domainSlug: "eng",
        categorySlug: "features",
        label: "s2",
        description: "d",
        intention: "i",
        template: "t",
      });

      const subs = store.getSubmissions();
      expect(subs).toHaveLength(2);
    });

    it("filters submissions by status", () => {
      store.addSubmission({
        type: "new",
        domainSlug: "eng",
        categorySlug: "features",
        label: "s1",
        description: "d",
        intention: "i",
        template: "t",
      });

      const pending = store.getSubmissions("pending");
      expect(pending).toHaveLength(1);

      const accepted = store.getSubmissions("accepted");
      expect(accepted).toHaveLength(0);
    });

    it("returns undefined for nonexistent submission id", () => {
      expect(store.getSubmission(99999)).toBeUndefined();
    });
  });

  describe("reviewSubmission", () => {
    beforeEach(() => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });
    });

    it("rejects a submission (sets status and reviewedAt)", () => {
      const id = store.addSubmission({
        type: "new",
        domainSlug: "eng",
        categorySlug: "features",
        label: "rejected-one",
        description: "d",
        intention: "i",
        template: "t",
      });

      store.reviewSubmission(id, "rejected");

      const sub = store.getSubmission(id);
      expect(sub!.status).toBe("rejected");
      expect(sub!.reviewedAt).toBeDefined();
      expect(sub!.reviewedAt).not.toBeNull();

      // Pattern should NOT have been created
      const patterns = store.getPatterns("eng", ["features"]);
      expect(patterns).toHaveLength(0);
    });

    it("accepts a 'new' submission — creates the pattern", () => {
      const id = store.addSubmission({
        type: "new",
        domainSlug: "eng",
        categorySlug: "features",
        label: "accepted-new",
        description: "Accepted desc",
        intention: "Accepted intention",
        template: "Accepted template",
      });

      store.reviewSubmission(id, "accepted");

      const sub = store.getSubmission(id);
      expect(sub!.status).toBe("accepted");
      expect(sub!.reviewedAt).not.toBeNull();

      // Pattern should have been created
      const patterns = store.getPatterns("eng", ["features"]);
      expect(patterns).toHaveLength(1);
      expect(patterns[0].label).toBe("accepted-new");
      expect(patterns[0].description).toBe("Accepted desc");
      expect(patterns[0].intention).toBe("Accepted intention");
      expect(patterns[0].template).toBe("Accepted template");
    });

    it("accepts a 'modify' submission — updates the target pattern", () => {
      store.addPattern("eng", "features", {
        label: "original",
        description: "Original desc",
        intention: "Original intention",
        template: "Original template",
      });
      const patternId = store.getPatternsWithIds("eng", ["features"])[0].id;

      const id = store.addSubmission({
        type: "modify",
        targetPatternId: patternId,
        label: "modified",
        description: "Modified desc",
        intention: "Modified intention",
        template: "Modified template",
      });

      store.reviewSubmission(id, "accepted");

      const sub = store.getSubmission(id);
      expect(sub!.status).toBe("accepted");

      // Pattern should have been updated
      const patterns = store.getPatternsWithIds("eng", ["features"]);
      expect(patterns).toHaveLength(1);
      expect(patterns[0].label).toBe("modified");
      expect(patterns[0].description).toBe("Modified desc");
      expect(patterns[0].intention).toBe("Modified intention");
      expect(patterns[0].template).toBe("Modified template");
    });

    it("throws for nonexistent submission id", () => {
      expect(() => store.reviewSubmission(99999, "accepted")).toThrow();
    });

    it("throws when reviewing an already-reviewed submission", () => {
      const id = store.addSubmission({
        type: "new",
        domainSlug: "eng",
        categorySlug: "features",
        label: "s1",
        description: "d",
        intention: "i",
        template: "t",
      });

      store.reviewSubmission(id, "rejected");
      expect(() => store.reviewSubmission(id, "accepted")).toThrow();
    });

    it("throws when accepting a 'new' submission with invalid domain/category", () => {
      const id = store.addSubmission({
        type: "new",
        domainSlug: "nonexistent",
        categorySlug: "features",
        label: "s1",
        description: "d",
        intention: "i",
        template: "t",
      });

      expect(() => store.reviewSubmission(id, "accepted")).toThrow();
    });
  });
});
