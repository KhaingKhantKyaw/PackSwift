const profileGuest = document.querySelector("#profile-guest");
const profileContent = document.querySelector("#profile-content");
const settingsForm = document.querySelector("#settings-form");
const passwordForm = document.querySelector("#password-form");
const inProgressTripsList = document.querySelector("#profile-in-progress-trips");
const readyTripsList = document.querySelector("#profile-ready-trips");
const cancelReadyDialog = document.querySelector("#cancel-ready-dialog");
const confirmCancelReady = document.querySelector("#confirm-cancel-ready");
const profileOrdersList = document.querySelector("#profile-orders");
const orderDetailsDialog = document.querySelector("#order-details-dialog");
const themeButtons = [...document.querySelectorAll("[data-theme-option]")];
const activeThemeLabel = document.querySelector("#active-theme-label");
const themeFeedback = document.querySelector("#theme-feedback");
let readyTrips = [];
let inProgressTrips = [];
let profileOrders = [];
let activeOrderFilter = "all";
let cancellingTripId = null;

function themeLabel(preference) {
  return {
    system: "System default",
    light: "Light",
    dark: "Dark",
  }[preference] || "System default";
}

function renderThemePreference(preference = window.PackSwift.themePreference) {
  for (const button of themeButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.themeOption === preference));
  }
  activeThemeLabel.textContent = themeLabel(preference);
}

for (const button of themeButtons) {
  button.addEventListener("click", () => {
    const result = window.PackSwift.setThemePreference(button.dataset.themeOption);
    renderThemePreference(result.preference);
    themeFeedback.textContent = result.preference === "system"
      ? `Following your device · currently ${result.theme}.`
      : `${themeLabel(result.preference)} theme applied.`;
  });
}

window.addEventListener("packswift:themechange", (event) => {
  renderThemePreference(event.detail.preference);
});

renderThemePreference();

function formatDate(value) {
  if (!value) return "Date not set";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function emptyItem(message) {
  const item = document.createElement("p");
  item.className = "profile-empty";
  item.textContent = message;
  return item;
}

function formatBudget(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);
  } catch {
    return `${currency || "USD"} ${Number(amount || 0).toLocaleString()}`;
  }
}

function formatOrderMoney(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: ["JPY", "KRW", "MMK"].includes(currency) ? 0 : 2,
    }).format(Number(amount) || 0);
  } catch {
    return `${currency || "USD"} ${Number(amount || 0).toLocaleString()}`;
  }
}

function orderCategory(order) {
  return {
    flight: { label: "Flight", icon: "✈", className: "is-flight" },
    accommodation: { label: "Hotel", icon: "⌂", className: "is-stay" },
    travel_gear: { label: "Travel Gear", icon: "▣", className: "is-gear" },
    insurance: { label: "Insurance", icon: "✓", className: "is-insurance" },
  }[order.category] || { label: "Order", icon: "•", className: "" };
}

function orderStatus(order) {
  return {
    confirmed: { label: "Confirmed ✓", className: "is-confirmed" },
    in_transit: { label: "In Transit 🚚", className: "is-transit" },
    completed: { label: "Completed", className: "is-completed" },
    cancelled: { label: "Cancelled", className: "is-cancelled" },
  }[order.status] || { label: order.status, className: "" };
}

