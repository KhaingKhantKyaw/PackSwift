const params = new URLSearchParams(window.location.search);
const tripId = params.get("trip");
const itemKey = params.get("item");
const stayStatus = document.querySelector("#stay-status");
const propertyList = document.querySelector("#stay-property-list");
const detailDialog = document.querySelector("#stay-detail-dialog");
const searchForm = document.querySelector("#stay-search-form");
const reservationForm = document.querySelector("#stay-reservation-form");
const currencyRatesToUsd = {
  USD: 1, EUR: 1.08, GBP: 1.27, THB: 0.0275, SGD: 0.745, MYR: 0.226,
  JPY: 0.0067, KRW: 0.00072, AUD: 0.66, CAD: 0.73, CNY: 0.138,
  INR: 0.012, MMK: 0.00022,
};

let activeTrip = null;
let activeItem = null;
let properties = [];
let selectedProperty = null;
let selectedRate = null;
let detailImageIndex = 0;
const carouselIndexes = new Map();

function safeReturnPath() {
  const requested = params.get("return");
  if (requested?.startsWith("/") && !requested.startsWith("//")) return requested;
  return `/assist-trip?trip=${encodeURIComponent(tripId || "")}`;
}

function loginPath() {
  const current = `${window.location.pathname}${window.location.search}`;
  return `/login?return=${encodeURIComponent(current)}`;
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

function formatDate(value) {
  if (!value) return "Flexible";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${dateOnly(value)}T00:00:00Z`));
}

function nights() {
  const start = new Date(`${searchForm.elements.checkIn.value}T00:00:00Z`);
  const end = new Date(`${searchForm.elements.checkOut.value}T00:00:00Z`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return 1;
  return Math.max(1, Math.round((end - start) / 86400000));
}

function moneyFromUsd(usd) {
  const currency = activeTrip?.budget?.currency || "USD";
  const rate = currencyRatesToUsd[currency] || 1;
  return new Intl.NumberFormat(undefined, {
    style: "currency", currency,
    maximumFractionDigits: ["JPY", "KRW", "MMK"].includes(currency) ? 0 : 2,
  }).format(usd / rate);
}

function preferredStayAmountFromUsd(usd) {
  const currency = activeTrip?.budget?.currency || "USD";
  return Number((usd / (currencyRatesToUsd[currency] || 1)).toFixed(2));
}

function propertyCatalog(destination) {
  return [
    {
      id: "horizon", name: `${destination} Horizon House`, stars: 5,
      rating: 8.8, ratingLabel: "Excellent", highlight: "Quiet rooms · thoughtful service",
      location: "7 mins walk to the nearest metro station", features: ["breakfast", "cancellation", "pool", "gym"],
      offer: "City View Double Room", discount: "15% PackSwift offer", priceUsd: 142,
      room: { bed: "1 double bed", alternateBed: "2 single beds", size: "22 m²", amenities: ["Free Wi-Fi", "City view", "Air conditioning", "Non-smoking"] },
    },
    {
      id: "riverside", name: `${destination} Riverside Calm`, stars: 4,
      rating: 8.5, ratingLabel: "Very Good", highlight: "River outlook · restful atmosphere",
      location: "12 mins by local transit to the city centre", features: ["breakfast", "cancellation", "pool"],
      offer: "Riverside King Room", discount: "Breakfast included", priceUsd: 116,
      room: { bed: "1 king bed", alternateBed: "1 double bed", size: "26 m²", amenities: ["Free Wi-Fi", "River view", "Air conditioning", "Non-smoking"] },
    },
    {
      id: "garden", name: `${destination} Garden Rooms`, stars: 3,
      rating: 8.0, ratingLabel: "Very Good", highlight: "Strong value · welcoming team",
      location: "5 mins walk to local dining and bus connections", features: ["cancellation", "gym"],
      offer: "Comfort Twin Room", discount: "10% lower this week", priceUsd: 78,
      room: { bed: "2 single beds", alternateBed: "1 double bed", size: "20 m²", amenities: ["Free Wi-Fi", "Neighbourhood view", "Air conditioning", "Non-smoking"] },
    },
  ];
}

function setPhoto(element, index, label) {
  element.style.backgroundPosition = `${index * 50}% center`;
  element.setAttribute("aria-label", label);
}

function changePropertyImage(property, direction, photo, counter) {
  const current = carouselIndexes.get(property.id) || 0;
  const next = (current + direction + 3) % 3;
  carouselIndexes.set(property.id, next);
  setPhoto(photo, next, `${property.name} image ${next + 1} of 3`);
  counter.textContent = `${next + 1} / 3`;
}

function selectedFeatures() {
  return [...document.querySelectorAll('input[name="feature"]:checked')]
    .map((input) => input.value);
}

function selectedStars() {
  return [...document.querySelectorAll('input[name="stars"]:checked')]
    .map((input) => Number(input.value));
}

function filteredProperties() {
  const stars = selectedStars();
  const features = selectedFeatures();
  const maxPrice = Number(document.querySelector("#stay-budget-range").value);
  return properties.filter((property) =>
    (!stars.length || stars.includes(property.stars)) &&
    features.every((feature) => property.features.includes(feature)) &&
    property.priceUsd <= maxPrice,
  );
}

function featureLabel(feature) {
  return {
    breakfast: "Breakfast included", cancellation: "Free cancellation",
    pool: "Pool", gym: "Gym",
  }[feature] || feature;
}

function propertyCard(property) {
  const card = document.createElement("article");
  card.className = "stay-property-card";

  const gallery = document.createElement("div");
  gallery.className = "stay-property-gallery";
  const photo = document.createElement("div");
  photo.className = "stay-property-photo";
  photo.setAttribute("role", "img");
  const startIndex = carouselIndexes.get(property.id) || properties.indexOf(property) % 3;
  carouselIndexes.set(property.id, startIndex);
  setPhoto(photo, startIndex, `${property.name} image ${startIndex + 1} of 3`);
  const previous = document.createElement("button");
  previous.type = "button";
  previous.textContent = "←";
  previous.setAttribute("aria-label", `Previous image for ${property.name}`);
  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "→";
  next.setAttribute("aria-label", `Next image for ${property.name}`);
  const counter = document.createElement("span");
  counter.textContent = `${startIndex + 1} / 3`;
  previous.addEventListener("click", () => changePropertyImage(property, -1, photo, counter));
  next.addEventListener("click", () => changePropertyImage(property, 1, photo, counter));
  gallery.append(photo, previous, next, counter);

  const content = document.createElement("div");
  content.className = "stay-property-content";
  const heading = document.createElement("div");
  heading.className = "stay-property-heading";
  const titleArea = document.createElement("div");
  const stars = document.createElement("span");
  stars.className = "stay-stars";
  stars.textContent = "★".repeat(property.stars);
  const title = document.createElement("h3");
  title.textContent = property.name;
  titleArea.append(stars, title);
  const rating = document.createElement("span");
  rating.className = "stay-rating";
  rating.textContent = `${property.rating}/10 ${property.ratingLabel}`;
  heading.append(titleArea, rating);
  const highlight = document.createElement("p");
  highlight.className = "stay-review-highlight";
  highlight.textContent = property.highlight;
  const location = document.createElement("p");
  location.className = "stay-location";
  location.textContent = property.location;
  const tags = document.createElement("div");
  tags.className = "stay-feature-tags";
  tags.replaceChildren(...property.features.slice(0, 3).map((feature) => {
    const tag = document.createElement("span");
    tag.textContent = featureLabel(feature);
    return tag;
  }));

  const offer = document.createElement("div");
  offer.className = "stay-offer";
  const offerCopy = document.createElement("div");
  const room = document.createElement("strong");
  room.textContent = property.offer;
  const perk = document.createElement("span");
  perk.textContent = `${property.room.bed} · ${property.discount}`;
  offerCopy.append(room, perk);
  const price = document.createElement("div");
  price.className = "stay-property-price";
  const note = document.createElement("small");
  note.textContent = `${nights()} ${nights() === 1 ? "night" : "nights"} · taxes included`;
  const amount = document.createElement("strong");
  amount.textContent = moneyFromUsd(property.priceUsd * nights() * Number(searchForm.elements.rooms.value));
  price.append(note, amount);
  offer.append(offerCopy, price);
  const action = document.createElement("button");
  action.className = "button button-primary";
  action.type = "button";
  action.textContent = "Check Availability";
  action.addEventListener("click", () => openProperty(property));
  content.append(heading, highlight, location, tags, offer, action);
  card.append(gallery, content);
  return card;
}

function renderProperties() {
  const matches = filteredProperties();
  document.querySelector("#stay-budget-label").textContent =
    `Up to ${moneyFromUsd(Number(document.querySelector("#stay-budget-range").value))}`;
  document.querySelector("#stay-result-count").textContent =
    `${matches.length} ${matches.length === 1 ? "property" : "properties"}`;
  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "flight-empty";
    const title = document.createElement("strong");
    title.textContent = "No properties match these filters.";
    const copy = document.createElement("span");
    copy.textContent = "Try increasing the budget or clearing an amenity.";
    empty.append(title, copy);
    propertyList.replaceChildren(empty);
    return;
  }
  propertyList.replaceChildren(...matches.map(propertyCard));
}

function rateOptions(property) {
  return [
    { id: "flex", name: "Flexible stay", breakfast: "Included", cancellation: "Free cancellation until 48 hours before check-in", payment: "Pay at the stay", guests: Math.min(4, Number(searchForm.elements.guests.value)), upliftUsd: 18 },
    { id: "value", name: "Best value", breakfast: property.features.includes("breakfast") ? "Included" : "Optional", cancellation: "Non-refundable", payment: "Prepay in this demonstration", guests: Math.min(4, Number(searchForm.elements.guests.value)), upliftUsd: 0 },
    { id: "comfort", name: "Comfort Plus", breakfast: "Included", cancellation: "Free cancellation until check-in day", payment: "Pay at the stay", guests: Math.min(4, Number(searchForm.elements.guests.value)), upliftUsd: 34 },
  ];
}

function roomPreview(property) {
  const wrapper = document.createElement("div");
  const copy = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = property.offer;
  const beds = document.createElement("span");
  beds.textContent = `${property.room.bed} or ${property.room.alternateBed} · ${property.room.size}`;
  copy.append(heading, beds);
  const amenities = document.createElement("div");
  amenities.className = "stay-room-amenities";
  amenities.replaceChildren(...property.room.amenities.map((amenity) => {
    const item = document.createElement("span");
    item.textContent = amenity;
    return item;
  }));
  wrapper.append(copy, amenities);
  return wrapper;
}

function rateRow(property, rate) {
  const row = document.createElement("article");
  row.className = "stay-rate-row";
  row.setAttribute("role", "row");
  const info = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = rate.name;
  const perks = document.createElement("span");
  perks.textContent = `${rate.breakfast} breakfast · ${rate.cancellation} · ${rate.payment}`;
  info.append(name, perks);
  const guests = document.createElement("span");
  guests.textContent = `Up to ${rate.guests} guests`;
  const totalUsd = (property.priceUsd + rate.upliftUsd) * nights() * Number(searchForm.elements.rooms.value);
  const price = document.createElement("div");
  const amount = document.createElement("strong");
  amount.textContent = moneyFromUsd(totalUsd);
  const note = document.createElement("small");
  note.textContent = `${nights()} nights total`;
  price.append(amount, note);
  const reserve = document.createElement("button");
  reserve.className = "button button-primary";
  reserve.type = "button";
  reserve.textContent = "Reserve";
  reserve.addEventListener("click", () => beginReservation(property, { ...rate, totalUsd }));
  row.append(info, guests, price, reserve);
  return row;
}

function updateDetailImage(direction) {
  detailImageIndex = (detailImageIndex + direction + 3) % 3;
  setPhoto(document.querySelector("#stay-detail-photo"), detailImageIndex, `${selectedProperty.name} room image ${detailImageIndex + 1} of 3`);
  document.querySelector("#stay-detail-image-count").textContent = `${detailImageIndex + 1} / 3`;
}

function openProperty(property) {
  selectedProperty = property;
  detailImageIndex = 1;
  document.querySelector("#stay-detail-title").textContent = property.name;
  document.querySelector("#stay-detail-location").textContent = property.location;
  document.querySelector("#stay-detail-rating").textContent = `${property.rating}/10 ${property.ratingLabel}`;
  setPhoto(document.querySelector("#stay-detail-photo"), detailImageIndex, `${property.name} room preview`);
  document.querySelector("#stay-detail-image-count").textContent = "2 / 3";
  document.querySelector("#stay-room-preview").replaceChildren(roomPreview(property));
  document.querySelector("#stay-rate-options").replaceChildren(
    ...rateOptions(property).map((rate) => rateRow(property, rate)),
  );
  if (typeof detailDialog.showModal === "function") detailDialog.showModal();
}

function beginReservation(property, rate) {
  selectedProperty = property;
  selectedRate = rate;
  detailDialog.close();
  document.querySelector("#stay-search-view").hidden = true;
  document.querySelector("#stay-reservation-view").hidden = false;
  document.querySelector("#stay-summary-title").textContent = property.name;
  document.querySelector("#stay-summary-rating").textContent = `${property.rating}/10 ${property.ratingLabel}`;
  document.querySelector("#stay-summary-room").textContent = `${property.offer} · ${rate.name}`;
  document.querySelector("#stay-summary-dates").textContent = `${formatDate(searchForm.elements.checkIn.value)} – ${formatDate(searchForm.elements.checkOut.value)}`;
  document.querySelector("#stay-summary-guests").textContent = `${searchForm.elements.guests.value} guests · ${searchForm.elements.rooms.value} rooms`;
  document.querySelector("#stay-summary-policy").textContent = `${rate.cancellation} · ${rate.payment}`;
  document.querySelector("#stay-summary-total").textContent = moneyFromUsd(rate.totalUsd);
  document.querySelector("#stay-summary-rewards").textContent = `${Math.floor(rate.totalUsd * 2)} PackSwift Rewards`;
  setPhoto(document.querySelector("#stay-summary-photo"), 1, `${property.name} selected room`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function confirmReservation(event) {
  event.preventDefault();
  const feedback = document.querySelector("#stay-reservation-feedback");
  feedback.textContent = "";
  if (!reservationForm.checkValidity()) {
    reservationForm.reportValidity();
    return;
  }
  const button = document.querySelector("#confirm-stay-reservation");
  button.disabled = true;
  button.textContent = "Confirming your stay…";
  try {
    await window.PackSwift.api(
      "/api/checkout/process",
      {
        method: "POST",
        body: JSON.stringify({
          tripId,
          checklistItemKey: activeItem.key,
          orderType: "HOTEL",
          totalAmount: preferredStayAmountFromUsd(selectedRate.totalUsd),
          currency: activeTrip.budget.currency || "USD",
          paymentMethod: "CREDIT_CARD",
          details: {
            hotelName: selectedProperty.name,
            destination: searchForm.elements.destination.value,
            checkIn: searchForm.elements.checkIn.value,
            checkOut: searchForm.elements.checkOut.value,
            roomType: selectedProperty.offer,
            rateOption: selectedRate.name,
            rooms: Number(searchForm.elements.rooms.value),
            guests: {
              count: Number(searchForm.elements.guests.value),
              givenName: reservationForm.elements.givenName.value.trim(),
              surname: reservationForm.elements.lastName.value.trim(),
              email: reservationForm.elements.email.value.trim(),
              phone: reservationForm.elements.phone.value.trim(),
              specialRequest: reservationForm.elements.specialRequest.value.trim(),
            },
            cancellation: selectedRate.cancellation,
            payment: selectedRate.payment,
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
    feedback.textContent = error.message;
  }
}

async function initializeStayAssistant() {
  if (!tripId || !itemKey) {
    stayStatus.className = "status-banner status-error";
    stayStatus.textContent = "Return to the readiness checklist and choose Accommodation first.";
    return;
  }
  const user = await window.PackSwift.authReady;
  if (!user) {
    window.location.assign(loginPath());
    return;
  }
  document.querySelector("#stay-back").href = safeReturnPath();
  try {
    const result = await window.PackSwift.api(`/api/trips/${encodeURIComponent(tripId)}/readiness`);
    activeItem = result.items.find((item) => item.key === itemKey);
    if (!activeItem || activeItem.assistantType !== "accommodation") {
      throw new Error("This PackSwift assistant does not match the selected checklist item.");
    }
    activeTrip = result.trip;
    searchForm.elements.destination.value = activeTrip.destination.displayName || activeTrip.destination.name;
    searchForm.elements.checkIn.value = dateOnly(activeTrip.dates.start);
    searchForm.elements.checkOut.value = dateOnly(activeTrip.dates.end);
    searchForm.elements.guests.value = String(Math.max(1, Number(activeTrip.travelers) || 1));
    searchForm.elements.rooms.value = String(Math.max(1, Math.ceil(Number(activeTrip.travelers || 1) / 2)));
    properties = propertyCatalog(activeTrip.destination.name);
    renderProperties();
    stayStatus.hidden = true;
  } catch (error) {
    if (error.status === 401) {
      window.location.assign(loginPath());
      return;
    }
    stayStatus.hidden = false;
    stayStatus.className = "status-banner status-error";
    stayStatus.textContent = error.message;
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  searchForm.elements.checkOut.setCustomValidity("");
  if (!searchForm.checkValidity()) return searchForm.reportValidity();
  if (searchForm.elements.checkOut.value <= searchForm.elements.checkIn.value) {
    searchForm.elements.checkOut.setCustomValidity("Check-out must be after check-in.");
    searchForm.elements.checkOut.reportValidity();
    return;
  }
  searchForm.elements.checkOut.setCustomValidity("");
  renderProperties();
});
document.querySelectorAll('input[name="stars"], input[name="feature"]').forEach((input) => input.addEventListener("change", renderProperties));
document.querySelector("#stay-budget-range").addEventListener("input", renderProperties);
document.querySelector("#clear-stay-filters").addEventListener("click", () => {
  document.querySelectorAll('input[name="stars"], input[name="feature"]').forEach((input) => { input.checked = false; });
  document.querySelector("#stay-budget-range").value = "180";
  renderProperties();
});
document.querySelector("#close-stay-detail").addEventListener("click", () => detailDialog.close());
document.querySelectorAll("[data-detail-image]").forEach((button) => button.addEventListener("click", () => updateDetailImage(button.dataset.detailImage === "next" ? 1 : -1)));
document.querySelector("#return-to-stay-results").addEventListener("click", () => {
  document.querySelector("#stay-reservation-view").hidden = true;
  document.querySelector("#stay-search-view").hidden = false;
});
reservationForm.addEventListener("submit", confirmReservation);

initializeStayAssistant();
