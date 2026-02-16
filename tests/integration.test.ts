import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { SqlitePatternStore } from "../src/sqlite-store.js";

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

describe("MCP Integration", () => {
  let client: Client;
  let store: SqlitePatternStore;

  beforeAll(async () => {
    store = new SqlitePatternStore(":memory:");
    store.initialize();
    seedTestStore(store);

    const server = createServer(store);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await client.close();
    store.close();
  });

  it("lists available tools", async () => {
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual(["discover", "match", "suggest"]);
  });

  it("discover tool returns categories for a given domain", async () => {
    const result = await client.callTool({
      name: "discover",
      arguments: { domain: "test-domain" },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse((result.content as any)[0].text);
    expect(data).toHaveLength(2);
  });

  it("discover tool returns all domains when called with no arguments", async () => {
    const result = await client.callTool({
      name: "discover",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse((result.content as any)[0].text);
    expect(data).toHaveLength(2);
    const slugs = data.map((d: any) => d.slug).sort();
    expect(slugs).toEqual(["another-domain", "test-domain"]);
  });

  it("discover tool schema marks domain as optional", async () => {
    const result = await client.listTools();
    const discoverTool = result.tools.find((t) => t.name === "discover");
    expect(discoverTool).toBeDefined();
    // domain should not be in the required array
    const required = (discoverTool!.inputSchema as any).required || [];
    expect(required).not.toContain("domain");
  });

  it("match tool returns patterns", async () => {
    const result = await client.callTool({
      name: "match",
      arguments: { domain: "test-domain", categories: ["widgets"] },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse((result.content as any)[0].text);
    expect(data).toHaveLength(2);
    expect(data[0].label).toBe("create-widget");
  });

  it("end-to-end: discover domains then discover categories then match", async () => {
    // Step 1: Discover all domains
    const domainsResult = await client.callTool({
      name: "discover",
      arguments: {},
    });
    const domains = JSON.parse((domainsResult.content as any)[0].text);
    const testDomain = domains.find((d: any) => d.slug === "test-domain");
    expect(testDomain).toBeDefined();

    // Step 2: Discover categories for the domain
    const categoriesResult = await client.callTool({
      name: "discover",
      arguments: { domain: testDomain.slug },
    });
    const categories = JSON.parse((categoriesResult.content as any)[0].text);
    const categorySlugs = categories.map((c: any) => c.slug);

    // Step 3: Match patterns using discovered categories
    const matchResult = await client.callTool({
      name: "match",
      arguments: { domain: testDomain.slug, categories: categorySlugs },
    });
    const patterns = JSON.parse((matchResult.content as any)[0].text);

    expect(patterns).toHaveLength(3);
    const labels = patterns.map((p: any) => p.label).sort();
    expect(labels).toEqual(["build-gadget", "create-widget", "update-widget"]);
  });

  it("discover returns error for unknown domain", async () => {
    const result = await client.callTool({
      name: "discover",
      arguments: { domain: "nonexistent" },
    });
    expect(result.isError).toBe(true);
  });

  it("suggest tool creates a new pattern submission", async () => {
    const result = await client.callTool({
      name: "suggest",
      arguments: {
        type: "new",
        domainSlug: "test-domain",
        categorySlug: "widgets",
        label: "mcp-suggested-pattern",
        description: "Pattern suggested via MCP",
        intention: "User wants to suggest a pattern from their LLM session",
        template: "# MCP Suggestion\n{{content}}",
        source: "mcp:integration-test",
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse((result.content as any)[0].text);
    expect(data.status).toBe("pending");
    expect(data.label).toBe("mcp-suggested-pattern");
    expect(data.source).toBe("mcp:integration-test");

    // Verify it landed in the store
    const sub = store.getSubmission(data.id);
    expect(sub).toBeDefined();
    expect(sub!.source).toBe("mcp:integration-test");
  });

  it("suggest tool creates a modify submission", async () => {
    const patterns = store.getPatternsWithIds("test-domain", ["widgets"]);
    const targetId = patterns[0].id;

    const result = await client.callTool({
      name: "suggest",
      arguments: {
        type: "modify",
        targetPatternId: targetId,
        label: "improved-create-widget",
        description: "Better widget creation",
        intention: "Improved widget creation flow",
        template: "# Better Widget\n{{content}}",
        source: "mcp:integration-test",
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse((result.content as any)[0].text);
    expect(data.type).toBe("modify");
    expect(data.targetPatternId).toBe(targetId);
  });

  it("suggest tool returns error without source", async () => {
    const result = await client.callTool({
      name: "suggest",
      arguments: {
        type: "new",
        domainSlug: "test-domain",
        categorySlug: "widgets",
        label: "no-source",
        description: "d",
        intention: "i",
        template: "t",
        source: "",
      },
    });

    expect(result.isError).toBe(true);
  });
});
