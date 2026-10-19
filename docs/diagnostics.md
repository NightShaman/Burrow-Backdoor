# Diagnose your Burrow

## A useful first pass

1. Call `burrow_health` for runtime health and build identity.
2. Call `burrow_runtime_status` for release/configuration, model-selection, policy, retention, and trace-observability status.
3. Call `burrow_list_sessions` and identify the session to investigate.
4. Inspect `burrow_agent_status`, `burrow_active_runs`, and `burrow_context_status` for that session.
5. Use `burrow_list_traces`, then `burrow_get_trace` and `burrow_get_trace_authority` for a relevant run.

Leave `agentId` out for caller-scoped work. Supply another agent only when your caller has global diagnostic access. Session/run identifiers must still resolve within the authorized scope.

## Read the right level of detail

`burrow_get_session` returns a **recent diagnostic tail**, not a complete conversation. The default is 50 turns with 1,000-character previews; the maximum turn limit is 100. `maxContentChars` is configurable. Use normal conversation reading for complete history.

Trace listing defaults to 50 and caps at 100. Continue using the returned `nextCursor`; traversal is live rather than a retained snapshot. Trace detail omits tool output unless `includeToolOutput: true` requests the existing bounded preview.

Context tools return scalar context/compression information, not transcript, prompt/support, summary-text, evidence-selection, or compression-history bodies. Active-run summaries exclude messages, answers, steering bodies, progress payloads, and child purpose/result/error bodies.

## Installation-wide investigations

Global diagnosticians can inspect Forge and opt-in mod jobs. Start with `burrow_list_mods` to see lifecycle and diagnostic support. A mod can report `supported`, `unsupported`, or `unavailable`; an unsupported diagnostic interface is not proof that the mod is broken.

`burrow_mod_pending_operations` reports current Core-hosted capability work. It is not the durable lifecycle-operation history. Use [management operation lookup](operations.md) for an accepted install/update/disable receipt.

`burrow_postgres_status` reports connectivity, server major version, and pgvector availability without connection credentials. `burrow_metrics` covers host process, load, and the configured runtime filesystem. Inventory is count-only.

## Brains and Forge

Brains tools expose saved-memory counts, metadata, embedding/index state, and retry metadata. They exclude memory titles/text, vectors, actual source references, legacy snapshots, and provider payloads. Forge summaries exclude prompts, model settings, provider errors, and artifact URLs.

!!! warning "Read-only is still private"
    Session previews, runtime evidence, agent identifiers, and operational metadata can be sensitive. Share only the information needed, after review and redaction.

All arguments are listed in the [tool reference](tools.md).
