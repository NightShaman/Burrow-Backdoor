# Burrow Backdoor

*Sometimes we have to enter from the rear.*

Burrow Backdoor gives an MCP client a read-only view into a running Burrow installation. Use it to investigate an agent that looks stuck, follow a run through its traces, check saved-memory indexing, or see what Core knows about a mod's work.

It runs as a separate service and talks to Burrow's authenticated HTTP API. Core owns the data, permissions, and diagnostic redaction. Backdoor does not open Burrow's databases or runtime files, and it cannot repair, cancel, or restart work.

## Before you start

You need:

- A running Burrow Core with API tokens and the diagnostics endpoints you want to use. Newer tools need matching Core support; an older Core may reject them.
- A Core-issued token with the `diagnostics:read` scope.
- Network access from Backdoor to your Burrow HTTP origin.
- Docker with Docker Compose, or Node.js 24.x for a source installation.
- An MCP client that supports **Streamable HTTP**.

**Protect the MCP endpoint before starting it.** Backdoor has no built-in client authentication or TLS. Anyone who can reach it can use its configured Core token indirectly through the diagnostic tools. The supplied Compose file publishes port 8080 on every host interface. Start with loopback access, or put it behind an authenticated TLS proxy and prevent clients from reaching the raw port.

## Install and connect

### 1. Create a diagnostic token

In Burrow, open **Settings → Connections → API tokens**. Give the token a recognizable name, choose an expiry if needed, and select **Create API token**. The scope is `diagnostics:read`.

Copy the token when it is shown. Burrow only reveals the plaintext at creation. Keep it out of Git, screenshots, client prompts, and support reports.

### 2. Configure Backdoor

From a checkout of this repository:

```sh
cp .env.example .env
chmod 600 .env
```

Edit `.env` and set:

- `BURROW_BASE_URL` to your Burrow origin, including scheme and port, without an `/api` suffix.
- `BURROW_API_TOKEN` to the token you just created.

The example `http://burrow:42817` only works when that hostname resolves from Backdoor. The supplied Compose file does not join an existing Burrow network automatically. Use an address reachable from the container, or deliberately configure a shared Docker network. Inside a container, `127.0.0.1` refers to that container, not your host or another container.

Use HTTPS between machines unless the connection is protected by a trusted private network or tunnel.

### 3. Start with Docker Compose

Before starting, edit the port mapping in `compose.yml` from `0.0.0.0:8080:8080` to:

```yaml
      - "127.0.0.1:8080:8080"
```

This keeps the host port local. It is suitable for an MCP client on the same host or a deliberately configured local proxy/tunnel. Remote clients need a protected route to the service; do not simply open the raw port to the Internet.

The supplied Compose file pulls `ghcr.io/nightshaman/burrow-backdoor:latest`. If that package is private, authenticate Docker to GHCR with a credential permitted to read it before pulling. Public source visibility does not automatically make the container package public.

```sh
docker compose pull
docker compose up -d
curl -fsS http://127.0.0.1:8080/healthz
```

`/healthz` checks the Backdoor process only. It does **not** verify your Core address, token, or diagnostics access.

### 4. Connect your MCP client

Add a **Streamable HTTP** server using `http://127.0.0.1:8080/mcp` for a client on the same host. For a remote client, use your protected proxy or tunnel address instead. There is no stdio transport in this implementation.

The Core token belongs in Backdoor's environment. It is not an MCP client password; any client authentication must be enforced by your proxy or network boundary.

Refresh the client's tools, then call `burrow_health`. A successful response checks the full client → Backdoor → Core path. There are currently 24 tools.

For a first investigation, ask your client:

> Check Burrow health and list its agents. For the agent I select, show active runs and recent sessions, then inspect the relevant trace without including tool output.

IDs returned by the list tools can be used in the corresponding detail tools. Treat the results as private operational data.

### Run from source instead

