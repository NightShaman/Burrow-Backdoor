# Tool reference

Backdoor registers 34 tools under **Mod: Burrow Backdoor**. All schemas reject additional properties. Tools are discoverable as mod-authorized tools; Core still checks the trusted caller on every call. See [agent access](access.md) and [diagnostic limits](diagnostics.md).

Required arguments are marked **required**. Other arguments are optional. No arguments means `{}`. Bounds below describe the advertised schema; Core may apply additional validation, scoping, pagination, and output limits.

## Diagnostic tools

### burrow_brains_status

Read scoped saved-memory counts and embedding configuration/index status; no memory content or credentials.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |

### burrow_list_brain_memories

List caller-authorized saved-memory metadata; excludes titles, content, source refs and legacy snapshots.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |
| `limit` | integer | optional; minimum: 1; maximum: 9007199254740991 |
| `cursor` | string | optional; minLength: 1 |

### burrow_list_brain_embedding_jobs

List caller-authorized embedding retry metadata and sanitized failure codes.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |
| `limit` | integer | optional; minimum: 1; maximum: 9007199254740991 |
| `cursor` | string | optional; minLength: 1 |

### burrow_postgres_status

Read PostgreSQL connectivity, server major and pgvector availability without connection details.

No arguments.

### burrow_list_forge_jobs

List sanitized Forge jobs when the caller has global diagnostic scope.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `limit` | integer | optional; minimum: 1; maximum: 100 |
| `cursor` | string | optional; pattern: `^[1-9]\d*$` |

### burrow_get_forge_job

Read one sanitized Forge job when the caller has global diagnostic scope.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `jobId` | string | **required**; format: uuid |

### burrow_inventory

Read safe count-only MCP and mod inventory.

No arguments.

### burrow_metrics

Read host process, configured-runtime-filesystem and load metrics.

No arguments.

### burrow_list_mods

List installed mod lifecycle and diagnostic support.

No arguments.

### burrow_list_mod_jobs

List sanitized mod jobs when the caller has global diagnostic scope.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `modId` | string | **required**; maxLength: 128; pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `limit` | integer | optional; minimum: 1; maximum: 100 |
| `cursor` | string | optional; maxLength: 256 |

### burrow_mod_pending_operations

Read current Core-hosted mod capability operations when the caller has global diagnostic scope.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `modId` | string | **required**; maxLength: 128; pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

### burrow_get_mod_job

Inspect one sanitized mod job when the caller has global diagnostic scope.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `modId` | string | **required**; maxLength: 128; pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `jobId` | string | **required**; pattern: `^[A-Za-z0-9_-]{1,128}$` |

### burrow_health

Read Burrow runtime health and build identity.

No arguments.

### burrow_runtime_status

Read runtime, release, model-selection, policy, retention and trace-observability status for an authorized agent.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |

### burrow_list_agents

List Burrow agent identities and execution assignments.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `includeDisabled` | boolean | optional |

### burrow_agent_status

Read current status for an authorized agent session.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |
| `sessionId` | string | optional; minLength: 1 |

### burrow_list_sessions

List compact session summaries for an authorized agent.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |
| `archived` | boolean | optional |
| `limit` | integer | optional; minimum: 1; maximum: 200 |

### burrow_get_session

Read a bounded recent session tail for an authorized agent. Use conversation reading for complete history.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |
| `sessionId` | string | **required**; minLength: 1 |
| `limit` | integer | optional; minimum: 1; maximum: 100 |
| `maxContentChars` | integer | optional; minimum: 1; maximum: 9007199254740991 |

### burrow_active_runs

List bounded active-run and subagent summaries for an authorized agent and optional session.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |
| `sessionId` | string | optional; minLength: 1 |

### burrow_list_traces

List a bounded page of trace runs for an authorized agent session.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |
| `sessionId` | string | optional; minLength: 1 |
| `limit` | integer | optional; minimum: 1; maximum: 100 |
| `cursor` | string | optional; minLength: 1 |

### burrow_get_trace

Read a summarized trace for an authorized agent; tool output is omitted by default.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `runId` | string | **required**; minLength: 1 |
| `agentId` | string | optional; minLength: 1 |
| `sessionId` | string | optional; minLength: 1 |
| `includeToolOutput` | boolean | optional |

### burrow_get_trace_authority

Explain authority evidence for one authorized trace.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `runId` | string | **required**; minLength: 1 |
| `agentId` | string | optional; minLength: 1 |
| `sessionId` | string | optional; minLength: 1 |

### burrow_list_run_proofs

List archived runtime proofs for an authorized agent/session.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |
| `sessionId` | string | optional; minLength: 1 |
| `limit` | integer | optional; minimum: 1; maximum: 200 |
| `cursor` | string | optional; minLength: 1 |

### burrow_get_run_proof

Read one archived runtime proof for an authorized agent.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `runId` | string | **required**; minLength: 1 |
| `agentId` | string | optional; minLength: 1 |

### burrow_get_session_context

Read a scalar context-composition summary for an authorized agent session; transcript and evidence bodies are excluded.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |
| `sessionId` | string | optional; minLength: 1 |

### burrow_context_status

Read bounded context-window, live usage and compression status for an authorized agent session.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |
| `sessionId` | string | optional; minLength: 1 |

## Administrative tools

All eight tools require administrative access and the approved capability, including inventory and operation lookup. Mutation receipts require [later verification](operations.md).

### burrow_mod_management_inventory

List sanitized configured sources and installable/installed mods. Requires Backdoor administrative access.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `offset` | integer | optional; minimum: 0; maximum: 9007199254740991 |
| `limit` | integer | optional; minimum: 1; maximum: 100 |

### burrow_refresh_mod_sources

Queue a durable refresh of configured mod sources. Requires Backdoor administrative access.

No arguments.

### burrow_install_mod

Queue a durable mod installation through Core. Requires Backdoor administrative access.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `modId` | string | **required**; maxLength: 128; pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `version` | string | optional; maxLength: 128; pattern: `^v?(?:\d{4}\.\d{2}\.\d{2}(?:\.\d+)?&#124;\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)$` |

### burrow_update_mod

Queue a durable mod update through Core. Requires Backdoor administrative access.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `modId` | string | **required**; maxLength: 128; pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `version` | string | optional; maxLength: 128; pattern: `^v?(?:\d{4}\.\d{2}\.\d{2}(?:\.\d+)?&#124;\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)$` |

### burrow_enable_mod

Queue a durable mod enable operation through Core. Requires Backdoor administrative access.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `modId` | string | **required**; maxLength: 128; pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

### burrow_disable_mod

Queue a durable mod disable operation through Core. Requires Backdoor administrative access.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `modId` | string | **required**; maxLength: 128; pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

### burrow_uninstall_mod

Queue a durable mod uninstall operation through Core. Requires Backdoor administrative access.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `modId` | string | **required**; maxLength: 128; pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

### burrow_get_mod_operation

Inspect one durable Backdoor-submitted lifecycle operation. Requires Backdoor administrative access.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `operationId` | string | **required**; format: uuid |

## Input conventions

`agentId` selects a target, never caller identity. Cursors should be passed through exactly as returned. Mod IDs use lowercase letters/digits separated by hyphens; Core reserves `mod-data`. An explicit version must match the currently inspected source latest version; this is a guard, not historical release selection. Use the UUID from the returned management receipt for operation lookup.
