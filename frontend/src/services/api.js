/**
 * Centralised API client. The ONLY place that knows backend URLs.
 *
 * Auth: the backend sets an httpOnly `token` cookie on login/register, so every
 * request uses `credentials: 'include'`; no token is ever stored in JS.
 *
 * Endpoints (all verified against backend/src/routes):
 *   POST /auth/register | /auth/login | /auth/logout      GET /auth/me
 *   GET  /accounts      POST /accounts                    GET /accounts/balance/:id
 *   GET  /transactions  GET  /transactions/:id            POST /transactions (needs the transaction PIN)
 *   POST /auth/pin  PUT /auth/pin  POST /auth/pin/reset   (set / change / forgot transaction PIN)
 */
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // 0 = server unreachable
    this.data = data;
  }
}

let unauthorizedHandler = null;
/** AuthContext registers a callback so an expired session logs the user out everywhere. */
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

async function request(path, { method = 'GET', body, params, keepSession = false } = {}) {
  let url = `${BASE}${path}`;

  if (params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') query.set(key, value);
    });
    const qs = query.toString();
    if (qs) url += `?${qs}`;
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Please check that the backend is running.', 0);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    /* non-JSON body */
  }

  if (!response.ok) {
    // A 401 normally means the session expired -> log out. `keepSession` is for calls where a 401
    // only means "wrong password" (set/reset PIN), which must NOT log the user out.
    if (response.status === 401 && unauthorizedHandler && !keepSession) unauthorizedHandler();
    throw new ApiError(data?.message || `Request failed (${response.status})`, response.status, data);
  }

  return data;
}

export const api = {
  // auth
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  logout: () => request('/auth/logout', { method: 'POST', body: {} }),
  me: () => request('/auth/me'),

  // accounts
  listAccounts: () => request('/accounts'),
  createAccount: () => request('/accounts', { method: 'POST', body: {} }),
  getBalance: (accountId) => request(`/accounts/balance/${accountId}`),

  // transactions
  listTransactions: (params) => request('/transactions', { params }),
  getTransaction: (id) => request(`/transactions/${id}`),
  createTransaction: (payload) => request('/transactions', { method: 'POST', body: payload }),

  // transaction PIN
  setPin: (payload) => request('/auth/pin', { method: 'POST', body: payload, keepSession: true }),
  changePin: (payload) => request('/auth/pin', { method: 'PUT', body: payload }),
  resetPin: (payload) => request('/auth/pin/reset', { method: 'POST', body: payload, keepSession: true }),
};
