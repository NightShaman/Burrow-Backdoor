# Sources and development

These guides describe the current public Backdoor tool and settings contracts. Tool schemas are derived from the implementation; Core remains responsible for authorization, diagnostic sanitization, distribution, and operation persistence.

| Contract | Public source |
| --- | --- |
| Tool registration and argument schemas | [src/mod.mjs](https://github.com/GoblinKing-Burrow/Burrow-Backdoor/blob/main/src/mod.mjs) |
| System capability and settings contribution | [burrow.mod.json](https://github.com/GoblinKing-Burrow/Burrow-Backdoor/blob/main/burrow.mod.json) |
| Operator settings and access replacement | [ui/settings.js](https://github.com/GoblinKing-Burrow/Burrow-Backdoor/blob/main/ui/settings.js) |
| Boundary and integration checks | [test directory](https://github.com/GoblinKing-Burrow/Burrow-Backdoor/tree/main/test) |
| Core behavior | [Burrow Backend](https://github.com/GoblinKing-Burrow/Burrow/tree/main/backend) |

## Versions

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
