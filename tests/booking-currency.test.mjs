import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bookingCurrency, destinationCurrency } from '../src/services/destination-currency.js';

const cities = JSON.parse(readFileSync(new URL('../public/data/destinations.json', import.meta.url)));

test('all catalog names, qualified names and airport codes use their origin country currency', () => {
  for (const city of cities) {
    const expected = destinationCurrency({ name: city.name, country: city.country });
    assert.equal(expected.known, true, city.name + ' has a mapped country');
    for (const label of [city.name, `${city.name}, ${city.country}`, city.code, city.code.toLowerCase()]) {
      const actual = bookingCurrency(label);
      assert.equal(actual.known, true, label + ' is recognized');
      assert.equal(actual.code, expected.code, label + ' has the correct currency');
      assert.equal(actual.countryCode, expected.countryCode, label + ' has the correct country');
    }
  }
});

test('Myanmar and Kenya origin currencies require estimates from USD provider quotes', () => {
  for (const [origin, code] of [['Yangon', 'MMK'], ['RGN', 'MMK'], ['Nairobi', 'KES'], ['NBO', 'KES']]) {
    const actual = bookingCurrency(origin);
    assert.equal(actual.code, code);
    assert.equal(actual.providerCode, 'USD');
    assert.equal(actual.needsConversion, true);
    assert.equal(actual.known, true);
  }
});

test('supported origin currencies are requested directly with no conversion', () => {
  for (const [origin, code] of [['Bangkok', 'THB'], ['Paris', 'EUR'], ['Tokyo', 'JPY'], ['New York City', 'USD'], ['Hanoi', 'VND'], ['London', 'GBP'], ['Singapore', 'SGD']]) {
    const actual = bookingCurrency(origin);
    assert.equal(actual.code, code);
    assert.equal(actual.providerCode, code);
    assert.equal(actual.needsConversion, false);
    assert.equal(actual.known, true);
  }
});

test('qualified names, whitespace and geographic objects resolve without a network lookup', () => {
  assert.equal(bookingCurrency('  bAnGkOk, THAILAND  ').code, 'THB');
  assert.equal(bookingCurrency('  rgn ').code, 'MMK');
  assert.equal(bookingCurrency({ name: 'Nice', country: 'France' }).code, 'EUR');
  assert.equal(bookingCurrency('Da Nang, Vietnam').code, 'VND');
});

test('unknown origins stay unknown rather than claiming their local currency is USD', () => {
  for (const origin of ['', 'Unrecognized City', 'ZZZ', 'constructor', '__proto__', undefined, null, {}]) {
    const actual = bookingCurrency(origin);
    assert.equal(actual.known, false);
    assert.equal(actual.countryCode, '');
    assert.equal(actual.needsConversion, false);
  }
});

test('booking origin policy does not change the destination or trip-budget resolver', () => {
  const before = destinationCurrency('Bangkok');
  assert.equal(bookingCurrency('Yangon').code, 'MMK');
  assert.deepEqual(destinationCurrency('Bangkok'), before);
  assert.equal(before.code, 'THB');
  assert.equal(destinationCurrency('Unknown').known, false);
  assert.equal(destinationCurrency('Unknown').code, 'USD');
});
