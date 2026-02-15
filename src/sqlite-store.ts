import Database from "better-sqlite3";
import type { Domain, Category, Pattern, PatternStore, PatternWithId, Submission, SubmissionInput, SubmissionStore } from "./types.js";

/**
 * SQLite-backed pattern store with a 3-table relational schema
 * mirroring the Domain > Category > Pattern hierarchy,
 * plus a submissions table for contributor proposals.
 */
export class SqlitePatternStore implements PatternStore, SubmissionStore {
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

      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('new', 'modify')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
        target_pattern_id INTEGER,
        domain_slug TEXT,
        category_slug TEXT,
        label TEXT NOT NULL,
        description TEXT NOT NULL,
        intention TEXT NOT NULL,
        template TEXT NOT NULL,
        source TEXT,
        submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
        reviewed_at TEXT,
        FOREIGN KEY (target_pattern_id) REFERENCES patterns(id) ON DELETE SET NULL
      );
    `);

    // Migration: add source column if it doesn't exist (for existing databases)
    const columns = this.db.pragma("table_info(submissions)") as Array<{ name: string }>;
    if (!columns.some((c) => c.name === "source")) {
      this.db.exec("ALTER TABLE submissions ADD COLUMN source TEXT");
    }
  }

  /**
   * Closes the database connection.
   */
  close(): void {
    this.db.close();
  }

  // -- Create methods --

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

  // -- Update methods --

  /**
   * Updates a domain's name and/or description.
   */
  updateDomain(slug: string, changes: { name?: string; description?: string }): void {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (changes.name !== undefined) {
      setClauses.push("name = ?");
      values.push(changes.name);
    }
    if (changes.description !== undefined) {
      setClauses.push("description = ?");
      values.push(changes.description);
    }

    if (setClauses.length === 0) return;

    values.push(slug);
    const result = this.db
      .prepare(`UPDATE domains SET ${setClauses.join(", ")} WHERE slug = ?`)
      .run(...values);

    if (result.changes === 0) {
      throw new Error(`Domain not found: "${slug}"`);
    }
  }

  /**
   * Updates a category's name and/or description.
   */
  updateCategory(
    domainSlug: string,
    categorySlug: string,
    changes: { name?: string; description?: string }
  ): void {
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

    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (changes.name !== undefined) {
      setClauses.push("name = ?");
      values.push(changes.name);
    }
    if (changes.description !== undefined) {
      setClauses.push("description = ?");
      values.push(changes.description);
    }

    if (setClauses.length === 0) return;

    values.push(row.id);
    this.db
      .prepare(`UPDATE categories SET ${setClauses.join(", ")} WHERE id = ?`)
      .run(...values);
  }

  /**
   * Updates a pattern by id.
   */
  updatePattern(
    id: number,
    changes: { label?: string; description?: string; intention?: string; template?: string }
  ): void {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (changes.label !== undefined) {
      setClauses.push("label = ?");
      values.push(changes.label);
    }
    if (changes.description !== undefined) {
      setClauses.push("description = ?");
      values.push(changes.description);
    }
    if (changes.intention !== undefined) {
      setClauses.push("intention = ?");
      values.push(changes.intention);
    }
    if (changes.template !== undefined) {
      setClauses.push("template = ?");
      values.push(changes.template);
    }

    if (setClauses.length === 0) return;

    values.push(id);
    const result = this.db
      .prepare(`UPDATE patterns SET ${setClauses.join(", ")} WHERE id = ?`)
      .run(...values);

    if (result.changes === 0) {
      throw new Error(`Pattern not found: id ${id}`);
    }
  }

  // -- Delete methods --

  /**
   * Deletes a domain and all its categories and patterns (via CASCADE).
   */
  deleteDomain(slug: string): void {
    const result = this.db
      .prepare("DELETE FROM domains WHERE slug = ?")
      .run(slug);

    if (result.changes === 0) {
      throw new Error(`Domain not found: "${slug}"`);
    }
  }

  /**
   * Deletes a category and all its patterns (via CASCADE).
   */
  deleteCategory(domainSlug: string, categorySlug: string): void {
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

    this.db.prepare("DELETE FROM categories WHERE id = ?").run(row.id);
  }

  /**
   * Deletes a single pattern by id.
   */
  deletePattern(id: number): void {
    const result = this.db
      .prepare("DELETE FROM patterns WHERE id = ?")
      .run(id);

    if (result.changes === 0) {
      throw new Error(`Pattern not found: id ${id}`);
    }
  }

  // -- PatternStore interface (read) --

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

  /**
   * Like getPatterns but includes the database id for each pattern.
   * Used by the management API for update/delete operations.
   */
  getPatternsWithIds(domainSlug: string, categorySlugs: string[]): PatternWithId[] {
    if (categorySlugs.length === 0) return [];

    const domain = this.db
      .prepare("SELECT id FROM domains WHERE slug = ?")
      .get(domainSlug) as { id: number } | undefined;

    if (!domain) return [];

    const placeholders = categorySlugs.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `SELECT p.id, p.label, p.description, p.intention, p.template
         FROM patterns p
         JOIN categories c ON p.category_id = c.id
         WHERE c.domain_id = ? AND c.slug IN (${placeholders})
         ORDER BY c.slug, p.id`
      )
      .all(domain.id, ...categorySlugs) as PatternWithId[];

    return rows;
  }

  // -- Submissions --

  /**
   * Creates a new submission. Returns the submission id.
   */
  addSubmission(input: SubmissionInput): number {
    const result = this.db
      .prepare(
        `INSERT INTO submissions (type, target_pattern_id, domain_slug, category_slug, label, description, intention, template, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.type,
        input.targetPatternId ?? null,
        input.domainSlug ?? null,
        input.categorySlug ?? null,
        input.label,
        input.description,
        input.intention,
        input.template,
        input.source ?? null
      );

    return result.lastInsertRowid as number;
  }

  /**
   * Returns submissions, optionally filtered by status.
   */
  getSubmissions(status?: "pending" | "accepted" | "rejected"): Submission[] {
    if (status) {
      return this.db
        .prepare(
          `SELECT id, type, status, target_pattern_id, domain_slug, category_slug,
                  label, description, intention, template, source, submitted_at, reviewed_at
           FROM submissions WHERE status = ? ORDER BY id DESC`
        )
        .all(status)
        .map(this.mapSubmissionRow);
    }

    return this.db
      .prepare(
        `SELECT id, type, status, target_pattern_id, domain_slug, category_slug,
                label, description, intention, template, source, submitted_at, reviewed_at
         FROM submissions ORDER BY id DESC`
      )
      .all()
      .map(this.mapSubmissionRow);
  }

  /**
   * Returns a single submission by id, or undefined if not found.
   */
  getSubmission(id: number): Submission | undefined {
    const row = this.db
      .prepare(
        `SELECT id, type, status, target_pattern_id, domain_slug, category_slug,
                label, description, intention, template, source, submitted_at, reviewed_at
         FROM submissions WHERE id = ?`
      )
      .get(id);

    if (!row) return undefined;

    return this.mapSubmissionRow(row);
  }

  /**
   * Reviews a submission — accepts or rejects it.
   * Accepting a 'new' submission creates the pattern.
   * Accepting a 'modify' submission updates the target pattern.
   */
  reviewSubmission(id: number, decision: "accepted" | "rejected"): void {
    const sub = this.getSubmission(id);
    if (!sub) {
      throw new Error(`Submission not found: id ${id}`);
    }
    if (sub.status !== "pending") {
      throw new Error(`Submission ${id} has already been reviewed (status: ${sub.status})`);
    }

    if (decision === "accepted") {
      if (sub.type === "new") {
        // Create the pattern in the target domain/category
        this.addPattern(sub.domainSlug!, sub.categorySlug!, {
          label: sub.label,
          description: sub.description,
          intention: sub.intention,
          template: sub.template,
        });
      } else if (sub.type === "modify" && sub.targetPatternId) {
        // Update the existing pattern
        this.updatePattern(sub.targetPatternId, {
          label: sub.label,
          description: sub.description,
          intention: sub.intention,
          template: sub.template,
        });
      }
    }

    this.db
      .prepare("UPDATE submissions SET status = ?, reviewed_at = datetime('now') WHERE id = ?")
      .run(decision, id);
  }

  // -- Private helpers --

  private mapSubmissionRow(row: any): Submission {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      targetPatternId: row.target_pattern_id,
      domainSlug: row.domain_slug,
      categorySlug: row.category_slug,
      label: row.label,
      description: row.description,
      intention: row.intention,
      template: row.template,
      source: row.source ?? null,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
    };
  }

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

  /**
   * Returns patterns for a category, including ids for management operations.
   * The extra `id` field is harmless for the MCP tools which just serialize to JSON.
   */
  private getPatternsForCategoryId(categoryId: number): PatternWithId[] {
    return this.db
      .prepare(
        "SELECT id, label, description, intention, template FROM patterns WHERE category_id = ? ORDER BY id"
      )
      .all(categoryId) as PatternWithId[];
  }
}
