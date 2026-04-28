# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-04-28

### Added
- Initial release of `@ghashtag/trios-railway-mcp`
- Streamable HTTP MCP server for Railway service management
- 6 MCP tools:
  - `railway_service_list` - List services in a project
  - `railway_service_deploy` - Create/deploy services
  - `railway_service_redeploy` - Redeploy existing services
  - `railway_service_delete` - Delete services (with R9 safety)
  - `railway_experience_append` - Append to L7 experience log
  - `railway_audit_migrate_sql` - Get Neon DDL for audit tables
- Basic authentication support
- Health check endpoint (`/health`)
- Configurable via environment variables
- TypeScript implementation with full type safety

### Features
- Stateless MCP server (fresh instance per request)
- Railway GraphQL API integration
- IGLA project defaults (`e4fe33bb-3b09-4842-9782-7d2dea1abc9b`)
- Production environment defaults
- Triplet emission for audit trails (R7 compliance)
- R9 safety: `confirm: true` required for destructive operations

### Documentation
- Comprehensive README
- Tool descriptions in MCP schema
- Example client connection code
- Deployment guide for Railway

### License
- Apache-2.0

### Anchor
- phi^2 + phi^-2 = 3
