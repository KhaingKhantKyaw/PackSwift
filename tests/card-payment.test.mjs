import assert from "node:assert/strict";
import test from "node:test";
import {
  detectCardBrand,
  passesLuhnCheck,
  validateCardPayment,
} from "../src/services/card-payment-service.js";

test("detects supported Visa and Mastercard card ranges", () => {
  assert.equal(detectCardBrand("4111 1111 1111 1111"), "VISA");
  assert.equal(detectCardBrand("5555 5555 5555 4444"), "MASTERCARD");
  assert.equal(detectCardBrand("378282246310005"), null);
});

test("rejects invalid checksums, expired cards, and invalid CVV values", () => {
  assert.equal(passesLuhnCheck("4111111111111111"), true);
  assert.equal(passesLuhnCheck("4111111111111112"), false);
  assert.throws(() => validateCardPayment({
    cardNumber: "4111111111111112",
    expiry: "12/35",
    cvv: "123",
    cardholderName: "Test Traveller",
  }), /valid card number/);
  assert.throws(() => validateCardPayment({
    cardNumber: "4111111111111111",
    expiry: "01/20",
    cvv: "123",
    cardholderName: "Test Traveller",
  }), /expired/);
  assert.throws(() => validateCardPayment({
    cardNumber: "4111111111111111",
    expiry: "12/35",
    cvv: "12",
    cardholderName: "Test Traveller",
  }), /three-digit CVV/);
});

test("returns only safe transaction metadata after validation", () => {
  const payment = validateCardPayment({
    cardNumber: "5555 5555 5555 4444",
    expiry: "12/35",
    cvv: "123",
    cardholderName: "Test Traveller",
  }, "CREDIT_CARD");
  assert.deepEqual(payment, {
    paymentMethod: "MASTERCARD",
    brand: "MASTERCARD",
    last4: "4444",
  });
  assert.equal("cardNumber" in payment, false);
  assert.equal("cvv" in payment, false);
  assert.equal("expiry" in payment, false);
});
