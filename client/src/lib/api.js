/**
 * API client.
 *
 * Holds the short-lived access token in memory only; the refresh token is an
 * httpOnly cookie the server manages. A 401 triggers one refresh attempt and
 * a single retry, with concurrent callers sharing that refresh.
 */

let accessToken = null;
let refreshPromise = null;
const listeners = new Set();

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

/** Notified when the session ends so the app can return to the login screen. */
export function onSessionLost(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function sessionLost() {
  accessToken = null;
  for (const fn of listeners) fn();
}

async function refresh() {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('refresh failed');
        const body = await res.json();
        accessToken = body.accessToken;
        return body;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export class ApiError extends Error {
  constructor(status, message, payload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function parse(res) {
  const type = res.headers.get('content-type') || '';
  if (type.includes('application/json')) return res.json();
  return res.text();
}

async function request(method, path, { body, retry = true, signal } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    signal,
    headers: {
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (res.status === 401 && retry) {
    try {
      await refresh();
      return request(method, path, { body, retry: false, signal });
    } catch {
      sessionLost();
      throw new ApiError(401, 'Your session has expired. Please sign in again.');
    }
  }

  if (!res.ok) {
    const payload = await parse(res).catch(() => null);
    const message = (payload && payload.error) || `Request failed (${res.status})`;
    throw new ApiError(res.status, message, payload);
  }

  if (res.status === 204) return null;
  return parse(res);
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body: body ?? {} }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body: body ?? {} }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body: body ?? {} }),
  del: (path, opts) => request('DELETE', path, opts),

  /** Multipart upload; the browser sets the boundary itself. */
  async upload(path, formData) {
    const send = async () => fetch(`/api${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
      body: formData
    });
    let res = await send();
    if (res.status === 401) {
      try { await refresh(); res = await send(); }
      catch { sessionLost(); throw new ApiError(401, 'Your session has expired.'); }
    }
    if (!res.ok) {
      const payload = await parse(res).catch(() => null);
      throw new ApiError(res.status, (payload && payload.error) || 'Upload failed', payload);
    }
    return res.json();
  },

  /**
   * Download a binary export. The access token cannot travel in a header on a
   * plain navigation, so the file is fetched and handed to the browser as a
   * blob with the filename the server chose.
   */
  async download(path, fallbackName) {
    const attempt = async () => fetch(`/api${path}`, {
      credentials: 'include',
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {}
    });
    let res = await attempt();
    if (res.status === 401) {
      try { await refresh(); res = await attempt(); }
      catch { sessionLost(); throw new ApiError(401, 'Your session has expired.'); }
    }
    if (!res.ok) {
      const payload = await parse(res).catch(() => null);
      throw new ApiError(res.status, (payload && payload.error) || 'Export failed', payload);
    }

    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : fallbackName || 'download';
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return filename;
  }
};

/** Build a query string, dropping empty values. */
export function qs(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}
