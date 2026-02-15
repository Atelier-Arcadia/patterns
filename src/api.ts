import { Router } from "express";
import type { SqlitePatternStore } from "./sqlite-store.js";

/**
 * Creates an Express router with REST endpoints for managing
 * the Domain > Category > Pattern hierarchy.
 */
export function createApiRouter(store: SqlitePatternStore): Router {
  const router = Router();

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
