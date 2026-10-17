<p align="center">
  <img src="docs/assets/hero.png" alt="Burrow Backdoor — read-only diagnostics for Burrow" width="720" />
</p>

# Burrow Backdoor [Burrow MCP]

*Sometimes we have to enter from the rear.*

Burrow Backdoor is an installable Burrow mod that gives every agent read-only diagnostic tools without creating a separate MCP connection or API token. Core owns the data, caller identity, scope enforcement, and redaction; the mod maps those approved diagnostics into a mod-managed MCP provider.

## Install

1. Open **Settings → Mods** in Burrow.
2. Add the Backdoor repository as a mod source.
3. Refresh the source and install **Burrow Backdoor**.
4. Explicitly enable the mod. Newly installed mods remain disabled by design.

Once enabled, Burrow registers the provider as **Mod: Burrow Backdoor** with 26 read-only tools. The tools are available to all agents without per-tool grants.

## Access model

Every agent can inspect its own sessions, runs, traces, context, saved-memory metadata, and other agent-owned diagnostic records. Model-supplied `agentId` values never establish authority; Core binds each call to the trusted calling agent.

In **Settings → Burrow Backdoor → Agent access**, the operator may select agents that need global diagnostic scope. Selected agents can inspect other agents and installation-wide diagnostic records such as Forge and mod jobs. Unselected agents remain own-scope.

Backdoor is read-only, but diagnostic data can still be sensitive. Do not paste sessions, traces, context, or tool output into public reports without reviewing and redacting it.

## What you can inspect

| Area | Tools | What they provide |
| --- | --- | --- |
| Runtime | `burrow_health`, `burrow_runtime_status`, `burrow_metrics`, `burrow_inventory`, `burrow_postgres_status` | Health, release/configuration status, host metrics, MCP/mod counts, and PostgreSQL connectivity/version/pgvector status |
| Agents and sessions | `burrow_list_agents`, `burrow_agent_status`, `burrow_list_sessions`, `burrow_get_session`, `burrow_get_session_context`, `burrow_context_status` | Agent assignments, current state, recent conversations, context composition, live usage, and compression status |
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

Backdoor has no service URL, bearer token, listener, container, or proxy configuration in mod mode. Its only setting is the operator-managed list of agents granted global diagnostic scope. Disabling the mod removes the live provider while preserving its settings for re-enable.

## Security boundary

- Every tool is registered as a mod-authorized, read-only tool.
- Core supplies the trusted caller identity; tool arguments cannot impersonate another agent.
- Ordinary callers default to their own agent and current session. Cross-agent requests are denied.
- Installation-wide records without agent ownership require global diagnostic scope.
- Backdoor receives no database credentials, model credentials, filesystem access, or arbitrary HTTP capability.
- Disabling or unloading the mod revokes live tool routing immediately.

## Development

Use Node.js 24.x. Run:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run check
```

The mod manifest is `burrow.mod.json`; the server entry is `src/mod.mjs`; the operator settings UI is `ui/settings.js`. Core integration tests run against the sibling Burrow Backend checkout when available.

## License

See [`LICENSE`](LICENSE).
