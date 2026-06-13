import { API_BASE as BASE } from '../config';
const TOKEN_KEY = 'ace_token';

export function getToken()    { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t)   { localStorage.setItem(TOKEN_KEY, t); }
export function clearToken()  { localStorage.removeItem(TOKEN_KEY); }

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
  checkUsername:   (username)                 => req('GET',  `/api/auth/check-username?username=${encodeURIComponent(username)}`),
  sendOTP:         (phone)                    => req('POST', '/api/auth/send-otp',  { phone }),
  verifyOTP:       (phone, code)              => req('POST', '/api/auth/verify-otp', { phone, code }),
  signup:          (username, pin, phoneToken) => req('POST', '/api/auth/signup',    { username, pin, phone_token: phoneToken }),
  login:           (username, pin)             => req('POST', '/api/auth/login',     { username, pin }),
  logout:          ()                          => req('POST', '/api/auth/logout'),
  sendRecoverOTP:  (phone)                    => req('POST', '/api/auth/recover-send-otp', { phone }),
  recoverUsername: (phone, code)              => req('POST', '/api/auth/recover',   { phone, code }),
  getMe:         ()              => req('GET',    '/api/me'),
  getStats:      ()              => req('GET',    '/api/stats'),
  recordGame:    body            => req('POST',   '/api/games', body),
  getHistory:    (limit = 50, offset = 0) => req('GET', `/api/games?limit=${limit}&offset=${offset}`),
  deleteAccount: ()              => req('DELETE', '/api/account'),
  aiMove:        payload         => req('POST',   '/api/ai/move', payload),
  getConfig:     ()              => req('GET',    '/api/config'),
};
