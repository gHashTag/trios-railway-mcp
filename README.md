# @ghashtag/trios-railway-mcp

Public MCP server for managing Railway services in the IGLA project.

**Anchor**: `phi^2 + phi^-2 = 3`

## Features

- **Streamable HTTP MCP Server**: Exposes 8 tools via `/mcp` endpoint
- **Railway Service Management**: List, deploy, redeploy, and delete services
- **Experience Logging**: Append to `.trinity/experience/` logs
- **Audit Support**: Get Neon DDL for railway audit tables
- **Basic Auth**: Configurable authentication for security

## Installation

```bash
npm install -g @ghashtag/trios-railway-mcp
```

Or run directly with npx:

```bash
npx @ghashtag/trios-railway-mcp
```

## Usage

```bash
trios-railway-mcp
```

The server will start on `http://localhost:3000` by default.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `HOST` | Server host | `0.0.0.0` |
| `RAILWAY_TOKEN` | Railway API token (required for deploy/redeploy/delete) | - |
| `AUTH_USERNAME` | Basic auth username | `admin` |
| `AUTH_PASSWORD` | Basic auth password | (empty = no auth) |
| `ENABLE_AUTH` | Enable basic auth | `true` |

## MCP Tools

| Tool | Description |
|------|-------------|
| `fleet_health` | Check health of all Railway accounts in the fleet (live API call per account) |
| `fleet_status` | Quick cached status of all accounts (no API calls) |
| `railway_service_list` | List all Railway services in a project |
| `railway_service_deploy` | Create or reuse a service, set image, env vars, and redeploy |
| `railway_service_redeploy` | Trigger a redeploy on an existing service |
| `railway_service_delete` | Permanently delete a service (requires `confirm: true`) |
| `railway_experience_append` | Append a line to the L7 experience log |
| `railway_audit_migrate_sql` | Get Neon DDL for railway audit tables |

## Endpoints

- `GET /` - Server info and available tools
- `GET /health` - Health check
- `POST /mcp` - MCP Streamable HTTP endpoint (JSON-RPC 2.0)

## Example: Connecting from an MCP Client

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:3000/mcp"),
  {
    headers: {
      Authorization: "Basic " + Buffer.from("admin:password").toString("base64"),
    },
  }
);

const client = new Client({
  name: "example-client",
  version: "1.0.0",
});

await client.connect(transport);

// List tools
const { tools } = await client.listTools();
console.log("Available tools:", tools.map(t => t.name));

// Call a tool
const result = await client.callTool({
  name: "railway_service_list",
  arguments: {},
});

console.log("Services:", result.content);
```

## Deployment to Railway

This package can be deployed directly to Railway:

```bash
railway up
```

Make sure to set the `RAILWAY_TOKEN` environment variable in your Railway project.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev

# Run tests
npm test
```

## License

Apache-2.0

## Repository

[github.com/gHashTag/trios-railway-mcp](https://github.com/gHashTag/trios-railway-mcp)

## Related Projects

- [gHashTag/trios](https://github.com/gHashTag/trios) - Main trios repository
- [gHashTag/trios-trainer-igla](https://github.com/gHashTag/trios-trainer-igla) - IGLA trainer
