# Connected planning upgrade

## Implemented
- Profile personality summary derived only from saved selections.
- Account-saved pace, hours, walking comfort and optional preference fields.
- Manual wishlist with destination links; reusable packing presets.
- Optional guest-friendly guided planning; existing quick form preserved.
- Explicit application of saved preferences; no silent defaults.
- Pace, short walks and rest-break preferences limit itinerary activity load.
- Typical-day length limits load; this is a planning heuristic, not routed timing.
- Laundry and custom essentials affect packing suggestions.
- Budget worksheet with unknown/partial states, optional reserve and limits.
- Search option to budget handoff asks the user to verify whole-trip amounts.
- Changing trip context or currency invalidates costs until cleared.
- Printable planning summary and saved-trip travel-day reminders.
- Existing sign-in and owned-trip access controls retained.

## Not yet implemented
- Automatic lowest practical flight/stay selection with verified group totals,
  room occupancy, baggage, fees and currency conversion.
- Date-specific weather forecasts and automatic weather alternatives.
- Verified accessibility, crowd, diet and accommodation filtering.
- Route-time optimisation using actual routing results.
- Revocable read-only sharing links.
- After-trip feedback that proposes preference updates.
- Photo-based wishlist browsing and the full concept-design layout.

Preference fields not listed as connected above are stored for future integration;
they do not claim to filter or verify provider results.

## Verification
- Targeted model tests: planning-model, place-search, itinerary-arrival,
  itinerary-preferences and live-review.
- Chrome checks: guided flow, profile editor, wishlist and preset actions,
  desktop/mobile horizontal overflow. Account responses were mocked; no user
  account was modified during browser tests.
- Print is a manual PDF/export action, not a service-worker offline application.
