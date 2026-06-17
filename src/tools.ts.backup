/**
 * Railway MCP Tools
 *
 * Provides tools for managing Railway services in the IGLA project.
 *
 * Anchor: phi^2 + phi^-2 = 3
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const IGLA_PROJECT_ID = "e4fe33bb-3b09-4842-9782-7d2dea1abc9b";
const IGLA_PROD_ENV_ID = "54e293b9-00a9-4102-814d-db151636d96e";

interface ListServicesParams {
  project?: string;
}

interface DeployParams {
  name: string;
  image?: string;
  project?: string;
  environment?: string;
  existing_service_id?: string;
  vars?: Array<{ key: string; value: string }>;
  experience_root?: string;
}

interface RedeployParams {
  service: string;
  environment?: string;
}

interface DeleteParams {
  service: string;
  confirm: boolean;
}

interface ExperienceAppendParams {
  issue: string;
  phi_step: string;
  task: string;
  status?: string;
  soul_name?: string;
  agent?: string;
  verb?: string;
  project?: string;
  service?: string;
  root?: string;
}

/**
 * GraphQL client for Railway API
 */
class RailwayClient {
  private token: string;
  private endpoint = "https://backboard.railway.app/graphql/v2";

  constructor(token?: string) {
    this.token = token || process.env.RAILWAY_TOKEN || "";
    if (!this.token) {
      throw new Error("RAILWAY_TOKEN is required");
    }
  }

