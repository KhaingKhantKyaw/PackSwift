import { readFile } from "node:fs/promises";

const countryCodes = Object.freeze({
  Australia: "AU",
  Brazil: "BR",
  Canada: "CA",
  China: "CN",
  Egypt: "EG",
  France: "FR",
  Germany: "DE",
  Greece: "GR",
  India: "IN",
  Indonesia: "ID",
  Italy: "IT",
  Japan: "JP",
  Kenya: "KE",
  Malaysia: "MY",
  Mexico: "MX",
  Morocco: "MA",
  Myanmar: "MM",
  Netherlands: "NL",
  "New Zealand": "NZ",
  Philippines: "PH",
  Portugal: "PT",
  Qatar: "QA",
  "Saudi Arabia": "SA",
  Singapore: "SG",
  "South Africa": "ZA",
  "South Korea": "KR",
  Spain: "ES",
  Switzerland: "CH",
  Thailand: "TH",
  UAE: "AE",
  USA: "US",
  Vietnam: "VN",
});

const primaryAirports = Object.freeze({
  amsterdam: "AMS",
  athens: "ATH",
  auckland: "AKL",
  bagan: "NYU",
  bali: "DPS",
  bangkok: "BKK",
  barcelona: "BCN",
  beijing: "PEK",
  berlin: "BER",
  cairo: "CAI",
  "cape-town": "CPT",
  "chiang-mai": "CNX",
  doha: "DOH",
  dubai: "DXB",
  hanoi: "HAN",
  jaipur: "JAI",
  "kuala-lumpur": "KUL",
  lisbon: "LIS",
  mandalay: "MDL",
  marrakech: "RAK",
  "mexico-city": "MEX",
  nairobi: "NBO",
  "new-york": "JFK",
  palawan: "PPS",
  paris: "CDG",
  phuket: "HKT",
  "rio-de-janeiro": "GIG",
  riyadh: "RUH",
  rome: "FCO",
  seoul: "ICN",
  singapore: "SIN",
  sydney: "SYD",
  tokyo: "HND",
  vancouver: "YVR",
  yangon: "RGN",
  zurich: "ZRH",
});

function catalogOverview(destination) {
  const highlights = destination.attractions.slice(0, 3).join(", ");
  return `${destination.name} is a destination in ${destination.region} known for ${highlights}.`;
}

export async function readDestinationCatalog() {
  const source = await readFile(
    new URL("../public/data/destinations.json", import.meta.url),
    "utf8",
  );
  return JSON.parse(source);
}

export async function seedDestinations(connection) {
  const catalog = await readDestinationCatalog();

  for (const destination of catalog) {
    await connection.execute(
      `INSERT INTO destinations
        (slug, destination_type, name, city_name, country_name, country_code,
         canonical_overview, primary_airport_code, source_name, source_reference)
       VALUES (?, 'city', ?, ?, ?, ?, ?, ?, 'PackSwift catalog', ?)
       ON DUPLICATE KEY UPDATE
         destination_type = VALUES(destination_type),
         name = VALUES(name),
         city_name = VALUES(city_name),
         country_name = VALUES(country_name),
         country_code = VALUES(country_code),
         canonical_overview = VALUES(canonical_overview),
         primary_airport_code = VALUES(primary_airport_code),
         source_name = VALUES(source_name),
         source_reference = VALUES(source_reference)`,
      [
        destination.slug,
        destination.name,
        destination.name,
        destination.country,
        countryCodes[destination.country] || null,
        catalogOverview(destination),
        primaryAirports[destination.slug] || destination.code || null,
        destination.slug,
      ],
    );
  }

  return catalog.length;
}
