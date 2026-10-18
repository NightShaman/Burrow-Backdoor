/** Operator-facing assignment of Core-owned Backdoor diagnostic and administrative access. */
export const settingsSections = [
  { id: 'global-access', label: 'Global Access' },
  { id: 'admin-access', label: 'Admin Access' },
];

const MANAGEMENT_CAPABILITY = 'mod-management-v1';
const sectionConfig = {
  'global-access': {
    key: 'diagnosticAgentIds',
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
    optionHelp: 'Can administer Burrow when the capability is approved',
    saveLabel: 'Save admin access',
    savedMessage: 'Admin access saved.',
    capability: MANAGEMENT_CAPABILITY,
  },
};

const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
};

function readStrings(result, key) {
  if (!Array.isArray(result?.[key]) || result[key].some(value => typeof value !== 'string' || !value)) {
    throw new Error('Core returned an invalid Backdoor access response.');
  }
  return [...result[key]];
}

function readAccess(result) {
  const access = {
    grants: readStrings(result, 'grants'),
    adminAgentIds: readStrings(result, 'adminAgentIds'),
    diagnosticAgentIds: readStrings(result, 'diagnosticAgentIds'),
    declaredCapabilities: readStrings(result, 'declaredCapabilities'),
    restartRequired: result?.restartRequired,
  };
  for (const key of ['grants', 'adminAgentIds', 'diagnosticAgentIds', 'declaredCapabilities']) {
    if (new Set(access[key]).size !== access[key].length) throw new Error('Core returned an invalid Backdoor access response.');
  }
  if (typeof access.restartRequired !== 'boolean') throw new Error('Core returned an invalid Backdoor access response.');
  return access;
}

function replacement(access) {
  return {
    grants: [...access.grants],
    adminAgentIds: [...access.adminAgentIds],
    diagnosticAgentIds: [...access.diagnosticAgentIds],
  };
}

export function mountSettings({ section, primary, overflow, accessApi, agents }) {
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
.backdoor-settings .backdoor-agent-option,.backdoor-settings .backdoor-capability-option{display:flex;align-items:flex-start;gap:10px;min-width:0;padding:11px 12px;border:1px solid var(--line);border-radius:7px;background:var(--surface-input);cursor:pointer}
.backdoor-settings .backdoor-agent-option:hover,.backdoor-settings .backdoor-capability-option:hover{border-color:var(--accent-border);background:var(--surface-hover)}
.backdoor-settings .backdoor-agent-option input,.backdoor-settings .backdoor-capability-option input{flex:none;margin-top:3px;accent-color:var(--accent)}
.backdoor-settings .backdoor-agent-option span,.backdoor-settings .backdoor-capability-option span{min-width:0;overflow-wrap:anywhere}
.backdoor-settings .backdoor-agent-option small,.backdoor-settings .backdoor-capability-option small{display:block;margin-top:2px;color:var(--text-muted,var(--muted))}
.backdoor-settings .backdoor-agent-option.unavailable{cursor:default}
.backdoor-settings .backdoor-capability{margin:18px 0 4px}
.backdoor-settings .backdoor-restart-notice{margin-top:12px}
.backdoor-settings .card-actions button{min-height:34px;padding:7px 12px;border-radius:6px}
.backdoor-settings button:disabled{opacity:.55;cursor:not-allowed}
.backdoor-settings :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
`;
  form.append(style, el('h2', config.title));
  form.append(el('p', config.description, 'settings-help'));
  form.append(el('p', config.independence, 'settings-help'));

  let capabilityInput = null;
  const capabilityBox = el('div', null, 'backdoor-capability');
  if (config.capability) form.append(capabilityBox);

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
    if (capabilityInput) capabilityInput.disabled = next;
  };

  function renderCapability(nextAccess) {
    capabilityBox.replaceChildren();
    capabilityInput = null;
    if (!config.capability) return;
    if (!nextAccess.declaredCapabilities.includes(config.capability)) {
      capabilityBox.append(el('p', 'Backdoor does not currently declare its required administrative capability.', 'settings-request-error'));
      return;
    }
    capabilityInput = el('input');
    capabilityInput.type = 'checkbox';
    capabilityInput.checked = nextAccess.grants.includes(config.capability);
    const copy = el('span', 'Approve Backdoor mod management');
    copy.append(el('small', 'Required before assigned administrators can install, update, enable, disable, or uninstall mods.'));
    const label = el('label', null, 'backdoor-capability-option');
    label.append(capabilityInput, copy);
    capabilityBox.append(label);
  }

  function render(nextAccess) {
    access = nextAccess;
    inputs.clear();
    list.replaceChildren();
    renderCapability(nextAccess);
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
    setStatus(nextAccess.restartRequired ? 'A Core restart is still required for the latest capability grant.' : '');
  }

  async function readCurrent() {
    if (typeof accessApi !== 'function') throw new Error('This Burrow UI does not support Core-owned mod access yet.');
    return readAccess(await accessApi({ signal: controller.signal }));
  }

  async function load() {
    save.disabled = true;
    try {
      const result = await readCurrent();
      if (!active) return;
      render(result);
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
    setSaving(true);
    setStatus('Saving…');
    try {
      // Core replacements are last-writer-wins. Refresh immediately before saving so
      // this panel preserves fields owned by the other panel and any unknown grants.
      const current = await readCurrent();
      const nextAccess = { ...current, [config.key]: selectedIds() };
      if (config.capability && capabilityInput) {
        nextAccess.grants = capabilityInput.checked
          ? [...new Set([...current.grants, config.capability])]
          : current.grants.filter(capability => capability !== config.capability);
      }
      const result = readAccess(await accessApi({
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(replacement(nextAccess)),
        signal: controller.signal,
      }));
      if (!active) return;
      render(result);
      setStatus(result.restartRequired
        ? `${config.savedMessage} Restart Core to apply newly granted host capabilities.`
        : config.savedMessage);
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