function orderDetailRows(order) {
  const details = order.details || {};
  const paymentRows = order.payment?.last4
    ? [
        ["Payment", `${order.payment.brand === "MASTERCARD" ? "Mastercard" : "Visa"} •••• ${order.payment.last4}`],
        ["Payment reference", order.payment.reference || "Confirmed"],
      ]
    : [];
  if (order.category === "flight") {
    return [
      ["Route", details.route || order.title],
      ["Travel dates", `${formatDate(details.departureDate)} – ${formatDate(details.returnDate)}`],
      ["Passengers", Array.isArray(details.passengers) ? details.passengers.join(", ") : "Traveller"],
      ["Seat class", details.seatClass || "Economy Standard"],
      ["Seats", Array.isArray(details.seats) && details.seats.length ? details.seats.join(", ") : "Assigned at check-in"],
      ["Baggage", details.baggage || "See confirmation"],
      ...paymentRows,
    ];
  }
  if (order.category === "accommodation") {
    return [
      ["Property", details.hotelName || order.title],
      ["Stay dates", `${formatDate(details.checkIn)} – ${formatDate(details.checkOut)}`],
      ["Room", details.roomType || "Selected room"],
      ["Guests", `${details.guests || 1} guests · ${details.rooms || order.quantity} rooms`],
      ["Rate", details.rateOption || "Confirmed stay"],
      ["Policy", details.cancellation || "See confirmation"],
      ...paymentRows,
    ];
  }
  if (order.category === "insurance") {
    return [
      ["Protection plan", details.planName || order.title],
      ["Tier", details.tier || "Travel protection"],
      ["Coverage", details.coverage ? Object.keys(details.coverage).join(", ") : "See policy summary"],
      ["Status", "Protection added to trip"],
      ...paymentRows,
    ];
  }
  return [
    ["Product", details.productTitle || order.title],
    ["Specifications", details.specs || "Travel-ready item"],
    ["Quantity", String(details.quantity || order.quantity || 1)],
    ["Delivery", details.deliveryOption || "Standard delivery"],
    ["Delivery status", details.deliveryStatus || "Preparing for dispatch"],
    ["Ships from", details.location || "PackSwift verified seller"],
    ...paymentRows,
  ];
}

function orderDetailsList(order, compact = false) {
  const list = document.createElement("dl");
  list.className = compact ? "profile-order-details" : "order-dialog-list";
  const rows = compact ? orderDetailRows(order).slice(0, 4) : orderDetailRows(order);
  for (const [term, value] of rows) {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = term;
    dd.textContent = value;
    row.append(dt, dd);
    list.append(row);
  }
  return list;
}

function openOrderDetails(order, documentView = false) {
  const category = orderCategory(order);
  const status = orderStatus(order);
  document.querySelector("#order-dialog-eyebrow").textContent = documentView
    ? order.category === "flight" ? "PackSwift E-Ticket" : "PackSwift Receipt"
    : "Order details";
  document.querySelector("#order-dialog-title").textContent = order.title;
  document.querySelector("#order-dialog-reference").textContent =
    `Order #${order.orderNumber} · ${formatDate(order.createdAt)} · ${category.label}`;
  const statusElement = document.querySelector("#order-dialog-status");
  statusElement.className = `profile-order-status ${status.className}`;
  statusElement.textContent = status.label;
  document.querySelector("#order-dialog-details").replaceChildren(orderDetailsList(order));
  document.querySelector("#order-dialog-total").textContent =
    formatOrderMoney(order.totalAmount, order.currency);
  document.querySelector("#print-order-document").textContent = documentView
    ? "Print / Save Document"
    : "Print Order Details";
  if (typeof orderDetailsDialog.showModal === "function") orderDetailsDialog.showModal();
}

