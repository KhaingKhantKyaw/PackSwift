const storeParams = new URLSearchParams(window.location.search);
const storeTripId = storeParams.get("trip");
const storeItemKey = storeParams.get("item");
const storeStatus = document.querySelector("#store-status");
const storeSearchForm = document.querySelector("#store-search-form");
const storeCheckoutForm = document.querySelector("#store-checkout-form");
const storeProductGrid = document.querySelector("#store-product-grid");
const currencyRatesToUsd = {
  USD: 1, EUR: 1.08, GBP: 1.27, THB: 0.0275, SGD: 0.745, MYR: 0.226,
  JPY: 0.0067, KRW: 0.00072, AUD: 0.66, CAD: 0.73, CNY: 0.138,
  INR: 0.012, MMK: 0.00022,
};

const itemProfiles = {
  clothes: { keyword: "daily wear", panel: 1, noun: "travel clothing set", spec: "Lightweight · quick dry · easy layer" },
  "luggage-30kg": { keyword: "30kg luggage", panel: 0, noun: "30kg hard-shell luggage", spec: "Secure shell · smooth wheels · expandable" },
  "hand-carry": { keyword: "hand-carry travel bag", panel: 0, noun: "cabin travel case", spec: "Compact size · organiser pockets · lightweight" },
  "towels-toiletries": { keyword: "travel towels", panel: 2, noun: "quick-dry travel set", spec: "Fast drying · compact · reusable pouch" },
  "power-adapter": { keyword: "universal power adapter", panel: 3, noun: "universal travel adapter", spec: "Multi-region plugs · USB charging · compact" },
  "rain-protection": { keyword: "compact rain gear", panel: 1, noun: "packable rain layer", spec: "Water resistant · lightweight · easy pack" },
  "pet-travel-kit": { keyword: "pet travel kit", panel: 4, noun: "pet travel essentials kit", spec: "Collapsible bowls · storage pouch · travel ready" },
};

let activeStoreTrip = null;
let activeStoreItem = null;
let storeUser = null;
let storeProducts = [];
let selectedStoreProduct = null;
let currentStoreSort = "relevance";

function safeStoreReturnPath() {
  const requested = storeParams.get("return");
  if (requested?.startsWith("/") && !requested.startsWith("//")) return requested;
  return `/assist-trip?trip=${encodeURIComponent(storeTripId || "")}`;
}

function storeLoginPath() {
  const current = `${window.location.pathname}${window.location.search}`;
  return `/login?return=${encodeURIComponent(current)}`;
}

