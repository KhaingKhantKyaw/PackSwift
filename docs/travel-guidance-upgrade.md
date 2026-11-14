# Travel guidance and trip essentials

Travel experience appears directly before Trip Comfort. Neither experience is selected by default. A first trip suggests More guidance; previous experience suggests Quick view. An explicit view choice overrides that suggestion until the user chooses “Use experience default.” This setting changes explanation density only, never the itinerary, pace, spending style or actual packing suggestions.

Packing & Trip Essentials keeps the existing panel height and offers three keyboard-accessible tabs:

- What to pack: existing editable categories, per-traveler/shared quantities, custom items, removal/undo, packed progress and trip-date forecast coverage.
- How to pack: practical expandable tips, including activity, family and available-weather context. Carrier-specific rules are not invented.
- Before you go: five user-confirmed preparation checks, with shortcuts to bookings, arrival, printable summary and weather. Preparation is separate from packed progress and is not travel clearance.

Guest tab drafts and the existing 20-minute sign-in handoff carry the same named hidden field as account-saved trips. The backend normalizes the state; no schema migration is required. Booking, document, arrival, offline and forecast checks are tied to relevant trip facts. A changed route/date/group/arrival reopens affected checks. Editing the saved itinerary reopens the offline-copy check. More guidance / Quick view never marks a task complete or makes extra provider requests.

Applying saved profile preferences explicitly also applies the saved Planning support preference. It does not rewrite the profile or infer travel experience. Print / save summary reflects the current preparation checks.

Verification: focused unit tests, browser tests for draft restore, keyboard navigation, both themes, equal-height responsive panels, unchanged itinerary/packing choices, and existing booking/activities/editable-itinerary flows. Real database persistence is checked using temporary data in a rolled-back transaction. The legacy test suite has 34 pre-existing source/layout assertion failures; these are not introduced by this upgrade.
