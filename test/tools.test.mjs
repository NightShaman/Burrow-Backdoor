import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerDiagnosticTools } from '../src/tools.mjs';
test('mod diagnostic tools use dedicated paths and read-only annotation', async () => {
  const tools = new Map(); const paths = [];
  registerDiagnosticTools({ registerTool(name, config, call) { tools.set(name, { config, call }); } }, { get: async (path, query) => { paths.push([path, query]); return { ok: true }; } });
  for (const name of ['burrow_list_mods', 'burrow_list_mod_jobs', 'burrow_get_mod_job', 'burrow_mod_pending_operations']) assert.equal(tools.get(name).config.annotations.readOnlyHint, true);
  await tools.get('burrow_list_mods').call({});
  await tools.get('burrow_list_mod_jobs').call({ modId: 'some-mod', cursor: '50', limit: 50 });
  await tools.get('burrow_mod_pending_operations').call({ modId: 'some-mod' });
  await tools.get('burrow_get_mod_job').call({ modId: 'some-mod', jobId: 'job_1' });
  assert.deepEqual(paths, [['/api/diagnostics/mods', undefined], ['/api/diagnostics/mods/some-mod/jobs', { cursor: '50', limit: 50 }], ['/api/diagnostics/mods/some-mod/pending', undefined], ['/api/diagnostics/mods/some-mod/jobs/job_1', undefined]]);
});
