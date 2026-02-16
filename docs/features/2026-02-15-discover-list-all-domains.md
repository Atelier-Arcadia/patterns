# Feature: Discover tool lists all domains when called with no arguments

Status: Not started

Currently the `discover` MCP tool requires a `domain` parameter to return categories within that domain. There is no way to programmatically list all available domains, which creates a discoverability gap — callers must already know domain slugs before they can explore the pattern hierarchy.

When the `discover` tool is invoked with no arguments (i.e. `domain` is omitted), it should return a list of all available domain slugs and their labels, allowing callers to enumerate the full pattern hierarchy from the top down.

Done Criteria:
* [ ] The `domain` parameter on the `discover` tool is optional
* [ ] Calling `discover` with no arguments returns all available domains (slug + label at minimum)
* [ ] Calling `discover` with a `domain` argument continues to return categories as before (no regression)
* [ ] The MCP tool schema is updated to reflect `domain` as optional
