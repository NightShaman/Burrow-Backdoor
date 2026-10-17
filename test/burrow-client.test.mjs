import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BurrowClient } from '../src/burrow-client.mjs';

test('client sends bearer token and query parameters', async () => {
  let request;
  const client = new BurrowClient({ baseUrl: 'http://burrow:42817/', token: 'secret', fetchImpl: async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  } });
  assert.deepEqual(await client.get('/api/traces', { agentId: 'hatchet', empty: '' }), { ok: true });
  assert.equal(request.url, 'http://burrow:42817/api/traces?agentId=hatchet');
  assert.equal(request.options.headers.authorization, 'Bearer secret');
});

test('client reports bounded upstream errors', async () => {
  const client = new BurrowClient({ baseUrl: 'http://burrow:42817', token: 'secret', fetchImpl: async () => new Response(JSON.stringify({ ok: false, error: 'forbidden' }), { status: 403 }) });
  await assert.rejects(() => client.get('/api/health'), (error) => error.message === 'forbidden' && error.status === 403);
});

test('client bounds transport failures and timeouts', async () => {
  const failed = new BurrowClient({ baseUrl: 'http://burrow:42817', token: 'secret', fetchImpl: async () => { throw new TypeError('connection refused'); } });
  await assert.rejects(() => failed.get('/api/health'), (error) => error.message === 'burrow_request_failed' && error.status === 502);

  const timedOut = new BurrowClient({ baseUrl: 'http://burrow:42817', token: 'secret', timeoutMs: 1, fetchImpl: async (_url, { signal }) => await new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })) });
  await assert.rejects(() => timedOut.get('/api/health'), (error) => error.message === 'burrow_request_timeout' && error.status === 504);
});

test('client rejects invalid timeout configuration', () => {
  assert.throws(() => new BurrowClient({ baseUrl: 'http://burrow:42817', token: 'secret', timeoutMs: 0 }), /positive safe integer/);
});
