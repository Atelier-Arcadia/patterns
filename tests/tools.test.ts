import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SqlitePatternStore } from "../src/sqlite-store.js";
import { createDiscoverHandler, createMatchHandler } from "../src/tools.js";

function seedTestStore(store: SqlitePatternStore): void {
  store.addDomain({ slug: "test-domain", name: "Test Domain", description: "A test domain for unit tests" });
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

  beforeAll(() => {
    store = new SqlitePatternStore(":memory:");
    store.initialize();
    seedTestStore(store);
    discoverHandler = createDiscoverHandler(store);
    matchHandler = createMatchHandler(store);
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
});
