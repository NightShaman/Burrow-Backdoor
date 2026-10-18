/** Operator-facing assignment of Backdoor diagnostic and administrative access. */
export const settingsSections = [
  { id: 'global-access', label: 'Global Access' },
  { id: 'admin-access', label: 'Admin Access' },
];

const sectionConfig = {
  'global-access': {
    key: 'globalAgentIds',
    title: 'Global diagnostic access',
    description: 'Agents can inspect their own diagnostics by default. Select agents that may inspect diagnostics across all agents.',
    independence: 'This assignment does not grant or imply Burrow administrative access.',
    ariaLabel: 'Agents with global diagnostic access',
    optionHelp: 'Can inspect all agents',
    saveLabel: 'Save global access',
    savedMessage: 'Global access saved.',
  },
  'admin-access': {
    key: 'adminAgentIds',
    title: 'Burrow administrative access',
    description: 'Select agents that may use Burrow administrative capabilities exposed through Backdoor.',
    independence: 'This assignment does not grant or imply global diagnostic access.',
    ariaLabel: 'Agents with Burrow administrative access',
    optionHelp: 'Can administer Burrow',
    saveLabel: 'Save admin access',
    savedMessage: 'Admin access saved.',
  },
};

const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
};

function readAgentIds(result, key) {
  if (!result || !Array.isArray(result[key]) || result[key].some(id => typeof id !== 'string')) {
    throw new Error('Backdoor returned an invalid access response.');
  }
  return [...new Set(result[key])];
}

function readAccess(result) {
  return {
    globalAgentIds: readAgentIds(result, 'globalAgentIds'),
    adminAgentIds: readAgentIds(result, 'adminAgentIds'),
  };
}

export function mountSettings({ section, primary, overflow, api, agents }) {
  let active = true;
  let saving = false;
  let access = null;
  const controller = new AbortController();
  const inputs = new Map();
  const config = sectionConfig[section] ?? sectionConfig['global-access'];
  const form = el('form', null, 'setting-section backdoor-settings');
  const style = el('style');
  style.textContent = `
.backdoor-settings .backdoor-agent-list{display:grid;gap:8px;margin:18px 0 24px}
.backdoor-settings .backdoor-agent-option{display:flex;align-items:flex-start;gap:10px;min-width:0;padding:11px 12px;border:1px solid var(--line);border-radius:7px;background:var(--surface-input);cursor:pointer}
.backdoor-settings .backdoor-agent-option:hover{border-color:var(--accent-border);background:var(--surface-hover)}
.backdoor-settings .backdoor-agent-option input{flex:none;margin-top:3px;accent-color:var(--accent)}
.backdoor-settings .backdoor-agent-option span{min-width:0;overflow-wrap:anywhere}
.backdoor-settings .backdoor-agent-option small{display:block;margin-top:2px;color:var(--text-muted,var(--muted))}
.backdoor-settings .backdoor-agent-option.unavailable{cursor:default}
.backdoor-settings .card-actions button{min-height:34px;padding:7px 12px;border-radius:6px}
.backdoor-settings button:disabled{opacity:.55;cursor:not-allowed}
.backdoor-settings :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
`;
  form.append(style, el('h2', config.title));
  form.append(el('p', config.description, 'settings-help'));
  form.append(el('p', config.independence, 'settings-help'));

  const list = el('div', null, 'backdoor-agent-list');
  list.setAttribute('aria-label', config.ariaLabel);
  form.append(list);

  const actions = el('div', null, 'card-actions');
  const save = el('button', config.saveLabel, 'primary');
  save.type = 'submit';
  save.disabled = true;
  const feedback = el('p', 'Loading agent access…', 'settings-help');
  feedback.setAttribute('role', 'status');
  actions.append(save);
  form.append(actions, feedback);
  primary.replace(form);
  overflow?.clear();

  const fail = message => {
    feedback.textContent = message;
    feedback.setAttribute('role', 'alert');
  };
  const setStatus = message => {
    feedback.textContent = message;
    feedback.setAttribute('role', 'status');
  };
  const setSaving = next => {
    saving = next;
    save.disabled = next;
    for (const input of inputs.values()) input.disabled = next;
  };

  function render(nextAccess) {
    access = nextAccess;
    inputs.clear();
    list.replaceChildren();
    const selectedIds = access[config.key];
    const selected = new Set(selectedIds);
    const availableIds = new Set(agents.map(agent => agent.id));
    const rows = [
      ...agents.map(agent => ({ id: agent.id, name: agent.name || agent.id, unavailable: false })),
      ...selectedIds.filter(id => !availableIds.has(id)).map(id => ({ id, name: id, unavailable: true })),
    ];
    if (!rows.length) list.append(el('p', 'No agents are available.', 'settings-help'));
    for (const agent of rows) {
      const input = el('input');
      input.type = 'checkbox';
      input.value = agent.id;
      input.checked = selected.has(agent.id);
      input.dataset.unavailable = String(agent.unavailable);
      const copy = el('span', agent.name);
      copy.append(el('small', agent.unavailable ? 'Unavailable agent assignment' : config.optionHelp));
      const label = el('label', null, `backdoor-agent-option${agent.unavailable ? ' unavailable' : ''}`);
      label.append(input, copy);
      list.append(label);
      inputs.set(agent.id, input);
    }
    save.disabled = false;
    setStatus('');
  }

  async function load() {
    save.disabled = true;
    try {
      const result = await api('/access', { signal: controller.signal });
      if (!active) return;
      render(readAccess(result));
    } catch (error) {
      if (active) fail(`Agent access unavailable: ${error?.message || 'Request failed.'}`);
    }
  }

  function selectedIds() {
    return [...inputs]
      .filter(([, input]) => input.checked)
      .map(([id]) => id);
  }

  async function submit(event) {
    event.preventDefault();
    if (saving || save.disabled || !access) return;
    const nextAccess = { ...access, [config.key]: selectedIds() };
    setSaving(true);
    setStatus('Saving…');
    try {
      const result = await api('/access', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(nextAccess),
        signal: controller.signal,
      });
      if (!active) return;
      render(result == null ? nextAccess : readAccess(result));
      setStatus(config.savedMessage);
    } catch (error) {
      if (active) fail(`Could not save agent access: ${error?.message || 'Request failed.'}`);
    } finally {
      if (active) setSaving(false);
    }
  }

  form.addEventListener('submit', submit);
  void load();

  return () => {
    active = false;
    controller.abort();
    form.removeEventListener('submit', submit);
    primary.clear();
    overflow?.clear();
  };
}
