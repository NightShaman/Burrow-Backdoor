import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const core = path.resolve(process.env.BURROW_CORE_ROOT || fileURLToPath(new URL('../../../Burrow-HC/Burrow-Backend/', import.meta.url)));
const runtimePath = path.join(core, 'src', 'mod-runtime.mjs');

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
  const settings = new Map([['globalAgentIds', ['diagnostic']], ['adminAgentIds', ['admin']]]);
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
    logger: { warn() {}, error() {} },
  });
  t.after(async () => { await cleanupMods(mods); await rm(root, { recursive: true, force: true }); });
  const mod = mods[0];
  assert.equal(mod.status, 'loaded', mod.error);
  assert.equal(mod.manifest.system, true);
  assert.deepEqual(mod.systemCapabilities, ['mod-management-v1']);
  assert.equal(mod.tools.length, 34);
  assert.ok(mod.tools.every((tool) => tool.availability === 'mod-authorized'));

  assert.deepEqual(await mod.host.invokeTool('burrow_list_sessions', {}, { agentId: 'one', sessionId: 'own' }), { effectiveAgentId: 'one', global: false });
  assert.deepEqual(await mod.host.invokeTool('burrow_list_sessions', { agentId: 'two' }, { agentId: 'diagnostic', sessionId: 'own' }), { effectiveAgentId: 'two', global: true });
  assert.deepEqual(diagnosticCalls.map(({ options }) => [options.caller.agentId, options.global]), [['one', false], ['diagnostic', true]]);

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

  const replies = [];
  let putBody = { globalAgentIds: ['one'], adminAgentIds: ['admin'] };
  const route = createModRoute({ mods, readJsonBody: async () => putBody, sendJson: (_res, status, body) => replies.push({ status, body }) });
  await route({ req: { method: 'GET', headers: {}, burrowVerifiedAuth: { enabled: true, authenticated: false } }, res: {}, url: new URL('http://fixture/api/mods/burrow-backdoor/access') });
  assert.equal(replies.at(-1).status, 401);
  await route({ req: { method: 'PUT', headers: {}, burrowVerifiedAuth: { enabled: true, authenticated: true } }, res: {}, url: new URL('http://fixture/api/mods/burrow-backdoor/access') });
  assert.deepEqual(replies.at(-1), { status: 200, body: putBody });
  assert.deepEqual(settings.get('globalAgentIds'), ['one']);
  assert.deepEqual(settings.get('adminAgentIds'), ['admin']);

  putBody = { globalAgentIds: ['diagnostic'], adminAgentIds: ['one'] };
  await route({ req: { method: 'PUT', headers: {}, burrowVerifiedAuth: { enabled: false, authenticated: false } }, res: {}, url: new URL('http://fixture/api/mods/burrow-backdoor/access') });
  assert.deepEqual(replies.at(-1), { status: 200, body: putBody });
  assert.deepEqual(settings.get('globalAgentIds'), ['diagnostic']);
  assert.deepEqual(settings.get('adminAgentIds'), ['one']);
});

test('Backdoor refuses activation when its manifest omits the management declaration', { skip: !existsSync(runtimePath) && `Burrow Core checkout unavailable at ${core}` }, async (t) => {
  const { loadMods, cleanupMods } = await import(runtimePath);
  const root = await mkdtemp(path.join(os.tmpdir(), 'backdoor-no-management-'));
  const modRoot = path.join(root, 'mods', 'burrow-backdoor');
  await mkdir(modRoot, { recursive: true });
  for (const entry of ['src', 'ui']) await cp(new URL(`../${entry}`, import.meta.url), path.join(modRoot, entry), { recursive: true });
  await cp(new URL('../burrow.mod.json', import.meta.url), path.join(modRoot, 'burrow.mod.json'));
  const manifest = JSON.parse(await (await import('node:fs/promises')).readFile(path.join(modRoot, 'burrow.mod.json'), 'utf8'));
  delete manifest.system;
  delete manifest.systemCapabilities;
  await (await import('node:fs/promises')).writeFile(path.join(modRoot, 'burrow.mod.json'), JSON.stringify(manifest));
  const mods = await loadMods({ runtimeRoot: root, enabledModIds: async () => ['burrow-backdoor'], modStoreFactory: async () => ({ get: async (_name, fallback) => fallback, close: async () => {} }), modCatalogWriter: async () => {}, resolveAgentRuntime: async () => ({}), stores: { agents: {}, models: {}, scheduledJobs: {}, conversations: {} }, logger: { warn() {}, error() {} } });
  t.after(async () => { await cleanupMods(mods); await rm(root, { recursive: true, force: true }); });
  assert.equal(mods[0].status, 'failed');
  assert.match(mods[0].error, /mod_management_capability_required/);
});
