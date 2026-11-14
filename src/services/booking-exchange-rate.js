// Currency estimates only: booking providers still determine the final amount paid.
const DAY = 24 * 60 * 60 * 1000;
const MAX_AGE = 2 * DAY;
const CLOCK_TOLERANCE = 5 * 60 * 1000;
const FAILURE_COOLDOWN = 30 * 1000;
const stores = new WeakMap();
const unavailable = () => new Error('Exchange rate is unavailable right now. Prices remain in USD.');

function validUpdate(updatedAt, at) {
  return Number.isFinite(updatedAt) && updatedAt > 0
    && updatedAt <= at + CLOCK_TOLERANCE && at - updatedAt <= MAX_AGE;
}

/** Return a fresh USD conversion snapshot, never a provider response or secret. */
export async function bookingExchangeRate(target, {
  fetcher = fetch,
  key = process.env.EXCHANGERATE_API_KEY,
  now = () => Date.now(),
} = {}) {
  if (typeof target !== 'string' || !/^[A-Z]{3}$/.test(target)) {
    throw new Error('Choose a valid three-letter currency code.');
  }
  if (typeof fetcher !== 'function' || typeof now !== 'function') throw unavailable();
  const at = now();
  if (!Number.isFinite(at)) throw unavailable();
  const credential = typeof key === 'string' ? key.trim() : '';
  let store = stores.get(fetcher);
  if (!store) { store = new Map(); stores.set(fetcher, store); }
  const cacheKey = JSON.stringify([credential, target]);
  let entry = store.get(cacheKey);
  if (entry?.snapshot && entry.expires > at && validUpdate(Date.parse(entry.snapshot.updatedAt), at)) {
    return { ...entry.snapshot };
  }
  if (entry?.pending) return { ...await entry.pending };
  if (entry?.failureUntil > at) throw unavailable();
  if (!entry) {
    if (store.size >= 128) store.delete(store.keys().next().value);
    entry = {};
    store.set(cacheKey, entry);
  }

  const task = (async () => {
    try {
      const url = credential
        ? `https://v6.exchangerate-api.com/v6/${encodeURIComponent(credential)}/pair/USD/${target}`
        : 'https://open.er-api.com/v6/latest/USD';
      const response = await fetcher(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw unavailable();
      const data = await response.json();
      const checkedAt = now();
      const updatedAt = typeof data?.time_last_update_unix === 'number'
        ? data.time_last_update_unix * 1000 : NaN;
      const rate = credential ? data?.conversion_rate : data?.rates?.[target];
      if (!Number.isFinite(checkedAt) || data?.result !== 'success' || data.base_code !== 'USD'
        || (credential && data.target_code !== target)
        || typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0
        || !validUpdate(updatedAt, checkedAt)) throw unavailable();

      const snapshot = {
        rate, base: 'USD', target, updatedAt: new Date(updatedAt).toISOString(),
        source: 'ExchangeRate-API', sourceUrl: 'https://www.exchangerate-api.com',
      };
      const nextUpdate = typeof data.time_next_update_unix === 'number'
        && Number.isFinite(data.time_next_update_unix) && data.time_next_update_unix > 0
        ? data.time_next_update_unix * 1000 : checkedAt + DAY;
      entry.snapshot = Object.freeze(snapshot);
      entry.expires = Math.min(checkedAt + DAY, updatedAt + MAX_AGE, nextUpdate);
      entry.failureUntil = 0;
      return snapshot;
    } catch {
      // Do not expose errors containing a URL/API key, or fall back to stale rates.
      delete entry.snapshot;
      entry.expires = 0;
      const failedAt = now();
      entry.failureUntil = Number.isFinite(failedAt) ? failedAt + FAILURE_COOLDOWN : at + FAILURE_COOLDOWN;
      throw unavailable();
    }
  })();
  entry.pending = task;
  try { return { ...await task }; }
  finally { if (entry.pending === task) delete entry.pending; }
}