Use Node.js 24.x, as used by the container and CI. After configuring `.env`, change its `HOST` to `127.0.0.1` for local-only access:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run check
node --env-file=.env src/server.mjs
```

`npm start` starts the server but does not load `.env` itself. Use it only when the required variables are already supplied by your process manager or shell.

## What you can inspect

| Area | Tools | What they provide |
| --- | --- | --- |
| Runtime | `burrow_health`, `burrow_metrics`, `burrow_inventory`, `burrow_postgres_status` | Health, host metrics, MCP/mod counts, and PostgreSQL connectivity/version/pgvector status |
| Agents and sessions | `burrow_list_agents`, `burrow_agent_status`, `burrow_list_sessions`, `burrow_get_session`, `burrow_context_status` | Agent assignments, current state, recent conversations, and context/compression status |
| Runs and evidence | `burrow_active_runs`, `burrow_list_traces`, `burrow_get_trace`, `burrow_get_trace_authority`, `burrow_list_run_proofs`, `burrow_get_run_proof` | Active work, recorded traces, authority evidence, and archived runtime proofs |
| Forge | `burrow_list_forge_jobs`, `burrow_get_forge_job` | Sanitized job status, mode, timestamps, and artifact count |
| Mods | `burrow_list_mods`, `burrow_list_mod_jobs`, `burrow_get_mod_job`, `burrow_mod_pending_operations` | Mod lifecycle/diagnostic support, opt-in job summaries, and pending Core-hosted operations |
| Brains | `burrow_brains_status`, `burrow_list_brain_memories`, `burrow_list_brain_embedding_jobs` | Saved-memory counts and metadata, embedding/index state, and retry metadata |

Each tool is annotated read-only and uses a fixed Core GET route. The [tool definitions](src/tools.mjs) contain the exact accepted arguments.

### Reading the results

- **Sessions and traces can contain sensitive material.** `burrow_get_trace` omits tool output by default; `includeToolOutput: true` requests it. Read-only access does not mean the output is safe to publish.
- **Forge summaries exclude** prompts, model settings, provider errors, and artifact URLs. PostgreSQL diagnostics do not expose connection credentials.
- **Mod diagnostics are opt-in.** Core uses dedicated diagnostic endpoints, not arbitrary mod routes. Unsupported or unavailable diagnostics are different from a supported tool returning no jobs. Job pages accept up to 100 records; use `nextCursor` when present.
- **Pending operations and progress counters are observations.** Elapsed time, recorded work, and retry attempts do not prove that a worker is currently making progress.
- **Brains counts are decimal strings.** Omitting `agentId` from status or embedding-job queries gives a global view. Saved-memory metadata listing requires `agentId`. An agent filter scopes counts, not the global embedding configuration.
- **Brains listings contain metadata only**, including soft-deleted and migrated records. They exclude titles, memory text, actual source references, legacy snapshots, vectors, and provider error payloads. Reads do not reindex, reconcile settings, call embedding providers, or modify memories.
- **Brains pagination defaults to 50.** Positive safe-integer limits are accepted; choose a sensible page size. Follow `nextCursor` until it is null, keeping the route and agent scope unchanged. Restart pagination when changing scope. Pages are not a single snapshot across concurrent changes.

## Configuration

| Variable | Required | Server default | Purpose |
| --- | --- | --- | --- |
| `BURROW_BASE_URL` | Yes | None | Burrow HTTP origin reachable from Backdoor |
| `BURROW_API_TOKEN` | Yes | None | Core-issued `diagnostics:read` token |
| `HOST` | No | `0.0.0.0` | Backdoor listener address |
| `PORT` | No | `8080` | Backdoor listener port |
| `MCP_PATH` | No | `/mcp` | Streamable HTTP endpoint path |

The supplied Compose file reads only `BURROW_BASE_URL` and `BURROW_API_TOKEN` from `.env`. It explicitly sets `HOST`, `PORT`, and `MCP_PATH`; changing those three values in `.env` alone will not change a Compose deployment. Edit the Compose configuration and port mapping together when needed. The process health endpoint remains `/healthz`.

## Access and security

Backdoor is for trusted operators and diagnostic clients. Its name is a joke, not an authentication bypass.

- Core enforces the token's `diagnostics:read` allowlist. It does not grant access to mutation, recovery, settings changes, cancellation, or mod lifecycle actions.
- Backdoor forwards Core responses; redaction and data selection belong to Core. Do not assume every response is sanitized to the same degree as the dedicated Forge, mod, and Brains summaries.
- Everyone allowed to use this Backdoor instance shares the diagnostic reach of its one Core token. There is no per-client or per-agent authorization layer here; an `agentId` filter is not an access restriction.
- Protect both the token and the MCP endpoint. Use authenticated TLS for remote access and restrict the backend listener so it cannot bypass the proxy. TLS alone does not authenticate a client.
- Backdoor needs no database credentials, database volumes, or Burrow runtime-directory mounts.

To retire access, revoke the token in Burrow and stop the service or remove the client's route to it. To rotate a token, create a replacement, update `.env`, recreate the container with `docker compose up -d --force-recreate`, verify `burrow_health`, and revoke the old token.

## Updates and troubleshooting

For an image update:

```sh
docker compose pull
docker compose up -d
```

Repeat both the `/healthz` check and an MCP `burrow_health` call. `latest` moves; pin the image in `compose.yml` to a published version, commit tag, or digest when you need reproducible deployments.

Useful commands:

```sh
docker compose ps
docker compose logs --tail=100 burrow-backdoor
docker compose down
```

Review and redact logs before sharing them. Avoid pasting `.env` or rendered Compose configuration into a report because it can contain the token.

| Symptom | Check |
| --- | --- |
| Image pull is denied | Verify the image reference, package availability, and GHCR read access. Repository and package visibility are separate. |
| Startup reports a missing variable | Set both required variables in `.env` for Compose, or load/export them for a source run. |
| `/healthz` works but tools fail | Check Core reachability from Backdoor, the token's validity/expiry, and Core endpoint support. Process health alone does not test those. |
| `403 api_token_forbidden` | Check Core compatibility and the diagnostics allowlist. Older Core versions can reject newer tools; update Core rather than widening token access. |
| `/mcp` returns “No valid session ID provided” | Use a Streamable HTTP MCP client that initializes a session. A plain browser request is not an MCP session. Reconnect after a restart. |
| Empty or unavailable mod results | Check whether the mod is enabled and implements diagnostic adapters. Unsupported/unavailable is not evidence that there is no work. |

For a useful bug report, include the Backdoor image tag or commit, Core version, tool name, redacted arguments, and exact error. Remove tokens, private conversation content, and sensitive tool output.

## Development and publishing

Run `npm run check` before submitting changes. It runs the source check command and Node's test suite, including a real MCP HTTP round trip against a fixture Core server. Tests do not need a real Burrow token or a running Burrow installation.

The [container workflow](.github/workflows/container.yml) checks/tests the source, builds the container, and smoke-tests `/healthz` on pull requests and pushes to `main`. Successful non-PR runs on `main` publish to `ghcr.io/<repository-owner>/<repository-name>` in lowercase using `GITHUB_TOKEN`. Manual dispatch follows the same main-only publishing condition.

Published tags are `latest`, `sha-<full commit>`, and a UTC calendar version of the form `YYYY.MM.DD.<GitHub run number>`. The workflow uses the standard Ubuntu runner and does not configure a multi-architecture build. The smoke test checks process health using a dummy token, not a live Core integration.

The supplied Compose image reference currently points to NightShaman's package. A repository mirror or ownership change does not rewrite that reference or configure synchronization. Verify the intended image and package access before distributing deployment instructions.

This README is maintained by hand alongside the implementation. Keep the setup, defaults, and tool descriptions in step with code changes.

## License

`package.json` currently declares `UNLICENSED`, and this repository has no license file. Public visibility alone does not grant an open-source license.
