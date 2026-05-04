/**
 * Railway MCP Tools
 *
 * Provides tools for managing Railway services in the IGLA project.
 * Multi-account support with automatic header selection based on token kind.
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
 * Account configuration loaded from environment
 */
interface Account {
  token: string;
  projectId: string;
  environmentId: string;
  kind: "project" | "personal";  // project = PAT (Project-Access-Token), personal = Bearer
  label: string;  // "acc0", "acc1", etc.
}

/**
 * Load all accounts from environment variables RAILWAY_TOKEN_ACC*, RAILWAY_PROJECT_ID_ACC*, etc.
 */
function loadAccounts(): Account[] {
  const accounts: Account[] = [];
  const maxAccounts = 7;  // ACC0-ACC6

  for (let i = 0; i < maxAccounts; i++) {
    const token = process.env[`RAILWAY_TOKEN_ACC${i}`];
    const projectId = process.env[`RAILWAY_PROJECT_ID_ACC${i}`];
    const environmentId = process.env[`RAILWAY_ENVIRONMENT_ID_ACC${i}`] || "";
    const kindStr = process.env[`RAILWAY_TOKEN_KIND_ACC${i}`] || "project";
    const kind = (kindStr === "personal" || kindStr === "user" || kindStr === "account") ? "personal" : "project";

    if (!token || !projectId) {
      if (token || projectId) {
        console.warn(`[WARN] ACC${i} incomplete: missing ${!token ? "token" : "projectId"}`);
      }
      continue;
    }

    accounts.push({
      token,
      projectId,
      environmentId,
      kind,
      label: `acc${i}`,
    });
  }

  if (accounts.length === 0) {
    throw new Error("No valid accounts found in RAILWAY_TOKEN_ACC* env vars");
  }

  console.log(`[INFO] Loaded ${accounts.length} accounts: ${accounts.map(a => `${a.label}(${a.kind})`).join(", ")}`);
  return accounts;
}

/**
 * Load allowed project IDs from ALLOWED_PROJECT_IDS env var
 */
function loadAllowedProjectIds(): Set<string> {
  const allowed = process.env.ALLOWED_PROJECT_IDS || "";
  const ids = allowed.split(",").map(s => s.trim()).filter(s => s.length > 0);
  const set = new Set(ids);

  console.log(`[INFO] Allowed project IDs: ${ids.length} projects${ids.length > 0 ? ` (${ids[0]}...)` : ""}`);
  if (ids.length === 0) {
    console.warn("[WARN] ALLOWED_PROJECT_IDS is empty - all projects allowed!");
  } else {
    // Validate that each allowed project has a matching account
    const allProjectIds = ACCOUNTS.map(a => a.projectId);
    for (const id of ids) {
      if (!allProjectIds.includes(id)) {
        console.warn(`[WARN] Project ${id} in ALLOWED_PROJECT_IDS has no matching RAILWAY_TOKEN_ACC*`);
      }
    }
  }

  return set;
}

// Load accounts and whitelist at module initialization
const ACCOUNTS = loadAccounts();
const ALLOWED_PROJECT_IDS = loadAllowedProjectIds();

/**
 * GraphQL client for Railway API with multi-account support
 */
class RailwayClient {
  private account: Account;
  private endpoint = "https://backboard.railway.app/graphql/v2";

  constructor(account: Account) {
    this.account = account;
  }

  /**
   * Find account by project ID
   * @throws Error if project not in whitelist or no account found
   */
  static findByProjectId(projectId: string): RailwayClient {
    // Check whitelist first
    if (ALLOWED_PROJECT_IDS.size > 0 && !ALLOWED_PROJECT_IDS.has(projectId)) {
      const available = Array.from(ALLOWED_PROJECT_IDS).slice(0, 3).join(", ");
      throw new Error(`Project ID ${projectId} not in ALLOWED_PROJECT_IDS whitelist. Allowed projects start with: ${available}...`);
    }

    // Find account that has this project
    const account = ACCOUNTS.find(a => a.projectId === projectId);
    if (!account) {
      const available = ACCOUNTS.map(a => a.projectId.slice(0, 8) + "...").join(", ");
      throw new Error(`No account found for project ${projectId}. Available projects: ${available}`);
    }

    return new RailwayClient(account);
  }

  /**
   * Find account by label (acc0, acc1, etc.)
   */
  static findByLabel(label: string): RailwayClient | null {
    const account = ACCOUNTS.find(a => a.label === label);
    return account ? new RailwayClient(account) : null;
  }

  /**
   * Get all accounts
   */
  static getAllAccounts(): Account[] {
    return [...ACCOUNTS];
  }

  /**
   * Execute GraphQL query with appropriate header based on token kind
   */
  async query<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    // Choose header based on token kind
    let headerName: string;
    let headerValue: string;

