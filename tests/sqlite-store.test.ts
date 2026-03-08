import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteGrimoire } from "../src/sqlite-store.js";
import type { Domain, Category, Spell } from "../src/types.js";

describe("SqliteGrimoire", () => {
  let store: SqliteGrimoire;

  beforeEach(() => {
    store = new SqliteGrimoire(":memory:");
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
      store.addDomain({ slug: "engineering", name: "Engineering", description: "Eng spells" });

      const domains = store.getDomains();
      expect(domains).toHaveLength(1);
      expect(domains[0].slug).toBe("engineering");
      expect(domains[0].name).toBe("Engineering");
      expect(domains[0].description).toBe("Eng spells");
      expect(domains[0].categories).toEqual([]);
    });

    it("retrieves a domain by slug", () => {
      store.addDomain({ slug: "engineering", name: "Engineering", description: "Eng spells" });

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
      store.addCategory("eng", { slug: "features", name: "Features", description: "Feature spells" });
      store.addCategory("eng", { slug: "bugs", name: "Bugs", description: "Bug spells" });

      const categories = store.getCategories("eng");
      expect(categories).toHaveLength(2);

      const slugs = categories.map((c) => c.slug).sort();
      expect(slugs).toEqual(["bugs", "features"]);
    });

    it("returns category metadata correctly", () => {
      store.addCategory("eng", { slug: "features", name: "Features", description: "Feature spells" });

      const categories = store.getCategories("eng");
      expect(categories[0].name).toBe("Features");
      expect(categories[0].description).toBe("Feature spells");
      expect(categories[0].spells).toEqual([]);
    });

    it("returns empty array for unknown domain", () => {
      expect(store.getCategories("nonexistent")).toEqual([]);
    });
  });

  describe("addSpell / getSpells", () => {
    beforeEach(() => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Feature spells" });
      store.addCategory("eng", { slug: "bugs", name: "Bugs", description: "Bug spells" });
    });

    it("adds and retrieves spells for a category", () => {
      store.addSpell("eng", "features", {
        label: "create-feature",
        description: "Create a feature",
        intention: "User wants a feature",
        template: "# Feature: {{name}}",
      });

      const spells = store.getSpells("eng", ["features"]);
      expect(spells).toHaveLength(1);
      expect(spells[0].label).toBe("create-feature");
      expect(spells[0].description).toBe("Create a feature");
      expect(spells[0].intention).toBe("User wants a feature");
      expect(spells[0].template).toBe("# Feature: {{name}}");
    });

    it("returns spells from multiple categories", () => {
      store.addSpell("eng", "features", {
        label: "create-feature",
        description: "Create a feature",
        intention: "User wants a feature",
        template: "# Feature",
      });
      store.addSpell("eng", "bugs", {
        label: "report-bug",
        description: "Report a bug",
        intention: "User found a bug",
        template: "# Bug",
      });

      const spells = store.getSpells("eng", ["features", "bugs"]);
      expect(spells).toHaveLength(2);
      const labels = spells.map((p) => p.label).sort();
      expect(labels).toEqual(["create-feature", "report-bug"]);
    });

    it("returns empty array for unknown domain", () => {
      expect(store.getSpells("nonexistent", ["features"])).toEqual([]);
    });

    it("returns empty array for unknown categories", () => {
      expect(store.getSpells("eng", ["nonexistent"])).toEqual([]);
    });

    it("ignores unknown categories and returns known ones", () => {
      store.addSpell("eng", "features", {
        label: "create-feature",
        description: "Create a feature",
        intention: "User wants a feature",
        template: "# Feature",
      });

      const spells = store.getSpells("eng", ["features", "nonexistent"]);
      expect(spells).toHaveLength(1);
      expect(spells[0].label).toBe("create-feature");
    });
  });

  describe("getDomain includes categories with spells", () => {
    it("returns full domain with nested categories and spells", () => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Feature spells" });
      store.addSpell("eng", "features", {
        label: "create-feature",
        description: "Create a feature",
        intention: "User wants a feature",
        template: "# Feature: {{name}}",
      });

      const domain = store.getDomain("eng");
      expect(domain).toBeDefined();
      expect(domain!.categories).toHaveLength(1);
      expect(domain!.categories[0].slug).toBe("features");
      expect(domain!.categories[0].spells).toHaveLength(1);
      expect(domain!.categories[0].spells[0].label).toBe("create-feature");
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

    it("cascades to categories and spells", () => {
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });
      store.addSpell("eng", "features", {
        label: "p1",
        description: "d",
        intention: "i",
        template: "t",
      });

      store.deleteDomain("eng");
      expect(store.getCategories("eng")).toEqual([]);
      expect(store.getSpells("eng", ["features"])).toEqual([]);
    });

    it("throws for nonexistent domain", () => {
      expect(() => store.deleteDomain("nonexistent")).toThrow();
    });
  });

  describe("updateCategory", () => {
    beforeEach(() => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Feature spells" });
    });

    it("updates category name", () => {
      store.updateCategory("eng", "features", { name: "Feature Requests" });
      const categories = store.getCategories("eng");
      expect(categories[0].name).toBe("Feature Requests");
      expect(categories[0].description).toBe("Feature spells"); // unchanged
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

    it("cascades to spells", () => {
      store.addSpell("eng", "features", {
        label: "p1",
        description: "d",
        intention: "i",
        template: "t",
      });
      store.deleteCategory("eng", "features");
      expect(store.getSpells("eng", ["features"])).toEqual([]);
    });

    it("throws for nonexistent category", () => {
      expect(() => store.deleteCategory("eng", "nonexistent")).toThrow();
    });
  });

  describe("getSpellsWithIds", () => {
    beforeEach(() => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });
    });

    it("returns spells with numeric ids", () => {
      store.addSpell("eng", "features", {
        label: "p1",
        description: "d1",
        intention: "i1",
        template: "t1",
      });
      store.addSpell("eng", "features", {
        label: "p2",
        description: "d2",
        intention: "i2",
        template: "t2",
      });

      const spells = store.getSpellsWithIds("eng", ["features"]);
      expect(spells).toHaveLength(2);
      expect(spells[0]).toHaveProperty("id");
      expect(typeof spells[0].id).toBe("number");
      expect(spells[0].label).toBe("p1");
      expect(spells[1].label).toBe("p2");
    });

    it("returns empty array for unknown domain", () => {
      expect(store.getSpellsWithIds("nonexistent", ["features"])).toEqual([]);
    });
  });

  describe("updateSpell", () => {
    let spellId: number;

    beforeEach(() => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });
      store.addSpell("eng", "features", {
        label: "p1",
        description: "Original desc",
        intention: "Original intention",
        template: "Original template",
      });
      const spells = store.getSpellsWithIds("eng", ["features"]);
      spellId = spells[0].id;
    });

    it("updates spell label", () => {
      store.updateSpell(spellId, { label: "new-label" });
      const spells = store.getSpellsWithIds("eng", ["features"]);
      expect(spells[0].label).toBe("new-label");
      expect(spells[0].description).toBe("Original desc"); // unchanged
    });

    it("updates spell description", () => {
      store.updateSpell(spellId, { description: "New desc" });
      const spells = store.getSpellsWithIds("eng", ["features"]);
      expect(spells[0].description).toBe("New desc");
    });

    it("updates spell intention", () => {
      store.updateSpell(spellId, { intention: "New intention" });
      const spells = store.getSpellsWithIds("eng", ["features"]);
      expect(spells[0].intention).toBe("New intention");
    });

    it("updates spell template", () => {
      store.updateSpell(spellId, { template: "New template" });
      const spells = store.getSpellsWithIds("eng", ["features"]);
      expect(spells[0].template).toBe("New template");
    });

    it("updates multiple fields at once", () => {
      store.updateSpell(spellId, { label: "x", description: "y", intention: "z", template: "w" });
      const spells = store.getSpellsWithIds("eng", ["features"]);
      expect(spells[0].label).toBe("x");
      expect(spells[0].description).toBe("y");
      expect(spells[0].intention).toBe("z");
      expect(spells[0].template).toBe("w");
    });

    it("throws for nonexistent spell id", () => {
      expect(() => store.updateSpell(99999, { label: "x" })).toThrow();
    });
  });

  describe("deleteSpell", () => {
    let spellId: number;

    beforeEach(() => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });
      store.addSpell("eng", "features", {
        label: "p1",
        description: "d",
        intention: "i",
        template: "t",
      });
      const spells = store.getSpellsWithIds("eng", ["features"]);
      spellId = spells[0].id;
    });

    it("deletes a spell by id", () => {
      store.deleteSpell(spellId);
      const spells = store.getSpells("eng", ["features"]);
      expect(spells).toHaveLength(0);
    });

    it("throws for nonexistent spell id", () => {
      expect(() => store.deleteSpell(99999)).toThrow();
    });

    it("only deletes the targeted spell", () => {
      store.addSpell("eng", "features", {
        label: "p2",
        description: "d2",
        intention: "i2",
        template: "t2",
      });

      store.deleteSpell(spellId);
      const spells = store.getSpells("eng", ["features"]);
      expect(spells).toHaveLength(1);
      expect(spells[0].label).toBe("p2");
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
        label: "proposed-spell",
        description: "A proposed spell",
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
      expect(sub!.targetSpellId).toBeNull();
      expect(sub!.label).toBe("proposed-spell");
      expect(sub!.description).toBe("A proposed spell");
      expect(sub!.intention).toBe("User wants to propose");
      expect(sub!.template).toBe("# Proposed");
      expect(sub!.submittedAt).toBeDefined();
      expect(sub!.reviewedAt).toBeNull();
    });

    it("creates a 'modify' submission referencing an existing spell", () => {
      store.addSpell("eng", "features", {
        label: "existing",
        description: "d",
        intention: "i",
        template: "t",
      });
      const spellId = store.getSpellsWithIds("eng", ["features"])[0].id;

      const id = store.addSubmission({
        type: "modify",
        targetSpellId: spellId,
        label: "improved-existing",
        description: "Better description",
        intention: "Better intention",
        template: "Better template",
      });

      const sub = store.getSubmission(id);
      expect(sub!.type).toBe("modify");
      expect(sub!.targetSpellId).toBe(spellId);
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

    it("stores and retrieves source field when provided", () => {
      const id = store.addSubmission({
        type: "new",
        domainSlug: "eng",
        categorySlug: "features",
        label: "sourced-spell",
        description: "d",
        intention: "i",
        template: "t",
        source: "mcp:claude-code:user123",
      });

      const sub = store.getSubmission(id);
      expect(sub).toBeDefined();
      expect(sub!.source).toBe("mcp:claude-code:user123");
    });

    it("defaults source to null when not provided", () => {
      const id = store.addSubmission({
        type: "new",
        domainSlug: "eng",
        categorySlug: "features",
        label: "no-source",
        description: "d",
        intention: "i",
        template: "t",
      });

      const sub = store.getSubmission(id);
      expect(sub!.source).toBeNull();
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

      // Spell should NOT have been created
      const spells = store.getSpells("eng", ["features"]);
      expect(spells).toHaveLength(0);
    });

    it("accepts a 'new' submission — creates the spell", () => {
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

      // Spell should have been created
      const spells = store.getSpells("eng", ["features"]);
      expect(spells).toHaveLength(1);
      expect(spells[0].label).toBe("accepted-new");
      expect(spells[0].description).toBe("Accepted desc");
      expect(spells[0].intention).toBe("Accepted intention");
      expect(spells[0].template).toBe("Accepted template");
    });

    it("accepts a 'modify' submission — updates the target spell", () => {
      store.addSpell("eng", "features", {
        label: "original",
        description: "Original desc",
        intention: "Original intention",
        template: "Original template",
      });
      const spellId = store.getSpellsWithIds("eng", ["features"])[0].id;

      const id = store.addSubmission({
        type: "modify",
        targetSpellId: spellId,
        label: "modified",
        description: "Modified desc",
        intention: "Modified intention",
        template: "Modified template",
      });

      store.reviewSubmission(id, "accepted");

      const sub = store.getSubmission(id);
      expect(sub!.status).toBe("accepted");

      // Spell should have been updated
      const spells = store.getSpellsWithIds("eng", ["features"]);
      expect(spells).toHaveLength(1);
      expect(spells[0].label).toBe("modified");
      expect(spells[0].description).toBe("Modified desc");
      expect(spells[0].intention).toBe("Modified intention");
      expect(spells[0].template).toBe("Modified template");
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

    it("auto-creates domain and category when accepting a 'new' submission with nonexistent domain", () => {
      const id = store.addSubmission({
        type: "new",
        domainSlug: "new-domain",
        categorySlug: "new-cat",
        label: "s1",
        description: "d",
        intention: "i",
        template: "t",
      });

      store.reviewSubmission(id, "accepted");

      const sub = store.getSubmission(id);
      expect(sub!.status).toBe("accepted");

      const domain = store.getDomain("new-domain");
      expect(domain).toBeDefined();
      expect(domain!.name).toBe("New Domain");
      expect(domain!.description).toBe("Auto-created domain");

      const categories = store.getCategories("new-domain");
      expect(categories).toHaveLength(1);
      expect(categories[0].slug).toBe("new-cat");
      expect(categories[0].name).toBe("New Cat");
      expect(categories[0].description).toBe("Auto-created category");

      const spells = store.getSpells("new-domain", ["new-cat"]);
      expect(spells).toHaveLength(1);
      expect(spells[0].label).toBe("s1");
    });

    it("auto-creates only category when domain exists but category does not", () => {
      const id = store.addSubmission({
        type: "new",
        domainSlug: "eng",
        categorySlug: "new-cat",
        label: "s1",
        description: "d",
        intention: "i",
        template: "t",
      });

      store.reviewSubmission(id, "accepted");

      const categories = store.getCategories("eng");
      expect(categories).toHaveLength(2); // "features" from beforeEach + "new-cat"
      const newCat = categories.find((c) => c.slug === "new-cat");
      expect(newCat).toBeDefined();
      expect(newCat!.name).toBe("New Cat");

      const spells = store.getSpells("eng", ["new-cat"]);
      expect(spells).toHaveLength(1);
    });

    it("auto-creates both domain and category when both are nonexistent", () => {
      const id = store.addSubmission({
        type: "new",
        domainSlug: "design",
        categorySlug: "ui-spells",
        label: "button-states",
        description: "d",
        intention: "i",
        template: "t",
      });

      store.reviewSubmission(id, "accepted");

      const domain = store.getDomain("design");
      expect(domain).toBeDefined();
      expect(domain!.name).toBe("Design");

      const categories = store.getCategories("design");
      expect(categories).toHaveLength(1);
      expect(categories[0].slug).toBe("ui-spells");
      expect(categories[0].name).toBe("Ui Spells");

      const spells = store.getSpells("design", ["ui-spells"]);
      expect(spells).toHaveLength(1);
    });

    it("does not auto-create when rejecting a submission with nonexistent domain", () => {
      const id = store.addSubmission({
        type: "new",
        domainSlug: "should-not-exist",
        categorySlug: "should-not-exist",
        label: "s1",
        description: "d",
        intention: "i",
        template: "t",
      });

      store.reviewSubmission(id, "rejected");

      expect(store.getDomain("should-not-exist")).toBeUndefined();
    });

    it("uses title-cased slug as name for auto-created domain", () => {
      const id = store.addSubmission({
        type: "new",
        domainSlug: "my-cool-domain",
        categorySlug: "some-cat",
        label: "s1",
        description: "d",
        intention: "i",
        template: "t",
      });

      store.reviewSubmission(id, "accepted");

      const domain = store.getDomain("my-cool-domain");
      expect(domain!.name).toBe("My Cool Domain");
    });

    it("uses title-cased slug as name for auto-created category", () => {
      const id = store.addSubmission({
        type: "new",
        domainSlug: "eng",
        categorySlug: "my-cool-category",
        label: "s1",
        description: "d",
        intention: "i",
        template: "t",
      });

      store.reviewSubmission(id, "accepted");

      const categories = store.getCategories("eng");
      const newCat = categories.find((c) => c.slug === "my-cool-category");
      expect(newCat!.name).toBe("My Cool Category");
    });
  });

  describe("getSubmissionImpact", () => {
    beforeEach(() => {
      store.addDomain({ slug: "eng", name: "Engineering", description: "Eng" });
      store.addCategory("eng", { slug: "features", name: "Features", description: "Features" });
    });

    it("returns null impacts when domain and category both exist", () => {
      const id = store.addSubmission({
        type: "new",
        domainSlug: "eng",
        categorySlug: "features",
        label: "s1",
        description: "d",
        intention: "i",
        template: "t",
      });

      const impact = store.getSubmissionImpact(id);
      expect(impact.newDomain).toBeNull();
      expect(impact.newCategory).toBeNull();
    });

    it("returns newDomain and newCategory when domain does not exist", () => {
      const id = store.addSubmission({
        type: "new",
        domainSlug: "new-domain",
        categorySlug: "new-cat",
        label: "s1",
        description: "d",
        intention: "i",
        template: "t",
      });

      const impact = store.getSubmissionImpact(id);
      expect(impact.newDomain).toEqual({ slug: "new-domain", name: "New Domain" });
      expect(impact.newCategory).toEqual({ slug: "new-cat", name: "New Cat" });
    });

    it("returns only newCategory when domain exists but category does not", () => {
      const id = store.addSubmission({
        type: "new",
        domainSlug: "eng",
        categorySlug: "new-cat",
        label: "s1",
        description: "d",
        intention: "i",
        template: "t",
      });

      const impact = store.getSubmissionImpact(id);
      expect(impact.newDomain).toBeNull();
      expect(impact.newCategory).toEqual({ slug: "new-cat", name: "New Cat" });
    });

    it("returns null impacts for modify submissions", () => {
      store.addSpell("eng", "features", {
        label: "p1",
        description: "d",
        intention: "i",
        template: "t",
      });
      const spellId = store.getSpellsWithIds("eng", ["features"])[0].id;

      const id = store.addSubmission({
        type: "modify",
        targetSpellId: spellId,
        label: "improved",
        description: "d",
        intention: "i",
        template: "t",
      });

      const impact = store.getSubmissionImpact(id);
      expect(impact.newDomain).toBeNull();
      expect(impact.newCategory).toBeNull();
    });

    it("returns null impacts for already-reviewed submissions", () => {
      const id = store.addSubmission({
        type: "new",
        domainSlug: "new-domain",
        categorySlug: "new-cat",
        label: "s1",
        description: "d",
        intention: "i",
        template: "t",
      });

      store.reviewSubmission(id, "rejected");

      const impact = store.getSubmissionImpact(id);
      expect(impact.newDomain).toBeNull();
      expect(impact.newCategory).toBeNull();
    });
  });
});
