# Feature: Auto-create domains and categories when approving suggestions

Status: Done

When a pattern suggestion references a domain or category that doesn't yet exist, approving that suggestion should automatically create the new domain or category. The web UI should prominently indicate when approving a suggestion will result in new domains or categories being created, so admins can make an informed decision.

Done Criteria:
* [x] Approving a suggestion with an unknown domain automatically creates that domain
* [x] Approving a suggestion with an unknown category automatically creates that category
* [x] The web UI clearly highlights when a suggestion would create new domains
* [x] The web UI clearly highlights when a suggestion would create new categories
* [x] Admin can see the new domain/category names before confirming approval
