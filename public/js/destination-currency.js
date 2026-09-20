/* Shared by browser and backend; entered amounts remain in local units. */
globalThis.PackSwiftCurrency = (() => {
  const currencies = { USD: { symbol: "$", suggested: 1500 }, THB: { symbol: "฿", suggested: 15000 }, EUR: { symbol: "€", suggested: 1500 }, JPY: { symbol: "¥", suggested: 150000 }, SGD: { symbol: "S$", suggested: 2000 }, MMK: { symbol: "Ks", suggested: 2000000 }, CNY: { symbol: "¥", suggested: 10000 } };
  const aliases = { THB: ["bangkok", "bkk", "dmk", "thailand", "phuket", "chiang mai", "pattaya"], EUR: ["paris", "france"], JPY: ["tokyo", "japan", "tyo", "hnd", "nrt", "osaka", "kyoto"], SGD: ["singapore", "sin"], MMK: ["yangon", "myanmar", "burma", "ygn", "rgn", "mandalay", "bagan"], CNY: ["china", "beijing", "shanghai"] };
  function resolve(destination) {
    const text = (typeof destination === "object" ? [destination?.name, destination?.country].filter(Boolean).join(" ") : String(destination || "")).toLowerCase().replace(/[^a-z]+/g, " ").trim();
    const code = Object.keys(aliases).find(code => aliases[code].some(alias => ` ${text} `.includes(` ${alias} `))) || "USD";
    return { code, ...currencies[code] };
  }
  function formatCurrency(amount, destination) {
    return new Intl.NumberFormat("en", { style: "currency", currency: resolve(destination).code, currencyDisplay: "code" }).format(Number(amount) || 0);
  }
  return { resolve, formatCurrency, currencies };
})();
