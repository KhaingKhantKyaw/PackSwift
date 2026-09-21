(() => {
  const destinations = [
    {
      id: "singapore", name: "Singapore", city: "SINGAPORE", country: "Singapore",
      pillLabel: "📍 Singapore, Singapore", spots: "Marina Bay Gardens",
      description: "Garden paths above the city. Hawker flavours around the corner. A small island with a world of possibilities.",
      bgImage: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=2400&q=85",
      cardImage: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=600&h=850&q=80",
    },
    {
      id: "bali", name: "Bali", city: "BALI", country: "Indonesia",
      pillLabel: "📍 Bali, Indonesia", spots: "Ubud Uluwatu",
      description: "Emerald rice terraces, ocean breezes and temples above the waves. Slow down and discover your own island rhythm.",
      bgImage: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=2400&q=85",
      cardImage: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&h=850&q=80",
    },
    {
      id: "yangon", name: "Yangon", city: "YANGON", country: "Myanmar",
      pillLabel: "📍 Yangon, Myanmar", spots: "RGN YGN Shwedagon Bogyoke",
      description: "Golden pagodas reflecting the evening sun, colonial streets, and authentic heritage waiting around every corner.",
      bgImage: "https://images.unsplash.com/photo-1547970810-dc1eac37d174?auto=format&fit=crop&w=2400&q=85",
      cardImage: "https://images.unsplash.com/photo-1547970810-dc1eac37d174?auto=format&fit=crop&w=600&h=850&q=80",
    },
    {
      id: "bangkok", name: "Bangkok", city: "BANGKOK", country: "Thailand",
      pillLabel: "📍 Bangkok, Thailand", spots: "Wat Arun Grand Palace",
      description: "Golden temples, riverside sunsets and unforgettable street food. Find your own rhythm in Thailand’s vibrant capital.",
      bgImage: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=2400&q=85",
      cardImage: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=600&h=850&q=80",
    },
    {
      id: "hanoi", name: "Hanoi", city: "HANOI", country: "Vietnam",
      pillLabel: "📍 Hanoi, Vietnam", spots: "Old Quarter Hoan Kiem",
      description: "Lakeside mornings, fragrant coffee and lantern-lit lanes. Wander the Old Quarter and savour Vietnam’s timeless capital.",
      bgImage: "https://images.unsplash.com/photo-1509030450996-dd1a26dda07a?auto=format&fit=crop&w=2400&q=85",
      cardImage: "https://images.unsplash.com/photo-1509030450996-dd1a26dda07a?auto=format&fit=crop&w=600&h=850&q=80",
    },
  ];
  const el = id => document.getElementById(id);
  const layers = [...document.querySelectorAll(".destination-backdrop")];
  let active = 0, layer = 0, sequence = 0;
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem("packswift.destination-ideas") || "[]"); if (!Array.isArray(saved)) saved = []; } catch {}
  const image = destination => destination.bgImage;
  function updateSave() {
    const chosen = saved.includes(destinations[active].id);
    el("slider-save").setAttribute("aria-pressed", String(chosen));
    el("slider-save").setAttribute("aria-label", `${chosen ? "Remove" : "Save"} ${destinations[active].name} ${chosen ? "from" : "as"} an idea on this device`);
    el("slider-save").textContent = chosen ? "♥" : "♡";
  }
  function cards() {
    const strip = el("destination-thumbnails"); strip.replaceChildren();
    for (let offset = 1; offset < destinations.length; offset++) {
      const index = (active + offset) % destinations.length, destination = destinations[index];
      const card = document.createElement("button"); card.type = "button"; card.className = "destination-thumbnail"; card.setAttribute("aria-label", `Explore ${destination.name}, ${destination.country}`);
      const img = document.createElement("img"); img.src = destination.cardImage; img.alt = ""; img.loading = "lazy";
      const copy = document.createElement("span"), subtitle = document.createElement("small"), title = document.createElement("strong");
      subtitle.textContent = destination.country; title.textContent = destination.name; copy.append(subtitle, title); card.append(img, copy);
      card.addEventListener("click", () => select(index, true)); strip.append(card);
    }
    strip.scrollLeft = 0;
  }
  async function select(index, focus = false) {
    const token = ++sequence, destination = destinations[index];
    const preload = new Image(); preload.src = image(destination);
    try { await preload.decode(); } catch { el("slider-feedback").textContent = "Destination photo unavailable. Please try another."; return; }
    if (token !== sequence) return;
    const next = 1 - layer; layers[next].src = image(destination); layers[next].classList.add("is-visible"); layers[layer].classList.remove("is-visible"); layer = next; active = index;
    el("slider-location").textContent = destination.pillLabel;
    el("slider-title").textContent = destination.city; el("slider-description").textContent = destination.description;
    el("slider-plan").href = `/trip-planner?destination=${encodeURIComponent(destination.name)}`;
    el("slider-position").textContent = `${String(index + 1).padStart(2, "0")} / ${String(destinations.length).padStart(2, "0")}`;
    const story = document.querySelector(".destination-story"); story.classList.remove("story-enter"); void story.offsetWidth; story.classList.add("story-enter");
    el("slider-feedback").textContent = ""; updateSave(); cards();
    if (focus) { el("slider-title").tabIndex = -1; el("slider-title").focus({ preventScroll: true }); }
  }
  el("slider-next").addEventListener("click", () => select((active + 1) % destinations.length));
  el("slider-previous").addEventListener("click", () => select((active - 1 + destinations.length) % destinations.length));
  el("slider-save").addEventListener("click", () => {
    const id = destinations[active].id, exists = saved.includes(id);
    const next = exists ? saved.filter(value => value !== id) : [...saved, id];
    try { localStorage.setItem("packswift.destination-ideas", JSON.stringify(next)); saved = next; updateSave(); el("slider-feedback").textContent = exists ? "Idea removed from this device." : "Saved as an idea on this device—not a saved trip."; }
    catch { el("slider-feedback").textContent = "This browser could not save the idea."; }
  });
  const search = el("destination-slider-search"), results = el("slider-search-results");
  // Use the shared worldwide catalog, with offline coverage for popular regional cities.
  let catalog = [...destinations,
    { name: "Phuket", country: "Thailand", spots: "HKT Patong beaches" },
    { name: "Chiang Mai", country: "Thailand", spots: "CNX Doi Suthep" },
    { name: "Da Nang", country: "Vietnam", spots: "DAD My Khe Golden Bridge" },
    { name: "Kuala Lumpur", country: "Malaysia", spots: "KUL Petronas" },
  ];
  const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  let highlighted = -1;
  function closeSearch() {
    results.hidden = true;
    search.setAttribute("aria-expanded", "false");
    search.removeAttribute("aria-activedescendant");
    highlighted = -1;
  }
  function chooseDestination(destination) {
    closeSearch();
    search.value = destination.name;
    const index = destinations.findIndex(item => normalize(item.name) === normalize(destination.name));
    if (index >= 0) select(index, true);
    else location.assign(`/trip-planner?destination=${encodeURIComponent(destination.name)}`);
  }
  function renderSearch() {
    const query = normalize(search.value.trim());
    results.replaceChildren(); closeSearch();
    if (!query) { el("slider-search-status").textContent = ""; return; }
    const matches = catalog.filter(item => normalize(`${item.name} ${item.country} ${item.spots || ""} ${(item.attractions || []).join(" ")}`).includes(query))
      .sort((a, b) => Number(normalize(b.name).startsWith(query)) - Number(normalize(a.name).startsWith(query)))
      .slice(0, 8);
    for (const [index, destination] of matches.entries()) {
      const button = document.createElement("button");
      button.type = "button"; button.tabIndex = -1; button.id = `destination-option-${index}`;
      button.setAttribute("role", "option"); button.setAttribute("aria-selected", "false");
      const title = document.createElement("strong"), detail = document.createElement("small");
      title.textContent = destination.name;
      detail.textContent = `${destination.country} · ${destinations.some(item => item.name === destination.name) ? "Explore destination" : "Plan a trip"}`;
      button.append(title, detail);
      button.addEventListener("click", () => chooseDestination(destination));
      results.append(button);
    }
    if (!matches.length) {
      const message = document.createElement("p"); message.textContent = "No matches. Try a city, country, or attraction."; results.append(message);
    }
    results.hidden = false; search.setAttribute("aria-expanded", "true");
    el("slider-search-status").textContent = `${matches.length} destination suggestions`;
  }
  search.addEventListener("input", renderSearch);
  search.addEventListener("focus", renderSearch);
  search.addEventListener("keydown", event => {
    if (event.key === "Escape" || event.key === "Tab") { closeSearch(); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); if (results.hidden) renderSearch();
      const options = [...results.querySelectorAll("button")]; if (!options.length) return;
      highlighted = (highlighted + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      options.forEach((option, index) => option.setAttribute("aria-selected", String(index === highlighted)));
      search.setAttribute("aria-activedescendant", options[highlighted].id);
      options[highlighted].scrollIntoView({ block: "nearest" });
    }
    if (event.key === "Enter" && !results.hidden) {
      event.preventDefault(); results.querySelectorAll("button")[Math.max(0, highlighted)]?.click();
    }
  });
  document.addEventListener("click", event => { if (!event.target.closest(".slider-search-wrap")) closeSearch(); });
  fetch("/data/destinations.json")
    .then(response => { if (!response.ok) throw new Error("Catalog unavailable"); return response.json(); })
    .then(data => {
      if (!Array.isArray(data)) return;
      const merged = new Map(catalog.map(item => [normalize(item.name), item]));
      data.filter(item => typeof item.name === "string" && typeof item.country === "string").forEach(item => {
        const key = normalize(item.name); merged.set(key, { ...merged.get(key), ...item });
      });
      catalog = [...merged.values()];
      if (document.activeElement === search) renderSearch();
    }).catch(() => { /* Regional suggestions remain usable if the catalog cannot load. */ });
  cards(); updateSave();
  const requested = new URLSearchParams(location.search).get("destination");
  if (requested) { const index = destinations.findIndex(d => d.id === requested.toLowerCase() || d.name.toLowerCase() === requested.toLowerCase()); if (index >= 0) select(index); }
})();
