# PackSwift

PackSwift is a minimalist personal travel planning assistant built with
Node.js, Express, Vanilla JavaScript, HTML, CSS, and MySQL. It recommends
worldwide destinations from budget and traveller context, interprets likely
weather, suggests attractions, generates itineraries and packing guidance,
stores account trip plans, and provides a focused travel community board.

## Requirements

- Node.js 22.13 or newer
- MySQL 8 or newer
- npm

## Local setup on macOS

For the complete Visual Studio Code and XAMPP workflow, including ready-made
VS Code tasks and debugging, see
[`docs/VSCODE_XAMPP_SETUP.md`](docs/VSCODE_XAMPP_SETUP.md).

1. Copy the environment template:

   ```sh
   cp .env.example .env
   ```

2. Edit `.env` with the local MySQL password and a private JWT secret of at
   least 32 characters:

   ```dotenv
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=packswift
   JWT_SECRET=replace-this-with-a-private-secret-at-least-32-characters
   GOOGLE_PLACES_API_KEY=your-server-side-google-places-key
   OPENAI_API_KEY=your-server-side-openai-key
   OPENAI_MODEL=gpt-4o-mini
   ```

3. Install packages, initialize the database, and start the application:

   ```sh
   npm install
   npm run db:init
   npm start
   ```

4. Open `http://localhost:3000`.

The initialization command creates the configured database and every required
table from `database/schema.sql`. It is safe to run again because all table
statements use `IF NOT EXISTS`. It also loads PackSwift's canonical worldwide
destination catalog. For an existing database, refresh only that catalog with:

```sh
npm run db:seed:destinations
```

## Optional sample seed data

Sample data is never loaded by the initialization command. To add two clearly
labelled demonstration accounts, compatible Tokyo travel-buddy plans, and one
travel-buddy post, run:

```sh
npm run db:seed
```

The seed command prints the demonstration credentials after it succeeds.

## Main capabilities

- Real MySQL registration and login with bcrypt password hashes
- JWT sessions in HTTP-only, same-site cookies and explicit logout
- Rate-limited login, input validation, HTML sanitization, and parameterized
  SQL queries
- Worldwide destination discovery across Asia, Europe, the Americas, Oceania,
  the Middle East, and Africa
- Budget normalization for USD, EUR, GBP, THB, SGD, MYR, JPY, KRW, AUD, CAD,
  CNY, INR, and MMK
- Recommendations shaped by destination, month, budget, traveller count, trip
  purpose, weather, demographics, interests, pace, and pets
- Account-backed trip save, view, and delete operations
- Travel community posts with search, likes, comments, and compatibility-based
  travel-buddy suggestions
- Contact messages stored in MySQL
- Community-derived destination insight cards with evidence counts and a
  PackSwift-only popularity calculation
- Airport-first, non-overlapping itinerary timelines with hotel transfer and
  destination-aware safety guidance
- Authenticated trip-owned packing-list APIs that preserve the exact saved
  destination without asking the traveller to enter it again
- A shared PackSwift Concierge with server-side OpenAI Responses API support,
  contextual trip guidance, rate limiting, and a built-in offline fallback

## Trip-planning API

Live attraction recommendations use Places API (New) when
`GOOGLE_PLACES_API_KEY` is configured. Enable Places API (New) and billing for
the key, restrict it to the Places API, and keep it in `.env` only. Without the
key, PackSwift automatically uses its MySQL/bundled destination catalog.

```text
POST /api/activities/recommend
GET  /api/activities/photo/:placeId
```

The recommendation body accepts `destination`, `travel_purpose`,
`travel_group`, `travel_pace`, `budget`, `days`, and `travelers`. Google place
names, ratings, descriptions, and photo resource names are refreshed live and
are not copied into MySQL. The database stores only durable Place IDs and
PackSwift request context in `destination_places_cache`.

Public destination discovery and insight routes:

```text
GET /api/destinations?search=Yangon
GET /api/destinations/yangon/insights
POST /api/trips/analyze
```

The following routes require the signed-in user's secure session and only
return trips owned by that user:

```text
GET  /api/trips/:tripId
POST /api/trips/:tripId/timeline
GET  /api/trips/:tripId/packing-context
GET  /api/trips/:tripId/packing-list
POST /api/trips/:tripId/packing-list
PATCH /api/trips/:tripId/packing-list/:itemId
POST /api/checkout/process
```

The packing context response includes the canonical display name, such as
`Yangon, Myanmar`, plus the trip dates, weather, duration, purpose, traveller
group, and pet context. The client should hand off only the saved `tripId`;
destination details are always read from MySQL to prevent stale or altered URL
values.

The universal checkout route accepts only `VISA`, `MASTERCARD`, or
`CREDIT_CARD` as the payment-method selection. It never accepts or stores card
numbers. The order, type-specific flight/hotel/gear record, and readiness item
update are committed in one MySQL transaction, with an automatic rollback if
any write fails.

## Currency reference

The recommendation engine converts every selected budget to USD before
comparing worldwide daily-cost reference data. Exchange values are explicitly
defined as indicative planning rates in
`src/services/travel-planner.js` and `public/js/trip-planner.js`; they are not
presented as live foreign-exchange quotations. For live rates, replace that
table with a trusted exchange-rate API and a cached update process.

## Database changes for an existing installation

For a database created before account and community support, apply migration
`database/migrations/002_accounts_community_contact.sql`. Then apply
`database/migrations/003_saved_trips.sql` for account-backed saved plans.
Apply `database/migrations/004_trip_planning_upgrade.sql` to add canonical
destinations, structured place reviews, community-derived insight snapshots,
airport and hotel trip context, and detailed itinerary timeline items.
Then apply migrations `005_trip_readiness.sql`, `006_ready_travel_status.sql`,
`007_orders.sql`, and `008_travel_shorts.sql` in that order for readiness
checklists, ready-trip status, assistant orders, and the vertical Trip Shorts
community feed. Then apply `009_planner_activities.sql` and
`010_universal_checkout.sql` for the live planner catalog and normalized
flight, hotel, and gear purchase records. The shorts migration also registers
the bundled example short.
Fresh installations should use `npm run db:init` instead.

## Validation

Run the production build and automated checks with:

```sh
npm test
```

Trip planning and device-only saved plans remain usable when MySQL is not
configured. Authentication, account trip storage, contact messages, profile
data, and the Trip Shorts community feed require the local Express server and
MySQL.
