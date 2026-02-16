import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SqlitePatternStore } from "../src/sqlite-store.js";
import { createDiscoverHandler, createMatchHandler, createSuggestHandler } from "../src/tools.js";

function seedTestStore(store: SqlitePatternStore): void {
  store.addDomain({ slug: "test-domain", name: "Test Domain", description: "A test domain for unit tests" });
  store.addDomain({ slug: "another-domain", name: "Another Domain", description: "A second domain for listing tests" });
  store.addCategory("test-domain", { slug: "widgets", name: "Widgets", description: "Patterns for widget creation" });
  store.addCategory("test-domain", { slug: "gadgets", name: "Gadgets", description: "Patterns for gadget operations" });
  store.addPattern("test-domain", "widgets", {
    label: "create-widget",
    description: "Create a new widget from a description",
    intention: "The user wants to create a widget",
    template: "# Widget: {{name}}\n## Purpose\n{{purpose}}\n",
  });
  store.addPattern("test-domain", "widgets", {
    label: "update-widget",
    description: "Update an existing widget",
    intention: "The user wants to modify a widget",
    template: "# Update Widget: {{name}}\n## Changes\n{{changes}}\n",
  });
  store.addPattern("test-domain", "gadgets", {
    label: "build-gadget",
    description: "Build a gadget from specifications",
    intention: "The user wants to build a gadget",
    template: "# Gadget: {{name}}\n## Specs\n{{specs}}\n",
  });
}

