import type { PatternStore, SubmissionStore } from "./types.js";

interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/**
 * Creates a handler for the `discover` tool.
 * When called with a domain slug, returns its categories.
 * When called with no domain, returns all available domains.
 */
export function createDiscoverHandler(db: PatternStore) {
  return async (args: { domain?: string }): Promise<ToolResult> => {
    // No domain provided — list all domains
    if (!args.domain) {
      const domains = db.getDomains().map((d) => ({
        name: d.name,
        slug: d.slug,
        description: d.description,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(domains, null, 2) }],
      };
    }

    // Domain provided — list categories within it
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

/**
 * Creates a handler for the `suggest` tool.
 * Allows LLM users to submit pattern suggestions (new or edit) with a source identifier.
 */
export function createSuggestHandler(db: PatternStore & SubmissionStore) {
  return async (args: {
    type: string;
    domainSlug?: string;
    categorySlug?: string;
    targetPatternId?: number;
    label: string;
    description: string;
    intention: string;
    template: string;
    source: string;
  }): Promise<ToolResult> => {
    // Validate source
    if (!args.source) {
      return {
        content: [
          {
            type: "text",
            text: "A source identifier is required to attribute the origin of the suggestion.",
          },
        ],
        isError: true,
      };
    }

    // Validate type
    if (args.type !== "new" && args.type !== "modify") {
      return {
        content: [
          {
            type: "text",
            text: `Invalid type: "${args.type}". Must be "new" or "modify".`,
          },
        ],
        isError: true,
      };
    }

    // Validate required pattern fields
    if (!args.label || !args.description || !args.intention || !args.template) {
      return {
        content: [
          {
            type: "text",
            text: "Missing required fields: label, description, intention, and template are all required.",
          },
        ],
        isError: true,
      };
    }

    try {
      const id = db.addSubmission({
        type: args.type,
        targetPatternId: args.targetPatternId,
        domainSlug: args.domainSlug,
        categorySlug: args.categorySlug,
        label: args.label,
        description: args.description,
        intention: args.intention,
        template: args.template,
        source: args.source,
      });

      const submission = db.getSubmission(id);

      return {
        content: [{ type: "text", text: JSON.stringify(submission, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to create suggestion: ${err.message}`,
          },
        ],
        isError: true,
      };
    }
  };
}
