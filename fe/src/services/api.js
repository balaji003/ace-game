import { API_BASE as BASE } from '../config';
// Token lives in native secure storage on apps, localStorage on web — behind
// one interface so callers (and req() below) stay synchronous.
export { getToken, setToken, clearToken } from '../native/storage';
import { getToken } from '../native/storage';

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'request failed'), { status: res.status, conflict: data.conflict, code: data.code, retryAfter: data.retry_after });
  return data;
}

export const api = {
  checkUsername:   (username)                => req('GET',  `/api/auth/check-username?username=${encodeURIComponent(username)}`),
  googleAuth:      (idToken)                 => req('POST', '/api/auth/google',          { id_token: idToken }),
  googleComplete:  (signupToken, username)   => req('POST', '/api/auth/google/complete', { signup_token: signupToken, username }),
  logout:          ()                        => req('POST', '/api/auth/logout'),
  getMe:         ()              => req('GET',    '/api/me'),
  getStats:      ()              => req('GET',    '/api/stats'),
  recordGame:    body            => req('POST',   '/api/games', body),
  getHistory:    (limit = 50, offset = 0) => req('GET', `/api/games?limit=${limit}&offset=${offset}`),
  deleteAccount: ()              => req('DELETE', '/api/account'),
  getConfig:     ()              => req('GET',    '/api/config'),
};
