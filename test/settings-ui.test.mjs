import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings, settingsSections } from '../ui/settings.js';

class Element {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.listeners = new Map();
    this.textContent = '';
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.dataset = {};
  }
  append(...items) { for (const item of items) { item.parent = this; this.children.push(item); } }
  replaceChildren(...items) { this.children = []; this.append(...items); }
  setAttribute(key, value) { this[key] = value; }
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  removeEventListener(type, fn) { if (this.listeners.get(type) === fn) this.listeners.delete(type); }
  descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
  fire(type) { return this.listeners.get(type)?.({ preventDefault() {} }); }
}

const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
const defaultAccess = {
  ok: true,
  modId: 'burrow-backdoor',
  grants: ['mod-management-v1'],
  adminAgentIds: ['agent-a'],
  diagnosticAgentIds: ['agent-b'],
  declaredCapabilities: ['mod-management-v1'],
  restartRequired: false,
};

async function fixture({
  section = 'global-access',
  access = defaultAccess,
  refreshedAccess,
  agents,
  saveResult,
  provideAccessApi = true,
} = {}, run) {
  const previous = globalThis.document;
  globalThis.document = { createElement: tag => new Element(tag) };
  const calls = [];
  let reads = 0;
  const primary = { replace(node) { this.node = node; }, clear() { this.node = null; } };
  const overflow = { clear() { this.cleared = true; } };
  const accessApi = async (init = {}) => {
    calls.push(init);
    if (init.method === 'PUT') {
      const replacement = JSON.parse(init.body);
      return saveResult ?? { ...defaultAccess, ...replacement, restartRequired: true };
    }
    reads += 1;
    return reads > 1 && refreshedAccess ? refreshedAccess : access;
  };
  const cleanup = mountSettings({
    section,
    primary,
    overflow,
    agents: agents ?? [{ id: 'agent-a', name: 'Agent A' }, { id: 'agent-b', name: 'Agent B' }],
    ...(provideAccessApi ? { accessApi } : {}),
  });
  try { await flush(); await run({ primary, overflow, calls, root: primary.node }); }
  finally { cleanup(); globalThis.document = previous; }
}

function inputs(root) {
  return root.descendants().filter(node => node.tagName === 'input');
}
function agentInputs(root) {
  return inputs(root).filter(input => input.value);
}
function capabilityInput(root) {
  return inputs(root).find(input => !input.value);
}
function copy(root) {
  return root.descendants().map(node => node.textContent).join(' ');
}

test('exposes separate Global Access and Admin Access settings menu items', () => {
  assert.deepEqual(settingsSections, [
    { id: 'global-access', label: 'Global Access' },
    { id: 'admin-access', label: 'Admin Access' },
  ]);
});

test('global panel renders only Core diagnostic assignments', async () => fixture({}, async ({ root, calls }) => {
  assert.equal(root.descendants().find(node => node.tagName === 'div' && node['aria-label'])['aria-label'], 'Agents with global diagnostic access');
  assert.deepEqual(agentInputs(root).map(input => [input.value, input.checked]), [['agent-a', false], ['agent-b', true]]);
  assert.match(copy(root), /does not grant or imply Burrow administrative access/);
  assert.doesNotMatch(copy(root), /Approve Backdoor mod management/);
  assert.equal(calls.length, 1);
}));

test('admin panel renders assignments and explicit declared capability approval', async () => fixture({ section: 'admin-access' }, async ({ root }) => {
  assert.deepEqual(agentInputs(root).map(input => [input.value, input.checked]), [['agent-a', true], ['agent-b', false]]);
  assert.equal(capabilityInput(root).checked, true);
  assert.match(copy(root), /Approve Backdoor mod management/);
  assert.match(copy(root), /does not grant or imply global diagnostic access/);
}));

test('global save refreshes Core authority and preserves concurrent grants and admin assignments', async () => fixture({
  refreshedAccess: {
    ...defaultAccess,
    grants: ['mod-management-v1', 'future-capability-v1'],
    adminAgentIds: ['agent-b'],
  },
}, async ({ root, calls }) => {
  const controls = agentInputs(root);
  controls[0].checked = true;
  controls[1].checked = false;
  await root.fire('submit');
  await flush();
  assert.equal(calls.length, 3);
  assert.equal(calls[0].method, undefined);
  assert.equal(calls[1].method, undefined);
  assert.deepEqual(JSON.parse(calls[2].body), {
    grants: ['mod-management-v1', 'future-capability-v1'],
    adminAgentIds: ['agent-b'],
    diagnosticAgentIds: ['agent-a'],
  });
  assert.match(copy(root), /Global access saved/);
  assert.match(copy(root), /Restart Core/);
}));

test('admin save preserves fresh diagnostics and can revoke only Backdoor management approval', async () => fixture({
  section: 'admin-access',
  refreshedAccess: {
    ...defaultAccess,
    grants: ['mod-management-v1', 'future-capability-v1'],
    diagnosticAgentIds: ['agent-a'],
  },
}, async ({ root, calls }) => {
  capabilityInput(root).checked = false;
  const controls = agentInputs(root);
  controls[0].checked = false;
  controls[1].checked = true;
  await root.fire('submit');
  await flush();
  assert.deepEqual(JSON.parse(calls.at(-1).body), {
    grants: ['future-capability-v1'],
    adminAgentIds: ['agent-b'],
    diagnosticAgentIds: ['agent-a'],
  });
}));

test('preserves a stale assignment in the active panel so the operator can remove it', async () => fixture({
  access: { ...defaultAccess, diagnosticAgentIds: ['missing-global'], adminAgentIds: ['missing-admin'] },
}, async ({ root, calls }) => {
  const stale = agentInputs(root).find(input => input.value === 'missing-global');
  assert.equal(stale.checked, true);
  assert.equal(stale.disabled, false);
  assert.equal(stale.parent.children[1].children[0].textContent, 'Unavailable agent assignment');
  assert.equal(agentInputs(root).some(input => input.value === 'missing-admin'), false);
  stale.checked = false;
  await root.fire('submit');
  await flush();
  assert.deepEqual(JSON.parse(calls.at(-1).body), {
    grants: ['mod-management-v1'],
    adminAgentIds: ['missing-admin'],
    diagnosticAgentIds: [],
  });
}));

test('rejects malformed Core responses without replacing controls', async () => fixture({
  access: { ...defaultAccess, adminAgentIds: 'all' },
}, async ({ root, calls }) => {
  assert.equal(calls.length, 1);
  assert.equal(inputs(root).length, 0);
  const alert = root.descendants().find(node => node.role === 'alert');
  assert.match(alert.textContent, /invalid Backdoor access response/);
}));

test('fails clearly when the UI host does not provide Core-owned access', async () => fixture({ provideAccessApi: false }, async ({ root }) => {
  const alert = root.descendants().find(node => node.role === 'alert');
  assert.match(alert.textContent, /does not support Core-owned mod access/);
  assert.equal(inputs(root).length, 0);
}));
