(() => {
  const supportedCurrencies = [
    { code: "THB", symbol: "฿", flag: "🇹🇭" },
    { code: "MMK", symbol: "Ks", flag: "🇲🇲" },
    { code: "CNY", symbol: "¥", flag: "🇨🇳" },
    { code: "USD", symbol: "$", flag: "🇺🇸" },
    { code: "SGD", symbol: "S$", flag: "🇸🇬" },
  ];

  function optionMarkup(selected) {
    return supportedCurrencies.map((currency) =>
      `<option value="${currency.code}"${currency.code === selected ? " selected" : ""}>${currency.flag} ${currency.code} (${currency.symbol})</option>`,
    ).join("");
  }

  function weatherIcon(code) {
    if (Number(code) >= 95) return "cloud-lightning";
    if (Number(code) >= 51) return "cloud-rain";
    return "sun";
  }

  function renderWidget(widget, payload) {
    const { weather, currency, preferredCurrency } = payload;
    const preferred = supportedCurrencies.some((item) => item.code === preferredCurrency)
      ? preferredCurrency
      : "THB";
    widget.innerHTML = `
      <div class="trip-weather-head">
        <span class="trip-tool-icon"><i data-lucide="${weatherIcon(weather.weatherCode)}"></i></span>
        <div><p class="eyebrow">Live destination weather</p><h2 data-weather-destination></h2></div>
      </div>
      <div class="trip-weather-reading">
        <strong data-weather-temperature></strong>
        <span><b data-weather-condition></b><small><i data-lucide="droplets"></i> <span data-weather-humidity></span></small></span>
      </div>
      <div class="trip-weather-alert" data-weather-alert hidden><i data-lucide="cloud-rain"></i><span></span></div>
      <div class="trip-currency-tool">
        <div class="trip-tool-title"><span><i data-lucide="circle-dollar-sign"></i> Currency converter</span><small data-rate-source></small></div>
        <label><span>From</span><div><input data-currency-from-amount inputmode="decimal" value="100"><select data-currency-from>${optionMarkup(preferred)}</select></div></label>
        <button class="currency-swap" type="button" data-currency-swap aria-label="Swap currencies"><i data-lucide="arrow-left-right"></i></button>
        <label><span>To</span><div><input data-currency-to-amount inputmode="decimal" readonly><select data-currency-to>${optionMarkup(preferred === "USD" ? "THB" : "USD")}</select></div></label>
        <small data-mid-market-rate></small>
      </div>`;

    widget.querySelector("[data-weather-destination]").textContent = weather.destination;
    widget.querySelector("[data-weather-temperature]").textContent = weather.temperatureC == null
      ? "—"
      : `${Math.round(weather.temperatureC)}°C`;
    widget.querySelector("[data-weather-condition]").textContent = weather.condition;
    widget.querySelector("[data-weather-humidity]").textContent = weather.humidity == null
      ? "Humidity unavailable"
      : `${weather.humidity}% humidity`;
    const alert = widget.querySelector("[data-weather-alert]");
    if (weather.alert) {
      alert.hidden = false;
      alert.classList.toggle("is-heat", weather.alert.type === "heat");
      alert.querySelector("span").textContent = weather.alert.message;
    }
    widget.querySelector("[data-rate-source]").textContent = currency.source === "live" ? "Live mid-market rate" : "Reference rate";

    const fromAmount = widget.querySelector("[data-currency-from-amount]");
    const toAmount = widget.querySelector("[data-currency-to-amount]");
    const fromCurrency = widget.querySelector("[data-currency-from]");
    const toCurrency = widget.querySelector("[data-currency-to]");
    const rateText = widget.querySelector("[data-mid-market-rate]");
    const convert = () => {
      const fromRate = Number(currency.rates[fromCurrency.value]);
      const toRate = Number(currency.rates[toCurrency.value]);
      const amount = Number(fromAmount.value) || 0;
      const rate = toRate / fromRate;
      toAmount.value = (amount * rate).toLocaleString("en", { maximumFractionDigits: 2 });
      rateText.textContent = `1 ${fromCurrency.value} = ${rate.toFixed(4)} ${toCurrency.value}`;
    };
    fromAmount.addEventListener("input", convert);
    fromCurrency.addEventListener("change", convert);
    toCurrency.addEventListener("change", convert);
    widget.querySelector("[data-currency-swap]").addEventListener("click", () => {
      [fromCurrency.value, toCurrency.value] = [toCurrency.value, fromCurrency.value];
      convert();
    });
    convert();
    window.lucide?.createIcons({ attrs: { "aria-hidden": "true" } });
  }

  async function initializeWidget(widget) {
    const tripId = new URLSearchParams(window.location.search).get("trip");
    if (!tripId) {
      widget.textContent = "Choose a saved trip to load weather and currency tools.";
      return;
    }
    try {
      const payload = await window.PackSwift.api(`/api/trip-tools?trip=${encodeURIComponent(tripId)}`);
      renderWidget(widget, payload);
      if (payload.weather.alert) {
        document.dispatchEvent(new CustomEvent("packswift:checklist-refresh"));
      }
    } catch (error) {
      widget.innerHTML = "";
      const message = document.createElement("p");
      message.className = "status-banner status-error";
      message.textContent = error.message;
      widget.append(message);
    }
  }

  window.PackSwiftTripTools = { initializeWidget };
  window.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-trip-tools]").forEach(initializeWidget);
  });
})();
