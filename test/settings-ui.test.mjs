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
  section = 'global-access',
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
    section,
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

function inputs(root) {
  return root.descendants().filter(node => node.tagName === 'input');
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

test('global panel renders only diagnostic assignments', async () => fixture({}, async ({ root }) => {
  assert.equal(root.descendants().find(node => node.tagName === 'div' && node['aria-label'])['aria-label'], 'Agents with global diagnostic access');
  assert.deepEqual(inputs(root).map(input => [input.value, input.checked]), [['agent-a', false], ['agent-b', true]]);
  assert.match(copy(root), /does not grant or imply Burrow administrative access/);
  assert.doesNotMatch(copy(root), /Select agents that may use Burrow administrative capabilities/);
}));

test('admin panel renders only administrative assignments', async () => fixture({ section: 'admin-access' }, async ({ root }) => {
  assert.equal(root.descendants().find(node => node.tagName === 'div' && node['aria-label'])['aria-label'], 'Agents with Burrow administrative access');
  assert.deepEqual(inputs(root).map(input => [input.value, input.checked]), [['agent-a', true], ['agent-b', false]]);
  assert.match(copy(root), /does not grant or imply global diagnostic access/);
  assert.doesNotMatch(copy(root), /inspect their own diagnostics by default/);
}));

test('global panel saves diagnostics while preserving admin assignments', async () => fixture({}, async ({ root, calls }) => {
  const controls = inputs(root);
  controls[0].checked = true;
  controls[1].checked = false;
  await root.fire('submit');
  await flush();
  const [, init] = calls.find(([, options]) => options.method === 'PUT');
  assert.deepEqual(JSON.parse(init.body), {
    globalAgentIds: ['agent-a'],
    adminAgentIds: ['agent-a'],
  });
  assert.ok(root.descendants().some(node => node.textContent === 'Global access saved.'));
}));

test('admin panel saves administrators while preserving diagnostic assignments', async () => fixture({ section: 'admin-access' }, async ({ root, calls }) => {
  const controls = inputs(root);
  controls[0].checked = false;
  controls[1].checked = true;
  await root.fire('submit');
  await flush();
  const [, init] = calls.find(([, options]) => options.method === 'PUT');
  assert.deepEqual(JSON.parse(init.body), {
    globalAgentIds: ['agent-b'],
    adminAgentIds: ['agent-b'],
  });
  assert.ok(root.descendants().some(node => node.textContent === 'Admin access saved.'));
}));

test('preserves a stale assignment in the active panel so the operator can remove it', async () => fixture({
  access: { globalAgentIds: ['missing-global'], adminAgentIds: ['missing-admin'] },
}, async ({ root, calls }) => {
  const stale = inputs(root).find(input => input.value === 'missing-global');
  assert.equal(stale.checked, true);
  assert.equal(stale.disabled, false);
  assert.equal(stale.parent.children[1].children[0].textContent, 'Unavailable agent assignment');
  assert.equal(inputs(root).some(input => input.value === 'missing-admin'), false);
  stale.checked = false;
  await root.fire('submit');
  await flush();
  const saved = JSON.parse(calls.find(([, init]) => init.method === 'PUT')[1].body);
  assert.deepEqual(saved, { globalAgentIds: [], adminAgentIds: ['missing-admin'] });
}));

test('rejects malformed access responses without replacing controls', async () => fixture({
  access: { globalAgentIds: ['agent-a'], adminAgentIds: 'all' },
}, async ({ root, calls }) => {
  assert.equal(calls.length, 1);
  assert.equal(inputs(root).length, 0);
  const alert = root.descendants().find(node => node.role === 'alert');
  assert.match(alert.textContent, /invalid access response/);
}));
