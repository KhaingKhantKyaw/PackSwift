(() => {
  const destinations = [
    { id: "bangkok", name: "Bangkok", country: "Thailand", spots: "Wat Arun Grand Palace", description: "Golden temples. River breezes. Streets that never stop surprising you. Find your own rhythm in Thailand’s vibrant capital." },
    { id: "paris", name: "Paris", country: "France", spots: "Eiffel Tower Louvre", description: "Slow mornings by the Seine, hidden courtyards and a little café around every corner. Make room for the unexpected." },
    { id: "tokyo", name: "Tokyo", country: "Japan", spots: "Shibuya Senso-ji", description: "Ancient shrines meet neon-lit streets. Follow your curiosity through tiny cafés, quiet gardens and unforgettable neighbourhoods." },
    { id: "bali", name: "Bali", country: "Indonesia", spots: "Ubud Uluwatu", description: "Green terraces, ocean air and sunsets worth slowing down for. Discover an island at your own pace." },
    { id: "singapore", name: "Singapore", country: "Singapore", spots: "Marina Bay Gardens", description: "Garden paths above the city. Hawker flavours around the corner. A small island with a world of possibilities." },
  ];
  const el = id => document.getElementById(id);
  const layers = [...document.querySelectorAll(".destination-backdrop")];
  let active = 0, layer = 0, sequence = 0;
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem("packswift.destination-ideas") || "[]"); if (!Array.isArray(saved)) saved = []; } catch {}
  const image = destination => `/images/destination-${destination.id}.jpg`;
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
      const img = document.createElement("img"); img.src = image(destination); img.alt = ""; img.loading = "lazy";
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
    el("slider-location").textContent = `⌖ ${destination.name}, ${destination.country}`;
    el("slider-title").textContent = destination.name.toUpperCase(); el("slider-description").textContent = destination.description;
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
  search.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase(); results.replaceChildren(); results.hidden = !query;
    if (!query) return;
    destinations.forEach((destination, index) => {
      if (!`${destination.name} ${destination.country} ${destination.spots}`.toLowerCase().includes(query)) return;
      const button = document.createElement("button"); button.type = "button"; button.textContent = `${destination.name} · ${destination.country}`;
      button.addEventListener("click", () => { select(index, true); results.hidden = true; search.value = ""; }); results.append(button);
    });
    if (!results.children.length) { const message = document.createElement("p"); message.textContent = "No featured matches. Use Plan Trip to explore another destination."; results.append(message); }
  });
  search.addEventListener("keydown", event => { if (event.key === "Escape") results.hidden = true; if (event.key === "ArrowDown") { event.preventDefault(); results.querySelector("button")?.focus(); } if (event.key === "Enter") results.querySelector("button")?.click(); });
  document.addEventListener("click", event => { if (!event.target.closest(".slider-search-wrap")) results.hidden = true; });
  cards(); updateSave();
  const requested = new URLSearchParams(location.search).get("destination");
  if (requested) { const index = destinations.findIndex(d => d.id === requested.toLowerCase() || d.name.toLowerCase() === requested.toLowerCase()); if (index >= 0) select(index); }
})();