describe("Tool Handlers", () => {
  let store: SqlitePatternStore;
  let discoverHandler: ReturnType<typeof createDiscoverHandler>;
  let matchHandler: ReturnType<typeof createMatchHandler>;
  let suggestHandler: ReturnType<typeof createSuggestHandler>;

  beforeAll(() => {
    store = new SqlitePatternStore(":memory:");
    store.initialize();
    seedTestStore(store);
    discoverHandler = createDiscoverHandler(store);
    matchHandler = createMatchHandler(store);
    suggestHandler = createSuggestHandler(store);
  });

  afterAll(() => {
    store.close();
  });

  describe("discover", () => {
    it("returns categories for a known domain", async () => {
      const result = await discoverHandler({ domain: "test-domain" });
      expect(result.isError).toBeFalsy();

      const content = result.content[0];
      expect(content.type).toBe("text");

      const data = JSON.parse((content as { type: "text"; text: string }).text);
      expect(data).toHaveLength(2);
      expect(data.map((c: any) => c.slug).sort()).toEqual(["gadgets", "widgets"]);
    });

    it("returns each category with name, slug, and description", async () => {
      const result = await discoverHandler({ domain: "test-domain" });
      const data = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
      const widgets = data.find((c: any) => c.slug === "widgets");

      expect(widgets.name).toBe("Widgets");
      expect(widgets.slug).toBe("widgets");
      expect(widgets.description).toBe("Patterns for widget creation");
    });

    it("returns error for unknown domain", async () => {
      const result = await discoverHandler({ domain: "nonexistent" });
      expect(result.isError).toBe(true);

      const text = (result.content[0] as { type: "text"; text: string }).text;
      expect(text).toContain("nonexistent");
    });

    it("returns all domains when called with no arguments", async () => {
      const result = await discoverHandler({});
      expect(result.isError).toBeFalsy();

      const data = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
      expect(data).toHaveLength(2);
      const slugs = data.map((d: any) => d.slug).sort();
      expect(slugs).toEqual(["another-domain", "test-domain"]);
    });

    it("returns each domain with name, slug, and description when no arguments given", async () => {
      const result = await discoverHandler({});
      const data = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
      const testDomain = data.find((d: any) => d.slug === "test-domain");

      expect(testDomain.name).toBe("Test Domain");
      expect(testDomain.slug).toBe("test-domain");
      expect(testDomain.description).toBe("A test domain for unit tests");
    });
  });

  describe("match", () => {
    it("returns patterns for valid domain and categories", async () => {
      const result = await matchHandler({
        domain: "test-domain",
        categories: ["widgets"],
      });
      expect(result.isError).toBeFalsy();

      const data = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
      expect(data).toHaveLength(2);
      expect(data[0].label).toBe("create-widget");
    });

    it("returns patterns from multiple categories", async () => {
      const result = await matchHandler({
        domain: "test-domain",
        categories: ["widgets", "gadgets"],
      });
      const data = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
      expect(data).toHaveLength(3);
    });

    it("returns error for unknown domain", async () => {
      const result = await matchHandler({
        domain: "nonexistent",
        categories: ["widgets"],
      });
      expect(result.isError).toBe(true);
    });

    it("returns empty array when no categories match", async () => {
      const result = await matchHandler({
        domain: "test-domain",
        categories: ["nonexistent"],
      });
      expect(result.isError).toBeFalsy();

      const data = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
      expect(data).toEqual([]);
    });

    it("includes full pattern data in results", async () => {
      const result = await matchHandler({
        domain: "test-domain",
        categories: ["gadgets"],
      });
      const data = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
      expect(data[0]).toHaveProperty("label");
      expect(data[0]).toHaveProperty("description");
      expect(data[0]).toHaveProperty("intention");
      expect(data[0]).toHaveProperty("template");
    });
  });

  describe("suggest", () => {
    it("creates a 'new' pattern suggestion with source", async () => {
      const result = await suggestHandler({
        type: "new",
        domainSlug: "test-domain",
        categorySlug: "widgets",
        label: "suggested-widget",
        description: "A suggested widget pattern",
        intention: "User wants to suggest a widget",
        template: "# Suggested Widget\n{{content}}",
        source: "mcp:test-client",
      });

      expect(result.isError).toBeFalsy();

      const data = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
      expect(data.type).toBe("new");
      expect(data.status).toBe("pending");
      expect(data.label).toBe("suggested-widget");
      expect(data.source).toBe("mcp:test-client");
      expect(data.domainSlug).toBe("test-domain");
      expect(data.categorySlug).toBe("widgets");
    });

    it("creates a 'modify' pattern suggestion with source", async () => {
      const patterns = store.getPatternsWithIds("test-domain", ["widgets"]);
      const targetId = patterns[0].id;

      const result = await suggestHandler({
        type: "modify",
        targetPatternId: targetId,
        label: "improved-widget",
        description: "An improved widget pattern",
        intention: "Better widget creation",
        template: "# Improved Widget\n{{content}}",
        source: "mcp:another-client",
      });

      expect(result.isError).toBeFalsy();

      const data = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
      expect(data.type).toBe("modify");
      expect(data.status).toBe("pending");
      expect(data.targetPatternId).toBe(targetId);
      expect(data.source).toBe("mcp:another-client");
    });

    it("returns error when source is missing", async () => {
      const result = await suggestHandler({
        type: "new",
        domainSlug: "test-domain",
        categorySlug: "widgets",
        label: "no-source",
        description: "d",
        intention: "i",
        template: "t",
        source: "",
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { type: "text"; text: string }).text;
      expect(text).toContain("source");
    });

    it("returns error when required fields are missing", async () => {
      const result = await suggestHandler({
        type: "new",
        domainSlug: "test-domain",
        categorySlug: "widgets",
        label: "",
        description: "d",
        intention: "i",
        template: "t",
        source: "mcp:test",
      });

      expect(result.isError).toBe(true);
    });

    it("returns error for invalid type", async () => {
      const result = await suggestHandler({
        type: "invalid" as any,
        label: "x",
        description: "d",
        intention: "i",
        template: "t",
        source: "mcp:test",
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { type: "text"; text: string }).text;
      expect(text).toContain("type");
    });

    it("suggestion appears in pending submissions", async () => {
      const beforeCount = store.getSubmissions("pending").length;

      await suggestHandler({
        type: "new",
        domainSlug: "test-domain",
        categorySlug: "gadgets",
        label: "count-check",
        description: "d",
        intention: "i",
        template: "t",
        source: "mcp:count-test",
      });

      const afterCount = store.getSubmissions("pending").length;
      expect(afterCount).toBe(beforeCount + 1);
    });
  });
});