function profileOrderCard(order) {
  const category = orderCategory(order);
  const status = orderStatus(order);
  const card = document.createElement("article");
  card.className = `profile-order-card ${category.className}`;

  const header = document.createElement("div");
  header.className = "profile-order-card-head";
  const reference = document.createElement("div");
  const referenceLabel = document.createElement("small");
  referenceLabel.textContent = `Order #${order.orderNumber} • ${formatDate(order.createdAt)}`;
  const title = document.createElement("h3");
  title.textContent = order.title;
  reference.append(referenceLabel, title);
  const categoryBadge = document.createElement("span");
  categoryBadge.className = "profile-order-category";
  categoryBadge.textContent = `${category.icon} ${category.label}`;
  header.append(reference, categoryBadge);

  const content = document.createElement("div");
  content.className = "profile-order-card-content";
  if (order.category === "travel_gear") {
    const thumbnail = document.createElement("div");
    thumbnail.className = "profile-order-thumbnail";
    const panel = Math.min(4, Math.max(0, Number(order.details?.imagePanel) || 0));
    thumbnail.style.backgroundPosition = `${panel * 25}% center`;
    thumbnail.setAttribute("role", "img");
    thumbnail.setAttribute("aria-label", order.details?.productTitle || order.title);
    content.append(thumbnail);
  }
  content.append(orderDetailsList(order, true));

  const footer = document.createElement("div");
  footer.className = "profile-order-card-footer";
  const total = document.createElement("div");
  const totalLabel = document.createElement("small");
  totalLabel.textContent = "Total";
  const totalValue = document.createElement("strong");
  totalValue.textContent = formatOrderMoney(order.totalAmount, order.currency);
  total.append(totalLabel, totalValue);
  const statusBadge = document.createElement("span");
  statusBadge.className = `profile-order-status ${status.className}`;
  statusBadge.textContent = status.label;
  const actions = document.createElement("div");
  actions.className = "profile-order-actions";
  const documentButton = document.createElement("button");
  documentButton.className = "button button-primary";
  documentButton.type = "button";
  documentButton.textContent = order.category === "flight" ? "View E-Ticket" : "View Receipt";
  documentButton.addEventListener("click", () => openOrderDetails(order, true));
  const detailsButton = document.createElement("button");
  detailsButton.className = "button button-secondary";
  detailsButton.type = "button";
  detailsButton.textContent = "Order Details";
  detailsButton.addEventListener("click", () => openOrderDetails(order));
  actions.append(documentButton, detailsButton);
  footer.append(total, statusBadge, actions);
  card.append(header, content, footer);
  return card;
}

function renderProfileOrders() {
  const filtered = activeOrderFilter === "all"
    ? profileOrders
    : profileOrders.filter((order) => order.category === activeOrderFilter);
  document.querySelector("#profile-order-count").textContent =
    `${filtered.length} ${filtered.length === 1 ? "order" : "orders"}`;
  if (!filtered.length) {
    profileOrdersList.replaceChildren(
      emptyItem(activeOrderFilter === "all"
        ? "No PackSwift assistant orders yet. Completed flight, stay, and gear confirmations will appear here."
        : "No orders match this category yet."),
    );
    return;
  }
  profileOrdersList.replaceChildren(...filtered.map(profileOrderCard));
}

function openCancelReadyTrip(trip) {
  cancellingTripId = trip.trip_id;
  document.querySelector("#cancel-ready-title").textContent =
    `Cancel ${trip.destination}?`;
  document.querySelector("#cancel-ready-feedback").textContent = "";
  if (typeof cancelReadyDialog.showModal === "function") {
    cancelReadyDialog.showModal();
    return;
  }
  if (window.confirm("Are you sure you want to cancel this ready trip?")) {
    cancelReadyTrip();
  }
}

function renderReadyTrips() {
  readyTripsList.replaceChildren();
  document.querySelector("#ready-trip-count").textContent =
    `${readyTrips.length} ${readyTrips.length === 1 ? "trip" : "trips"} ready`;
  if (!readyTrips.length) {
    readyTripsList.append(
      emptyItem("No trips are fully prepared yet. Complete a trip checklist and it will appear here."),
    );
    return;
  }

  for (const trip of readyTrips) {
    const card = document.createElement("article");
    card.className = "ready-profile-card";
    const head = document.createElement("div");
    head.className = "ready-profile-head";
    const destination = document.createElement("div");
    const label = document.createElement("small");
    label.textContent = "Destination";
    const title = document.createElement("h3");
    title.textContent = trip.destination;
    destination.append(label, title);
    const badge = document.createElement("span");
    badge.className = "ready-badge";
    badge.textContent = "Fully Prepared ✓";
    head.append(destination, badge);

    const details = document.createElement("dl");
    details.className = "ready-profile-details";
    const detailRows = [
      ["Travel dates", `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`],
      ["Budget", formatBudget(trip.budget_amount, trip.budget_currency)],
    ];
    for (const [term, value] of detailRows) {
      const row = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = term;
      dd.textContent = value;
      row.append(dt, dd);
      details.append(row);
    }

    const actions = document.createElement("div");
    actions.className = "ready-profile-actions";
    const edit = document.createElement("a");
    edit.className = "button button-primary";
    edit.href = `/assist-trip?trip=${encodeURIComponent(trip.trip_id)}`;
    edit.textContent = "Edit Trip";
    const cancel = document.createElement("button");
    cancel.className = "button button-secondary";
    cancel.type = "button";
    cancel.textContent = "Cancel Trip";
    cancel.addEventListener("click", () => openCancelReadyTrip(trip));
    actions.append(edit, cancel);
    card.append(head, details, actions);
    readyTripsList.append(card);
  }
}

