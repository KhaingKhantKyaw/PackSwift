import { Router } from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(__dirname, "../../public");

export const pageRouter = Router();

const pages = new Map([
  ["/", "index.html"],
  ["/trip-planner", "trip-planner.html"],
  ["/travel-guide", "travel-guide.html"],
  ["/packing-list", "packing-list.html"],
  ["/my-trips", "my-trips.html"],
  ["/about", "about.html"],
  ["/login", "login.html"],
  ["/signup", "signup.html"],
  ["/profile", "profile.html"],
  ["/assist-trip", "assist-trip.html"],
  ["/assist-flight", "assist-flight.html"],
  ["/assist-stay", "assist-stay.html"],
  ["/assist-store", "assist-store.html"],
  ["/assist-shop", "assist-store.html"],
  ["/trip-itinerary", "trip-itinerary.html"],
  ["/assist-visa", "assist-visa.html"],
  ["/trip-expenses", "trip-expenses.html"],
]);

pageRouter.get(["/community", "/community-feed"], (request, response) => {
  response.redirect(302, "/travel-guide");
});

pageRouter.get("/contact", (request, response) => {
  response.redirect(302, "/#support");
});

for (const [route, file] of pages) {
  pageRouter.get(route, (request, response) => {
    response.sendFile(path.join(publicDirectory, file));
  });
}
