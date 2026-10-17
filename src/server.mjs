import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { BurrowClient } from './burrow-client.mjs';
import { registerDiagnosticTools } from './tools.mjs';

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 8080);
const mcpPath = process.env.MCP_PATH || '/mcp';
const requestTimeoutMs = process.env.BURROW_REQUEST_TIMEOUT_MS || 30_000;
const sessions = new Map();
const client = new BurrowClient({ baseUrl: process.env.BURROW_BASE_URL, token: process.env.BURROW_API_TOKEN, timeoutMs: Number(requestTimeoutMs) });

async function createSession() {
  const server = new McpServer({ name: 'Burrow-Backdoor', version: '0.2.0' });
  registerDiagnosticTools(server, client);
  let entry;
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: randomUUID, onsessioninitialized(id) { entry.sessionId = id; sessions.set(id, entry); } });
  entry = { server, transport, sessionId: null };
  transport.onclose = () => { if (entry.sessionId) sessions.delete(entry.sessionId); };
  await server.connect(transport);
  return entry;
}

const httpServer = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok: true, service: 'burrow-backdoor', sessions: sessions.size });
    if (url.pathname !== mcpPath) return json(res, 404, { error: 'not_found' });
    const body = req.method === 'POST' ? await readJson(req) : undefined;
    const id = Array.isArray(req.headers['mcp-session-id']) ? req.headers['mcp-session-id'][0] : req.headers['mcp-session-id'];
    let entry = id ? sessions.get(id) : null;
    if (!entry && !id && req.method === 'POST' && isInitializeRequest(body)) entry = await createSession();
    if (!entry) return json(res, 400, { jsonrpc: '2.0', error: { code: -32000, message: 'No valid session ID provided' }, id: null });
    await entry.transport.handleRequest(req, res, body);
  } catch (error) {
    console.error('[burrow-backdoor] request failed:', error);
    if (!res.headersSent) json(res, 400, { jsonrpc: '2.0', error: { code: -32000, message: 'invalid_request' }, id: null });
  }
});

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.error(`[burrow-backdoor] shutting down (${signal})`);
  httpServer.close();
  const active = [...sessions.values()];
  sessions.clear();
  await Promise.allSettled(active.map(({ transport }) => transport.close()));
  process.exit(0);
}
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(signal, () => void shutdown(signal));
httpServer.listen(port, host, () => console.error(`[burrow-backdoor] MCP listening on http://${host}:${port}${mcpPath}`));

function json(res, status, body) { const payload = JSON.stringify(body); res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }); res.end(payload); }
async function readJson(req) { const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > 4 * 1024 * 1024) throw new Error('request_body_too_large'); chunks.push(chunk); } const value = Buffer.concat(chunks).toString('utf8'); return value ? JSON.parse(value) : undefined; }
