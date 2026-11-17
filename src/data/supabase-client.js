export const SESSION_STORAGE_KEY = 'school_journal.supabase.session.v1';

const LOGIN_ERROR = 'Не вдалося увійти. Перевірте електронну пошту й пароль.';
const SESSION_ERROR = 'Сеанс завершився. Увійдіть знову.';
const REQUEST_ERROR = 'Не вдалося завантажити дані. Перевірте доступ і повторіть спробу.';
const NETWORK_ERROR = 'Не вдалося зв’язатися із сервером. Перевірте з’єднання й повторіть спробу.';
const TIMEOUT_ERROR = 'Запит тривав занадто довго. Перевірте з’єднання й повторіть спробу.';

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createSupabaseClient({
  url,
  anonKey,
  fetchImpl = globalThis.fetch,
  storage = defaultStorage(),
  now = () => Date.now(),
  setTimeoutImpl = globalThis.setTimeout.bind(globalThis),
  clearTimeoutImpl = globalThis.clearTimeout.bind(globalThis),
  timeoutMs = 10_000
} = {}) {
  if (!url || !anonKey || typeof fetchImpl !== 'function') {
    throw new Error('Налаштування підключення Supabase відсутні.');
  }

  const baseUrl = String(url).replace(/\/+$/, '');
  let session = null;
  let refreshTimer = null;
  let refreshPromise = null;

  function clearRefreshTimer() {
    if (refreshTimer !== null) clearTimeoutImpl(refreshTimer);
    refreshTimer = null;
  }

  function clearSession() {
    session = null;
    clearRefreshTimer();
    try {
      storage?.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Keep authentication errors free of storage details and tokens.
    }
  }

  function readSession() {
    try {
      const stored = JSON.parse(storage?.getItem(SESSION_STORAGE_KEY) ?? 'null');
      if (
        !stored ||
        typeof stored.access_token !== 'string' ||
        typeof stored.refresh_token !== 'string' ||
        !Number.isFinite(Number(stored.expires_at))
      ) return null;
      return {
        access_token: stored.access_token,
        refresh_token: stored.refresh_token,
        expires_at: Number(stored.expires_at)
      };
    } catch {
      return null;
    }
  }

  function scheduleRefresh() {
    clearRefreshTimer();
    if (!session) return;
    const delay = Math.max(0, session.expires_at * 1000 - now() - 60_000);
    refreshTimer = setTimeoutImpl(() => {
      refreshTimer = null;
      refreshSession().catch(() => clearSession());
    }, delay);
  }

  function storeSession(payload) {
    if (!payload || typeof payload.access_token !== 'string' || typeof payload.refresh_token !== 'string') {
      clearSession();
      throw new Error(SESSION_ERROR);
    }
    const expiresAt = Number(payload.expires_at) ||
      Math.floor(now() / 1000) + Math.max(1, Number(payload.expires_in) || 3600);
    session = {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: expiresAt
    };
    if (!storage) {
      clearSession();
      throw new Error('Не вдалося зберегти сеанс на цьому пристрої.');
    }
    try {
      storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      clearSession();
      throw new Error('Не вдалося зберегти сеанс на цьому пристрої.');
    }
    scheduleRefresh();
    return session;
  }

  async function fetchResponse(endpoint, options = {}) {
    const controller = new AbortController();
    const timer = setTimeoutImpl(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, { ...options, signal: controller.signal });
      let payload = null;
      if (response.status !== 204) {
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }
      }
      return { response, payload };
    } catch {
      if (controller.signal.aborted) throw new Error(TIMEOUT_ERROR);
      throw new Error(NETWORK_ERROR);
    } finally {
      clearTimeoutImpl(timer);
    }
  }

  async function requestToken(grantType, body) {
    const endpoint = new URL('/auth/v1/token', baseUrl);
    endpoint.searchParams.set('grant_type', grantType);
    const { response, payload } = await fetchResponse(endpoint, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(grantType === 'password' ? LOGIN_ERROR : SESSION_ERROR);
    }
    return payload;
  }

  async function refreshSession() {
    if (refreshPromise) return refreshPromise;
    if (!session?.refresh_token) {
      clearSession();
      throw new Error(SESSION_ERROR);
    }
    const refreshToken = session.refresh_token;
    refreshPromise = (async () => {
      try {
        const payload = await requestToken('refresh_token', { refresh_token: refreshToken });
        return storeSession(payload);
      } catch (error) {
        clearSession();
        if (error.message === NETWORK_ERROR || error.message === TIMEOUT_ERROR) throw error;
        throw new Error(SESSION_ERROR);
      }
    })();
    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }

  async function ensureFreshSession() {
    if (!session) return null;
    if (session.expires_at <= Math.floor(now() / 1000) + 60) await refreshSession();
    return session;
  }

  async function sendAuthorized(endpoint, options, accessToken) {
    const headers = new Headers(options.headers ?? {});
    headers.set('apikey', anonKey);
    headers.set('Authorization', 'Bearer ' + accessToken);
    headers.set('Accept', 'application/json');
    return fetchResponse(endpoint, { ...options, headers });
  }

  async function requestAuthorized(endpoint, options = {}) {
    let current = await ensureFreshSession();
    if (!current?.access_token) {
      clearSession();
      throw new Error(SESSION_ERROR);
    }
    let result = await sendAuthorized(endpoint, options, current.access_token);
    if (result.response.status === 401) {
      try {
        current = await refreshSession();
      } catch {
        clearSession();
        throw new Error(SESSION_ERROR);
      }
      result = await sendAuthorized(endpoint, options, current.access_token);
      if (result.response.status === 401) {
        clearSession();
        throw new Error(SESSION_ERROR);
      }
    }
    if (!result.response.ok) throw new Error(REQUEST_ERROR);
    return result.payload;
  }

  session = readSession();
  if (session) scheduleRefresh();

  return {
    async signIn(email, password) {
      if (!email || !password) throw new Error('Введіть електронну пошту та пароль.');
      const payload = await requestToken('password', { email, password });
      storeSession(payload);
      const user = payload?.user;
      if (!user?.id) {
        clearSession();
        throw new Error(LOGIN_ERROR);
      }
      return {
        id: user.id,
        email: user.email ?? email,
        displayName: user.user_metadata?.display_name ?? user.email ?? email
      };
    },

    async restoreSession() {
      if (!session) return null;
      const user = await requestAuthorized(new URL('/auth/v1/user', baseUrl), { method: 'GET' });
      if (!user?.id) {
        clearSession();
        return null;
      }
      return {
        id: user.id,
        email: user.email ?? '',
        displayName: user.user_metadata?.display_name ?? user.email ?? ''
      };
    },

    async signOut() {
      const active = session;
      try {
        if (active?.access_token) {
          const headers = new Headers({
            apikey: anonKey,
            Authorization: 'Bearer ' + active.access_token,
            Accept: 'application/json'
          });
          await fetchResponse(new URL('/auth/v1/logout', baseUrl), {
            method: 'POST',
            headers
          });
        }
      } catch {
        // Always clear the local session, even if the network is unavailable.
      } finally {
        clearSession();
      }
    },

    async get(path, query = {}) {
      const endpoint = new URL('/rest/v1/' + String(path).replace(/^\/+/, ''), baseUrl);
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) endpoint.searchParams.set(key, String(value));
      }
      return requestAuthorized(endpoint, { method: 'GET' });
    }
  };
}
