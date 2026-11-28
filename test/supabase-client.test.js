import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseClient, SESSION_STORAGE_KEY } from '../src/data/supabase-client.js';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}
const response = (body, status = 200) => ({
  status, ok: status >= 200 && status < 300,
  json: async () => body
});
const storedSession = (storage, values = {}) => storage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
  access_token: 'old-access', refresh_token: 'old-refresh', expires_at: 5000, ...values
}));
const quietTimers = { now: () => 1_000_000, setTimeoutImpl: () => 1, clearTimeoutImpl: () => {} };

test('sign in stores only session fields and masks Auth errors', async () => {
  const storage = new MemoryStorage();
  const calls = [];
  const client = createSupabaseClient({
    url: 'https://example.supabase.co', anonKey: 'public-key', storage,
    ...quietTimers,
    setTimeoutImpl: (fn, delay) => { calls.push({ timer: delay }); return calls.length; },
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return response({ access_token: 'access-secret', refresh_token: 'refresh-secret', expires_in: 3600, user: { id: 'user-1', email: 'owner@example.test' } });
    }
  });
  const user = await client.signIn('owner@example.test', 'password');
  assert.equal(user.id, 'user-1');
  const auth = calls.find((call) => call.url);
  assert.equal(new URL(auth.url).pathname, '/auth/v1/token');
  assert.equal(new URL(auth.url).searchParams.get('grant_type'), 'password');
  assert.equal(auth.options.method, 'POST');
  assert.equal(auth.options.headers.apikey, 'public-key');
  assert.deepEqual(JSON.parse(auth.options.body), { email: 'owner@example.test', password: 'password' });
  const saved = JSON.parse(storage.getItem(SESSION_STORAGE_KEY));
  assert.deepEqual(Object.keys(saved).sort(), ['access_token', 'expires_at', 'refresh_token']);
  assert.equal(saved.access_token, 'access-secret');
  assert.equal(saved.refresh_token, 'refresh-secret');
  assert.ok(calls.some((call) => call.timer === 3_540_000), 'refresh is scheduled about 60 seconds before expiry');

  const failed = createSupabaseClient({
    url: 'https://example.supabase.co', anonKey: 'public-key', storage: new MemoryStorage(),
    ...quietTimers,
    fetchImpl: async () => response({ access_token: 'must-not-leak', message: 'must-not-leak' }, 400)
  });
  await assert.rejects(failed.signIn('owner@example.test', 'wrong'), (error) => {
    assert.match(error.message, /Перевірте електронну пошту й пароль/);
    assert.doesNotMatch(error.message, /must-not-leak/);
    return true;
  });
});

test('refreshes before a protected request when the session is within 60 seconds of expiry', async () => {
  const storage = new MemoryStorage();
  storedSession(storage, { expires_at: 1050 });
  const calls = [];
  const client = createSupabaseClient({
    url: 'https://example.supabase.co', anonKey: 'public-key', storage,
    ...quietTimers,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).includes('/auth/v1/token')) return response({ access_token: 'fresh-access', refresh_token: 'fresh-refresh', expires_in: 3600 });
      return response([]);
    }
  });
  await client.get('journals', { select: 'id' });
  assert.equal(new URL(calls[0].url).searchParams.get('grant_type'), 'refresh_token');
  assert.deepEqual(JSON.parse(calls[0].options.body), { refresh_token: 'old-refresh' });
  assert.equal(calls[1].options.headers.get('Authorization'), 'Bearer fresh-access');
});

test('retries one PostgREST request once after 401 with a refreshed access token', async () => {
  const storage = new MemoryStorage();
  storedSession(storage);
  const dataCalls = [];
  let refreshCalls = 0;
  const client = createSupabaseClient({
    url: 'https://example.supabase.co', anonKey: 'public-key', storage,
    ...quietTimers,
    fetchImpl: async (url, options) => {
      if (String(url).includes('/auth/v1/token')) {
        refreshCalls++;
        return response({ access_token: 'fresh-access', refresh_token: 'fresh-refresh', expires_in: 3600 });
      }
      dataCalls.push(options.headers.get('Authorization'));
      return dataCalls.length === 1 ? response({}, 401) : response([{ id: 'journal-1' }]);
    }
  });
  assert.deepEqual(await client.get('journals'), [{ id: 'journal-1' }]);
  assert.equal(refreshCalls, 1);
  assert.deepEqual(dataCalls, ['Bearer old-access', 'Bearer fresh-access']);
});

test('does not retry repeatedly after a second 401', async () => {
  const storage = new MemoryStorage();
  storedSession(storage);
  let dataCalls = 0;
  const client = createSupabaseClient({
    url: 'https://example.supabase.co', anonKey: 'public-key', storage,
    ...quietTimers,
    fetchImpl: async (url) => {
      if (String(url).includes('/auth/v1/token')) return response({ access_token: 'fresh', refresh_token: 'fresh-r', expires_in: 3600 });
      dataCalls++;
      return response({}, 401);
    }
  });
  await assert.rejects(client.get('journals'), /Сеанс завершився/);
  assert.equal(dataCalls, 2);
  assert.equal(storage.getItem(SESSION_STORAGE_KEY), null);
});

test('sign out posts to Auth and clears local session even if the request fails', async () => {
  const storage = new MemoryStorage();
  storedSession(storage);
  let logout;
  const client = createSupabaseClient({
    url: 'https://example.supabase.co', anonKey: 'public-key', storage,
    ...quietTimers,
    fetchImpl: async (url, options) => {
      logout = { url: String(url), options };
      throw new Error('sensitive transport detail');
    }
  });
  await client.signOut();
  assert.equal(new URL(logout.url).pathname, '/auth/v1/logout');
  assert.equal(logout.options.method, 'POST');
  assert.equal(logout.options.headers.get('Authorization'), 'Bearer old-access');
  assert.equal(storage.getItem(SESSION_STORAGE_KEY), null);
});

test('inserts through PostgREST with session headers and does not expose database error details', async () => {
  const storage = new MemoryStorage();
  storedSession(storage);
  let request;
  const client = createSupabaseClient({
    url: 'https://example.supabase.co', anonKey: 'public-key', storage,
    ...quietTimers,
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return response([{ id: 'lesson-1' }], 201);
    }
  });
  assert.deepEqual(await client.insert('lessons', { topic: 'Тема' }), [{ id: 'lesson-1' }]);
  assert.equal(new URL(request.url).pathname, '/rest/v1/lessons');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.get('apikey'), 'public-key');
  assert.equal(request.options.headers.get('Authorization'), 'Bearer old-access');
  assert.equal(request.options.headers.get('Prefer'), 'return=representation');
  assert.deepEqual(JSON.parse(request.options.body), { topic: 'Тема' });

  const duplicate = createSupabaseClient({
    url: 'https://example.supabase.co', anonKey: 'public-key', storage,
    ...quietTimers,
    fetchImpl: async () => response({ code: '23505', message: 'private server details' }, 409)
  });
  await assert.rejects(duplicate.insert('lessons', {}), (error) => {
    assert.equal(error.code, '23505');
    assert.match(error.message, /Не вдалося завантажити дані/);
    assert.doesNotMatch(error.message, /private server details/);
    return true;
  });
});
