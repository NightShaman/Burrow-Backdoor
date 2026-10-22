import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const core = path.resolve(process.env.BURROW_CORE_ROOT || fileURLToPath(new URL('../../../Burrow-HC/Burrow-Backend/', import.meta.url)));
const runtimePath = path.join(core, 'src', 'mod-runtime.mjs');
// Explicit paths and CI are contracts, not optional local discovery.
if (!existsSync(runtimePath) && (process.env.CI || process.env.BURROW_CORE_ROOT)) {
  throw new Error(`Required Burrow Core checkout unavailable at ${core}`);
}

function managementFixture(calls) {
  return Object.fromEntries(['inventory', 'submit', 'operation'].map(method => [method, async (input, options) => {
    calls.push({ method, input, options });
    return method === 'inventory' ? { ok: true, mods: [], sources: [], pagination: { nextOffset: null } }
      : { ok: true, operation: { id: '00000000-0000-4000-8000-000000000001', status: method === 'operation' ? 'succeeded' : 'queued' } };
  }]));
}

test('actual Core loads Backdoor with caller-scoped diagnostics and independently authorized management', { skip: !existsSync(runtimePath) && `Burrow Core checkout unavailable at ${core}` }, async (t) => {
  const { loadMods, cleanupMods, createModRoute } = await import(runtimePath);
  const root = await mkdtemp(path.join(os.tmpdir(), 'backdoor-mod-'));
  const modRoot = path.join(root, 'mods', 'burrow-backdoor');
  await mkdir(modRoot, { recursive: true });
  for (const entry of ['burrow.mod.json', 'src', 'ui']) await cp(new URL(`../${entry}`, import.meta.url), path.join(modRoot, entry), { recursive: true });
  const settings = new Map([['unrelated', { preserved: true }]]);
  const diagnosticAgentIds = ['diagnostic'];
  const adminAgentIds = ['admin'];
  const modAuthority = {
    read: async () => ({ grants: ['mod-management-v1'], adminAgentIds, diagnosticAgentIds }),
    allowed: async (_modId, capability, agentId) => capability === 'diagnostics-global' && diagnosticAgentIds.includes(agentId),
    assertAllowed: async (_modId, capability, agentId) => {
      if (capability === 'mod-management-v1' && adminAgentIds.includes(agentId)) return;
      throw new Error('mod_authority_forbidden');
    },
  };
  const diagnosticCalls = [];
  const managementCalls = [];
  const mods = await loadMods({
    runtimeRoot: root,
    enabledModIds: async () => ['burrow-backdoor'],
    modStoreFactory: async () => ({
      get: async (name, fallback) => settings.has(name) ? settings.get(name) : fallback,
      set: async (name, value) => (settings.set(name, value), value),
      delete: async (name) => settings.delete(name),
      close: async () => {},
    }),
    modCatalogWriter: async () => {},
    resolveAgentRuntime: async (id) => ({ agentId: id }),
    stores: {
      agents: { get: async (id) => ({ id, enabled: true }), list: async () => [{ id: 'one', name: 'One', enabled: true }, { id: 'diagnostic', name: 'Diagnostic', enabled: true }, { id: 'admin', name: 'Admin', enabled: true }] },
      models: {}, scheduledJobs: {}, conversations: {},
    },
    runtimeDiagnostics: { read: async (input, options) => (diagnosticCalls.push({ input, options }), { effectiveAgentId: input.agentId || options.caller.agentId, global: options.global }) },
    modManagement: managementFixture(managementCalls),
    modAuthority,
    logger: { warn() {}, error() {} },
  });
  t.after(async () => { await cleanupMods(mods); await rm(root, { recursive: true, force: true }); });
  const mod = mods[0];
  assert.equal(mod.status, 'loaded', mod.error);
  assert.equal(mod.manifest.name, 'Backdoor');
  assert.equal(mod.manifest.contributions.settings[0].navigation.title, 'Backdoor');
  assert.equal(mod.manifest.contributions.settings[0].primary.title, 'Backdoor');
  assert.equal(mod.manifest.system, true);
  assert.deepEqual(mod.systemCapabilities, ['mod-management-v1']);
  assert.equal(mod.tools.length, 34);
  assert.ok(mod.tools.every((tool) => tool.availability === 'mod-authorized'));

  assert.deepEqual(await mod.host.invokeTool('burrow_list_sessions', {}, { agentId: 'one', sessionId: 'own' }), { effectiveAgentId: 'one', global: false });
  assert.deepEqual(await mod.host.invokeTool('burrow_list_sessions', { agentId: 'two' }, { agentId: 'diagnostic', sessionId: 'own' }), { effectiveAgentId: 'two', global: true });
  assert.deepEqual(diagnosticCalls.map(({ options }) => [options.caller.agentId, options.global]), [['one', false], ['diagnostic', true]]);

  // Host schema validation rejects before any diagnostic or distribution capability runs.
  for (const [tool, input] of [
    ['burrow_inventory', { operation: 'trace', runId: 'other' }],
    ['burrow_list_sessions', { limit: '10' }],
    ['burrow_list_sessions', { limit: 201 }],
    ['burrow_get_trace', {}],
    ['burrow_install_mod', { modId: 'fixture', action: 'uninstall' }],
    ['burrow_update_mod', { modId: 'fixture', action: 'install' }],
    ['burrow_install_mod', { modId: 'fixture', version: 'not-a-version' }],
    ['burrow_mod_management_inventory', { limit: -1 }],
    ['burrow_get_mod_operation', { operationId: 'not-a-uuid' }],
  ]) {
    const before = [diagnosticCalls.length, managementCalls.length];
    await assert.rejects(mod.host.invokeTool(tool, input, { agentId: 'admin', sessionId: 'own' }), (error) => error.statusCode === 400, tool);
    assert.deepEqual([diagnosticCalls.length, managementCalls.length], before, tool);
  }
  const cursor = 'opaque-proof-cursor';
  await mod.host.invokeTool('burrow_list_run_proofs', { limit: 2, cursor }, { agentId: 'one', sessionId: 'own' });
  assert.deepEqual(diagnosticCalls.at(-1).input, { operation: 'run-proofs', limit: 2, cursor });


  await assert.rejects(mod.host.invokeTool('burrow_mod_management_inventory', {}, { agentId: 'diagnostic', sessionId: 'own' }), /mod_route_failed/);
  assert.equal(managementCalls.length, 0);
  const actor = { agentId: 'admin', sessionId: 'session', conversationId: 'conversation', runId: 'run' };
  assert.equal((await mod.host.invokeTool('burrow_mod_management_inventory', {}, actor)).ok, true);
  const accepted = [];
  for (const [tool, input] of [
    ['burrow_refresh_mod_sources', {}],
    ['burrow_install_mod', { modId: 'fixture', version: '2026.10.18' }],
    ['burrow_update_mod', { modId: 'burrow-backdoor', version: '2026.10.18' }],
    ['burrow_enable_mod', { modId: 'fixture' }],
    ['burrow_disable_mod', { modId: 'fixture' }],
    ['burrow_uninstall_mod', { modId: 'fixture' }],
  ]) {
    const receipt = await mod.host.invokeTool(tool, input, actor);
    assert.equal(receipt.operation.status, 'queued', tool);
    accepted.push(receipt);
  }
  assert.equal((await mod.host.invokeTool('burrow_get_mod_operation', { operationId: accepted[2].operation.id }, actor)).operation.status, 'succeeded');
  assert.deepEqual(managementCalls.map(({ method, input }) => [method, input]), [
    ['inventory', {}],
    ['submit', { action: 'refresh' }],
    ['submit', { action: 'install', modId: 'fixture', version: '2026.10.18' }],
    ['submit', { action: 'update', modId: 'burrow-backdoor', version: '2026.10.18' }],
    ['submit', { action: 'enable', modId: 'fixture' }],
    ['submit', { action: 'disable', modId: 'fixture' }],
    ['submit', { action: 'uninstall', modId: 'fixture' }],
    ['operation', { operationId: accepted[2].operation.id }],
  ]);
  assert.ok(managementCalls.every(({ options }) => options.ownerModId === 'burrow-backdoor' && options.caller.agentId === 'admin'));
  await Promise.all(managementCalls.map(({ options }) => options.waitForCaller));

  assert.deepEqual(mod.routes, []);
  const replies = [];
  const route = createModRoute({ mods, readJsonBody: async () => assert.fail('removed access route must not read a body'), sendJson: (_res, status, body) => replies.push({ status, body }) });
  for (const method of ['GET', 'PUT']) {
    await route({ req: { method, headers: {}, burrowVerifiedAuth: { enabled: true, authenticated: true } }, res: {}, url: new URL('http://fixture/api/mods/burrow-backdoor/access') });
    assert.deepEqual(replies.at(-1), { status: 404, body: { ok: false, error: 'mod_route_not_found' } });
  }
  assert.deepEqual([...settings], [['unrelated', { preserved: true }]]);
});

