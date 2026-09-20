import test from "node:test";
import assert from "node:assert/strict";
import { destinationCurrency, formatCurrency } from "../src/services/destination-currency.js";
test("local currency mapping covers requested cities and unknown destinations", () => {
  for (const [city, code] of Object.entries({ Bangkok: "THB", Thailand: "THB", Paris: "EUR", France: "EUR", Tokyo: "JPY", Japan: "JPY", Singapore: "SGD", Yangon: "MMK", Myanmar: "MMK", Unknown: "USD" })) assert.equal(destinationCurrency(city).code, code);
  assert.equal(destinationCurrency({ name: "Nice", country: "France" }).code, "EUR");
  assert.match(formatCurrency(500, "Bangkok"), /THB/);
});
