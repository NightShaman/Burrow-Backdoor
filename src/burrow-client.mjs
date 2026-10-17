export class BurrowClient {
  constructor({ baseUrl, token, timeoutMs = 30_000, fetchImpl = fetch } = {}) {
    this.baseUrl = String(baseUrl || '').replace(/\/$/, '');
    this.token = String(token || '');
    this.timeoutMs = Number(timeoutMs);
    this.fetch = fetchImpl;
    if (!this.baseUrl) throw new Error('BURROW_BASE_URL is required');
    if (!this.token) throw new Error('BURROW_API_TOKEN is required');
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 1) throw new Error('BURROW_REQUEST_TIMEOUT_MS must be a positive safe integer');
  }

  async get(pathname, query = {}) {
    const url = new URL(pathname, `${this.baseUrl}/`);
    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
    }
    let response;
    try {
      response = await this.fetch(url, {
        headers: { accept: 'application/json', authorization: `Bearer ${this.token}` },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (cause) {
      const timedOut = cause?.name === 'TimeoutError';
      throw Object.assign(new Error(timedOut ? 'burrow_request_timeout' : 'burrow_request_failed'), { status: timedOut ? 504 : 502, cause });
    }
    const text = await response.text();
    let body;
    try { body = text ? JSON.parse(text) : null; } catch { body = { ok: false, error: 'invalid_json_response' }; }
    if (!response.ok) throw Object.assign(new Error(body?.error || `burrow_http_${response.status}`), { status: response.status, body });
    return body;
  }
}
