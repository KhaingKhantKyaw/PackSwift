import { currencyRatesToUsd } from "./travel-planner.js";

const weatherLabels = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Foggy",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  80: "Rain showers",
  81: "Rain showers",
  82: "Heavy showers",
  95: "Thunderstorm",
  96: "Thunderstorm",
  99: "Thunderstorm",
};

function fallbackRates() {
  const usdPerUnit = currencyRatesToUsd;
  return Object.fromEntries(
    Object.entries(usdPerUnit).map(([code, rate]) => [code, Number((1 / rate).toFixed(6))]),
  );
}

export async function getCurrencyRates(fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(6000),
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error("Currency provider unavailable");
    const payload = await response.json();
    const supported = ["USD", "THB", "MMK", "CNY", "SGD"];
    const rates = Object.fromEntries(
      supported.map((code) => [code, Number(payload.rates?.[code])]),
    );
    if (Object.values(rates).some((value) => !Number.isFinite(value) || value <= 0)) {
      throw new Error("Currency provider returned incomplete rates");
    }
    return { base: "USD", rates, updatedAt: payload.time_last_update_utc || null, source: "live" };
  } catch {
    return { base: "USD", rates: fallbackRates(), updatedAt: null, source: "fallback" };
  }
}

export async function getDestinationWeather(destination, fetchImpl = globalThis.fetch) {
  try {
    const lookup = await fetchImpl(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=en&format=json`,
      { signal: AbortSignal.timeout(6000), headers: { accept: "application/json" } },
    );
    if (!lookup.ok) throw new Error("Destination lookup unavailable");
    const place = (await lookup.json()).results?.[0];
    if (!place) throw new Error("Destination coordinates unavailable");
    const forecast = await fetchImpl(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      "&current=temperature_2m,relative_humidity_2m,weather_code" +
      "&daily=weather_code,temperature_2m_max,precipitation_probability_max" +
      "&timezone=auto&forecast_days=7",
      { signal: AbortSignal.timeout(6000), headers: { accept: "application/json" } },
    );
    if (!forecast.ok) throw new Error("Weather provider unavailable");
    const payload = await forecast.json();
    const rainProbability = Math.max(...(payload.daily?.precipitation_probability_max || [0]));
    const high = Math.max(...(payload.daily?.temperature_2m_max || [Number(payload.current?.temperature_2m) || 0]));
    const alert = rainProbability >= 60
      ? { type: "rain", message: "Rain is likely during this trip — rain protection was added to your checklist." }
      : high >= 36
        ? { type: "heat", message: "Extreme heat is possible — hydration and sun protection are recommended." }
        : null;
    return {
      destination: `${place.name}${place.country ? `, ${place.country}` : ""}`,
      temperatureC: Number(payload.current?.temperature_2m || 0),
      humidity: Number(payload.current?.relative_humidity_2m || 0),
      weatherCode: Number(payload.current?.weather_code || 0),
      condition: weatherLabels[payload.current?.weather_code] || "Current conditions",
      rainProbability,
      daily: (payload.daily?.time || []).map((date, index) => ({
        date,
        weatherCode: payload.daily.weather_code?.[index],
        highC: payload.daily.temperature_2m_max?.[index],
        rainProbability: payload.daily.precipitation_probability_max?.[index],
      })),
      alert,
      source: "Open-Meteo",
    };
  } catch {
    return {
      destination,
      temperatureC: null,
      humidity: null,
      weatherCode: null,
      condition: "Forecast temporarily unavailable",
      rainProbability: null,
      daily: [],
      alert: null,
      source: "unavailable",
    };
  }
}