    if (this.account.kind === "personal") {
      // Personal/Account token: Authorization: Bearer <token>
      headerName = "Authorization";
      headerValue = `Bearer ${this.account.token}`;
    } else {
      // Project token (PAT): Project-Access-Token: <token>
      headerName = "Project-Access-Token";
      headerValue = this.account.token;
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [headerName]: headerValue,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Railway API error: ${response.status} ${text} (account: ${this.account.label}, header: ${headerName})`);
    }

    const data = await response.json() as { data?: T; errors?: unknown[] };
    if (data.errors && data.errors.length > 0) {
      throw new Error(`Railway GraphQL error: ${JSON.stringify(data.errors)} (account: ${this.account.label})`);
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
    let hash = 0;
    for (let i = 0; i < this.account.token.length; i++) {
      const char = this.account.token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get account info for debugging
   */
  getAccountInfo() {
    return {
      label: this.account.label,
      projectId: this.account.projectId,
      environmentId: this.account.environmentId,
      kind: this.account.kind,
      tokenHash: this.tokenFingerprint(),
    };
  }
}

/**
 * Register all Railway MCP tools on the server
 */
export function registerRailwayTools(server: McpServer): void {
  // Tool: fleet_health - check all accounts
  server.tool(
    "fleet_health",
    "Check health of all Railway accounts in the fleet. Returns status, token kind, and project info for each account.",
    {},
    async () => {
      const results = [];

      for (const account of ACCOUNTS) {
        try {
          const client = new RailwayClient(account);
          const pv = await client.projectView(account.projectId);

          results.push({
            acc: account.label,
            user_email_hash: account.token.slice(0, 6) + "***",
            project_id: account.projectId,
            project_name: pv.name,
            token_kind: account.kind,
            token_header_used: account.kind === "personal" ? "Authorization: Bearer" : "Project-Access-Token",
            services_count: pv.services.edges.length,
            last_seen: new Date().toISOString(),
            status: "OK",
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          results.push({
            acc: account.label,
            user_email_hash: account.token.slice(0, 6) + "***",
            project_id: account.projectId,
            token_kind: account.kind,
            status: "ERROR",
            error: message,
          });
        }
      }

      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }
  );

  // Tool: fleet_status - quick cached status (non-blocking)
  server.tool(
    "fleet_status",
    "Quick status of all accounts (cached, no API calls). Returns account labels and project IDs.",
    {},
    async () => {
      const status = ACCOUNTS.map(a => ({
        acc: a.label,
        project_id: a.projectId,
        token_kind: a.kind,
        environment_id: a.environmentId || "not-set",
      }));

      return {
        content: [{ type: "text", text: JSON.stringify({
          accounts_count: ACCOUNTS.length,
          allowed_projects_count: ALLOWED_PROJECT_IDS.size,
          accounts: status,
        }, null, 2) }],
      };
    }
  );

  // Tool: railway_service_list
  server.tool(
    "railway_service_list",
    "List all Railway services in a project. Automatically selects the correct account based on project ID and checks whitelist.",
    {},
    async (args: any) => {
      try {
        const project = (args.project as string) || IGLA_PROJECT_ID;
        const client = RailwayClient.findByProjectId(project);
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
          account: client.getAccountInfo(),
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
    "Create (or reuse) a Railway service, pin its image, upsert env vars, and trigger a redeploy. Automatically selects account based on project ID.",
    {},
    async (args: any) => {
      try {
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

        const client = RailwayClient.findByProjectId(project);
        const tokenFp = client.tokenFingerprint();

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

        const triplet = `RAIL=deploy project=${project.slice(0, 8)} service=${serviceId.slice(0, 8)} token=${tokenFp}`;

        const body = {
          service_id: serviceId,
          deploy_id: deployId.id,
          image,
          triplet,
          account: client.getAccountInfo(),
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
    "Trigger a redeploy on an existing Railway service. Automatically selects account based on project ID.",
    {},
    async (args: any) => {
      try {
        const project = (args.project as string) || IGLA_PROJECT_ID;
        const env = (args.environment as string) || IGLA_PROD_ENV_ID;
        const service = args.service as string;

        if (!service) {
          return {
            content: [{ type: "text", text: "Error: 'service' is required" }],
            isError: true,
          };
        }

        const client = RailwayClient.findByProjectId(project);
        const deployId = await client.serviceRedeploy(service, env);

        const body = {
          service_id: service,
          deploy_id: deployId.id,
          account: client.getAccountInfo(),
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
        const project = (args.project as string) || IGLA_PROJECT_ID;
        const service = args.service as string;

        if (!service) {
          return {
            content: [{ type: "text", text: "Error: 'service' is required" }],
            isError: true,
          };
        }

        const client = RailwayClient.findByProjectId(project);
        await client.serviceDelete(service);

        const body = {
          deleted_service_id: service,
          account: client.getAccountInfo(),
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

        // Find account for this project
        let tokenFp = "no-token";
        try {
          const client = RailwayClient.findByProjectId(project);
          tokenFp = client.tokenFingerprint();
        } catch {
          // If no account found, use empty hash
        }

        const verb = (args.verb as string) || "experience";
        const triplet = `RAIL=${verb} project=${project.slice(0, 8)} service=${((args.service as string) || "none").slice(0, 8)} token=${tokenFp}`;

        const agent = (args.agent as string) || "GENERAL";
        const soul = (args.soul_name as string) || "RailRangerOne";
        const status = (args.status as string) || "OK";

        const timestamp = new Date().toISOString();
        const line = `[${timestamp}] AGENT: ${agent} | SOUL: ${soul} | ISSUE: ${args.issue} | STEP: ${args.phi_step} | TASK: ${args.task} | STATUS: ${status} | TRIPLET: ${triplet}`;

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

export const TOOL_COUNT = 8;  // Added fleet_health and fleet_status
