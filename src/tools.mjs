import { z } from 'zod';

const text = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], structuredContent: value });
const fail = (error) => ({ isError: true, content: [{ type: 'text', text: JSON.stringify({ ok: false, error: error.message, status: error.status || null, details: error.body || null }, null, 2) }] });

export function registerDiagnosticTools(server, client) {
  const add = (name, description, schema, handler) => server.registerTool(name, { description, inputSchema: schema, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } }, async (input) => {
    try { return text(await handler(input || {})); } catch (error) { return fail(error); }
  });

  add('burrow_health', 'Read Burrow runtime health and host/configuration status.', {}, () => client.get('/api/health'));
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
  add('burrow_context_status', 'Read context-window and compression status for an agent session.', { agentId: z.string().optional(), sessionId: z.string().optional() }, (q) => client.get('/api/session/context-status', q));
}
