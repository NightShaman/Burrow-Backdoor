import { z } from 'zod';

const text = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], structuredContent: value });
const fail = (error) => ({ isError: true, content: [{ type: 'text', text: JSON.stringify({ ok: false, error: error.message, status: error.status || null, details: error.body || null }, null, 2) }] });

export function registerDiagnosticTools(server, client) {
  const add = (name, description, schema, handler) => server.registerTool(name, { description, inputSchema: schema, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } }, async (input) => {
    try { return text(await handler(input || {})); } catch (error) { return fail(error); }
  });

  // Core owns redaction and database reads; Backdoor never reads memory storage directly.
  const agentId = z.string().refine(value => value.trim().length > 0, 'agentId must not be blank');
  const page = { limit: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).optional(), cursor: z.string().min(1).optional() };
  add('burrow_brains_status', 'Read scoped saved-memory counts and embedding configuration/index status; no memory content or credentials. Omit agentId for global counts.', { agentId: agentId.optional() }, q => client.get('/api/diagnostics/brains', q));
  add('burrow_list_brain_memories', 'List agent-owned saved-memory metadata, including tombstones and migration state, with a continuation cursor. Excludes titles, content, source refs and legacy snapshots.', { agentId, ...page }, q => client.get('/api/diagnostics/brains/memories', q));
  add('burrow_list_brain_embedding_jobs', 'List embedding retry metadata and sanitized failure codes, with a continuation cursor. Recorded attempts are not proof of live progress; no provider calls, memory text or vectors.', { agentId: agentId.optional(), ...page }, q => client.get('/api/diagnostics/brains/embedding-jobs', q));
  add('burrow_postgres_status', 'Read PostgreSQL connectivity, server major and pgvector availability (no connection details).', {}, () => client.get('/api/diagnostics/postgres'));
  add('burrow_list_forge_jobs', 'List sanitized Forge job status summaries with continuation cursor; excludes prompts, artifacts and provider errors.', { limit: z.number().int().min(1).max(100).optional(), cursor: z.string().regex(/^[1-9]\d*$/).optional() }, (q) => client.get('/api/diagnostics/forge/jobs', q));
  add('burrow_get_forge_job', 'Read sanitized Forge job status, mode, timestamps and artifact count only.', { jobId: z.string().uuid() }, ({ jobId }) => client.get(`/api/diagnostics/forge/jobs/${encodeURIComponent(jobId)}`));
  add('burrow_inventory', 'Read safe count-only inventory of configured MCP connections and installed/enabled mods.', {}, () => client.get('/api/diagnostics/inventory'));
  add('burrow_metrics', 'Read host process, filesystem and load metrics.', {}, () => client.get('/api/metrics'));
  add('burrow_list_mods', 'List installed mod names, versions when available, lifecycle status and diagnostic support.', {}, () => client.get('/api/diagnostics/mods'));
  add('burrow_list_mod_jobs', 'List opt-in sanitized mod jobs, with continuation cursor.', { modId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), limit: z.number().int().min(1).max(100).optional(), cursor: z.string().max(256).optional() }, ({ modId, ...q }) => client.get(`/api/diagnostics/mods/${encodeURIComponent(modId)}/jobs`, q));
  add('burrow_mod_pending_operations', 'Read all current Core-hosted mod capability operations and elapsed time (not proof of progress).', { modId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) }, ({ modId }) => client.get(`/api/diagnostics/mods/${encodeURIComponent(modId)}/pending`));
  add('burrow_get_mod_job', 'Inspect one sanitized mod job.', { modId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), jobId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) }, ({ modId, jobId }) => client.get(`/api/diagnostics/mods/${encodeURIComponent(modId)}/jobs/${encodeURIComponent(jobId)}`));
  add('burrow_health', 'Read Burrow runtime health and host/configuration status.', {}, () => client.get('/api/health'));
  add('burrow_runtime_status', 'Read Burrow runtime, release, model-selection, policy, retention and trace-observability status, optionally for one agent.', { agentId: agentId.optional() }, (q) => client.get('/api/status', q));
  add('burrow_list_agents', 'List Burrow agents and their execution-environment assignments.', { includeDisabled: z.boolean().optional() }, ({ includeDisabled }) => client.get('/api/agents', { includeDisabled }));
  add('burrow_agent_status', 'Read current status for an agent session.', { agentId: z.string().optional(), sessionId: z.string().optional() }, (q) => client.get('/api/agent-status', q));
  add('burrow_list_sessions', 'List recent sessions, optionally for one agent.', { agentId: z.string().optional(), archived: z.boolean().optional(), limit: z.number().int().min(1).max(200).optional() }, (q) => client.get('/api/sessions', q));
  add('burrow_get_session', 'Read one session and its recent conversation state.', { agentId: z.string().optional(), sessionId: z.string().min(1) }, ({ agentId, sessionId }) => client.get(`/api/sessions/${encodeURIComponent(sessionId)}`, { agentId }));
  add('burrow_active_runs', 'List active chat runs, optionally filtered by agent and session.', { agentId: z.string().optional(), sessionId: z.string().optional() }, (q) => client.get('/api/chat/runs/active', q));
  add('burrow_list_traces', 'List trace runs for an agent session.', { agentId: z.string().optional(), sessionId: z.string().optional() }, (q) => client.get('/api/traces', q));
  add('burrow_get_trace', 'Read a summarized trace for one run. Tool output is omitted by default.', { runId: z.string().min(1), agentId: z.string().optional(), sessionId: z.string().optional(), includeToolOutput: z.boolean().optional() }, ({ runId, includeToolOutput, ...q }) => client.get(`/api/traces/${encodeURIComponent(runId)}`, { ...q, output: includeToolOutput === true }));
  add('burrow_get_trace_authority', 'Explain the recorded authority and decision evidence for one trace.', { runId: z.string().min(1), agentId: z.string().optional(), sessionId: z.string().optional() }, ({ runId, ...q }) => client.get(`/api/traces/${encodeURIComponent(runId)}/authority`, q));
  add('burrow_list_run_proofs', 'List archived runtime proofs for an agent/session.', { agentId: z.string().optional(), sessionId: z.string().optional(), limit: z.number().int().min(1).max(200).optional() }, (q) => client.get('/api/archive/runs', q));
  add('burrow_get_run_proof', 'Read one archived runtime proof.', { runId: z.string().min(1), agentId: z.string().optional() }, ({ runId, agentId }) => client.get(`/api/archive/runs/${encodeURIComponent(runId)}`, { agentId }));
  add('burrow_get_session_context', 'Inspect the current context composition and limits for an agent session.', { agentId: agentId.optional(), sessionId: z.string().min(1).optional() }, (q) => client.get('/api/session/context', q));
  add('burrow_context_status', 'Read context-window, live usage and compression status for an agent session.', { agentId: agentId.optional(), sessionId: z.string().min(1).optional() }, (q) => client.get('/api/session/context-status', q));
}
