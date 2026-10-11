import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerDiagnosticTools } from '../src/tools.mjs';
test('mod diagnostic tools use dedicated paths and read-only annotation', async () => {
  const tools = new Map(); const paths = [];
  registerDiagnosticTools({ registerTool(name, config, call) { tools.set(name, { config, call }); } }, { get: async (path, query) => { paths.push([path, query]); return { ok: true }; } });
  for (const name of ['burrow_list_mods', 'burrow_list_mod_jobs', 'burrow_get_mod_job', 'burrow_mod_pending_operations']) assert.equal(tools.get(name).config.annotations.readOnlyHint, true);
  assert.match(tools.get('burrow_list_mods').config.description, /versions/);
  assert.match(tools.get('burrow_mod_pending_operations').config.description, /all current/);
  assert.equal(tools.get('burrow_mod_pending_operations').config.inputSchema.modId.safeParse('bad--id').success, false);
  await tools.get('burrow_list_mods').call({});
  await tools.get('burrow_list_mod_jobs').call({ modId: 'some-mod', cursor: '50', limit: 50 });
  await tools.get('burrow_mod_pending_operations').call({ modId: 'some-mod' });
  await tools.get('burrow_get_mod_job').call({ modId: 'some-mod', jobId: 'job_1' });
  assert.deepEqual(paths, [['/api/diagnostics/mods', undefined], ['/api/diagnostics/mods/some-mod/jobs', { cursor: '50', limit: 50 }], ['/api/diagnostics/mods/some-mod/pending', undefined], ['/api/diagnostics/mods/some-mod/jobs/job_1', undefined]]);
});
test('Forge, inventory and PostgreSQL tools use sanitized diagnostics paths', async () => {
  const tools = new Map(), paths = [];
  registerDiagnosticTools({ registerTool(name, config, call) { tools.set(name, { config, call }); } }, { get: async (path, query) => { paths.push([path, query]); return { ok: true }; } });
  for (const name of ['burrow_postgres_status', 'burrow_list_forge_jobs', 'burrow_get_forge_job', 'burrow_inventory', 'burrow_metrics']) assert.equal(tools.get(name).config.annotations.readOnlyHint, true);
  await tools.get('burrow_postgres_status').call({});
  await tools.get('burrow_list_forge_jobs').call({ cursor: '42', limit: 25 });
  await tools.get('burrow_get_forge_job').call({ jobId: 'aaaa0000-0000-4000-8000-000000000001' });
  await tools.get('burrow_inventory').call({});
  await tools.get('burrow_metrics').call({});
  assert.deepEqual(paths, [['/api/diagnostics/postgres', undefined], ['/api/diagnostics/forge/jobs', { cursor: '42', limit: 25 }], ['/api/diagnostics/forge/jobs/aaaa0000-0000-4000-8000-000000000001', undefined], ['/api/diagnostics/inventory', undefined], ['/api/metrics', undefined]]);
});
test('Brains tools stay read-only and use only dedicated metadata routes', async () => {
 const tools=new Map(),paths=[];
 registerDiagnosticTools({registerTool(name,config,call){tools.set(name,{config,call});}}, {get:async(path,query)=>{paths.push([path,query]);return {ok:true,items:[],nextCursor:null};}});
 const names=['burrow_brains_status','burrow_list_brain_memories','burrow_list_brain_embedding_jobs'];
 for(const name of names) assert.deepEqual(tools.get(name).config.annotations,{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false});
 assert.equal(tools.size,24);
 assert.equal(tools.get(names[1]).config.inputSchema.agentId.safeParse(' ').success,false);
 assert.equal(tools.get(names[1]).config.inputSchema.limit.safeParse(1000).success,true);
 for(const bad of [0,-1,1.2,Number.MAX_SAFE_INTEGER+1]) assert.equal(tools.get(names[1]).config.inputSchema.limit.safeParse(bad).success,false);
 assert.equal(tools.get(names[1]).config.inputSchema.cursor.safeParse('').success,false);
 await tools.get(names[0]).call({});
 await tools.get(names[0]).call({agentId:'hatchet'});
 const result=await tools.get(names[1]).call({agentId:'hatchet',limit:1,cursor:'opaque'});
 assert.deepEqual(result.structuredContent,{ok:true,items:[],nextCursor:null});
 await tools.get(names[2]).call({limit:5});
 assert.deepEqual(paths,[['/api/diagnostics/brains',{}],['/api/diagnostics/brains',{agentId:'hatchet'}],['/api/diagnostics/brains/memories',{agentId:'hatchet',limit:1,cursor:'opaque'}],['/api/diagnostics/brains/embedding-jobs',{limit:5}]]);
});
test('older Core denial is reported explicitly, never disguised as empty Brains', async()=>{
 const tools=new Map(); registerDiagnosticTools({registerTool(n,c,call){tools.set(n,call);}}, {get:async()=>{throw Object.assign(new Error('api_token_forbidden'),{status:403,body:{ok:false,error:'api_token_forbidden'}});}});
 const result=await tools.get('burrow_brains_status')({});
 assert.equal(result.isError,true); assert.equal(JSON.parse(result.content[0].text).status,403);
});
