export class BurrowClient {
  constructor({ baseUrl, token, fetchImpl = fetch } = {}) {
    this.baseUrl = String(baseUrl || '').replace(/\/$/, '');
    this.token = String(token || '');
    this.fetch = fetchImpl;
    if (!this.baseUrl) throw new Error('BURROW_BASE_URL is required');
    if (!this.token) throw new Error('BURROW_API_TOKEN is required');
  }

  async get(pathname, query = {}) {
    const url = new URL(pathname, `${this.baseUrl}/`);
    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
    }
    const response = await this.fetch(url, { headers: { accept: 'application/json', authorization: `Bearer ${this.token}` } });
    const text = await response.text();
    let body;
    try { body = text ? JSON.parse(text) : null; } catch { body = { ok: false, error: 'invalid_json_response' }; }
    if (!response.ok) throw Object.assign(new Error(body?.error || `burrow_http_${response.status}`), { status: response.status, body });
    return body;
  }
}
