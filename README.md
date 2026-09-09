# PackSwift

PackSwift is an AI-powered personal travel assistant built with Node.js,
Express, Vanilla JavaScript, HTML, CSS, and MySQL. It helps travellers turn an
idea into a practical trip by combining destination discovery, realistic budget
guidance, weather-aware recommendations, attractions, itineraries, cultural and
entry guidance, and smart packing preparation in one calm interface.

PackSwift is not a booking, shopping, payment, insurance-sales, or order
platform. Flight routes and accommodation appear only as planning and
preparation guidance. The product is designed to make independent travel easier
and help travellers discover destinations around the world responsibly.

## Requirements

- Node.js 22.13 or newer
- MySQL 8 or newer (XAMPP MySQL is supported)
- npm

## Run locally with VS Code and XAMPP

For a guided macOS setup, see
[`docs/VSCODE_XAMPP_SETUP.md`](docs/VSCODE_XAMPP_SETUP.md).

1. Start MySQL in XAMPP.
2. Copy the environment template and add your local values:

   ```sh
   cp .env.example .env
   ```

   ```dotenv
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=packswift
   JWT_SECRET=replace-this-with-a-private-secret-at-least-32-characters
   GEMINI_API_KEY=your-server-side-gemini-key
   GOOGLE_PLACES_API_KEY=your-server-side-google-places-key
   EXCHANGERATE_API_KEY=your-server-side-exchange-rate-key
   ```

3. Install, initialize, and start:

   ```sh
   npm install
   npm run db:init
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000). Do not open HTML files
   through a `file://` address because authentication and APIs require Express.

`npm run db:init` creates or updates the database, loads the destination
catalog, and removes retired commerce tables. Sample accounts are never loaded
automatically. Run `npm run db:seed` only when you intentionally want labelled
demonstration data.

## Main capabilities

- MySQL registration and login with bcrypt password hashes and secure JWT
  cookies
- AI Travel Concierge with context-aware trip recommendations and one-click
  planner handoff
- Worldwide destination discovery with Google Places integration and a MySQL
  metadata cache
- Route-, duration-, traveller-, and currency-aware budget guidance
- Live trip preview with tailored attractions and replaceable recommendations
- Day-by-day itinerary generation and saved trip management
- Weather-aware packing lists and preparation checklists
- Cultural guidance, destination knowledge, and official entry-rule links
- Contact and feedback messages stored in MySQL
- Responsive, accessible light/dark/system themes

## Planning APIs

Public planning and discovery:

```text
POST /api/ai/chat
GET  /api/destinations?search=Yangon
GET  /api/destinations/:slug/insights
POST /api/activities/recommend
GET  /api/activities/photo/:placeId
POST /api/trips/analyze
```

Authenticated, trip-owned planning:

```text
GET    /api/trips/:tripId
POST   /api/trips/:tripId/timeline
GET    /api/trips/:tripId/packing-context
GET    /api/trips/:tripId/packing-list
POST   /api/trips/:tripId/packing-list
PATCH  /api/trips/:tripId/packing-list/:itemId
GET    /api/profile
GET    /api/saved-trips
POST   /api/saved-trips
PATCH  /api/saved-trips/:id
DELETE /api/saved-trips/:id
```

The Google Places key stays server-side. PackSwift stores durable Place IDs and
search context but resolves Google photo resources live. Without a configured
key, the app falls back to its bundled worldwide destination catalog.

## Updating an existing database

The normal command is:

```sh
npm run db:init
```

For manual migration workflows, run
`database/migrations/019_remove_commerce_modules.sql` after your earlier
migrations. It drops the retired order, booking, gear-purchase, payment, and
expense tables and converts checklist assistant actions to Concierge guidance.

## Validation

```sh
npm test
```

Always run PackSwift through `npm start` or `npm run dev`; authentication,
MySQL persistence, AI responses, and external travel APIs do not work from a
standalone HTML file.
