# Operations and recovery

## Receipt and attribution

Management mutations return promptly with `ok` and an `operation` record. The record includes its UUID, owner mod, trusted actor identity (agent/session/conversation/run where available), action, target mod/version, status, timestamps, sanitized result, and an error code when present.

The operation is persisted by Core. It is not held only in the submitting model turn or Backdoor host. `burrow_get_mod_operation` is an administrative tool and looks up operations owned by Backdoor; a random UUID is not a cross-mod lookup capability.

| Status | Meaning | Next step |
| --- | --- | --- |
| `queued` | Persisted and accepted | Check again later |
| `running` | Claimed/in progress | Wait; do not submit a duplicate |
| `succeeded` | Core reports completion | Inspect result and verify resulting state |
| `failed` | Execution reported failure | Read the sanitized error and inspect current state before retrying |
| `interrupted` | Core cannot establish completion after interruption | Reconcile inventory and operator status before any retry |

A failed operation can have `result.outcome: "unknown"` because an error may occur after a change committed. `mod_authority_forbidden` checked before mutation produces a known failed outcome. Do not interpret every failure as “nothing changed.”

## Backdoor can update or disable itself

Core waits for the submitting tool invocation to settle before executing the mutation. This lets Backdoor return a receipt before its old host is retired during its own update, disable, or uninstall.

Disabling/unloading Backdoor revokes new live tool routing. Accepted work is Core-owned; it can continue even when the Backdoor host is gone, subject to authority checks before execution. If you disabled or uninstalled Backdoor, use operator **Settings → Mods** to inspect/recover availability. Do not assume you can keep polling through an unloaded tool group.

## Restart and interrupted work

Core records uncertain running work as interrupted instead of blindly replaying a mutation that may already have committed. Queued work and running work are different: the worker may resume queued work, while uncertain running work requires reconciliation.

Check the target’s version, installation and enabled state. Resolve a source, compatibility, or authority problem before submitting a fresh operation. There is no Backdoor cancel/retry-operation tool; any new mutation is a new request.

## Pending capability calls are different

`burrow_mod_pending_operations` is a global diagnostic view of currently active Core-hosted mod capability calls. It does not replace durable management receipts, operation IDs, or their terminal statuses.
