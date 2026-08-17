const supportedMethods = new Set(["VISA", "MASTERCARD", "CREDIT_CARD"]);

function paymentError(message) {
  const error = new Error(message);
  error.status = 422;
  return error;
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

export function detectCardBrand(value) {
  const number = digitsOnly(value);
  if (/^4\d{12}(?:\d{3})?(?:\d{3})?$/.test(number)) return "VISA";
  if (!/^\d{16}$/.test(number)) return null;
  const firstTwo = Number(number.slice(0, 2));
  const firstFour = Number(number.slice(0, 4));
  if ((firstTwo >= 51 && firstTwo <= 55) || (firstFour >= 2221 && firstFour <= 2720)) {
    return "MASTERCARD";
  }
  return null;
}

export function passesLuhnCheck(value) {
  const number = digitsOnly(value);
  if (number.length < 13 || number.length > 19 || /^0+$/.test(number)) return false;
  let total = 0;
  let doubleDigit = false;
  for (let index = number.length - 1; index >= 0; index -= 1) {
    let digit = Number(number[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    total += digit;
    doubleDigit = !doubleDigit;
  }
  return total % 10 === 0;
}

function validateExpiry(value, now = new Date()) {
  const match = String(value || "").trim().match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
  if (!match) throw paymentError("Enter the expiry date as MM/YY.");
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    throw paymentError("This card has expired.");
  }
  if (year > currentYear + 20) throw paymentError("Enter a valid card expiry date.");
}

export function validateCardPayment(payment, selectedMethod = "CREDIT_CARD") {
  if (!payment || typeof payment !== "object" || Array.isArray(payment)) {
    throw paymentError("Enter your card payment details.");
  }
  if (!supportedMethods.has(selectedMethod)) {
    throw paymentError("Payment method must be Visa, Mastercard, or Credit Card.");
  }
  const cardNumber = digitsOnly(payment.cardNumber);
  const brand = detectCardBrand(cardNumber);
  if (!brand) throw paymentError("Only Visa and Mastercard credit cards are accepted.");
  if (!passesLuhnCheck(cardNumber)) throw paymentError("Enter a valid card number.");
  if (selectedMethod !== "CREDIT_CARD" && selectedMethod !== brand) {
    throw paymentError(`The selected payment method does not match the detected ${brand === "VISA" ? "Visa" : "Mastercard"} card.`);
  }
  validateExpiry(payment.expiry);
  if (!/^\d{3}$/.test(String(payment.cvv || ""))) {
    throw paymentError("Enter the three-digit CVV from the back of your card.");
  }
  const cardholderName = String(payment.cardholderName || "").trim().replace(/\s+/g, " ");
  if (cardholderName.length < 3 || cardholderName.length > 100 || !/^[\p{L}\p{M} .'-]+$/u.test(cardholderName)) {
    throw paymentError("Enter the cardholder name exactly as shown on the card.");
  }
  return {
    paymentMethod: brand,
    brand,
    last4: cardNumber.slice(-4),
  };
}
