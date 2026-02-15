/**
 * A pattern maps an intention to a structured prompt template.
 */
export interface Pattern {
  label: string;
  description: string;
  intention: string;
  template: string;
}

/**
 * A pattern with its database id, used for update/delete operations.
 */
export interface PatternWithId extends Pattern {
  id: number;
}

/**
 * A category groups related patterns within a domain.
 */
export interface Category {
  name: string;
  slug: string;
  description: string;
  patterns: Pattern[];
}

/**
 * A domain is a top-level knowledge area containing categories of patterns.
 */
export interface Domain {
  name: string;
  slug: string;
  description: string;
  categories: Category[];
}

/**
 * A submission is a proposed pattern change from an anonymous contributor.
 * Type 'new' proposes adding a pattern to a domain/category.
 * Type 'modify' proposes changes to an existing pattern.
 */
export interface Submission {
  id: number;
  type: "new" | "modify";
  status: "pending" | "accepted" | "rejected";
  targetPatternId: number | null;
  domainSlug: string | null;
  categorySlug: string | null;
  label: string;
  description: string;
  intention: string;
  template: string;
  submittedAt: string;
  reviewedAt: string | null;
}

/**
 * Input for creating a new submission (id, status, timestamps are auto-generated).
 */
export interface SubmissionInput {
  type: "new" | "modify";
  targetPatternId?: number;
  domainSlug?: string;
  categorySlug?: string;
  label: string;
  description: string;
  intention: string;
  template: string;
}

/**
 * Common query interface for pattern storage backends.
 */
export interface PatternStore {
  getDomains(): Domain[];
  getDomain(slug: string): Domain | undefined;
  getCategories(domainSlug: string): Category[];
  getPatterns(domainSlug: string, categorySlugs: string[]): Pattern[];
}
