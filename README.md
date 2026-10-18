<p align="center">
  <img src="docs/assets/hero.png" alt="Burrow Backdoor — agent diagnostics and administration for the home Burrow" width="720" />
</p>

# Burrow Backdoor [Burrow Mod]

*Sometimes we have to enter from the rear.*

Burrow Backdoor gives an agent a controlled path back into the **home Burrow that hosts it**, even when the agent's shell and filesystem tools are pointed at a Node Goblin machine. It exposes caller-scoped diagnostics to every agent and explicit Core mod-management operations to operator-selected administrators. It does not create a separate MCP connection, call Burrow's external HTTP API, or require an API token.

Backdoor is a **system mod** because it requests a privileged Core application interface unavailable to regular mods. It uses the same install, update, enable, disable, and uninstall lifecycle as other mods. System status grants nothing by itself; this manifest requests only `mod-management-v1`.

## Install

1. Open **Settings → Mods** in Burrow.
2. Add the Backdoor repository as a mod source.
3. Refresh the source and install **Burrow Backdoor**.
4. Explicitly enable the mod. Newly installed mods remain disabled by design.
5. Open **Settings → Burrow Backdoor → Agent access** and assign any administrative agents deliberately.

Once enabled, Burrow registers **Mod: Burrow Backdoor** with 26 diagnostic tools and 8 administrative tools. They are globally discoverable mod-authorized tools, but Core still authorizes every call from its trusted caller identity.

Backdoor requires a Core version that supports the declared `mod-management-v1` system capability. It fails activation rather than silently running with a weaker contract.

## Access model

Backdoor has two independent operator-managed access lists.

### Global diagnostic access

Every agent can inspect its own sessions, runs, traces, context, saved-memory metadata, and other agent-owned diagnostic records. Agents in `globalAgentIds` can also inspect other agents and installation-wide records such as Forge and mod jobs. Model-supplied `agentId` values never establish authority.

### Burrow administrative access

Only agents in `adminAgentIds` can use mod-management tools. Diagnostic global access does not imply administrative access, and administrative access does not imply global diagnostics. Core checks membership using the owner mod's settings and trusted active tool caller on every management request.

The Settings UI/API that changes these assignments follows normal operator authentication. Internal agent tool calls do not depend on browser cookies, Basic Auth, OIDC, bearer tokens, or the selected Node Goblin target.

## Diagnostic tools

| Area | Tools | What they provide |
| --- | --- | --- |
| Runtime | `burrow_health`, `burrow_runtime_status`, `burrow_metrics`, `burrow_inventory`, `burrow_postgres_status` | Health, release/configuration status, configured-runtime-filesystem metrics, MCP/mod counts, and PostgreSQL connectivity/version/pgvector status |
| Agents and sessions | `burrow_list_agents`, `burrow_agent_status`, `burrow_list_sessions`, `burrow_get_session`, `burrow_get_session_context`, `burrow_context_status` | Agent assignments, compact session summaries, a bounded recent session tail, and scalar context/compression summaries |
| Runs and evidence | `burrow_active_runs`, `burrow_list_traces`, `burrow_get_trace`, `burrow_get_trace_authority`, `burrow_list_run_proofs`, `burrow_get_run_proof` | Bounded active-work summaries, paginated traces, authority evidence, and archived runtime proofs |
| Forge | `burrow_list_forge_jobs`, `burrow_get_forge_job` | Sanitized job status, mode, timestamps, and artifact count |
| Mods | `burrow_list_mods`, `burrow_list_mod_jobs`, `burrow_get_mod_job`, `burrow_mod_pending_operations` | Mod lifecycle/diagnostic support, opt-in job summaries, and current Core-hosted capability operations |
| Brains | `burrow_brains_status`, `burrow_list_brain_memories`, `burrow_list_brain_embedding_jobs` | Saved-memory counts and metadata, embedding/index state, and retry metadata |

### Diagnostic result boundaries

