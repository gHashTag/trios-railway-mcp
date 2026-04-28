/**
 * Streamable HTTP /mcp endpoint for the Trios Railway MCP Server.
 *
 * Mounts a JSON-RPC 2.0 MCP server on an Express app so that
 * external MCP clients can use the Railway management tools.
 *
 * Stateless mode: a fresh McpServer + StreamableHTTPServerTransport pair
 * is constructed per request.
 *
 * Anchor: phi^2 + phi^-2 = 3
 */

import type { Express, Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerRailwayTools } from "./tools.js";

interface InternalAuth {
  username: string;
  password: string;
  enabled: boolean;
}

function buildAuthHeader(auth: InternalAuth): string | null {
  if (!auth.enabled) return null;
  const token = Buffer.from(`${auth.username}:${auth.password}`, "utf8").toString("base64");
  return `Basic ${token}`;
}

function buildMcpServer(auth: InternalAuth): McpServer {
  const server = new McpServer({
    name: "Trios Railway MCP (HTTP)",
    version: "1.0.0",
  });

  // Register all Railway tools
  registerRailwayTools(server);

  return server;
}

/**
 * Mount POST /mcp (Streamable HTTP) on the supplied Express app.
 *
 * @param app    The Express application created in index.ts.
 * @param auth   Credentials for basic authentication.
 */
export function mountMcpHttpHandler(
  app: Express,
  auth: InternalAuth
): void {
  app.post("/mcp", async (req: Request, res: Response) => {
    let server: McpServer | null = null;
    let transport: StreamableHTTPServerTransport | null = null;

    try {
      server = buildMcpServer(auth);
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });

      res.on("close", () => {
        try {
          transport?.close();
        } catch {
          /* noop */
        }
        try {
          server?.close();
        } catch {
          /* noop */
        }
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[MCP /mcp] handler error:", message);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: `Internal MCP error: ${message}` },
          id: null,
        });
      }
    }
  });

  // Stateless mode: GET (and DELETE) are not used. Return 405 with a JSON-RPC
  // error so MCP clients that probe the endpoint get a clean answer.
  const methodNotAllowed = (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method Not Allowed (stateless /mcp)" },
      id: null,
    });
  };

  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  console.log("[MCP] Streamable HTTP /mcp endpoint mounted (stateless mode)");
}

/**
 * Get the list of tool names for logging
 */
export function getToolNames(): string[] {
  return [
    "railway_service_list",
    "railway_service_deploy",
    "railway_service_redeploy",
    "railway_service_delete",
    "railway_experience_append",
    "railway_audit_migrate_sql",
  ];
}
