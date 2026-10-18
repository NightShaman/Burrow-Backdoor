const object = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
// Construct capability inputs from the advertised properties, even for direct handler calls.
const allowlisted = (input, schema) => Object.fromEntries(Object.keys(schema.properties).filter((key) => Object.hasOwn(input || {}, key)).map((key) => [key, input[key]]));
const string = (extra = {}) => ({ type: 'string', ...extra });
const integer = (maximum, minimum = 1) => ({ type: 'integer', minimum, ...(maximum ? { maximum } : {}) });
const boolean = { type: 'boolean' };
const agent = string({ minLength: 1 });
const session = string({ minLength: 1 });
const modId = string({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', maxLength: 128 });
const version = string({ pattern: '^v?(?:\\d{4}\\.\\d{2}\\.\\d{2}(?:\\.\\d+)?|\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?)$', maxLength: 128 });
const operationId = string({ format: 'uuid' });
const page = { limit: integer(Number.MAX_SAFE_INTEGER), cursor: string({ minLength: 1 }) };

const diagnosticTools = [
  ['burrow_brains_status','Read scoped saved-memory counts and embedding configuration/index status; no memory content or credentials.',object({agentId:agent}), 'brains-status'],
  ['burrow_list_brain_memories','List caller-authorized saved-memory metadata; excludes titles, content, source refs and legacy snapshots.',object({agentId:agent,...page}), 'brain-memories'],
  ['burrow_list_brain_embedding_jobs','List caller-authorized embedding retry metadata and sanitized failure codes.',object({agentId:agent,...page}), 'brain-embedding-jobs'],
  ['burrow_postgres_status','Read PostgreSQL connectivity, server major and pgvector availability without connection details.',object(), 'postgres-status'],
  ['burrow_list_forge_jobs','List sanitized Forge jobs when the caller has global diagnostic scope.',object({limit:integer(100),cursor:string({pattern:'^[1-9]\\d*$'})}), 'forge-jobs'],
  ['burrow_get_forge_job','Read one sanitized Forge job when the caller has global diagnostic scope.',object({jobId:string({format:'uuid'})},['jobId']), 'forge-job'],
  ['burrow_inventory','Read safe count-only MCP and mod inventory.',object(), 'inventory'],
  ['burrow_metrics','Read host process, configured-runtime-filesystem and load metrics.',object(), 'metrics'],
  ['burrow_list_mods','List installed mod lifecycle and diagnostic support.',object(), 'mods'],
  ['burrow_list_mod_jobs','List sanitized mod jobs when the caller has global diagnostic scope.',object({modId,limit:integer(100),cursor:string({maxLength:256})},['modId']), 'mod-jobs'],
  ['burrow_mod_pending_operations','Read current Core-hosted mod capability operations when the caller has global diagnostic scope.',object({modId},['modId']), 'mod-pending'],
  ['burrow_get_mod_job','Inspect one sanitized mod job when the caller has global diagnostic scope.',object({modId,jobId:string({pattern:'^[A-Za-z0-9_-]{1,128}$'})},['modId','jobId']), 'mod-job'],
  ['burrow_health','Read Burrow runtime health and build identity.',object(), 'health'],
  ['burrow_runtime_status','Read runtime, release, model-selection, policy, retention and trace-observability status for an authorized agent.',object({agentId:agent}), 'runtime-status'],
  ['burrow_list_agents','List Burrow agent identities and execution assignments.',object({includeDisabled:boolean}), 'agents'],
  ['burrow_agent_status','Read current status for an authorized agent session.',object({agentId:agent,sessionId:session}), 'agent-status'],
  ['burrow_list_sessions','List compact session summaries for an authorized agent.',object({agentId:agent,archived:boolean,limit:integer(200)}), 'sessions'],
  ['burrow_get_session','Read a bounded recent session tail for an authorized agent. Use conversation reading for complete history.',object({agentId:agent,sessionId:session,limit:integer(100),maxContentChars:integer(Number.MAX_SAFE_INTEGER)},['sessionId']), 'session'],
  ['burrow_active_runs','List bounded active-run and subagent summaries for an authorized agent and optional session.',object({agentId:agent,sessionId:session}), 'active-runs'],
  ['burrow_list_traces','List a bounded page of trace runs for an authorized agent session.',object({agentId:agent,sessionId:session,limit:integer(100),cursor:string({minLength:1})}), 'traces'],
  ['burrow_get_trace','Read a summarized trace for an authorized agent; tool output is omitted by default.',object({runId:string({minLength:1}),agentId:agent,sessionId:session,includeToolOutput:boolean},['runId']), 'trace'],
  ['burrow_get_trace_authority','Explain authority evidence for one authorized trace.',object({runId:string({minLength:1}),agentId:agent,sessionId:session},['runId']), 'trace-authority'],
  ['burrow_list_run_proofs','List archived runtime proofs for an authorized agent/session.',object({agentId:agent,sessionId:session,limit:integer(200),cursor:string({minLength:1})}), 'run-proofs'],
  ['burrow_get_run_proof','Read one archived runtime proof for an authorized agent.',object({runId:string({minLength:1}),agentId:agent},['runId']), 'run-proof'],
  ['burrow_get_session_context','Read a scalar context-composition summary for an authorized agent session; transcript and evidence bodies are excluded.',object({agentId:agent,sessionId:session}), 'session-context'],
  ['burrow_context_status','Read bounded context-window, live usage and compression status for an authorized agent session.',object({agentId:agent,sessionId:session}), 'context-status'],
];

const managementTools = [
  ['burrow_mod_management_inventory','List sanitized configured sources and installable/installed mods. Requires Backdoor administrative access.',object({offset:integer(Number.MAX_SAFE_INTEGER, 0),limit:integer(100)}), (args) => args.context.modManagement.inventory(args.input)],
  ['burrow_refresh_mod_sources','Queue a durable refresh of configured mod sources. Requires Backdoor administrative access.',object(), (args) => args.context.modManagement.refresh()],
  ['burrow_install_mod','Queue a durable mod installation through Core. Requires Backdoor administrative access.',object({modId,version},['modId']), (args) => args.context.modManagement.submit({ action: 'install', modId: args.input.modId, ...(args.input.version !== undefined ? { version: args.input.version } : {}) })],
  ['burrow_update_mod','Queue a durable mod update through Core. Requires Backdoor administrative access.',object({modId,version},['modId']), (args) => args.context.modManagement.submit({ action: 'update', modId: args.input.modId, ...(args.input.version !== undefined ? { version: args.input.version } : {}) })],
  ['burrow_enable_mod','Queue a durable mod enable operation through Core. Requires Backdoor administrative access.',object({modId},['modId']), (args) => args.context.modManagement.submit({ action: 'enable', modId: args.input.modId })],
  ['burrow_disable_mod','Queue a durable mod disable operation through Core. Requires Backdoor administrative access.',object({modId},['modId']), (args) => args.context.modManagement.submit({ action: 'disable', modId: args.input.modId })],
  ['burrow_uninstall_mod','Queue a durable mod uninstall operation through Core. Requires Backdoor administrative access.',object({modId},['modId']), (args) => args.context.modManagement.submit({ action: 'uninstall', modId: args.input.modId })],
  ['burrow_get_mod_operation','Inspect one durable Backdoor-submitted lifecycle operation. Requires Backdoor administrative access.',object({operationId},['operationId']), (args) => args.context.modManagement.operation(args.input.operationId)],
];

const auth = (request) => {
  if (request.auth?.enabled && !request.auth?.authenticated) throw Object.assign(new Error('operator_authentication_required'), { statusCode: 401 });
};
const normalizeIds = (value, error = 'invalid_agent_ids') => {
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || !id.trim())) throw Object.assign(new Error(error), { statusCode: 400 });
  return [...new Set(value.map((id) => id.trim()))];
};

