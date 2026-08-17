const params = new URLSearchParams(window.location.search);
const tripId = params.get("trip");
const itemKey = params.get("item") || "air-tickets";
const flightStatus = document.querySelector("#flight-status");
const routeOptions = document.querySelector("#flight-route-options");
const detailDialog = document.querySelector("#flight-detail-dialog");
const bookingForm = document.querySelector("#flight-booking-form");
const currencyRatesToUsd = {
  USD: 1, EUR: 1.08, GBP: 1.27, THB: 1 / 35, SGD: 1 / 1.35, MYR: 0.226,
  JPY: 0.0067, KRW: 0.00072, AUD: 0.66, CAD: 0.73, CNY: 1 / 7.2,
  INR: 0.012, MMK: 1 / 2100,
};

let activeTrip = null;
let activeItem = null;
let routes = [];
let selectedRoute = null;
let selectedFare = "standard";
let currentStep = 1;
let selectedSeats = [];
let flightType = "round-trip";

function safeReturnPath() {
  const requested = params.get("return");
  if (requested?.startsWith("/") && !requested.startsWith("//")) return requested;
  return `/assist-trip?trip=${encodeURIComponent(tripId || "")}`;
}

function loginPath() {
  const current = `${window.location.pathname}${window.location.search}`;
  return `/login?return=${encodeURIComponent(current)}`;
}

function formatDate(value, fallback) {
  if (!value) return fallback;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(date);
}

function moneyFromUsd(usd) {
  const currency = activeTrip?.budget?.currency || "USD";
  const rate = currencyRatesToUsd[currency] || 1;
  const value = usd / rate;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: ["JPY", "KRW", "MMK"].includes(currency) ? 0 : 2,
  }).format(value);
}

function preferredAmountFromUsd(usd) {
  const currency = activeTrip?.budget?.currency || "USD";
  return Number((usd / (currencyRatesToUsd[currency] || 1)).toFixed(2));
}

function routeCatalog() {
  const estimated = Math.max(100, Number(activeTrip?.route?.estimatedTransitCostUsd) || 180);
  return [
    {
      id: "direct", label: "Direct Route", badge: "Recommended", stops: 0,
      depart: "08:10", arrive: "09:35", returnDepart: "18:20", returnArrive: "19:45",
      duration: "1h 25m", returnDuration: "1h 25m", baggage: true, baggageText: "20kg checked · 7kg carry-on", priceUsd: estimated,
    },
    {
      id: "value", label: "Value Economy Route", badge: "Best value", stops: 1,
      depart: "11:45", arrive: "15:30", returnDepart: "13:10", returnArrive: "17:05",
      duration: "3h 45m", returnDuration: "3h 55m", baggage: false, baggageText: "7kg carry-on · checked baggage optional", priceUsd: Math.round(estimated * 0.85),
    },
    {
      id: "flexible", label: "Flexible Fare Route", badge: "Easy changes", stops: 0,
      depart: "16:30", arrive: "17:55", returnDepart: "20:15", returnArrive: "21:40",
      duration: "1h 25m", returnDuration: "1h 25m", baggage: true, baggageText: "25kg checked · 7kg carry-on", priceUsd: Math.round(estimated * 1.25),
    },
  ];
}

function originForTrip(trip) {
  const origin = trip.route?.origin;
  if (origin?.name) {
    return { city: origin.name, code: origin.code || origin.name.slice(0, 3).toUpperCase() };
  }
  return trip.destination.slug === "yangon"
    ? { city: "Bangkok", code: "DMK" }
    : { city: "Yangon", code: "RGN" };
}

function destinationCode(trip) {
  if (trip.route?.destination?.code) return trip.route.destination.code;
  if (trip.destination.slug === "bangkok") return "DMK";
  return trip.destination.primaryAirportCode || trip.destination.slug.slice(0, 3).toUpperCase();
}

