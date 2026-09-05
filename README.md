# Burrow-Backdoor

Burrow-Backdoor is a **read-only diagnostic MCP server** for tracing problems through Burrow's own authenticated HTTP API.

It does not read Burrow's SQLite databases or runtime files directly. Burrow Core remains authoritative. Despite the suspicious name, this is not an authentication bypass.

## Initial tools

- `burrow_health`
- `burrow_list_agents`
- `burrow_agent_status`
- `burrow_list_sessions`
- `burrow_get_session`
- `burrow_active_runs`
- `burrow_list_traces`
- `burrow_get_trace`
- `burrow_get_trace_authority`
- `burrow_list_run_proofs`
- `burrow_get_run_proof`
- `burrow_context_status`

Every tool is annotated read-only. Mutation and recovery actions are deliberately deferred.

## Configuration

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `BURROW_BASE_URL` | yes | — | Burrow HTTP origin, e.g. `http://burrow:42817` |
| `BURROW_API_TOKEN` | yes | — | Core-issued token with `diagnostics:read` |
| `HOST` | no | `0.0.0.0` | MCP listener address |
| `PORT` | no | `8080` | MCP listener port |
| `MCP_PATH` | no | `/mcp` | Streamable HTTP endpoint |

Never commit the API token. Burrow returns plaintext only when the token is created; it stores a SHA-256 digest and metadata.

## Run

```sh
cp .env.example .env
# fill in BURROW_BASE_URL and BURROW_API_TOKEN
docker compose up -d --build
curl -fsS http://127.0.0.1:8080/healthz
```

MCP endpoint: `http://<host>:8080/mcp`

## Security boundary

The first release accepts only the Core `diagnostics:read` scope. Core maps that scope to an explicit GET-only endpoint allowlist. A token cannot call chat, settings, filesystem mutation, TaskBoard mutation, cancellation, or mod lifecycle endpoints.

The MCP transport itself should remain on a trusted network or behind authenticated TLS. Possession of its Burrow token grants access to potentially sensitive diagnostic history.