export function activate(context) {
  if (!context.modManagement) throw new Error('mod_management_capability_required');
  context.api.get('/access', async (request) => {
    auth(request);
    return {
      globalAgentIds: normalizeIds(await context.settings.get('globalAgentIds', []), 'invalid_global_agent_ids'),
      adminAgentIds: normalizeIds(await context.settings.get('adminAgentIds', []), 'invalid_admin_agent_ids'),
    };
  });
  context.api.put('/access', async (request) => {
    auth(request);
    const globalAgentIds = normalizeIds(request.body?.globalAgentIds, 'invalid_global_agent_ids');
    const adminAgentIds = normalizeIds(request.body?.adminAgentIds, 'invalid_admin_agent_ids');
    const known = new Set((await context.agents.list()).map((entry) => entry.id));
    if ([...globalAgentIds, ...adminAgentIds].some((id) => !known.has(id))) throw Object.assign(new Error('unknown_agent_id'), { statusCode: 400 });
    await context.settings.set('globalAgentIds', globalAgentIds);
    await context.settings.set('adminAgentIds', adminAgentIds);
    return { globalAgentIds, adminAgentIds };
  });
  for (const [name, description, inputSchema, operation] of diagnosticTools) context.tools.register({
    name, description, inputSchema, availability: 'mod-authorized',
    handler: (argumentsValue, caller) => context.runtimeDiagnostics.read({ ...allowlisted(argumentsValue, inputSchema), operation }, { signal: caller.signal }),
  });
  for (const [name, description, inputSchema, invoke] of managementTools) context.tools.register({
    name, description, inputSchema, availability: 'mod-authorized',
    handler: (input = {}) => invoke({ context, input: allowlisted(input, inputSchema) }),
  });
}