function renderInProgressTrips() {
  inProgressTripsList.replaceChildren();
  document.querySelector("#in-progress-trip-count").textContent =
    `${inProgressTrips.length} in progress`;
  if (!inProgressTrips.length) {
    inProgressTripsList.append(
      emptyItem("Trips with confirmed flights or hotels and unfinished checklist items will appear here."),
    );
    return;
  }

  for (const trip of inProgressTrips) {
    const percentage = Math.max(0, Math.min(100, Number(trip.progress_percentage) || 0));
    const remaining = Math.max(0, Number(trip.remaining_count) || 0);
    const card = document.createElement("article");
    card.className = "ready-profile-card in-progress-profile-card";

    const head = document.createElement("div");
    head.className = "ready-profile-head";
    const destination = document.createElement("div");
    const label = document.createElement("small");
    label.textContent = "Destination";
    const title = document.createElement("h3");
    title.textContent = trip.destination;
    destination.append(label, title);
    const badge = document.createElement("span");
    badge.className = "ready-badge in-progress-badge";
    badge.textContent = "Booked & Confirmed";
    head.append(destination, badge);

    const details = document.createElement("dl");
    details.className = "ready-profile-details";
    for (const [term, value] of [
      ["Travel dates", `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`],
      ["Budget", formatBudget(trip.budget_amount, trip.budget_currency)],
    ]) {
      const row = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = term;
      dd.textContent = value;
      row.append(dt, dd);
      details.append(row);
    }

    const progress = document.createElement("div");
    progress.className = "trip-readiness-progress";
    const progressText = document.createElement("p");
    progressText.textContent = `${percentage}% Prepared — ${remaining} ${remaining === 1 ? "packing item" : "packing items"} remaining`;
    const track = document.createElement("div");
    track.className = "trip-readiness-progress-track";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", `${trip.destination} preparation progress`);
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", String(percentage));
    const fill = document.createElement("span");
    fill.style.width = `${percentage}%`;
    track.append(fill);
    progress.append(progressText, track);

    const actions = document.createElement("div");
    actions.className = "ready-profile-actions single-action";
    const continueButton = document.createElement("a");
    continueButton.className = "button button-primary";
    continueButton.href = `/assist-trip?trip=${encodeURIComponent(trip.trip_id)}`;
    continueButton.textContent = "Continue Preparing";
    actions.append(continueButton);
    card.append(head, details, progress, actions);
    inProgressTripsList.append(card);
  }
}

async function cancelReadyTrip() {
  if (!cancellingTripId) return;
  confirmCancelReady.disabled = true;
  const feedback = document.querySelector("#cancel-ready-feedback");
  feedback.textContent = "Returning this trip to your saved plans…";
  try {
    await window.PackSwift.api(
      `/api/trips/${encodeURIComponent(cancellingTripId)}/readiness/cancel`,
      { method: "POST" },
    );
    cancellingTripId = null;
    cancelReadyDialog.close();
    await loadProfile();
  } catch (error) {
    feedback.textContent = error.message;
  } finally {
    confirmCancelReady.disabled = false;
  }
}

