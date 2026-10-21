# Sources and development

These guides describe Backdoor’s tool and settings contracts, with build-specific notes for Core behavior. Tool schemas are derived from the implementation; Core remains responsible for authorization, diagnostic sanitization, distribution, and operation persistence.

| Contract | Public source |
| --- | --- |
| Tool registration and argument schemas | [src/mod.mjs](https://github.com/GoblinKing-Burrow/Burrow-Backdoor/blob/main/src/mod.mjs) |
| System capability and settings contribution | [burrow.mod.json](https://github.com/GoblinKing-Burrow/Burrow-Backdoor/blob/main/burrow.mod.json) |
| Operator settings and access replacement | [ui/settings.js](https://github.com/GoblinKing-Burrow/Burrow-Backdoor/blob/main/ui/settings.js) |
| Boundary and integration checks | [test directory](https://github.com/GoblinKing-Burrow/Burrow-Backdoor/tree/main/test) |
| Core behavior | [Burrow Backend](https://github.com/GoblinKing-Burrow/Burrow/tree/main/backend) |

## Versions

The no-auth settings behavior documented here requires a Core build containing the mod-access authentication fix. The public 2026.10.19 runtime predates that fix; see [settings troubleshooting](troubleshooting.md#settings-say-access-is-unavailable).

Public release versions use UTC `YYYY.MM.DD`. Use compatible Core and Backdoor releases. Tool schemas also accept valid calendar revisions and semantic version strings as an explicit version guard, but Core requires a match to the source’s currently inspected latest version.

## Local checks

Use Node.js 24.x. From a Backdoor checkout:

```sh
npm ci --ignore-scripts --no-audit --no-fund
BURROW_CORE_ROOT=/absolute/path/to/Burrow-Backend npm run check
```

Install the compatible Core checkout’s dependencies first. `BURROW_CORE_ROOT` selects the integration target explicitly; a missing explicit checkout or a missing Core checkout in CI is a failure. Only optional automatic local discovery may skip integration tests, so check the reported skip count.

Documentation checks:

```sh
python -m pip install -r requirements-docs.txt
python -m mkdocs build --strict
python scripts/docs/check_site.py site
```

The public site uses MkDocs Material. Documentation CI builds and checks links before deployment. The source and [license](https://github.com/GoblinKing-Burrow/Burrow-Backdoor/blob/main/LICENSE) are available in the public repository.

## Review checkpoint: 21 October 2026

All pages in this section were reconciled from the [2026.10.19 runtime baseline](https://github.com/GoblinKing-Burrow/Burrow-Backdoor/tree/02aef71e99bd54b4ee635251ab4496720cd4f5fa) through [public source `381b6f5`](https://github.com/GoblinKing-Burrow/Burrow-Backdoor/tree/381b6f50e545063e2a4434c1f56658f8b7d6d7f0). The public runtime implementation is unchanged across that interval; documentation changes do not imply a new runtime release. Core-dependent and forthcoming managed-skill behavior is identified separately in the relevant guides.

The original guides named the release line but did not pin every page to a commit. This review uses the published release snapshot and repository history as the baseline, rather than assuming an undocumented per-page source revision.

### Public-snapshot test limitation

The 2026.10.19 public snapshot includes `test/development-release-workflow.test.mjs` but excludes the development release workflow it reads. The aggregate `npm run check` therefore fails with a missing workflow file even when the mod's focused tests pass. Report that separately from runtime behavior. Core integration additionally requires the compatible Core checkout and dependencies described above; skipped integration cases do not establish compatibility.
