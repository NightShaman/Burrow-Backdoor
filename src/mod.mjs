const object = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const string = (extra = {}) => ({ type: 'string', ...extra });
const integer = (maximum) => ({ type: 'integer', minimum: 1, ...(maximum ? { maximum } : {}) });
const agent = string({ minLength: 1 });
const session = string({ minLength: 1 });
const page = { limit: integer(Number.MAX_SAFE_INTEGER), cursor: string({ minLength: 1 }) };

const tools = [
  ['burrow_brains_status','Read scoped saved-memory counts and embedding configuration/index status; no memory content or credentials.',object({agentId:agent}), 'brains-status'],
  ['burrow_list_brain_memories','List caller-authorized saved-memory metadata; excludes titles, content, source refs and legacy snapshots.',object({agentId:agent,...page}), 'brain-memories'],
  ['burrow_list_brain_embedding_jobs','List caller-authorized embedding retry metadata and sanitized failure codes.',object({agentId:agent,...page}), 'brain-embedding-jobs'],
  ['burrow_postgres_status','Read PostgreSQL connectivity, server major and pgvector availability without connection details.',object(), 'postgres-status'],
  ['burrow_list_forge_jobs','List sanitized Forge jobs when the caller has global diagnostic scope.',object({limit:integer(100),cursor:string({pattern:'^[1-9]\\d*$'})}), 'forge-jobs'],
  ['burrow_get_forge_job','Read one sanitized Forge job when the caller has global diagnostic scope.',object({jobId:string({format:'uuid'})},['jobId']), 'forge-job'],
  ['burrow_inventory','Read safe count-only MCP and mod inventory.',object(), 'inventory'],
  ['burrow_metrics','Read host process, filesystem and load metrics.',object(), 'metrics'],
  ['burrow_list_mods','List installed mod lifecycle and diagnostic support.',object(), 'mods'],
  ['burrow_list_mod_jobs','List sanitized mod jobs when the caller has global diagnostic scope.',object({modId:string({pattern:'^[a-z0-9]+(?:-[a-z0-9]+)*$'}),limit:integer(100),cursor:string({maxLength:256})},['modId']), 'mod-jobs'],
  ['burrow_mod_pending_operations','Read current Core-hosted mod capability operations when the caller has global diagnostic scope.',object({modId:string({pattern:'^[a-z0-9]+(?:-[a-z0-9]+)*$'})},['modId']), 'mod-pending'],
  ['burrow_get_mod_job','Inspect one sanitized mod job when the caller has global diagnostic scope.',object({modId:string({pattern:'^[a-z0-9]+(?:-[a-z0-9]+)*$'}),jobId:string({pattern:'^[A-Za-z0-9_-]{1,128}$'})},['modId','jobId']), 'mod-job'],
  ['burrow_health','Read Burrow runtime health and build identity.',object(), 'health'],
  ['burrow_runtime_status','Read runtime, release, model-selection, policy, retention and trace-observability status for an authorized agent.',object({agentId:agent}), 'runtime-status'],
  ['burrow_list_agents','List Burrow agent identities and execution assignments.',object({includeDisabled:{type:'boolean'}}), 'agents'],
  ['burrow_agent_status','Read current status for an authorized agent session.',object({agentId:agent,sessionId:session}), 'agent-status'],
  ['burrow_list_sessions','List sessions for an authorized agent.',object({agentId:agent,archived:{type:'boolean'},limit:integer(200)}), 'sessions'],
  ['burrow_get_session','Read one session for an authorized agent.',object({agentId:agent,sessionId:session},['sessionId']), 'session'],
  ['burrow_active_runs','List active runs for an authorized agent and optional session.',object({agentId:agent,sessionId:session}), 'active-runs'],
  ['burrow_list_traces','List trace runs for an authorized agent session.',object({agentId:agent,sessionId:session}), 'traces'],
  ['burrow_get_trace','Read a summarized trace for an authorized agent; tool output is omitted by default.',object({runId:string({minLength:1}),agentId:agent,sessionId:session,includeToolOutput:{type:'boolean'}},['runId']), 'trace'],
  ['burrow_get_trace_authority','Explain authority evidence for one authorized trace.',object({runId:string({minLength:1}),agentId:agent,sessionId:session},['runId']), 'trace-authority'],
  ['burrow_list_run_proofs','List archived runtime proofs for an authorized agent/session.',object({agentId:agent,sessionId:session,limit:integer(200)}), 'run-proofs'],
  ['burrow_get_run_proof','Read one archived runtime proof for an authorized agent.',object({runId:string({minLength:1}),agentId:agent},['runId']), 'run-proof'],
  ['burrow_get_session_context','Inspect context composition and limits for an authorized agent session.',object({agentId:agent,sessionId:session}), 'session-context'],
  ['burrow_context_status','Read context-window, live usage and compression status for an authorized agent session.',object({agentId:agent,sessionId:session}), 'context-status'],
];

const auth = (request) => {
  if (request.auth?.enabled && !request.auth?.authenticated) throw Object.assign(new Error('operator_authentication_required'), { statusCode: 401 });
};
const normalizeIds = (value) => {
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || !id.trim())) throw Object.assign(new Error('invalid_global_agent_ids'), { statusCode: 400 });
  return [...new Set(value.map((id) => id.trim()))];
};

export function activate(context) {
  context.api.get('/access', async (request) => {
    auth(request);
    return { globalAgentIds: normalizeIds(await context.settings.get('globalAgentIds', [])) };
  });
  context.api.put('/access', async (request) => {
    auth(request);
    const ids = normalizeIds(request.body?.globalAgentIds);
    const known = new Set((await context.agents.list()).map((entry) => entry.id));
    if (ids.some((id) => !known.has(id))) throw Object.assign(new Error('unknown_agent_id'), { statusCode: 400 });
    await context.settings.set('globalAgentIds', ids);
    return { globalAgentIds: ids };
  });
  for (const [name, description, inputSchema, operation] of tools) context.tools.register({
    name, description, inputSchema, availability: 'mod-authorized',
    handler: (argumentsValue, caller) => context.runtimeDiagnostics.read({ operation, ...(argumentsValue || {}) }, { signal: caller.signal }),
  });
}
