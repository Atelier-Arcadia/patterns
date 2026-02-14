import type { PatternStore } from "./types.js";

interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/**
 * Creates a handler for the `discover` tool.
 * Given a domain slug, returns its categories.
 */
export function createDiscoverHandler(db: PatternStore) {
  return async (args: { domain: string }): Promise<ToolResult> => {
    const domain = db.getDomain(args.domain);
    if (!domain) {
      return {
        content: [
          {
            type: "text",
            text: `Domain not found: "${args.domain}". Use a valid domain slug.`,
          },
        ],
        isError: true,
      };
    }

    const categories = domain.categories.map((c) => ({
      name: c.name,
      slug: c.slug,
      description: c.description,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(categories, null, 2) }],
    };
  };
}

/**
 * Creates a handler for the `match` tool.
 * Given a domain slug and category slugs, returns matching patterns.
 */
export function createMatchHandler(db: PatternStore) {
  return async (args: {
    domain: string;
    categories: string[];
  }): Promise<ToolResult> => {
    const domain = db.getDomain(args.domain);
    if (!domain) {
      return {
        content: [
          {
            type: "text",
            text: `Domain not found: "${args.domain}". Use a valid domain slug.`,
          },
        ],
        isError: true,
      };
    }

    const patterns = db.getPatterns(args.domain, args.categories);

    return {
      content: [{ type: "text", text: JSON.stringify(patterns, null, 2) }],
    };
  };
}
