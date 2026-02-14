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
 * Common query interface for pattern storage backends.
 */
export interface PatternStore {
  getDomains(): Domain[];
  getDomain(slug: string): Domain | undefined;
  getCategories(domainSlug: string): Category[];
  getPatterns(domainSlug: string, categorySlugs: string[]): Pattern[];
}
