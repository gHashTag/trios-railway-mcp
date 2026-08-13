/**
 * Guards the tool list advertised by the `/` and `/health` endpoints against
 * drifting from the tools actually registered on the MCP server.
 *
 * This drift is not hypothetical: fleet_health and fleet_status were added in
 * aa397af but getToolNames() kept returning the original six, so both
 * informational endpoints under-reported the server's capabilities.
 *
 * Runs against dist/, so `npm run build` must come first (npm test does this).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// tools.js loads Railway credentials at import time and throws when none are
// configured. Nothing here makes a network call; a placeholder account is
// enough to let the module import so the tools can be registered.
process.env.RAILWAY_TOKEN_ACC0 ||= "test-token-not-used";
process.env.RAILWAY_PROJECT_ID_ACC0 ||= "00000000-0000-0000-0000-000000000000";

const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
const { registerRailwayTools, TOOL_NAMES, TOOL_COUNT } = await import("../dist/tools.js");
const { getToolNames } = await import("../dist/server.js");

test("advertised tool names match the tools actually registered", () => {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerRailwayTools(server);

  // _registeredTools is an SDK internal. If a future SDK version renames it
  // this assertion fails loudly rather than silently passing on an empty set.
  const registered = Object.keys(server._registeredTools ?? {});
  assert.ok(
    registered.length > 0,
    "could not read registered tools from McpServer — SDK internals may have changed"
  );

  assert.deepEqual(getToolNames().slice().sort(), registered.slice().sort());
});

test("TOOL_NAMES is the single source of truth for the advertised list", () => {
  assert.deepEqual(getToolNames(), [...TOOL_NAMES]);
  assert.equal(TOOL_COUNT, TOOL_NAMES.length);
});

test("the fleet tools are advertised", () => {
  const names = getToolNames();
  assert.ok(names.includes("fleet_health"), "fleet_health missing from advertised tools");
  assert.ok(names.includes("fleet_status"), "fleet_status missing from advertised tools");
});
