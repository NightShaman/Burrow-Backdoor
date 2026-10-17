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

async function fixture({ access = ['agent-b'], agents, saveResult } = {}, run) {
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
      return { globalAgentIds: access };
    },
  });
  try { await flush(); await run({ primary, overflow, calls, root: primary.node }); }
  finally { cleanup(); globalThis.document = previous; }
}

test('exposes one agent-access settings section', () => {
  assert.deepEqual(settingsSections, [{ id: 'access', label: 'Agent access' }]);
});

test('loads current global assignments and saves the selected agent IDs', async () => fixture({}, async ({ root, calls }) => {
  const inputs = root.descendants().filter(node => node.tagName === 'input');
  assert.deepEqual(inputs.map(input => [input.value, input.checked]), [['agent-a', false], ['agent-b', true]]);
  assert.match(root.descendants().map(node => node.textContent).join(' '), /inspect their own diagnostics by default/);
  inputs[0].checked = true;
  inputs[1].checked = false;
  await root.fire('submit');
  await flush();
  const [, init] = calls.find(([, options]) => options.method === 'PUT');
  assert.equal(init.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(init.body), { globalAgentIds: ['agent-a'] });
  assert.ok(root.descendants().some(node => node.textContent === 'Agent access saved.'));
}));

test('preserves a stale selected assignment so the operator can remove it', async () => fixture({ access: ['missing-agent'] }, async ({ root, calls }) => {
  const stale = root.descendants().find(node => node.tagName === 'input' && node.value === 'missing-agent');
  assert.equal(stale.checked, true);
  assert.equal(stale.disabled, false);
  assert.equal(stale.parent.children[1].children[0].textContent, 'Unavailable agent assignment');
  stale.checked = false;
  await root.fire('submit');
  await flush();
  const saved = JSON.parse(calls.find(([, init]) => init.method === 'PUT')[1].body);
  assert.deepEqual(saved, { globalAgentIds: [] });
}));

test('rejects malformed access responses without replacing controls', async () => fixture({ access: 'all' }, async ({ root, calls }) => {
  assert.equal(calls.length, 1);
  assert.equal(root.descendants().some(node => node.tagName === 'input'), false);
  const alert = root.descendants().find(node => node.role === 'alert');
  assert.match(alert.textContent, /invalid access response/);
}));
