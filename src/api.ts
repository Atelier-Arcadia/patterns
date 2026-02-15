import { Router } from "express";
import type { SqlitePatternStore } from "./sqlite-store.js";
import { login, logout, isAdminConfigured, parseCookie, requireAdmin } from "./auth.js";

/**
 * Creates an Express router with REST endpoints for managing
 * the Domain > Category > Pattern hierarchy, plus auth and submissions.
 */
export function createApiRouter(store: SqlitePatternStore): Router {
  const router = Router();

  // -- Auth --

  router.get("/auth/status", (req, res) => {
    res.json({
      authenticated: !!(req as any).isAdmin,
      adminConfigured: isAdminConfigured(),
    });
  });

  router.post("/auth/login", (req, res) => {
    if (!isAdminConfigured()) {
      res.status(401).json({ error: "Admin access is not configured. Set the ADMIN_SECRET environment variable." });
      return;
    }

    const { secret } = req.body ?? {};
    const token = login(secret ?? "");
    if (!token) {
      res.status(401).json({ error: "Invalid secret" });
      return;
    }

    res.setHeader("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict`);
    res.json({ ok: true });
  });

  router.post("/auth/logout", (req, res) => {
    const token = parseCookie(req.headers.cookie, "session");
    if (token) {
      logout(token);
    }
    res.setHeader("Set-Cookie", "session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
    res.json({ ok: true });
  });

  // -- Submissions (public: create, admin: list + review) --

  router.post("/submissions", (req, res) => {
    const { type, targetPatternId, domainSlug, categorySlug, label, description, intention, template, source } = req.body ?? {};

    if (!type || !label || !description || !intention || !template) {
      res.status(400).json({ error: "Missing required fields: type, label, description, intention, template" });
      return;
    }

    if (type !== "new" && type !== "modify") {
      res.status(400).json({ error: "type must be 'new' or 'modify'" });
      return;
    }

    try {
      const id = store.addSubmission({
        type,
        targetPatternId,
        domainSlug,
        categorySlug,
        label,
        description,
        intention,
        template,
        source,
      });

      const sub = store.getSubmission(id);
      res.status(201).json(sub);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/submissions", requireAdmin, (req, res) => {
    const status = req.query.status as "pending" | "accepted" | "rejected" | undefined;
    const submissions = store.getSubmissions(status);
    res.json(submissions);
  });

  router.post("/submissions/:id/review", requireAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid submission id" });
      return;
    }

    const { decision } = req.body ?? {};
    if (decision !== "accepted" && decision !== "rejected") {
      res.status(400).json({ error: "decision must be 'accepted' or 'rejected'" });
      return;
    }

    try {
      store.reviewSubmission(id, decision);
      res.json({ ok: true });
    } catch (err: any) {
      if (err.message?.includes("not found")) {
        res.status(404).json({ error: err.message });
      } else if (err.message?.includes("already been reviewed")) {
        res.status(409).json({ error: err.message });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  // -- Domains --

  router.get("/domains", (_req, res) => {
    const domains = store.getDomains();
    res.json(domains);
  });

  router.post("/domains", (req, res) => {
    const { slug, name, description } = req.body ?? {};
    if (!slug || !name || !description) {
      res.status(400).json({ error: "Missing required fields: slug, name, description" });
      return;
    }

    try {
      store.addDomain({ slug, name, description });
      res.status(201).json({ slug, name, description });
    } catch (err: any) {
      if (err.message?.includes("UNIQUE constraint")) {
        res.status(409).json({ error: `Domain with slug "${slug}" already exists` });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  router.put("/domains/:slug", (req, res) => {
    const { name, description } = req.body ?? {};
    try {
      store.updateDomain(req.params.slug, { name, description });
      const domain = store.getDomain(req.params.slug);
      res.json(domain);
    } catch (err: any) {
      if (err.message?.includes("not found")) {
        res.status(404).json({ error: err.message });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  router.delete("/domains/:slug", (req, res) => {
    try {
      store.deleteDomain(req.params.slug);
      res.json({ ok: true });
    } catch (err: any) {
      if (err.message?.includes("not found")) {
        res.status(404).json({ error: err.message });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  // -- Categories --

  router.post("/domains/:slug/categories", (req, res) => {
    const { slug: catSlug, name, description } = req.body ?? {};
    if (!catSlug || !name || !description) {
      res.status(400).json({ error: "Missing required fields: slug, name, description" });
      return;
    }

    try {
      store.addCategory(req.params.slug, { slug: catSlug, name, description });
      res.status(201).json({ slug: catSlug, name, description });
    } catch (err: any) {
      if (err.message?.includes("not found")) {
        res.status(404).json({ error: err.message });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  router.put("/domains/:slug/categories/:catSlug", (req, res) => {
    const { name, description } = req.body ?? {};
    try {
      store.updateCategory(req.params.slug, req.params.catSlug, { name, description });
      const categories = store.getCategories(req.params.slug);
      const updated = categories.find((c) => c.slug === req.params.catSlug);
      res.json(updated);
    } catch (err: any) {
      if (err.message?.includes("not found")) {
        res.status(404).json({ error: err.message });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  router.delete("/domains/:slug/categories/:catSlug", (req, res) => {
    try {
      store.deleteCategory(req.params.slug, req.params.catSlug);
      res.json({ ok: true });
    } catch (err: any) {
      if (err.message?.includes("not found")) {
        res.status(404).json({ error: err.message });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  // -- Patterns --

  router.post("/domains/:slug/categories/:catSlug/patterns", (req, res) => {
    const { label, description, intention, template } = req.body ?? {};
    if (!label || !description || !intention || !template) {
      res.status(400).json({
        error: "Missing required fields: label, description, intention, template",
      });
      return;
    }

    try {
      store.addPattern(req.params.slug, req.params.catSlug, {
        label,
        description,
        intention,
        template,
      });
      res.status(201).json({ label, description, intention, template });
    } catch (err: any) {
      if (err.message?.includes("not found")) {
        res.status(404).json({ error: err.message });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  router.put("/patterns/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid pattern id" });
      return;
    }

    const { label, description, intention, template } = req.body ?? {};
    try {
      store.updatePattern(id, { label, description, intention, template });
      res.json({ ok: true });
    } catch (err: any) {
      if (err.message?.includes("not found")) {
        res.status(404).json({ error: err.message });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  router.delete("/patterns/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid pattern id" });
      return;
    }

    try {
      store.deletePattern(id);
      res.json({ ok: true });
    } catch (err: any) {
      if (err.message?.includes("not found")) {
        res.status(404).json({ error: err.message });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  return router;
}
