# Install and enable

## Requirements

Use a compatible Burrow Core with the `mod-management-v1` system capability and the Core-owned mod access settings adapter. Backdoor fails activation on an unsupported capability contract; it does not silently fall back to a weaker one. Keep Core and Backdoor on compatible releases.

On Core builds containing the mod-access authentication fix, the access settings follow Core’s configured authentication mode: a verified operator login is required when authentication is enabled; with `authMode: none`, direct UI access does not require a separate login. API tokens still cannot authorize this operator route. Older Core builds reject access with authentication disabled; see [settings troubleshooting](troubleshooting.md#settings-say-access-is-unavailable).

## Install from Settings

1. Open **Settings → Mods** in your home Burrow.
2. Add `https://github.com/GoblinKing-Burrow/Burrow-Backdoor` as a mod source.
3. Refresh the source and install **Burrow Backdoor**.
4. Explicitly enable the mod. A fresh installation remains disabled until enabled.
5. Open **Settings → Backdoor** to choose access. Ordinary agents can use their own diagnostics without assignment to either list.
6. For administration, open **Admin Access**, select **Approve Backdoor mod management**, choose the administrative agents, and save. Restart Core when the panel reports that a newly granted host capability requires it.
7. For cross-agent diagnostics, separately choose agents under **Global Access** and save.

## Verify

Ask an agent to call `burrow_health` and inspect its own sessions with `burrow_list_sessions`. The tool group is **Mod: Burrow Backdoor**. There are 34 registered tools; discovery does not imply permission to execute every one.

For an assigned administrator, `burrow_mod_management_inventory` verifies administrative access without changing mods. An administrator is not automatically a global diagnostician.

## Configuration and updates

There is no Backdoor service URL, bearer token, proxy, listener, or mod-owned access configuration. Core owns grants and agent assignments independently of the mod lifecycle. The manifest identifies the mod as `burrow-backdoor`, declares `system: true`, and requests `mod-management-v1`.

Use normal **Settings → Mods** update, disable, and uninstall actions, or use the [administrative tools](administration.md) from an authorized agent. System-mod status does not make Backdoor bundled, always enabled, or non-removable.

## Automatic operating skill

On compatible Core and mod builds that declare managed skills, loading this mod automatically supplies the `burrow-backdoor` skill from [Burrow-Skills](https://github.com/GoblinKing-Burrow/Burrow-Skills/tree/main/burrow-backdoor). Core maintains the installed copy as read-only and refreshes managed skills at startup, on mod lifecycle changes, and on its default six-hour schedule. You do not paste, edit, or assign that managed copy manually. The skill provides instructions; it does not grant tool or data access.

The current mod manifest declares this managed skill. Automatic mod-managed delivery still requires a Core build that supports it. Older public **2026.10.19** snapshots lack the declaration; updating only the skill repository cannot add the missing integration to those older packages. See [how managed skills work](https://burrow-docs.blissful-psychosis.com/burrow-skills/managed-skills/).
