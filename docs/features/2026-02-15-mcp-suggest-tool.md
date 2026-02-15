# Feature: MCP Suggest Tool

Status: Complete

Expose the web application's pattern suggestion/submission feature as MCP tools, allowing LLM users to suggest new patterns or edits to existing patterns directly from their coding sessions without needing to open the web UI.

The MCP server currently provides `discover` and `match` tools. This feature adds a `suggest` tool (or tools) that call the existing `/api/submissions` endpoint logic, enabling contributors to submit new pattern suggestions and edit suggestions for review by admins.

Each suggestion must include a source identifier so that admins can tell where a submission came from (e.g. which user or MCP client originated the suggestion). This helps distinguish MCP-originated suggestions from web UI submissions and provides traceability.

Done Criteria:
* [x] A new MCP tool is available for suggesting a new pattern (fields: domainSlug, categorySlug, label, description, intention, template)
* [x] A new MCP tool (or mode of the suggest tool) is available for suggesting edits to an existing pattern (fields: targetPatternId, label, description, intention, template)
* [x] Both suggest flows require a source identifier field to attribute the origin of the suggestion
* [x] Suggestions created via MCP tools appear in the admin submissions queue with status "pending", just like web UI submissions
* [x] The tool returns confirmation with the created submission details on success
* [x] The tool returns a clear error message when required fields are missing or invalid
* [x] Existing `discover` and `match` tools continue to work without regression
