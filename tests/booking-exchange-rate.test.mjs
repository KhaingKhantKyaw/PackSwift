import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingExchangeRate } from '../src/services/booking-exchange-rate.js';

const TIME = Date.parse('2026-11-07T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const now = () => TIME;
const payload = (extra = {}) => ({
  result: 'success', base_code: 'USD',
  time_last_update_unix: (TIME - HOUR) / 1000,
  time_next_update_unix: (TIME + HOUR) / 1000,
  rates: { MMK: 2100, THB: 34.2, USD: 1 }, ...extra,
});
const response = (data) => ({ ok: true, json: async () => data });

test('open endpoint returns only the requested rate and attribution', async () => {
  const result = await bookingExchangeRate('MMK', { key: '', now, fetcher: async (url, options) => {
    assert.equal(url, 'https://open.er-api.com/v6/latest/USD');
    assert.ok(options.signal instanceof AbortSignal);
    return response(payload({ secret: 'never expose', rates: { MMK: 2100, THB: 34.2 } }));
  } });
  assert.deepEqual(result, {
    rate: 2100, base: 'USD', target: 'MMK', updatedAt: '2026-11-07T11:00:00.000Z',
    source: 'ExchangeRate-API', sourceUrl: 'https://www.exchangerate-api.com',
  });
  assert.ok(!JSON.stringify(result).includes('never expose'));
  assert.ok(!Object.hasOwn(result, 'rates'));
});

test('configured key uses the encoded pair endpoint and checks its target', async () => {
  const result = await bookingExchangeRate('MMK', { key: 'private/key', now, fetcher: async url => {
    assert.equal(url, 'https://v6.exchangerate-api.com/v6/private%2Fkey/pair/USD/MMK');
    return response(payload({ target_code: 'MMK', conversion_rate: 2099.5 }));
  } });
  assert.equal(result.rate, 2099.5);
  assert.ok(!JSON.stringify(result).includes('private'));
});

test('invalid currency codes fail before requesting a provider', async () => {
  let calls = 0;
  for (const target of ['', 'usd', 'US', 'USDD', 'US1', '../MMK', null, {}]) {
    await assert.rejects(bookingExchangeRate(target, { key: '', now, fetcher: async () => { calls++; } }), /valid three-letter/);
  }
  assert.equal(calls, 0);
});

test('rejects provider errors and wrong currency identities', async () => {
  for (const data of [payload({ result: 'error' }), payload({ base_code: 'EUR' }), null]) {
    await assert.rejects(bookingExchangeRate('MMK', { key: '', now, fetcher: async () => response(data) }), /unavailable/);
  }
  await assert.rejects(bookingExchangeRate('MMK', { key: 'test', now, fetcher: async () => response(payload({ target_code: 'THB', conversion_rate: 34 })) }), /unavailable/);
});

test('rejects missing, zero, negative, nonnumeric and infinite rates', async () => {
  for (const rate of [undefined, null, 0, -2, '2100', NaN, Infinity]) {
    await assert.rejects(bookingExchangeRate('MMK', { key: '', now, fetcher: async () => response(payload({ rates: { MMK: rate } })) }), /unavailable/);
  }
});

test('rejects missing, stale, nonnumeric and excessively future update times', async () => {
  for (const time of [undefined, null, '1700000000', 0, NaN, Infinity, (TIME - 49 * HOUR) / 1000, (TIME + 6 * 60 * 1000) / 1000]) {
    await assert.rejects(bookingExchangeRate('MMK', { key: '', now, fetcher: async () => response(payload({ time_last_update_unix: time })) }), /unavailable/);
  }
  assert.equal((await bookingExchangeRate('MMK', { key: '', now, fetcher: async () => response(payload({ time_last_update_unix: (TIME + 4 * 60 * 1000) / 1000 })) })).rate, 2100);
});

test('HTTP, parsing, and transport errors never leak provider details', async () => {
  for (const fetcher of [
    async () => ({ ok: false, status: 429 }),
    async () => ({ ok: true, json: async () => { throw new Error('private key'); } }),
    async () => { throw new Error('https://provider/private-key'); },
  ]) {
    await assert.rejects(bookingExchangeRate('MMK', { key: 'private-key', now, fetcher }), error => {
      assert.equal(error.message, 'Exchange rate is unavailable right now. Prices remain in USD.');
      return true;
    });
  }
});

test('successful snapshots are cached only until the next update and cannot be mutated', async () => {
  let time = TIME, calls = 0;
  const options = { key: '', now: () => time, fetcher: async () => { calls++; return response(payload()); } };
  const first = await bookingExchangeRate('MMK', options);
  first.rate = 1;
  assert.equal((await bookingExchangeRate('MMK', options)).rate, 2100);
  assert.equal(calls, 1);
  time += HOUR;
  await bookingExchangeRate('MMK', options);
  assert.equal(calls, 2);
});

test('even a distant next update cannot cache for longer than 24 hours', async () => {
  let time = TIME, calls = 0;
  const options = { key: '', now: () => time, fetcher: async () => {
    calls++;
    return response(payload({ time_last_update_unix: time / 1000, time_next_update_unix: (time + 100 * HOUR) / 1000 }));
  } };
  await bookingExchangeRate('MMK', options);
  time += 23 * HOUR;
  await bookingExchangeRate('MMK', options);
  assert.equal(calls, 1);
  time += HOUR;
  await bookingExchangeRate('MMK', options);
  assert.equal(calls, 2);
});

test('deduplicates simultaneous requests for a snapshot', async () => {
  let calls = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  const options = { key: '', now, fetcher: async () => { calls++; await gate; return response(payload()); } };
  const first = bookingExchangeRate('MMK', options), second = bookingExchangeRate('MMK', options);
  release();
  assert.deepEqual(await first, await second);
  assert.equal(calls, 1);
});

test('failed requests cool down then retry, without stale estimate fallback', async () => {
  let time = TIME, calls = 0, fail = false;
  const options = { key: '', now: () => time, fetcher: async () => {
    calls++;
    if (fail) throw new Error('provider unavailable');
    return response(payload({ time_last_update_unix: time / 1000, time_next_update_unix: (time + HOUR) / 1000 }));
  } };
  await bookingExchangeRate('MMK', options);
  time += HOUR;
  fail = true;
  await assert.rejects(bookingExchangeRate('MMK', options), /unavailable/);
  await assert.rejects(bookingExchangeRate('MMK', options), /unavailable/);
  assert.equal(calls, 2);
  time += 30000;
  fail = false;
  assert.equal((await bookingExchangeRate('MMK', options)).rate, 2100);
  assert.equal(calls, 3);
});

test('separate targets and credentials cannot reuse the wrong rate', async () => {
  let calls = 0;
  const fetcher = async url => {
    calls++;
    return response(url.includes('/pair/') ? payload({ target_code: 'MMK', conversion_rate: 2000 }) : payload());
  };
  assert.equal((await bookingExchangeRate('MMK', { key: '', now, fetcher })).rate, 2100);
  assert.equal((await bookingExchangeRate('THB', { key: '', now, fetcher })).rate, 34.2);
  assert.equal((await bookingExchangeRate('MMK', { key: 'private', now, fetcher })).rate, 2000);
  assert.equal(calls, 3);
});