  async query<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Railway API error: ${response.status} ${text}`);
    }

    const data = await response.json() as { data?: T; errors?: unknown[] };
    if (data.errors && data.errors.length > 0) {
      throw new Error(`Railway GraphQL error: ${JSON.stringify(data.errors)}`);
    }

    if (!data.data) {
      throw new Error("Railway API returned no data");
    }

    return data.data;
  }

  async projectView(projectId: string) {
    const query = `
      query ProjectView($projectId: UUID!) {
        project(id: $projectId) {
          id
          name
          services {
            edges {
              node {
                id
                name
                createdAt
              }
            }
          }
        }
      }
    `;

    const data = await this.query<{ project: any }>(query, { projectId });
    return data.project;
  }

  async serviceCreate(projectId: string, name: string) {
    const mutation = `
      mutation ServiceCreate($projectId: UUID!, $name: String!) {
        serviceCreate(input: { projectId: $projectId, name: $name }) {
          id
          name
        }
      }
    `;

    const data = await this.query<{ serviceCreate: any }>(mutation, { projectId, name });
    return data.serviceCreate;
  }

  async serviceInstanceSetImage(serviceId: string, environmentId: string, image: string) {
    const mutation = `
      mutation ServiceInstanceSetImage($serviceId: UUID!, $environmentId: UUID!, $imageUrl: String!) {
        serviceInstanceSetImage(input: { serviceId: $serviceId, environmentId: $environmentId, imageUrl: $imageUrl }) {
          service {
            id
          }
        }
      }
    `;

    await this.query(mutation, { serviceId, environmentId, imageUrl: image });
  }

  async variableUpsert(projectId: string, environmentId: string, serviceId: string, key: string, value: string) {
    const mutation = `
      mutation VariableUpsert($projectId: UUID!, $environmentId: UUID!, $serviceId: UUID!, $key: String!, $value: String!) {
        variableUpsert(input: { projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId, key: $key, value: $value }) {
          id
        }
      }
    `;

    await this.query(mutation, { projectId, environmentId, serviceId, key, value });
  }

  async serviceRedeploy(serviceId: string, environmentId: string) {
    const mutation = `
      mutation ServiceRedeploy($serviceId: UUID!, $environmentId: UUID!) {
        serviceRedeploy(input: { serviceId: $serviceId, environmentId: $environmentId }) {
          id
        }
      }
    `;

    const data = await this.query<{ serviceRedeploy: any }>(mutation, { serviceId, environmentId });
    return data.serviceRedeploy;
  }

  async serviceDelete(serviceId: string) {
    const mutation = `
      mutation ServiceDelete($serviceId: UUID!) {
        serviceDelete(input: { serviceId: $serviceId }) {
          success
        }
      }
    `;

    await this.query(mutation, { serviceId });
  }

  tokenFingerprint(): string {
    // Simple hash of the token for logging
    let hash = 0;
    for (let i = 0; i < this.token.length; i++) {
      const char = this.token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * Register all Railway MCP tools on the server
 */
export function registerRailwayTools(server: McpServer): void {
  // Tool: railway_service_list
  server.tool(
    "railway_service_list",
    "List all Railway services in the IGLA project (or any other project).",
    {},
    async (args: any) => {
      try {
        const client = new RailwayClient();
        const project = (args.project as string) || IGLA_PROJECT_ID;
        const pv = await client.projectView(project);

        const services = pv.services.edges.map((edge: any) => ({
          id: edge.node.id,
          name: edge.node.name,
          created_at: edge.node.createdAt,
        }));

        const body = {
          project_id: pv.id,
          project_name: pv.name,
          services,
          count: services.length,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Error listing services: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: railway_service_deploy
  server.tool(
    "railway_service_deploy",
    "Create (or reuse) a Railway service, pin its image, upsert env vars, and trigger a redeploy. Emits an L7 experience line. Requires RAILWAY_TOKEN env var.",
    {},
    async (args: any) => {
      try {
        const client = new RailwayClient();
        const tokenFp = client.tokenFingerprint();

        const project = (args.project as string) || IGLA_PROJECT_ID;
        const environment = (args.environment as string) || IGLA_PROD_ENV_ID;
        const image = (args.image as string) || "ghcr.io/ghashtag/trios-trainer-igla:latest";
        const name = args.name as string;

        if (!name) {
          return {
            content: [{ type: "text", text: "Error: 'name' is required" }],
            isError: true,
          };
        }

        let serviceId: string;
        if (args.existing_service_id) {
          serviceId = args.existing_service_id as string;
        } else {
          const created = await client.serviceCreate(project, name);
          serviceId = created.id;
        }

        await client.serviceInstanceSetImage(serviceId, environment, image);

        if (args.vars && Array.isArray(args.vars)) {
          for (const kv of args.vars as Array<{ key: string; value: string }>) {
            await client.variableUpsert(project, environment, serviceId, kv.key, kv.value);
          }
        }

        const deployId = await client.serviceRedeploy(serviceId, environment);

        // R7 triplet (simplified - in real implementation would write to .trinity/experience/)
        const triplet = `RAIL=deploy project=${project.slice(0, 8)} service=${serviceId.slice(0, 8)} token=${tokenFp}`;

        const body = {
          service_id: serviceId,
          deploy_id: deployId.id,
          image,
          triplet,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Error deploying service: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: railway_service_redeploy
  server.tool(
    "railway_service_redeploy",
    "Trigger a redeploy on an existing Railway service.",
    {},
    async (args: any) => {
      try {
        const client = new RailwayClient();
        const env = (args.environment as string) || IGLA_PROD_ENV_ID;
        const service = args.service as string;

        if (!service) {
          return {
            content: [{ type: "text", text: "Error: 'service' is required" }],
            isError: true,
          };
        }

        const deployId = await client.serviceRedeploy(service, env);

        const body = {
          service_id: service,
          deploy_id: deployId.id,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Error redeploying service: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: railway_service_delete
  server.tool(
    "railway_service_delete",
    "Permanently delete a Railway service. Requires `confirm: true` (R9). Irreversible.",
    {},
    async (args: any) => {
      const confirm = args.confirm as boolean;

      if (!confirm) {
        return {
          content: [{ type: "text", text: "Refusing to delete service without `confirm: true` (R9)" }],
          isError: true,
        };
      }

      try {
        const service = args.service as string;

        if (!service) {
          return {
            content: [{ type: "text", text: "Error: 'service' is required" }],
            isError: true,
          };
        }

        const client = new RailwayClient();
        await client.serviceDelete(service);

        const body = {
          deleted_service_id: service,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Error deleting service: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: railway_experience_append
  server.tool(
    "railway_experience_append",
    "Append a single line to the local L7 experience log (.trinity/experience/<YYYYMMDD>.trinity).",
    {},
    async (args: any) => {
      try {
        const project = (args.project as string) || IGLA_PROJECT_ID;
        const tokenFp = process.env.RAILWAY_TOKEN
          ? Array.from(process.env.RAILWAY_TOKEN).reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0).toString(16)
          : "no-token";

        const verb = (args.verb as string) || "experience";
        const triplet = `RAIL=${verb} project=${project.slice(0, 8)} service=${((args.service as string) || "none").slice(0, 8)} token=${tokenFp}`;

        const agent = (args.agent as string) || "GENERAL";
        const soul = (args.soul_name as string) || "RailRangerOne";
        const status = (args.status as string) || "OK";

        // Format: [timestamp] AGENT: agent | SOUL: soul | ISSUE: #N | STEP: phi_step | TASK: task | STATUS: status | TRIPLET: triplet
        const timestamp = new Date().toISOString();
        const line = `[${timestamp}] AGENT: ${agent} | SOUL: ${soul} | ISSUE: ${args.issue} | STEP: ${args.phi_step} | TASK: ${args.task} | STATUS: ${status} | TRIPLET: ${triplet}`;

        // In a real implementation, this would write to .trinity/experience/<YYYYMMDD>.trinity
        // For now, just return the formatted line
        const body = {
          line,
          triplet,
          note: "In production, this would append to .trinity/experience/<YYYYMMDD>.trinity",
        };

        return {
          content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Error appending experience: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: railway_audit_migrate_sql
  server.tool(
    "railway_audit_migrate_sql",
    "Print the idempotent Neon DDL needed for the railway audit tables (issue #6).",
    {},
    async () => {
      const sql = `
-- railway_projects
CREATE TABLE IF NOT EXISTS railway_projects (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- railway_services
CREATE TABLE IF NOT EXISTS railway_services (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES railway_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- railway_audit_runs
CREATE TABLE IF NOT EXISTS railway_audit_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES railway_projects(id) ON DELETE CASCADE,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  drift_count INTEGER NOT NULL DEFAULT 0
);

-- railway_audit_events
CREATE TABLE IF NOT EXISTS railway_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES railway_audit_runs(id) ON DELETE CASCADE,
  service_id UUID REFERENCES railway_services(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- View: open drift events
CREATE OR REPLACE VIEW v_railway_drift_open AS
SELECT e.*
FROM railway_audit_events e
JOIN railway_audit_runs r ON e.run_id = r.id
WHERE r.run_at = (
  SELECT MAX(run_at) FROM railway_audit_runs
);
`.trim();

      return {
        content: [{ type: "text", text: sql }],
      };
    }
  );
}

export const TOOL_COUNT = 6;
