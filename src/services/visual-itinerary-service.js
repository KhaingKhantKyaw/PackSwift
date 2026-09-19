import { isGooglePlacesConfigured, searchGooglePlacesPage } from "./google-places-service.js";

export const itineraryStyles = {
  "Family with Kids": { query: "family friendly parks zoos and museums", types: ["park", "zoo", "museum", "aquarium", "amusement_park"], stay: "90–120 minutes", count: 3 },
  "Food & Culinary": { query: "top rated local food markets street food and restaurants", types: ["restaurant", "market", "food", "cafe"], stay: "45–75 minutes", count: 4 },
  "Culture & Heritage": { query: "historic landmarks temples and cultural museums", types: ["museum", "historical_landmark", "place_of_worship", "hindu_temple", "buddhist_temple", "tourist_attraction"], stay: "60–120 minutes", count: 3 },
  "Solo / Aesthetic": { query: "scenic viewpoints gardens and beautiful cafes", types: ["cafe", "park", "tourist_attraction", "observation_deck"], stay: "45–90 minutes", count: 4 },
  "Budget / Backpacker": { query: "free parks public markets and low cost sights", types: ["park", "market", "tourist_attraction", "museum"], stay: "45–90 minutes", count: 3 },
};

function distance(a, b) {
  if (!a || !b) return Infinity;
  const rad = x => x * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude), dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export async function generateVisualItinerary(input, dependencies = {}) {
  const style = itineraryStyles[input.userType];
  const search = dependencies.search || searchGooglePlacesPage;
  const configured = dependencies.configured ?? isGooglePlacesConfigured();
  let places = [], fallbackReason = "API key not configured";
  if (configured) {
    try {
      const result = await search({ destination: input.destination, searchQuery: `${style.query}${input.budgetCategory === "budget" ? " affordable low cost" : ""} in ${input.destination}`, limit: 20, itineraryDetails: true });
      places = result.activities || [];
      fallbackReason = "No matching places returned";
    } catch { fallbackReason = "Live provider temporarily unavailable or quota exceeded"; }
  }
  const cheap = input.budgetCategory === "budget" || input.userType === "Budget / Backpacker";
  places = [...new Map(places.map(place => [place.providerPlaceId, place])).values()]
    .filter(p => !cheap || !["PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"].includes(p.priceLevel))
    .sort((a, b) => {
      const score = p => (p.types?.some(t => style.types.includes(t)) ? 10 : 0) + (p.rating || 0) + (cheap && ["PRICE_LEVEL_FREE", "PRICE_LEVEL_INEXPENSIVE"].includes(p.priceLevel) ? 8 : 0);
      return score(b) - score(a);
    });
  const mock = !places.length;
  const days = [];
  const perDay = input.pace === "relaxed" ? 2 : input.pace === "packed" ? 5 : style.count;
  for (let day = 1; day <= input.duration; day++) {
    const activities = [];
    for (let i = 0; i < perDay; i++) {
      if (!mock && !places.length) break;
      if (mock) {
        activities.push({ stopNumber: i + 1, title: `Sample ${input.userType} stop ${i + 1} · ${input.destination}`, imageUrl: "", hours: "Sample — verify locally", ticket: "Sample — price not verified", stay: `${style.stay} (suggested)`, isSample: true });
        continue;
      }
      const previous = activities.at(-1)?.coordinates;
      if (previous) places.sort((a, b) => distance(previous, a.coordinates) - distance(previous, b.coordinates));
      const place = places.shift();
      const ticket = place.priceLevel === "PRICE_LEVEL_FREE" ? "Provider price level: free; confirm admission" : place.priceLevel ? `${place.priceRange} price level — not a ticket quote` : "Admission / meal cost unverified";
      activities.push({ stopNumber: i + 1, placeId: place.providerPlaceId, title: place.title, imageUrl: place.hasPhoto ? place.imageUrl : "", imageCredit: place.imageCredit, imageSourceUrl: place.imageSourceUrl, googleMapsUri: place.googleMapsUri, rating: place.rating, coordinates: place.coordinates, hours: place.openingHours || "Opening hours not supplied", ticket, stay: `${style.stay} (suggested)`, openingHours: place.openingHours, ticketPrice: ticket, suggestedStay: `${style.stay} (suggested)` });
    }
    days.push({ day, activities });
  }
  return { success: true, source: mock ? "sample" : "google_places", message: mock ? `Sample itinerary only: ${fallbackReason}.` : "Places from Google Maps. Nearby-first ordering uses straight-line distance, not verified transit routes. Hours describe the current week; verify for your travel dates. Prices and visit durations are guidance.", days, stops: days[0]?.activities || [], partial: !mock && days.some(d => d.activities.length < perDay) };
}