function passengerBreakdown() {
  const fallback = Math.max(1, Number(activeTrip?.travelers) || 1);
  const adults = Math.max(1, Number(activeTrip?.travelerBreakdown?.adults) || fallback);
  const children = Math.max(0, Number(activeTrip?.travelerBreakdown?.children) || 0);
  return { adults, children, total: adults + children };
}

function routePriceUsd(route) {
  return flightType === "one-way" ? Math.round(route.priceUsd * 0.58) : route.priceUsd;
}

function filteredRoutes() {
  const nonstop = document.querySelector("#filter-nonstop").checked;
  const baggage = document.querySelector("#filter-baggage").checked;
  const maximum = document.querySelector("#filter-price").value;
  return routes.filter((route) =>
    (!nonstop || route.stops === 0) &&
    (!baggage || route.baggage) &&
    (maximum === "any" || routePriceUsd(route) <= Number(maximum)),
  );
}

function routeCard(route) {
  const card = document.createElement("article");
  card.className = "flight-route-card";
  const heading = document.createElement("div");
  heading.className = "flight-route-heading";
  const title = document.createElement("div");
  const badge = document.createElement("span");
  badge.textContent = route.badge;
  const name = document.createElement("h3");
  name.textContent = route.label;
  title.append(badge, name);
  const routePrice = document.createElement("div");
  routePrice.className = "flight-route-price";
  const from = document.createElement("small");
  from.textContent = flightType === "one-way" ? "One-way from" : "Round trip from";
  const amount = document.createElement("strong");
  amount.textContent = moneyFromUsd(routePriceUsd(route));
  routePrice.append(from, amount);
  heading.append(title, routePrice);

  const timeline = document.createElement("div");
  timeline.className = "flight-route-timeline";
  const origin = originForTrip(activeTrip);
  const destination = destinationCode(activeTrip);
  timeline.innerHTML = `<div><strong>${route.depart}</strong><span>${origin.code}</span></div><div class="flight-route-line"><small>${route.duration}</small><i></i><span>${route.stops ? `${route.stops} stop` : "Nonstop"}</span></div><div><strong>${route.arrive}</strong><span>${destination}</span></div>`;

  const footer = document.createElement("div");
  footer.className = "flight-route-footer";
  const baggage = document.createElement("span");
  baggage.textContent = route.baggageText;
  const action = document.createElement("button");
  action.className = "button button-primary";
  action.type = "button";
  action.textContent = "View flight & fares";
  action.addEventListener("click", () => openFlightDetail(route));
  footer.append(baggage, action);
  card.append(heading, timeline, footer);
  return card;
}

function renderRoutes() {
  const matches = filteredRoutes();
  document.querySelector("#flight-result-count").textContent =
    `${matches.length} ${matches.length === 1 ? "route" : "routes"}`;
  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "flight-empty";
    empty.innerHTML = "<strong>No routes match these filters.</strong><span>Try clearing one or more filters.</span>";
    routeOptions.replaceChildren(empty);
    return;
  }
  routeOptions.replaceChildren(...matches.map(routeCard));
}

