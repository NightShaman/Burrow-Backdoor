import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activate } from '../src/mod.mjs';

test('direct handlers only forward advertised fields and retain fixed operation/action', async () => {
  const tools = new Map();
  const diagnostics = [];
  const management = [];
  activate({
    tools: { register: tool => tools.set(tool.name, tool) },
    runtimeDiagnostics: { read: async input => diagnostics.push(input) },
    modManagement: Object.fromEntries(['inventory', 'submit', 'refresh', 'operation'].map(method => [method, async input => management.push({ method, input })])),
  });
  await tools.get('burrow_inventory').handler({ operation: 'trace', runId: 'private' }, {});
  assert.deepEqual(diagnostics, [{ operation: 'inventory' }]);
  for (const action of ['install', 'update']) {
    await tools.get(`burrow_${action}_mod`).handler({ modId: 'fixture', version: '1.2.3', action: 'uninstall', sourceUrl: 'forbidden' });
    assert.deepEqual(management.at(-1), { method: 'submit', input: { action, modId: 'fixture', version: '1.2.3' } });
  }
  await tools.get('burrow_mod_management_inventory').handler({ limit: 3, action: 'install', sourceUrl: 'forbidden' });
  assert.deepEqual(management.at(-1), { method: 'inventory', input: { limit: 3 } });
});
