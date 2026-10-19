# Security and trust

!!! danger "Choose administrative agents deliberately"
    Mod administration changes executable code and service availability. Global diagnostics widens access to other agents’ work. Grant each independently and keep the list as small as your workflow needs.

## Boundaries Core enforces

- The trusted caller comes from Core, not `agentId` or other model-supplied arguments.
- Diagnostic scope and administrative authority are independently Core-owned.
- Backdoor requests only `mod-management-v1`; system status alone grants nothing.
- Diagnostic reads use `context.runtimeDiagnostics.read`; management uses the declared `context.modManagement` facade.
- Lifecycle mutations reuse Core’s distribution and recovery behavior.
- Mod diagnostics require the target mod’s dedicated opt-in diagnostic interface. Backdoor does not proxy arbitrary mod routes.
- Source credentials, model/database credentials, direct controller filesystem/process access, and arbitrary HTTP access are not exposed by these facades.

## What these boundaries do not mean

Sanitization does not make every diagnostic result public-safe. Session tails and evidence can contain private information. “Read-only” describes the diagnostic action, not the sensitivity of its output.

A trusted administrator can make a disruptive but permitted change. Backdoor does not promise a confirmation prompt for each mutation or automatic rollback. Inspect [operation results](operations.md), including unknown outcomes, and keep operator access available for recovery.

Node Goblin and Backdoor solve different jobs: Node Goblin selects execution on another machine; Backdoor observes/administers the home Burrow. Changing the remote target does not move Backdoor’s authority to that remote host.

Disabling or uninstalling Backdoor removes its live routing. Core-owned grants/assignments are independent of the mod lifecycle; do not treat uninstall as a substitute for reviewing or revoking authority.
