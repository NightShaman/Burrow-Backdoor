# Burrow-Backdoor

Burrow-Backdoor is a **read-only diagnostic MCP server** for tracing problems through Burrow's own authenticated HTTP API.

It does not read Burrow's SQLite databases or runtime files directly. Burrow Core remains authoritative. Despite the suspicious name, this is not an authentication bypass.

## Initial tools

- `burrow_list_mods`, `burrow_list_mod_jobs`, `burrow_get_mod_job`, `burrow_mod_pending_operations` (Core opt-in sanitized diagnostics only)
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
docker compose pull
docker compose up -d
curl -fsS http://127.0.0.1:8080/healthz
```

MCP endpoint: `http://<host>:8080/mcp`

## Security boundary

The first release accepts only the Core `diagnostics:read` scope. Core maps that scope to an explicit GET-only endpoint allowlist. A token cannot call chat, settings, filesystem mutation, TaskBoard mutation, cancellation, or mod lifecycle endpoints.

The MCP transport itself should remain on a trusted network or behind authenticated TLS. Possession of its Burrow token grants access to potentially sensitive diagnostic history.

## Container publishing

GitHub Actions runs source checks/tests, builds the Linux AMD64 container, and
smoke-tests `/healthz` on pull requests and pushes to `main`. Only successful
`main` runs publish to `ghcr.io/nightshaman/burrow-backdoor` using the workflow's
`GITHUB_TOKEN` (`packages: write`); no separate registry secret is required.
Manual workflow dispatch is also supported; publishing remains main-only.

Tags: `latest`, `sha-<full commit>`, and an automatically assigned UTC calendar
version `YYYY.MM.DD.<GitHub run number>`. Pin a version or digest for reproducible
deployments. Compose pulls the published image; deployment does not build locally.

The repository is private. Keep its GHCR package private too; deployment hosts
must authenticate to GHCR with a credential permitted to read the package
(`read:packages`). CI never needs a real Burrow API token: the health smoke test
uses a dummy value and makes no authenticated calls to Burrow.

Mod diagnostics use dedicated Core GET endpoints, never arbitrary mod GET routes. Unsupported, disabled, and unavailable adapters are distinguished from an empty supported job page. Pages are bounded to 100 records; follow `nextCursor` to traverse further. Progress counters indicate recorded work, not proof that a running operation is advancing.
