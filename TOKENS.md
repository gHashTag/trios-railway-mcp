# Railway Token Conventions

This document describes the token types and their usage in the Railway MCP gateway.

## Token Types

### Project Token (PAT)

- **Source**: Created via `/project/<id>/settings/tokens` in Railway dashboard
- **Header**: `Project-Access-Token: <token>`
- **Scope**: Single project only
- **Test query**: `query { project(id:"...") { name } }`
- **Env kind**: `RAILWAY_TOKEN_KIND_ACCX=project`

### Personal/Account Token

- **Source**: Created via `/account/tokens` in Railway dashboard
- **Header**: `Authorization: Bearer <token>`
- **Scope**: All projects accessible by the user
- **Test query**: `query { me { name } }`
- **Env kind**: `RAILWAY_TOKEN_KIND_ACCX=personal`

## Current Token Configuration

| Account | User Email | Project ID | Project Name | Token Kind | Header Used |
|---------|-----------|-----------|-------------|------------|-------------|
| ACC0 | kaglerslomaansc@... | abdf752c-... | trios-trainer | project | Project-Access-Token |
| ACC1 | rumbodzalaclhdv0@... | e4fe33bb-... | IGLA | personal | Authorization: Bearer |
| ACC2 | brabbtjubindt5cug@... | 12c508c7-... | reasonable-perception | personal | Authorization: Bearer |
| ACC3 | gondiigamzevup@... | 8ab06401-... | angelic-embrace | personal | Authorization: Bearer |
| ACC4 | mongepjobeyipy@... | 0247abaa-... | believable-connection | personal | Authorization: Bearer |
| ACC5 | sadloapurold3flw@... | 475a2290-... | robust-radiance | project | Project-Access-Token |
| ACC6 | horsejpyryt8d1pg@... | 475a2290-... | robust-radiance | project | Project-Access-Token |

## Environment Variables

For each account, the following environment variables must be set:

```
RAILWAY_TOKEN_ACCX=<token>
RAILWAY_PROJECT_ID_ACCX=<project-uuid>
RAILWAY_ENVIRONMENT_ID_ACCX=<environment-uuid>
RAILWAY_TOKEN_KIND_ACCX=<project|personal>
```

Where `X` is 0-6.

## Whitelist

The `ALLOWED_PROJECT_IDS` environment variable contains a comma-separated list of project IDs that the MCP gateway is allowed to operate on. This is a security measure to prevent accidental operations on unintended projects.

```
ALLOWED_PROJECT_IDS=abdf752c-...,e4fe33bb-...,12c508c7-...,8ab06401-...,0247abaa-...,475a2290-...
```

Changes to `ALLOWED_PROJECT_IDS` take effect on next MCP server redeploy (no rebuild needed).

## Migration Guide

When adding a new account:

1. Create the token in Railway dashboard
2. Determine if it's a project token or personal token
3. Add the four env variables to `.env` and Railway service
4. Add the project ID to `ALLOWED_PROJECT_IDS`
5. Redeploy the MCP service

**Important**: Never set `RAILWAY_TOKEN_KIND_ACCX=project` for a personal/account token. This will cause 401 errors because the wrong header is used.

## Testing Token Validity

To test if a token works correctly:

```bash
# For project token
curl -H "Project-Access-Token: <token>" \
  -H "Content-Type: application/json" \
  -d '{"query":"query { project(id:\"<project-id>\") { name } }"}' \
  https://backboard.railway.app/graphql/v2

# For personal token
curl -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"query":"query { me { name } }"}' \
  https://backboard.railway.app/graphql/v2
```

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized | Wrong header for token type | Check `RAILWAY_TOKEN_KIND_ACCX` matches token source |
| Project not in whitelist | Project ID missing from `ALLOWED_PROJECT_IDS` | Add project ID to whitelist |
| No account found | Project ID not in any `RAILWAY_PROJECT_ID_ACC*` | Verify project ID matches env var |
