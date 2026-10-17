import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const core = path.resolve(process.env.BURROW_CORE_ROOT || fileURLToPath(new URL('../../../Burrow-HC/Burrow-Backend/', import.meta.url)));
const runtimePath = path.join(core, 'src', 'mod-runtime.mjs');

test('actual Core loads Backdoor as globally available caller-scoped mod tools', { skip: !existsSync(runtimePath) && `Burrow Core checkout unavailable at ${core}` }, async (t) => {
  const { loadMods, cleanupMods, createModRoute } = await import(runtimePath);
  const root = await mkdtemp(path.join(os.tmpdir(), 'backdoor-mod-'));
  const modRoot = path.join(root, 'mods', 'burrow-backdoor');
  await mkdir(modRoot, { recursive: true });
  for (const entry of ['burrow.mod.json', 'src', 'ui']) await cp(new URL(`../${entry}`, import.meta.url), path.join(modRoot, entry), { recursive: true });
  const settings = new Map([['globalAgentIds', ['admin']]]);
  const calls = [];
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
      agents: { get: async (id) => ({ id, enabled: true }), list: async () => [{ id: 'one', name: 'One', enabled: true }, { id: 'admin', name: 'Admin', enabled: true }] },
      models: {}, scheduledJobs: {}, conversations: {},
    },
    runtimeDiagnostics: { read: async (input, options) => (calls.push({ input, options }), { effectiveAgentId: input.agentId || options.caller.agentId, global: options.global }) },
    logger: { warn() {}, error() {} },
  });
  t.after(async () => { await cleanupMods(mods); await rm(root, { recursive: true, force: true }); });
  const mod = mods[0];
  assert.equal(mod.status, 'loaded', mod.error);
  assert.equal(mod.tools.length, 26);
  assert.ok(mod.tools.every((tool) => tool.availability === 'mod-authorized'));
  assert.deepEqual(await mod.host.invokeTool('burrow_list_sessions', {}, { agentId: 'one', sessionId: 'own' }), { effectiveAgentId: 'one', global: false });
  assert.deepEqual(await mod.host.invokeTool('burrow_list_sessions', { agentId: 'two' }, { agentId: 'admin', sessionId: 'own' }), { effectiveAgentId: 'two', global: true });
  assert.deepEqual(calls.map(({ options }) => [options.caller.agentId, options.global]), [['one', false], ['admin', true]]);

  const replies = [];
  const route = createModRoute({ mods, readJsonBody: async () => ({ globalAgentIds: ['one'] }), sendJson: (_res, status, body) => replies.push({ status, body }) });
  await route({ req: { method: 'GET', headers: {}, burrowVerifiedAuth: { enabled: true, authenticated: false } }, res: {}, url: new URL('http://fixture/api/mods/burrow-backdoor/access') });
  assert.equal(replies.at(-1).status, 401);
  await route({ req: { method: 'PUT', headers: {}, burrowVerifiedAuth: { enabled: true, authenticated: true } }, res: {}, url: new URL('http://fixture/api/mods/burrow-backdoor/access') });
  assert.deepEqual(replies.at(-1), { status: 200, body: { globalAgentIds: ['one'] } });
  assert.deepEqual(settings.get('globalAgentIds'), ['one']);
});
