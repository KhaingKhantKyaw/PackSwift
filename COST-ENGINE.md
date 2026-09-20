# Internal Destination Cost Engine

Edit `public/js/costEngine.js` to maintain the single benchmark matrix. The backend helper `src/services/costEngine.js` imports the same implementation, preventing frontend/backend drift.

These are illustrative planning benchmarks, not verified live rates or guaranteed minimums. Country aliases use the representative city's benchmark. Unknown locations use a clearly marked generic currency benchmark. Update the matrix when your team obtains reliable cost evidence.

`calculateTripEstimate(destination, startDate, endDate, travellers, travelStyle)` accepts ISO dates and budget/comfort/luxury. It counts nights (departure excluded), applies each night's month multiplier, and adds 15% only on Friday/Saturday. Daily average means per traveller per night. Demand compares the combined seasonal/weekend index with the base benchmark. Flights, visas, insurance and purchases are excluded. Monthly assumptions do not model specific festivals or event dates.

POST `/api/cost-estimate` with:
```json
{"destination":"Bangkok","startDate":"2027-01-08","endDate":"2027-01-11","travellers":2,"style":"comfort"}
```
Expected: THB 19,800; 3 nights; 2 weekend nights; THB 3,300 per person/night; Peak Season.

The current planning-priority controls map Make the trip possible / Fixed budget to Budget, Best value / Comfort first to Comfort, and Luxury to Luxury. Date/destination/style/group changes refill the budget; manual edits are kept until those selections change. A delayed response never overwrites a newer manual budget edit.

No API keys or schema migration are needed. The older `/api/budget-baseline` remains for compatibility but the planner no longer calls Numbeo. Exchange rates do not set these local-currency benchmarks.

Restart with `npm start`, hard-refresh `/trip-planner`, then test January versus July, Friday/Saturday versus weekdays, and different traveller counts. Run `npm test` for calculation regression checks.