function setFare(fare) {
  selectedFare = fare;
  for (const button of document.querySelectorAll("[data-fare]")) {
    const selected = button.dataset.fare === fare;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
}

function itineraryRow(label, depart, arrive, duration) {
  const origin = originForTrip(activeTrip);
  const destination = destinationCode(activeTrip);
  const row = document.createElement("article");
  const direction = document.createElement("span");
  direction.textContent = label;
  const departure = document.createElement("div");
  const departureTime = document.createElement("strong");
  const departurePlace = document.createElement("small");
  departureTime.textContent = depart;
  departurePlace.textContent = `${origin.city} · ${origin.code}`;
  departure.append(departureTime, departurePlace);
  const line = document.createElement("i");
  line.setAttribute("aria-hidden", "true");
  const arrival = document.createElement("div");
  const arrivalTime = document.createElement("strong");
  const arrivalPlace = document.createElement("small");
  arrivalTime.textContent = arrive;
  arrivalPlace.textContent = `${activeTrip.route?.destination?.name || activeTrip.destination.name} · ${destination}`;
  arrival.append(arrivalTime, arrivalPlace);
  const meta = document.createElement("b");
  meta.textContent = `${duration} · ${selectedRoute.stops ? "1 stop" : "Nonstop"}`;
  row.append(direction, departure, line, arrival, meta);
  return row;
}

function openFlightDetail(route) {
  selectedRoute = route;
  setFare("standard");
  document.querySelector("#flight-detail-title").textContent = route.label;
  document.querySelector("#flight-detail-itinerary").replaceChildren(
    itineraryRow("Departure", route.depart, route.arrive, route.duration),
    ...(flightType === "round-trip"
      ? [itineraryRow("Return", route.returnDepart, route.returnArrive, route.returnDuration)]
      : []),
  );
  document.querySelector("#fare-standard-price").textContent = "Included";
  document.querySelector("#fare-plus-price").textContent = `+ ${moneyFromUsd(59)}`;
  if (typeof detailDialog.showModal === "function") detailDialog.showModal();
}

function passengerForm(index, passengerType, typeIndex) {
  const wrapper = document.createElement("fieldset");
  wrapper.className = "flight-passenger-card";
  wrapper.innerHTML = `<legend>${passengerType} ${typeIndex + 1}${index === 0 ? " · Primary" : ""}</legend><div class="form-grid"><div class="form-field"><label class="form-label" for="given-${index}">Given names</label><input id="given-${index}" class="field-control" name="given-${index}" data-passenger-type="${passengerType.toLowerCase()}" autocomplete="given-name" maxlength="80" required></div><div class="form-field"><label class="form-label" for="surname-${index}">Last name (surname)</label><input id="surname-${index}" class="field-control" name="surname-${index}" autocomplete="family-name" maxlength="80" required></div><div class="form-field form-field-wide"><label class="form-label" for="passport-${index}">Passport valid until</label><input id="passport-${index}" class="field-control" name="passport-${index}" type="date" required><span class="field-hint">Must remain valid for at least six months after this trip.</span></div></div>`;
  return wrapper;
}

function renderPassengerForms() {
  const { adults, children } = passengerBreakdown();
  const passengerTypes = [
    ...Array.from({ length: adults }, (_, index) => ({ type: "Adult", typeIndex: index })),
    ...Array.from({ length: children }, (_, index) => ({ type: "Child", typeIndex: index })),
  ];
  document.querySelector("#flight-passenger-forms").replaceChildren(
    ...passengerTypes.map((passenger, index) =>
      passengerForm(index, passenger.type, passenger.typeIndex),
    ),
  );
}

function renderSeatMap() {
  const unavailable = new Set(["2B", "3C", "5A"]);
  const seats = [];
  for (let row = 1; row <= 6; row += 1) {
    const rowElement = document.createElement("div");
    rowElement.className = "flight-seat-row";
    const number = document.createElement("span");
    number.textContent = String(row);
    rowElement.append(number);
    for (const letter of ["A", "B", "C", "D"]) {
      const seat = `${row}${letter}`;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = letter;
      button.dataset.seat = seat;
      button.disabled = unavailable.has(seat);
      button.setAttribute("aria-label", unavailable.has(seat) ? `Seat ${seat} unavailable` : `Select seat ${seat}`);
      button.addEventListener("click", () => toggleSeat(seat));
      rowElement.append(button);
    }
    seats.push(rowElement);
  }
  document.querySelector("#flight-seat-map").replaceChildren(...seats);
  updateSeatMap();
}

function toggleSeat(seat) {
  if (selectedSeats.includes(seat)) {
    selectedSeats = selectedSeats.filter((value) => value !== seat);
  } else if (selectedSeats.length < passengerBreakdown().total) {
    selectedSeats.push(seat);
  } else {
    selectedSeats = [...selectedSeats.slice(1), seat];
  }
  updateSeatMap();
}

function updateSeatMap() {
  for (const button of document.querySelectorAll("[data-seat]")) {
    const selected = selectedSeats.includes(button.dataset.seat);
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  const count = passengerBreakdown().total;
  document.querySelector("#seat-selection-summary").textContent =
    selectedSeats.length === count
      ? `Selected: ${selectedSeats.join(", ")}`
      : `Choose ${count - selectedSeats.length} more ${count - selectedSeats.length === 1 ? "seat" : "seats"}.`;
}

function selectedAddOns() {
  return [...document.querySelectorAll('input[name="addOn"]:checked')];
}

function priceParts() {
  const passengers = passengerBreakdown().total;
  const ticketsUsd = routePriceUsd(selectedRoute) * passengers;
  const fareUsd = selectedFare === "plus" ? 59 * passengers : 0;
  const extrasUsd = selectedAddOns().reduce(
    (total, input) => total + Number(input.dataset.priceUsd || 0) * passengers,
    0,
  );
  return { passengers, ticketsUsd, fareUsd, extrasUsd, totalUsd: ticketsUsd + fareUsd + extrasUsd };
}

function updatePrice() {
  if (!selectedRoute) return;
  const price = priceParts();
  const origin = originForTrip(activeTrip);
  document.querySelector("#price-route-code").textContent = `${origin.code} → ${destinationCode(activeTrip)}`;
  document.querySelector("#price-route-name").textContent = selectedRoute.label;
  document.querySelector("#price-fare-name").textContent = selectedFare === "plus" ? "Economy Plus" : "Economy Standard";
  document.querySelector("#price-ticket-label").textContent = `${price.passengers} ${price.passengers === 1 ? "ticket" : "tickets"}`;
  document.querySelector("#price-tickets").textContent = moneyFromUsd(price.ticketsUsd);
  document.querySelector("#price-fare").textContent = price.fareUsd ? moneyFromUsd(price.fareUsd) : "Included";
  document.querySelector("#price-extras").textContent = price.extrasUsd ? moneyFromUsd(price.extrasUsd) : "None";
  document.querySelector("#price-total").textContent = moneyFromUsd(price.totalUsd);
  document.querySelector("#price-points").textContent = `${Math.floor(price.totalUsd * 2)} PackSwift Points`;
}

function cardDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function cardBrandFromPrefix(value) {
  const number = cardDigits(value);
  if (number.startsWith("4")) return "VISA";
  const firstTwo = Number(number.slice(0, 2));
  const firstFour = Number(number.slice(0, 4));
  if ((number.length >= 2 && firstTwo >= 51 && firstTwo <= 55) ||
      (number.length >= 4 && firstFour >= 2221 && firstFour <= 2720)) {
    return "MASTERCARD";
  }
  return null;
}

function validCardBrand(value) {
  const number = cardDigits(value);
  const brand = cardBrandFromPrefix(number);
  if (brand === "VISA" && [13, 16, 19].includes(number.length)) return brand;
  if (brand === "MASTERCARD" && number.length === 16) return brand;
  return null;
}

function cardPassesLuhn(value) {
  const number = cardDigits(value);
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

function updateDetectedCardBrand() {
  const input = document.querySelector("#card-number");
  const brand = cardBrandFromPrefix(input.value);
  const label = document.querySelector("#detected-card-brand");
  const mark = document.querySelector("#card-brand-mark");
  const readable = brand === "MASTERCARD" ? "Mastercard" : brand === "VISA" ? "Visa" : "Credit Card";
  label.textContent = readable;
  label.dataset.brand = brand?.toLowerCase() || "unknown";
  mark.textContent = brand === "MASTERCARD" ? "MC" : brand || "CARD";
  mark.dataset.brand = brand?.toLowerCase() || "unknown";
  document.querySelector("#card-number-feedback").textContent = brand
    ? `${readable} detected automatically.`
    : "Visa and Mastercard credit cards only.";
}

function expiryIsValid(value) {
  const match = String(value || "").match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
  if (!match) return false;
  const now = new Date();
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}

function validateCardPaymentStep() {
  const cardholder = document.querySelector("#cardholder-name");
  const cardNumber = document.querySelector("#card-number");
  const expiry = document.querySelector("#card-expiry");
  const cvv = document.querySelector("#card-cvv");
  const brand = validCardBrand(cardNumber.value);
  const cleanName = cardholder.value.trim().replace(/\s+/g, " ");
  cardholder.setCustomValidity(
    cleanName.length >= 3 && cleanName.length <= 100 && /^[\p{L}\p{M} .'-]+$/u.test(cleanName)
      ? ""
      : "Enter the cardholder name exactly as shown on the card.",
  );
  cardNumber.setCustomValidity(
    !brand
      ? "Only Visa and Mastercard credit cards are accepted."
      : cardPassesLuhn(cardNumber.value)
        ? ""
        : "Enter a valid card number.",
  );
  expiry.setCustomValidity(expiryIsValid(expiry.value) ? "" : "Enter a valid, unexpired date as MM/YY.");
  cvv.setCustomValidity(/^\d{3}$/.test(cvv.value) ? "" : "Enter the three-digit CVV from the back of the card.");
  const invalid = [cardholder, cardNumber, expiry, cvv].find((input) => !input.checkValidity());
  if (invalid) {
    invalid.reportValidity();
    invalid.focus();
    return null;
  }
  return {
    brand,
    cardNumber: cardDigits(cardNumber.value),
    expiry: expiry.value,
    cvv: cvv.value,
    cardholderName: cleanName,
  };
}

function showStep(step) {
  currentStep = step;
  for (const section of document.querySelectorAll("[data-flight-step]")) {
    section.hidden = Number(section.dataset.flightStep) !== step;
  }
  for (const progress of document.querySelectorAll("[data-progress-step]")) {
    const value = Number(progress.dataset.progressStep);
    progress.classList.toggle("is-active", value === step);
    progress.classList.toggle("is-complete", value < step);
  }
  document.querySelector("#flight-step-back").hidden = step === 1;
  document.querySelector("#flight-step-next").hidden = step === 4;
  document.querySelector("#confirm-flight-booking").hidden = step !== 4;
  document.querySelector("#flight-step-feedback").textContent = "";
  if (step === 4) renderFinalSummary();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function validatePassengerStep() {
  const inputs = [...document.querySelectorAll('[data-flight-step="1"] input')];
  const invalid = inputs.find((input) => !input.checkValidity());
  if (invalid) {
    invalid.reportValidity();
    return false;
  }
  const returnDate = activeTrip.dates.end
    ? new Date(`${String(activeTrip.dates.end).slice(0, 10)}T00:00:00Z`)
    : new Date();
  returnDate.setUTCMonth(returnDate.getUTCMonth() + 6);
  const invalidPassport = inputs.find((input) =>
    input.name.startsWith("passport-") && new Date(`${input.value}T00:00:00Z`) < returnDate,
  );
  if (invalidPassport) {
    document.querySelector("#flight-step-feedback").textContent =
      "Each passport must remain valid for at least six months after the return date.";
    invalidPassport.focus();
    return false;
  }
  return true;
}

function renderFinalSummary() {
  const firstName = bookingForm.elements["given-0"].value;
  const lastName = bookingForm.elements["surname-0"].value;
  const summary = document.querySelector("#flight-final-summary");
  const details = [
    ["Lead passenger", `${firstName} ${lastName}`],
    ["Flight type", flightType === "one-way" ? "One-Way" : "Round-Trip"],
    ["Route", selectedRoute.label],
    ["Fare", selectedFare === "plus" ? "Economy Plus" : "Economy Standard"],
    ["Seats", selectedSeats.join(", ")],
  ];
  summary.replaceChildren(
    ...details.map(([label, value]) => {
      const row = document.createElement("div");
      const term = document.createElement("span");
      const detail = document.createElement("strong");
      term.textContent = label;
      detail.textContent = value;
      row.append(term, detail);
      return row;
    }),
  );
}

function beginBooking() {
  detailDialog.close();
  document.querySelector("#flight-search-view").hidden = true;
  document.querySelector("#flight-booking-view").hidden = false;
  renderPassengerForms();
  renderSeatMap();
  updatePrice();
  showStep(1);
}

async function confirmBooking() {
  const payment = validateCardPaymentStep();
  if (!payment) return;
  const confirmationCheck = document.querySelector("#flight-confirmation-check");
  if (!confirmationCheck.checkValidity()) {
    confirmationCheck.reportValidity();
    return;
  }
  const button = document.querySelector("#confirm-flight-booking");
  button.disabled = true;
  button.textContent = "Confirming your flight…";
  flightStatus.hidden = false;
  flightStatus.className = "status-banner";
  flightStatus.textContent = "Saving your PackSwift flight confirmation…";
  try {
    const origin = originForTrip(activeTrip);
    const destination = activeTrip.route?.destination?.name ||
      activeTrip.destination.displayName || activeTrip.destination.name;
    const passengerCount = passengerBreakdown().total;
    const passengers = Array.from({ length: passengerCount }, (_, index) => ({
      givenNames: bookingForm.elements[`given-${index}`].value.trim(),
      surname: bookingForm.elements[`surname-${index}`].value.trim(),
      passportExpiry: bookingForm.elements[`passport-${index}`].value,
      passengerType: bookingForm.elements[`given-${index}`].dataset.passengerType,
    }));
    const route = `${origin.city} (${origin.code}) → ${destination} (${destinationCode(activeTrip)})`;
    const price = priceParts();
    await window.PackSwift.api(
      "/api/checkout/process",
      {
        method: "POST",
        body: JSON.stringify({
          tripId,
          checklistItemKey: activeItem.key,
          orderType: "FLIGHT",
          totalAmount: preferredAmountFromUsd(price.totalUsd),
          currency: activeTrip.budget.currency || "USD",
          paymentMethod: payment.brand,
          payment: {
            cardNumber: payment.cardNumber,
            expiry: payment.expiry,
            cvv: payment.cvv,
            cardholderName: payment.cardholderName,
          },
          details: {
            route,
            departureDate: String(activeTrip.dates.start || "").slice(0, 10),
            returnDate: flightType === "round-trip"
              ? String(activeTrip.dates.end || "").slice(0, 10)
              : null,
            passengers,
            classType: selectedFare === "plus" ? "Economy Plus" : "Economy Standard",
            itinerary: {
              seats: selectedSeats,
              routeOption: selectedRoute.label,
              flightType,
              baggage: selectedRoute.baggageText,
            },
          },
        }),
      },
    );
    const returnUrl = new URL(safeReturnPath(), window.location.origin);
    returnUrl.searchParams.set("completed", activeItem.key);
    window.location.assign(`${returnUrl.pathname}${returnUrl.search}`);
  } catch (error) {
    button.disabled = false;
    button.textContent = "Try confirmation again";
    flightStatus.className = "status-banner status-error";
    flightStatus.textContent = error.message;
  }
}

async function initializeFlightAssistant() {
  if (!tripId || !itemKey) {
    flightStatus.className = "status-banner status-error";
    flightStatus.textContent = "Return to the readiness checklist and choose Air Tickets first.";
    return;
  }
  const user = await window.PackSwift.authReady;
  if (!user) {
    window.location.assign(loginPath());
    return;
  }
  document.querySelector("#flight-back").href = safeReturnPath();
  try {
    const result = await window.PackSwift.api(`/api/trips/${encodeURIComponent(tripId)}/readiness`);
    activeItem = result.items.find((item) => item.key === itemKey);
    if (!activeItem || activeItem.assistantType !== "flight") {
      throw new Error("This PackSwift assistant does not match the selected checklist item.");
    }
    activeTrip = result.trip;
    routes = routeCatalog();
    const origin = originForTrip(activeTrip);
    document.querySelector("#flight-origin").textContent = `${origin.city} (${origin.code})`;
    document.querySelector("#flight-destination").textContent =
      `${activeTrip.route?.destination?.name || activeTrip.destination.name} (${destinationCode(activeTrip)})`;
    document.querySelector("#flight-departure").textContent = formatDate(activeTrip.dates.start, "Flexible date");
    document.querySelector("#flight-return").textContent = formatDate(activeTrip.dates.end, "Flexible return");
    const passengers = passengerBreakdown();
    document.querySelector("#flight-passengers").textContent =
      `${passengers.adults} ${passengers.adults === 1 ? "adult" : "adults"} · ` +
      `${passengers.children} ${passengers.children === 1 ? "child" : "children"}`;
    renderRoutes();
    flightStatus.hidden = true;
  } catch (error) {
    if (error.status === 401) {
      window.location.assign(loginPath());
      return;
    }
    flightStatus.hidden = false;
    flightStatus.className = "status-banner status-error";
    flightStatus.textContent = error.message;
  }
}

for (const filter of document.querySelectorAll("#filter-nonstop, #filter-baggage, #filter-price")) {
  filter.addEventListener("change", renderRoutes);
}
document.querySelector("#clear-flight-filters").addEventListener("click", () => {
  document.querySelector("#filter-nonstop").checked = false;
  document.querySelector("#filter-baggage").checked = false;
  document.querySelector("#filter-price").value = "any";
  renderRoutes();
});
for (const fare of document.querySelectorAll("[data-fare]")) {
  fare.addEventListener("click", () => setFare(fare.dataset.fare));
}
document.querySelector("#close-flight-detail").addEventListener("click", () => detailDialog.close());
document.querySelector("#continue-with-flight").addEventListener("click", beginBooking);
document.querySelector("#return-to-flight-results").addEventListener("click", () => {
  document.querySelector("#flight-booking-view").hidden = true;
  document.querySelector("#flight-search-view").hidden = false;
});
document.querySelector("#flight-step-next").addEventListener("click", () => {
  if (currentStep === 1 && !validatePassengerStep()) return;
  if (currentStep === 2 && selectedSeats.length !== passengerBreakdown().total) {
    document.querySelector("#flight-step-feedback").textContent =
      "Choose one seat for every passenger before continuing.";
    return;
  }
  showStep(Math.min(4, currentStep + 1));
});
document.querySelector("#flight-step-back").addEventListener("click", () => showStep(Math.max(1, currentStep - 1)));
document.querySelectorAll('input[name="addOn"]').forEach((input) => input.addEventListener("change", updatePrice));
document.querySelector("#confirm-flight-booking").addEventListener("click", confirmBooking);
document.querySelector("#card-number").addEventListener("input", (event) => {
  const digits = cardDigits(event.target.value).slice(0, 19);
  event.target.value = digits.replace(/(.{4})/g, "$1 ").trim();
  event.target.setCustomValidity("");
  updateDetectedCardBrand();
});
document.querySelector("#card-expiry").addEventListener("input", (event) => {
  const digits = cardDigits(event.target.value).slice(0, 4);
  event.target.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  event.target.setCustomValidity("");
});
document.querySelector("#card-cvv").addEventListener("input", (event) => {
  event.target.value = cardDigits(event.target.value).slice(0, 3);
  event.target.setCustomValidity("");
});
document.querySelector("#cardholder-name").addEventListener("input", (event) => event.target.setCustomValidity(""));
document.querySelectorAll('input[name="flightType"]').forEach((input) => {
  input.addEventListener("change", () => {
    flightType = input.value;
    document.querySelector("#flight-return-summary").hidden = flightType === "one-way";
    selectedRoute = null;
    renderRoutes();
  });
});

initializeFlightAssistant();
window.lucide?.createIcons();
