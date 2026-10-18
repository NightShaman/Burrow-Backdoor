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

async function fixture({
  access = { globalAgentIds: ['agent-b'], adminAgentIds: ['agent-a'] },
  agents,
  saveResult,
} = {}, run) {
  const previous = globalThis.document;
  globalThis.document = { createElement: tag => new Element(tag) };
  const calls = [];
  const primary = { replace(node) { this.node = node; }, clear() { this.node = null; } };
  const overflow = { clear() { this.cleared = true; } };
  const cleanup = mountSettings({
    primary,
    overflow,
    agents: agents ?? [{ id: 'agent-a', name: 'Agent A' }, { id: 'agent-b', name: 'Agent B' }],
    api: async (path, init = {}) => {
      calls.push([path, init]);
      if (init.method === 'PUT') return saveResult;
      return access;
    },
  });
  try { await flush(); await run({ primary, overflow, calls, root: primary.node }); }
  finally { cleanup(); globalThis.document = previous; }
}

function accessGroups(root) {
  const lists = root.descendants().filter(node => node.tagName === 'div' && node['aria-label']?.startsWith('Agents with'));
  return Object.fromEntries(lists.map(list => [list['aria-label'], list.descendants().filter(node => node.tagName === 'input')]));
}

test('exposes one agent-access settings section', () => {
  assert.deepEqual(settingsSections, [{ id: 'access', label: 'Agent access' }]);
});

test('loads diagnostic and administrative assignments independently', async () => fixture({}, async ({ root }) => {
  const groups = accessGroups(root);
  assert.deepEqual(
    groups['Agents with global diagnostic access'].map(input => [input.value, input.checked]),
    [['agent-a', false], ['agent-b', true]],
  );
  assert.deepEqual(
    groups['Agents with Burrow administrative access'].map(input => [input.value, input.checked]),
    [['agent-a', true], ['agent-b', false]],
  );
  const copy = root.descendants().map(node => node.textContent).join(' ');
  assert.match(copy, /Membership in either list does not grant or imply membership in the other/);
  assert.match(copy, /inspect their own diagnostics by default/);
}));

test('saves both independently selected agent lists', async () => fixture({}, async ({ root, calls }) => {
  const groups = accessGroups(root);
  const diagnostics = groups['Agents with global diagnostic access'];
  const administrators = groups['Agents with Burrow administrative access'];
  diagnostics[0].checked = true;
  diagnostics[1].checked = false;
  administrators[0].checked = true;
  administrators[1].checked = true;
  await root.fire('submit');
  await flush();
  const [, init] = calls.find(([, options]) => options.method === 'PUT');
  assert.equal(init.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(init.body), {
    globalAgentIds: ['agent-a'],
    adminAgentIds: ['agent-a', 'agent-b'],
  });
  assert.ok(root.descendants().some(node => node.textContent === 'Agent access saved.'));
}));

test('preserves stale assignments in each list so the operator can remove them', async () => fixture({
  access: { globalAgentIds: ['missing-global'], adminAgentIds: ['missing-admin'] },
}, async ({ root, calls }) => {
  const groups = accessGroups(root);
  const staleGlobal = groups['Agents with global diagnostic access'].find(input => input.value === 'missing-global');
  const staleAdmin = groups['Agents with Burrow administrative access'].find(input => input.value === 'missing-admin');
  assert.equal(staleGlobal.checked, true);
  assert.equal(staleAdmin.checked, true);
  assert.equal(staleGlobal.disabled, false);
  assert.equal(staleAdmin.disabled, false);
  assert.equal(staleGlobal.parent.children[1].children[0].textContent, 'Unavailable agent assignment');
  assert.equal(staleAdmin.parent.children[1].children[0].textContent, 'Unavailable agent assignment');
  staleGlobal.checked = false;
  staleAdmin.checked = false;
  await root.fire('submit');
  await flush();
  const saved = JSON.parse(calls.find(([, init]) => init.method === 'PUT')[1].body);
  assert.deepEqual(saved, { globalAgentIds: [], adminAgentIds: [] });
}));

test('rejects malformed access responses without replacing controls', async () => fixture({
  access: { globalAgentIds: ['agent-a'], adminAgentIds: 'all' },
}, async ({ root, calls }) => {
  assert.equal(calls.length, 1);
  assert.equal(root.descendants().some(node => node.tagName === 'input'), false);
  const alert = root.descendants().find(node => node.role === 'alert');
  assert.match(alert.textContent, /invalid access response/);
}));