function formatStoreDate(value) {
  if (!value) return "Flexible";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${String(value).slice(0, 10)}T00:00:00Z`));
}

function storeMoney(usd) {
  const currency = activeStoreTrip?.budget?.currency || "USD";
  const rate = currencyRatesToUsd[currency] || 1;
  return new Intl.NumberFormat(undefined, {
    style: "currency", currency,
    maximumFractionDigits: ["JPY", "KRW", "MMK"].includes(currency) ? 0 : 2,
  }).format(usd / rate);
}

function preferredStoreAmountFromUsd(usd) {
  const currency = activeStoreTrip?.budget?.currency || "USD";
  return Number((usd / (currencyRatesToUsd[currency] || 1)).toFixed(2));
}

function activeItemProfile() {
  return itemProfiles[storeItemKey] || {
    keyword: activeStoreItem?.name?.toLowerCase() || "travel essentials",
    panel: 4,
    noun: activeStoreItem?.name?.toLowerCase() || "travel essentials kit",
    spec: "Travel ready · compact · practical",
  };
}

function productCatalog(profile) {
  const variants = [
    { prefix: "Essential", suffix: "PackSwift Choice", price: 64, original: 82, rating: 4.9, location: "Bangkok", shipping: ["domestic", "express"], services: ["discount", "stock", "verified"], sales: 1260, latest: 4 },
    { prefix: "Lightweight", suffix: "PackSwift Preferred", price: 48, original: 60, rating: 4.8, location: "Yangon", shipping: ["domestic"], services: ["discount", "stock", "verified"], sales: 980, latest: 6 },
    { prefix: "Everyday", suffix: "Verified Travel Quality", price: 39, original: 39, rating: 4.6, location: "Chiang Mai", shipping: ["domestic", "express"], services: ["stock", "verified"], sales: 740, latest: 2 },
    { prefix: "Journey", suffix: "PackSwift Express Delivery", price: 76, original: 95, rating: 4.7, location: "Singapore", shipping: ["overseas", "express"], services: ["discount", "stock"], sales: 1580, latest: 5 },
    { prefix: "Compact", suffix: "PackSwift Preferred", price: 31, original: 42, rating: 4.5, location: "Kuala Lumpur", shipping: ["overseas"], services: ["discount", "verified"], sales: 520, latest: 3 },
    { prefix: "Premium", suffix: "Verified Travel Quality", price: 92, original: 110, rating: 4.9, location: "Bangkok", shipping: ["domestic", "express"], services: ["discount", "stock", "verified"], sales: 1890, latest: 1 },
  ];
  return variants.map((variant, index) => ({
    id: `${storeItemKey || "gear"}-${index + 1}`,
    title: `${variant.prefix} ${profile.noun}`,
    specs: profile.spec,
    panel: profile.panel,
    tone: index % 3,
    badge: variant.suffix,
    priceUsd: variant.price,
    originalUsd: variant.original,
    rating: variant.rating,
    location: variant.location,
    shipping: variant.shipping,
    services: variant.services,
    sales: variant.sales,
    latest: variant.latest,
    relevance: 6 - index,
  }));
}

function imagePosition(panel) {
  return `${panel * 25}% center`;
}

function checkedStoreValues(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)]
    .map((input) => input.value);
}

function filteredStoreProducts() {
  const services = checkedStoreValues("service");
  const shipping = checkedStoreValues("shipping");
  const maxPrice = Number(document.querySelector("#store-price-range").value);
  const rating = Number(document.querySelector("#store-rating").value);
  const matches = storeProducts.filter((product) =>
    services.every((service) => product.services.includes(service)) &&
    shipping.every((method) => product.shipping.includes(method)) &&
    product.priceUsd <= maxPrice && product.rating >= rating,
  );
  return matches.sort((a, b) => {
    if (currentStoreSort === "latest") return b.latest - a.latest;
    if (currentStoreSort === "sales") return b.sales - a.sales;
    if (currentStoreSort === "low") return a.priceUsd - b.priceUsd;
    if (currentStoreSort === "high") return b.priceUsd - a.priceUsd;
    return b.relevance - a.relevance;
  });
}

function storeBadge(label, className = "") {
  const badge = document.createElement("span");
  badge.className = `store-product-badge ${className}`.trim();
  badge.textContent = label;
  return badge;
}

function storeProductCard(product) {
  const card = document.createElement("article");
  card.className = "store-product-card";

  const photo = document.createElement("div");
  photo.className = `store-product-photo store-tone-${product.tone}`;
  photo.style.backgroundPosition = imagePosition(product.panel);
  photo.setAttribute("role", "img");
  photo.setAttribute("aria-label", product.title);
  const badges = document.createElement("div");
  badges.className = "store-product-badges";
  badges.append(storeBadge(product.badge));
  const discount = Math.round((1 - product.priceUsd / product.originalUsd) * 100);
  if (discount > 0) badges.append(storeBadge(`-${discount}%`, "is-discount"));
  photo.append(badges);

  const body = document.createElement("div");
  body.className = "store-product-body";
  const title = document.createElement("h3");
  title.textContent = product.title;
  const specs = document.createElement("p");
  specs.textContent = product.specs;
  const labels = document.createElement("div");
  labels.className = "store-product-labels";
  if (product.services.includes("verified")) labels.append(storeBadge("Verified seller", "is-soft"));
  if (product.shipping.includes("express")) labels.append(storeBadge("Express", "is-soft"));

  const priceRow = document.createElement("div");
  priceRow.className = "store-product-price";
  const current = document.createElement("strong");
  current.textContent = storeMoney(product.priceUsd);
  const original = document.createElement("del");
  original.textContent = storeMoney(product.originalUsd);
  priceRow.append(current, original);

  const meta = document.createElement("div");
  meta.className = "store-product-meta";
  const rating = document.createElement("span");
  rating.textContent = `★ ${product.rating}`;
  const location = document.createElement("span");
  location.textContent = product.location;
  meta.append(rating, location);

  const actions = document.createElement("div");
  actions.className = "store-product-actions";
  const add = document.createElement("button");
  add.className = "button button-secondary";
  add.type = "button";
  add.textContent = selectedStoreProduct?.id === product.id ? "In Trip Cart ✓" : "Add to Trip Cart";
  add.addEventListener("click", () => addProductToTripCart(product));
  const buy = document.createElement("button");
  buy.className = "button button-primary";
  buy.type = "button";
  buy.textContent = "Buy Now";
  buy.addEventListener("click", () => beginStoreCheckout(product));
  actions.append(add, buy);
  body.append(title, specs, labels, priceRow, meta, actions);
  card.append(photo, body);
  return card;
}

function renderStoreProducts() {
  const products = filteredStoreProducts();
  document.querySelector("#store-price-label").textContent =
    `Up to ${storeMoney(Number(document.querySelector("#store-price-range").value))}`;
  document.querySelector("#store-result-count").textContent =
    `${products.length} ${products.length === 1 ? "result" : "results"}`;
  if (!products.length) {
    const empty = document.createElement("div");
    empty.className = "flight-empty";
    const title = document.createElement("strong");
    title.textContent = "No gear matches these filters.";
    const message = document.createElement("span");
    message.textContent = "Try increasing the price or clearing a service option.";
    empty.append(title, message);
    storeProductGrid.replaceChildren(empty);
    return;
  }
  storeProductGrid.replaceChildren(...products.map(storeProductCard));
}

function addProductToTripCart(product) {
  selectedStoreProduct = product;
  document.querySelector("#trip-cart-summary").hidden = false;
  document.querySelector("#store-cart-item").textContent = product.title;
  document.querySelector("#store-cart-total").textContent = storeMoney(product.priceUsd);
  renderStoreProducts();
}

function updateStoreSummary() {
  if (!selectedStoreProduct) return;
  const express = storeCheckoutForm.elements.delivery.value === "express";
  const deliveryUsd = express ? 9 : 0;
  const discountUsd = Math.max(0, selectedStoreProduct.originalUsd - selectedStoreProduct.priceUsd);
  const totalUsd = selectedStoreProduct.priceUsd + deliveryUsd;
  document.querySelector("#store-summary-delivery").textContent = express ? storeMoney(deliveryUsd) : "Included";
  document.querySelector("#store-summary-price").textContent = storeMoney(selectedStoreProduct.originalUsd);
  document.querySelector("#store-summary-discount").textContent = discountUsd ? `−${storeMoney(discountUsd)}` : "—";
  document.querySelector("#store-summary-total").textContent = storeMoney(totalUsd);
  document.querySelector("#store-summary-rewards").textContent = `${Math.floor(totalUsd * 3)} PackSwift Coins`;
}

function beginStoreCheckout(product) {
  selectedStoreProduct = product;
  document.querySelector("#store-results-view").hidden = true;
  document.querySelector("#store-checkout-view").hidden = false;
  document.querySelector("#store-summary-title").textContent = product.title;
  document.querySelector("#store-summary-specs").textContent = product.specs;
  const summaryPhoto = document.querySelector("#store-summary-photo");
  summaryPhoto.style.backgroundPosition = imagePosition(product.panel);
  summaryPhoto.setAttribute("aria-label", product.title);
  updateStoreSummary();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function confirmStorePurchase(event) {
  event.preventDefault();
  const feedback = document.querySelector("#store-checkout-feedback");
  feedback.textContent = "";
  if (!storeCheckoutForm.checkValidity()) {
    storeCheckoutForm.reportValidity();
    return;
  }
  const button = document.querySelector("#confirm-store-purchase");
  button.disabled = true;
  button.textContent = "Preparing your trip item…";
  try {
    const deliveryOption = storeCheckoutForm.elements.delivery.value;
    const deliveryUsd = deliveryOption === "express" ? 9 : 0;
    const totalUsd = selectedStoreProduct.priceUsd + deliveryUsd;
    await window.PackSwift.api(
      "/api/checkout/process",
      {
        method: "POST",
        body: JSON.stringify({
          tripId: storeTripId,
          checklistItemKey: activeStoreItem.key,
          orderType: "GEAR",
          totalAmount: preferredStoreAmountFromUsd(totalUsd),
          currency: activeStoreTrip.budget.currency || "USD",
          paymentMethod: "CREDIT_CARD",
          details: {
            itemName: selectedStoreProduct.title,
            quantity: 1,
            itemDetails: {
              productTitle: selectedStoreProduct.title,
              specs: selectedStoreProduct.specs,
              quantity: 1,
              deliveryOption: deliveryOption === "express"
                ? "PackSwift Express Delivery"
                : "Standard delivery",
              deliveryStatus: "Preparing for dispatch",
              imagePanel: selectedStoreProduct.panel,
              location: selectedStoreProduct.location,
              destination: activeStoreTrip.destination.displayName || activeStoreTrip.destination.name,
              deliveryAddress: storeCheckoutForm.elements.address.value.trim(),
            },
          },
        }),
      },
    );
    const returnUrl = new URL(safeStoreReturnPath(), window.location.origin);
    returnUrl.searchParams.set("completed", activeStoreItem.key);
    window.location.assign(`${returnUrl.pathname}${returnUrl.search}`);
  } catch (error) {
    button.disabled = false;
    button.textContent = "Try confirmation again";
    feedback.textContent = error.message;
  }
}

async function initializeStoreAssistant() {
  if (!storeTripId || !storeItemKey) {
    storeStatus.className = "status-banner status-error";
    storeStatus.textContent = "Return to the readiness checklist and choose a physical travel item first.";
    return;
  }
  storeUser = await window.PackSwift.authReady;
  if (!storeUser) {
    window.location.assign(storeLoginPath());
    return;
  }
  document.querySelector("#store-back").href = safeStoreReturnPath();
  try {
    const result = await window.PackSwift.api(`/api/trips/${encodeURIComponent(storeTripId)}/readiness`);
    activeStoreItem = result.items.find((item) => item.key === storeItemKey);
    if (!activeStoreItem || activeStoreItem.assistantType !== "shopping") {
      throw new Error("This PackSwift assistant does not match the selected checklist item.");
    }
    activeStoreTrip = result.trip;
    const profile = activeItemProfile();
    storeSearchForm.elements.keyword.value = profile.keyword;
    document.querySelector("#store-results-title").textContent = `${activeStoreItem.name} for your trip`;
    document.querySelector("#store-trip-context").textContent =
      activeStoreTrip.destination.displayName || activeStoreTrip.destination.name;
    document.querySelector("#store-trip-dates").textContent =
      `${formatStoreDate(activeStoreTrip.dates.start)} – ${formatStoreDate(activeStoreTrip.dates.end)}`;
    storeCheckoutForm.elements.fullName.value = storeUser.fullName || "";
    storeCheckoutForm.elements.email.value = storeUser.email || "";
    storeProducts = productCatalog(profile);
    renderStoreProducts();
    storeStatus.hidden = true;
  } catch (error) {
    if (error.status === 401) {
      window.location.assign(storeLoginPath());
      return;
    }
    storeStatus.hidden = false;
    storeStatus.className = "status-banner status-error";
    storeStatus.textContent = error.message;
  }
}

storeSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!storeSearchForm.checkValidity()) return storeSearchForm.reportValidity();
  const keyword = storeSearchForm.elements.keyword.value.trim();
  document.querySelector("#store-results-title").textContent = `${keyword} for your trip`;
  renderStoreProducts();
});
document.querySelectorAll('input[name="service"], input[name="shipping"]').forEach((input) => input.addEventListener("change", renderStoreProducts));
document.querySelector("#store-price-range").addEventListener("input", renderStoreProducts);
document.querySelector("#store-rating").addEventListener("change", renderStoreProducts);
document.querySelectorAll("[data-store-sort]").forEach((button) => button.addEventListener("click", () => {
  currentStoreSort = button.dataset.storeSort;
  document.querySelectorAll("[data-store-sort]").forEach((option) => option.setAttribute("aria-pressed", String(option === button)));
  renderStoreProducts();
}));
document.querySelector("#clear-store-filters").addEventListener("click", () => {
  document.querySelectorAll('input[name="service"], input[name="shipping"]').forEach((input) => { input.checked = false; });
  document.querySelector("#store-price-range").value = "300";
  document.querySelector("#store-rating").value = "0";
  renderStoreProducts();
});
document.querySelector("#store-checkout-button").addEventListener("click", () => {
  if (selectedStoreProduct) beginStoreCheckout(selectedStoreProduct);
});
document.querySelector("#return-to-store-results").addEventListener("click", () => {
  document.querySelector("#store-checkout-view").hidden = true;
  document.querySelector("#store-results-view").hidden = false;
});
storeCheckoutForm.elements.delivery.addEventListener("change", updateStoreSummary);
storeCheckoutForm.addEventListener("submit", confirmStorePurchase);

initializeStoreAssistant();