function renderProfile(profile) {
  const { user, savedTrips } = profile;
  inProgressTrips = Array.isArray(profile.inProgressTrips) ? profile.inProgressTrips : [];
  readyTrips = Array.isArray(profile.readyTrips) ? profile.readyTrips : [];
  profileOrders = Array.isArray(profile.orders) ? profile.orders : [];
  document.querySelector("#profile-name").textContent = user.fullName;
  document.querySelector("#profile-handle").textContent = `@${user.username} · ${user.email}`;
  document.querySelector("#profile-initials").textContent = user.fullName
    .split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  settingsForm.elements.fullName.value = user.fullName;
  settingsForm.elements.username.value = user.username;
  settingsForm.elements.email.value = user.email;
  renderInProgressTrips();
  renderReadyTrips();
  renderProfileOrders();

  const trips = document.querySelector("#profile-trips");
  trips.replaceChildren();
  if (!savedTrips.length) trips.append(emptyItem("No server-saved trips yet. Your next signed-in plan will appear here."));
  for (const trip of savedTrips) {
    let plan = trip.trip_data || {};
    if (typeof plan === "string") {
      try {
        plan = JSON.parse(plan);
      } catch {
        plan = {};
      }
    }
    const item = document.createElement("article");
    item.className = "profile-list-item";
    const title = document.createElement("strong");
    title.textContent = trip.destination;
    const meta = document.createElement("span");
    const score = plan.destination?.score
      ? ` · ${Math.round(plan.destination.score)}% match`
      : "";
    meta.textContent = `${trip.travel_month} · USD ${Number(trip.budget).toLocaleString()} budget${score}`;
    item.append(title, meta);
    trips.append(item);
  }
}

async function loadProfile() {
  const user = await window.PackSwift.authReady;
  if (!user) {
    profileGuest.hidden = false;
    return;
  }
  try {
    const result = await window.PackSwift.api("/api/profile");
    renderProfile(result.profile);
    profileContent.hidden = false;
  } catch (error) {
    if (error.status === 401) profileGuest.hidden = false;
    else {
      profileGuest.hidden = false;
      profileGuest.querySelector("h1").textContent = "Your profile is temporarily unavailable.";
      profileGuest.querySelector("p:not(.eyebrow)").textContent = error.message;
    }
  }
}

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const feedback = document.querySelector("#settings-feedback");
  feedback.textContent = "";
  if (!window.PackSwift.forms.validate(settingsForm)) return;
  try {
    const result = await window.PackSwift.api("/api/auth/settings", {
      method: "PUT",
      body: JSON.stringify(Object.fromEntries(new FormData(settingsForm))),
    });
    window.PackSwift.setCurrentUser(result.user);
    feedback.className = "form-feedback form-success";
    feedback.textContent = "Account settings saved.";
    document.querySelector("#profile-name").textContent = result.user.fullName;
    document.querySelector("#profile-handle").textContent = `@${result.user.username} · ${result.user.email}`;
  } catch (error) {
    feedback.className = "form-feedback";
    if (!window.PackSwift.forms.showServerErrors(settingsForm, error)) feedback.textContent = error.message;
  }
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const feedback = document.querySelector("#password-feedback");
  feedback.textContent = "";
  if (!window.PackSwift.forms.validate(passwordForm)) return;
  try {
    await window.PackSwift.api("/api/auth/password", {
      method: "PUT",
      body: JSON.stringify(Object.fromEntries(new FormData(passwordForm))),
    });
    passwordForm.reset();
    feedback.className = "form-feedback form-success";
    feedback.textContent = "Password updated securely.";
  } catch (error) {
    feedback.className = "form-feedback";
    if (!window.PackSwift.forms.showServerErrors(passwordForm, error)) feedback.textContent = error.message;
  }
});

confirmCancelReady.addEventListener("click", cancelReadyTrip);
document.querySelectorAll("[data-order-filter]").forEach((button) => button.addEventListener("click", () => {
  activeOrderFilter = button.dataset.orderFilter;
  document.querySelectorAll("[data-order-filter]").forEach((option) =>
    option.setAttribute("aria-selected", String(option === button)),
  );
  renderProfileOrders();
}));
document.querySelector("#close-order-dialog").addEventListener("click", () => orderDetailsDialog.close());
document.querySelector("#done-order-dialog").addEventListener("click", () => orderDetailsDialog.close());
document.querySelector("#print-order-document").addEventListener("click", () => window.print());

loadProfile();
