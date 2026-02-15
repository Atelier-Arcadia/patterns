# Feature: Pattern Management Web App

Status: Complete

A web application served alongside the MCP server that provides a clean interface for browsing and managing the full Domain > Category > Pattern hierarchy stored in the SQLite database. The app should allow users to navigate the tree structure, view pattern details, and perform full CRUD operations on all three levels of the hierarchy.

Done Criteria:
* [x] Web app is served via an HTTP endpoint (can reuse or extend the existing Express server in `src/http.ts`)
* [x] Domains are listed on the main page with name, slug, and description visible
* [x] Clicking a domain navigates to its categories
* [x] Clicking a category shows its patterns with label, description, intention, and template
* [x] Users can create new domains with name, slug, and description
* [x] Users can create new categories within a domain
* [x] Users can create new patterns within a category, including all fields (label, description, intention, template)
* [x] Users can edit existing domains, categories, and patterns inline or via a form
* [x] Users can delete domains, categories, and patterns (with confirmation)
* [x] Deleting a domain cascades to its categories and patterns
* [x] Deleting a category cascades to its patterns
* [x] The UI provides clear navigation breadcrumbs (e.g. Domain > Category > Pattern)
* [x] The app works as a simple self-contained frontend (no separate build step required for the client)
