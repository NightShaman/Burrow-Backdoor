import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');

test('main publishes an installable NightShaman development mod version after focused checks', () => {
  assert.match(workflow, /push:\s*\n\s+branches: \[main\]/);
  assert.match(workflow, /Fast development contract gate/);
  assert.match(workflow, /set-release-version\.mjs/);
  assert.match(workflow, /git push origin "\$tag"/);
  assert.match(workflow, /gh release create/);
  assert.match(workflow, /Complete Backdoor\/Core validation and public promotion run separately/);
});