test('Backdoor remains diagnostic-only when Core does not grant its management capability', { skip: !existsSync(runtimePath) && `Burrow Core checkout unavailable at ${core}` }, async (t) => {
  const { loadMods, cleanupMods } = await import(runtimePath);
  const root = await mkdtemp(path.join(os.tmpdir(), 'backdoor-no-management-'));
  const modRoot = path.join(root, 'mods', 'burrow-backdoor');
  await mkdir(modRoot, { recursive: true });
  for (const entry of ['src', 'ui']) await cp(new URL(`../${entry}`, import.meta.url), path.join(modRoot, entry), { recursive: true });
  await cp(new URL('../burrow.mod.json', import.meta.url), path.join(modRoot, 'burrow.mod.json'));
  const manifest = JSON.parse(await (await import('node:fs/promises')).readFile(path.join(modRoot, 'burrow.mod.json'), 'utf8'));
  await (await import('node:fs/promises')).writeFile(path.join(modRoot, 'burrow.mod.json'), JSON.stringify(manifest));
  const mods = await loadMods({ runtimeRoot: root, enabledModIds: async () => ['burrow-backdoor'], modStoreFactory: async () => ({ get: async (_name, fallback) => fallback, close: async () => {} }), modCatalogWriter: async () => {}, resolveAgentRuntime: async () => ({}), stores: { agents: {}, models: {}, scheduledJobs: {}, conversations: {} }, runtimeDiagnostics: { read: async () => ({ ok: true }) }, modManagement: managementFixture([]), modAuthority: { read: async () => ({ grants: [] }), allowed: async () => false, assertAllowed: async () => { throw Error('mod_authority_forbidden'); } }, logger: { warn() {}, error() {} } });
  t.after(async () => { await cleanupMods(mods); await rm(root, { recursive: true, force: true }); });
  assert.equal(mods[0].status, 'loaded', mods[0].error);
  assert.equal(mods[0].tools.length, 34);
  await assert.rejects(mods[0].host.invokeTool('burrow_mod_management_inventory', {}, { agentId: 'admin' }), /mod_route_failed/);
});