- `burrow_get_session` is a diagnostic tail, not a complete transcript reader. It defaults to 50 turns and 1,000-character previews; `limit` is capped at 100 while `maxContentChars` is configurable.
- `burrow_list_traces` defaults to 50, caps at 100, and returns `nextCursor` for continuation. The traversal is live rather than a retained snapshot.
- Session-context and context-status tools omit transcript, prompt/support, evidence-selection, summary-text, and compression-history bodies.
- Active-run results omit messages, answers, steering bodies, progress payloads, child purpose/results/errors, and other potentially huge content.
- `burrow_get_trace` omits tool output by default. `includeToolOutput: true` requests the existing bounded trace preview.
- Forge summaries exclude prompts, model settings, provider errors, and artifact URLs. PostgreSQL diagnostics expose no connection credentials.
- Mod diagnostics are opt-in and read through dedicated Core interfaces, not arbitrary mod routes.
- Brains listings contain metadata only, excluding memory text, titles, vectors, actual source references, legacy snapshots, and provider payloads.

Read-only does not mean safe to publish. Review and redact diagnostics before putting them into public reports.

## Administrative tools

| Tool | Operation |
| --- | --- |
| `burrow_mod_management_inventory` | List sanitized configured source status and installable/installed mods with offset pagination |
| `burrow_refresh_mod_sources` | Queue refresh of already configured sources |
| `burrow_install_mod` | Queue installation through Core's normal distribution service |
| `burrow_update_mod` | Queue update through the same install/update path |
| `burrow_enable_mod` / `burrow_disable_mod` | Queue lifecycle intent changes |
| `burrow_uninstall_mod` | Queue normal uninstall while preserving Core lifecycle invariants |
| `burrow_get_mod_operation` | Inspect a durable operation by ID |

Mutations return a persisted operation receipt promptly. `queued` or `running` means accepted/in progress—not success. Inspect the operation in a later tool call until it reaches `succeeded`, `failed`, or `interrupted`. Core waits for the submitting invocation to settle before mutation, so Backdoor can return its own update/disable/uninstall receipt before its old host is retired. A Core restart marks uncertain in-flight work `interrupted` rather than blindly replaying a mutation that may already have committed.

Backdoor cannot add or remove sources and cannot receive source URLs, GitHub tokens, browser credentials, arbitrary installer flags, raw error bodies, database access, controller filesystem/process access, or arbitrary HTTP access. Source credentials already stored by Core remain inside Core.

## Security boundary

- Core supplies caller agent/session/conversation/run identity; tool arguments cannot impersonate it.
- Diagnostic `globalAgentIds` and administrative `adminAgentIds` are separate.
- The mod receives only `context.runtimeDiagnostics.read` and its declared `context.modManagement` facade for these operations.
- Lifecycle work reuses Core's mod-distribution validation, recovery journals, source authentication, transitions, and persisted operation records.
- Backdoor does not receive model/database/source credentials or direct filesystem/process access.
- Node Goblin continues to own execution against the selected machine; Backdoor operates the home Burrow.
- Disabling or unloading Backdoor revokes new live tool routing. Already accepted lifecycle operations are Core-owned and continue to terminal or interrupted state.
- Backdoor uses the normal mod lifecycle. Being a system mod does not make it bundled or non-removable.

## Configuration

Backdoor has no service URL, bearer token, listener, container, or proxy configuration. Its settings are the operator-managed global-diagnostic and Burrow-administrator agent lists. Disabling the mod preserves those settings for re-enable.

## Development

Use Node.js 24.x. Run:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run check
```

The mod manifest is `burrow.mod.json`; the server entry is `src/mod.mjs`; the operator settings UI is `ui/settings.js`. Core integration tests run against the sibling Burrow Backend checkout when available.

Releases use UTC calendar versions (`YYYY.MM.DD[.N]`). GitHub Actions assigns the next available revision on `main`, synchronizes the manifest/package release identity, tags it, and publishes the GitHub release.
