import "./destination-currency.js";
import "../../public/js/costEngine.js";
// One matrix is shared with the browser to prevent offline/online drift.
export const { destinations, calculateTripEstimate } = globalThis.PackSwiftCostEngine;
