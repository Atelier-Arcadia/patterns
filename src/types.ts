/**
 * A spell maps an intention to a structured prompt template.
 */
export interface Spell {
  label: string;
  description: string;
  intention: string;
  template: string;
}

/**
 * A spell with its database id, used for update/delete operations.
 */
export interface SpellWithId extends Spell {
  id: number;
}

/**
 * A category groups related spells within a domain.
 */
export interface Category {
  name: string;
  slug: string;
  description: string;
  spells: Spell[];
}

/**
 * A domain is a top-level knowledge area containing categories of spells.
 */
export interface Domain {
  name: string;
  slug: string;
  description: string;
  categories: Category[];
}

/**
 * A submission is a proposed spell change from an anonymous contributor.
 * Type 'new' proposes adding a spell to a domain/category.
 * Type 'modify' proposes changes to an existing spell.
 */
export interface Submission {
  id: number;
  type: "new" | "modify";
  status: "pending" | "accepted" | "rejected";
  targetSpellId: number | null;
  domainSlug: string | null;
  categorySlug: string | null;
  label: string;
  description: string;
  intention: string;
  template: string;
  source: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

/**
 * Input for creating a new submission (id, status, timestamps are auto-generated).
 */
export interface SubmissionInput {
  type: "new" | "modify";
  targetSpellId?: number;
  domainSlug?: string;
  categorySlug?: string;
  label: string;
  description: string;
  intention: string;
  template: string;
  source?: string;
}

/**
 * Common query interface for spell storage backends.
 */
export interface Grimoire {
  getDomains(): Domain[];
  getDomain(slug: string): Domain | undefined;
  getCategories(domainSlug: string): Category[];
  getSpells(domainSlug: string, categorySlugs: string[]): Spell[];
}

/**
 * Extended store interface that includes submission capabilities.
 * Used by MCP tools that need to create suggestions.
 */
/**
 * Describes what new entities would be created if a submission were approved.
 */
export interface SubmissionImpact {
  newDomain: { slug: string; name: string } | null;
  newCategory: { slug: string; name: string } | null;
}

export interface SubmissionStore {
  addSubmission(input: SubmissionInput): number;
  getSubmission(id: number): Submission | undefined;
  getSubmissions(status?: "pending" | "accepted" | "rejected"): Submission[];
}
