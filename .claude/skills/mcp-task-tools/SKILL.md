---
name: mcp-task-tools
description: |
  Use this skill when designing, reviewing, or refactoring MCP server tools.
  It enforces task-oriented, natural-language tool semantics and prevents
  redundant CRUD-only MCP APIs when Hub UI or internal APIs already cover CRUD.
metadata:
  scope: mcp-server
  stage: design
---

# MCP Task-Oriented Tool Design

Use this skill before implementing any MCP tools.

## Goal

Design tools around user outcomes, not tables.

Follow root project rules while designing:

- Keep DB/service logic in `packages/shared` first, then wire MCP in `packages/mcp-server`.
- Prefer task-oriented MCP tools; avoid redundant CRUD-only APIs when Hub already covers CRUD.

- Good: `travel_plan_trip`, `travel_prepare_trip`, `travel_get_trip_brief`
- Avoid: `travel_create_trip`, `travel_update_trip`, `travel_delete_trip` unless strictly required

## Decision Tree

1. Is the capability read-only contextual data?

- Use an MCP resource.

2. Is it a user action/workflow with intent and transformation?

- Use an MCP tool.
- Include smart defaults so the tool works with minimal required arguments.

3. Is it low-level CRUD already available in Hub UI/API?

- Do not expose it as MCP by default.
- Keep CRUD in Hub/API and expose only high-value orchestration tools in MCP.

4. Is low-level mutation still needed for composition by other MCP tools?

- Keep as internal helper function/service.
- Expose publicly only if there is a strong user-intent case.

## Tool Naming Rules

- Use `domain_action_outcome` shape.
- Names must reflect what the user wants to accomplish.
- Include defaults so AI can call tools with minimal required fields.
- Use consistent domain prefixes (`calories_`, `travel_`, `apiary_`).

Examples:

- `travel_add_reservation_from_text`
- `travel_adjust_itinerary`
- `travel_prepare_trip_checklist`
- `travel_who_is_traveling`

## Input/Output Rules

- Inputs should be natural-language friendly and AI-friendly.
- Accept optional context and infer sensible defaults.
- Date defaults should use the authenticated user's timezone when available.
- Avoid requiring opaque IDs unless unavoidable.
- Outputs must include action result summary and key structured data.

## Redundancy Guardrails

Before adding each MCP tool, answer:

1. What user intent does this satisfy?
2. Can existing MCP tools + resources already satisfy this?
3. Is this duplicated by Hub full CRUD UX?
4. Does removing this tool reduce complexity without hurting outcomes?

If a tool fails these checks, skip it.

## Implementation Handoff

After tool semantics are approved with this skill:

1. Use `.claude/skills/mcp-add-tool/SKILL.md` for implementation.
2. Use `.claude/skills/mcp-add-resource/SKILL.md` for resources.
3. Keep shared DB and service logic in `packages/shared` first.

Current implementation contract in this repo:

- Tool callbacks use local `ToolHandler` with `(input, context, extra?)`.
- Resource callbacks use local `ResourceHandler` with `(uri, context, extra?)`.
- `context` is authenticated and non-null (`userId`, `clientId`, `serverName`, `timezone`).
- Wrapper registration uses `withUserIdCheck(cb)` and `withUserIdCheckResource(cb)` (no skip flag).

## Review Checklist

- Tool list reads as end-user tasks.
- No CRUD-only clusters unless justified.
- Resources provide context snapshots.
- Hub remains the canonical detailed CRUD surface.
- Naming and schemas are consistent across domains.
