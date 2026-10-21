# Agent access

## Three distinct kinds of access

| Access | Who has it | What it allows |
| --- | --- | --- |
| Own diagnostics | Agents using enabled Backdoor | Caller-authorized agent/session records and shared health/inventory summaries and the agent identity/execution-assignment directory |
| Global diagnostics | Agents selected in **Global Access** | Cross-agent diagnostics plus installation-wide Forge/mod job and pending-operation diagnostics |
| Mod administration | Agents selected in **Admin Access**, with the capability approved | Management inventory, refresh, install, update, enable, disable, uninstall, and operation lookup |

Global diagnostics do not grant administration. Administration does not grant global diagnostics. Selecting an `agentId` in tool arguments never grants access to that agent.

## Set access

Open **Settings → Burrow Backdoor → Global Access**. Check the agents that should see cross-agent diagnostics, then choose **Save global access**.

Open **Admin Access**. Check **Approve Backdoor mod management**, select trusted agents, then choose **Save admin access**. Newly granted host capabilities require a Core restart; follow the panel’s restart notice. Agent assignments and capability grants are separate parts of the authority record. The current restart flag is a save-time signal, not persistent restart tracking; see the [operator API](operator-api.md).

To revoke access, uncheck the relevant assignment or capability and save. Core checks authority on calls and again before starting queued management mutations. Revoking access does not undo an already completed change, and an operation already in progress may have committed.

Unavailable agent assignments remain visible so operators can deliberately retain or remove them. Each panel refreshes before saving and preserves the other panel’s fields and unrelated grants. Updates are complete replacements and last-writer-wins; coordinate simultaneous operator edits.

## Trusted caller identity

Core supplies the active agent, session, conversation, and run identity. This identity determines authorization and is recorded on management operations. The agent cannot impersonate another caller through tool arguments. Browser cookies, operator login, bearer tokens, and Node Goblin target selection are not the authority source for internal agent tool calls.

The Settings page itself uses Core’s operator access API and follows Core’s configured authentication mode on builds containing the mod-access authentication fix. API tokens do not grant operator access. See the [operator API reference](operator-api.md).

## Shared agent directory

`burrow_list_agents` exposes agent identities and execution assignments without global diagnostic access. Disabled agents are included by default; set `includeDisabled: false` to filter them. This directory visibility does not grant access to other agents’ sessions or records.
