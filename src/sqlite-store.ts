import Database from "better-sqlite3";
import type { Domain, Category, Pattern, PatternStore } from "./types.js";

/**
 * SQLite-backed pattern store with a 3-table relational schema
 * mirroring the Domain > Category > Pattern hierarchy.
 */
export class SqlitePatternStore implements PatternStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
  }

  /**
   * Creates the schema tables. Idempotent — safe to call multiple times.
   */
  initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS domains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_id INTEGER NOT NULL,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
        UNIQUE(domain_id, slug)
      );

      CREATE TABLE IF NOT EXISTS patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        label TEXT NOT NULL,
        description TEXT NOT NULL,
        intention TEXT NOT NULL,
        template TEXT NOT NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      );
    `);
  }

  /**
   * Closes the database connection.
   */
  close(): void {
    this.db.close();
  }

  /**
   * Adds a domain to the store.
   */
  addDomain(domain: { slug: string; name: string; description: string }): void {
    this.db
      .prepare("INSERT INTO domains (slug, name, description) VALUES (?, ?, ?)")
      .run(domain.slug, domain.name, domain.description);
  }

  /**
   * Adds a category to a domain.
   */
  addCategory(
    domainSlug: string,
    category: { slug: string; name: string; description: string }
  ): void {
    const domain = this.db
      .prepare("SELECT id FROM domains WHERE slug = ?")
      .get(domainSlug) as { id: number } | undefined;

    if (!domain) {
      throw new Error(`Domain not found: "${domainSlug}"`);
    }

    this.db
      .prepare(
        "INSERT INTO categories (domain_id, slug, name, description) VALUES (?, ?, ?, ?)"
      )
      .run(domain.id, category.slug, category.name, category.description);
  }

  /**
   * Adds a pattern to a category within a domain.
   */
  addPattern(domainSlug: string, categorySlug: string, pattern: Pattern): void {
    const row = this.db
      .prepare(
        `SELECT c.id FROM categories c
         JOIN domains d ON c.domain_id = d.id
         WHERE d.slug = ? AND c.slug = ?`
      )
      .get(domainSlug, categorySlug) as { id: number } | undefined;

    if (!row) {
      throw new Error(
        `Category not found: "${categorySlug}" in domain "${domainSlug}"`
      );
    }

    this.db
      .prepare(
        "INSERT INTO patterns (category_id, label, description, intention, template) VALUES (?, ?, ?, ?, ?)"
      )
      .run(row.id, pattern.label, pattern.description, pattern.intention, pattern.template);
  }

  // -- PatternStore interface --

  getDomains(): Domain[] {
    const domainRows = this.db
      .prepare("SELECT id, slug, name, description FROM domains ORDER BY slug")
      .all() as Array<{ id: number; slug: string; name: string; description: string }>;

    return domainRows.map((d) => ({
      slug: d.slug,
      name: d.name,
      description: d.description,
      categories: this.getCategoriesForDomainId(d.id),
    }));
  }

  getDomain(slug: string): Domain | undefined {
    const row = this.db
      .prepare("SELECT id, slug, name, description FROM domains WHERE slug = ?")
      .get(slug) as { id: number; slug: string; name: string; description: string } | undefined;

    if (!row) return undefined;

    return {
      slug: row.slug,
      name: row.name,
      description: row.description,
      categories: this.getCategoriesForDomainId(row.id),
    };
  }

  getCategories(domainSlug: string): Category[] {
    const domain = this.db
      .prepare("SELECT id FROM domains WHERE slug = ?")
      .get(domainSlug) as { id: number } | undefined;

    if (!domain) return [];

    return this.getCategoriesForDomainId(domain.id);
  }

  getPatterns(domainSlug: string, categorySlugs: string[]): Pattern[] {
    if (categorySlugs.length === 0) return [];

    const domain = this.db
      .prepare("SELECT id FROM domains WHERE slug = ?")
      .get(domainSlug) as { id: number } | undefined;

    if (!domain) return [];

    const placeholders = categorySlugs.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `SELECT p.label, p.description, p.intention, p.template
         FROM patterns p
         JOIN categories c ON p.category_id = c.id
         WHERE c.domain_id = ? AND c.slug IN (${placeholders})
         ORDER BY c.slug, p.id`
      )
      .all(domain.id, ...categorySlugs) as Pattern[];

    return rows;
  }

  // -- Private helpers --

  private getCategoriesForDomainId(domainId: number): Category[] {
    const categoryRows = this.db
      .prepare(
        "SELECT id, slug, name, description FROM categories WHERE domain_id = ? ORDER BY slug"
      )
      .all(domainId) as Array<{
      id: number;
      slug: string;
      name: string;
      description: string;
    }>;

    return categoryRows.map((c) => ({
      slug: c.slug,
      name: c.name,
      description: c.description,
      patterns: this.getPatternsForCategoryId(c.id),
    }));
  }

  private getPatternsForCategoryId(categoryId: number): Pattern[] {
    return this.db
      .prepare(
        "SELECT label, description, intention, template FROM patterns WHERE category_id = ? ORDER BY id"
      )
      .all(categoryId) as Pattern[];
  }
}
