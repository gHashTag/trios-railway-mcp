#!/usr/bin/env node

/**
 * Trios Railway MCP Server
 *
 * Public Streamable-HTTP MCP server for managing Railway services
 * in the IGLA project.
 *
 * Anchor: phi^2 + phi^-2 = 3
 *
 * Environment variables:
 *   PORT              - Server port (default: 3000)
 *   RAILWAY_TOKEN     - Railway API token (required for deploy/redeploy/delete)
 *   AUTH_USERNAME     - Basic auth username (default: admin)
 *   AUTH_PASSWORD     - Basic auth password (default: empty = no auth)
 *   ENABLE_AUTH       - Enable basic auth (default: true)
 */

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { mountMcpHttpHandler, getToolNames } from "./server.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

const AUTH_USERNAME = process.env.AUTH_USERNAME || "admin";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "";
const ENABLE_AUTH = process.env.ENABLE_AUTH !== "false";

/**
 * Basic authentication middleware
 */
function basicAuthMiddleware(req: any, res: any, next: any) {
  if (!ENABLE_AUTH) {
    return next();
  }

  const authHeader: string | undefined = req.headers.authorization;
  if (!authHeader) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Trios Railway MCP"');
    return res.status(401).json({ error: "Authentication required" });
  }

  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) {
    return res.status(400).json({ error: "Malformed Authorization header" });
  }

  // Support Basic auth (RFC 7617) and Bearer token with encoded credentials
  let candidate: string | null = null;

  if (scheme.toLowerCase() === "basic") {
    try {
      candidate = Buffer.from(token, "base64").toString("utf8");
    } catch {
      candidate = null;
    }
  } else if (scheme.toLowerCase() === "bearer") {
    if (token.includes(":")) {
      // Literal "user:pass"
      candidate = token;
    } else {
      // Base64 encoded "user:pass"
      try {
        const decoded = Buffer.from(token, "base64").toString("utf8");
        if (decoded.includes(":")) {
          candidate = decoded;
        }
      } catch {
        candidate = null;
      }
    }
  } else {
    return res.status(400).json({ error: `Unsupported auth scheme: ${scheme}` });
  }

  if (!candidate || !candidate.includes(":")) {
    return res.status(403).json({ error: "Invalid credentials" });
  }

  const sep = candidate.indexOf(":");
  const username = candidate.slice(0, sep);
  const password = candidate.slice(sep + 1);

  if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
    next();
  } else {
    res.status(403).json({ error: "Invalid credentials" });
  }
}

// Create Express app
const app = express();

// Apply CORS
app.use(cors());

// Apply auth middleware (skip for health check)
app.use((req: any, res: any, next: any) => {
  if (req.path === "/health" || req.path === "/") {
    return next();
  }
  basicAuthMiddleware(req, res, next);
});

// Body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Mount MCP HTTP handler
mountMcpHttpHandler(app, {
  username: AUTH_USERNAME,
  password: AUTH_PASSWORD,
  enabled: ENABLE_AUTH,
});

console.log(
  `[MCP] /mcp will expose ${getToolNames().length} tools: ${getToolNames().join(", ")}`
);

// Health check endpoint
app.get("/health", (_req: any, res: any) => {
  res.json({
    status: "ok",
    service: "trios-railway-mcp",
    version: "1.0.0",
    tools: getToolNames().length,
  });
});

// Root endpoint
app.get("/", (_req: any, res: any) => {
  res.json({
    service: "trios-railway-mcp",
    version: "1.0.0",
    description: "Public MCP server for managing Railway services in the IGLA project",
    mcp_endpoint: "/mcp",
    health_endpoint: "/health",
    tools: getToolNames(),
    anchor: "phi^2 + phi^-2 = 3",
  });
});

// Start server
app.listen(PORT, HOST, () => {
  console.log("\n=== Trios Railway MCP Server Started ===");
  console.log(`Listening on http://${HOST}:${PORT}`);
  console.log(`MCP endpoint: http://${HOST}:${PORT}/mcp`);
  console.log(`Health check: http://${HOST}:${PORT}/health`);
  console.log(`Auth enabled: ${ENABLE_AUTH}`);
  console.log(`Tools available: ${getToolNames().length}`);
  console.log("Anchor: phi^2 + phi^-2 = 3\n");
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nReceived SIGINT, shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nReceived SIGTERM, shutting down...");
  process.exit(0);
});
