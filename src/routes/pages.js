import { Router } from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(__dirname, "../../public");

export const pageRouter = Router();
pageRouter.get('/trips',(req,res)=>res.redirect(302,'/profile#dashboard-trips'));
pageRouter.get('/trips/:tripId',(req,res)=>res.sendFile(path.join(publicDirectory,'trip-hub.html')));
pageRouter.get('/trips/:tripId/:section',(req,res)=>{
  const tabs={overview:'overview',requirements:'help',itinerary:'itinerary',packing:'packing',budget:'budget',help:'help'};
  const tab=tabs[req.params.section];if(!tab)return res.status(404).sendFile(path.join(publicDirectory,'404.html'));
  res.redirect(302,'/trips/'+encodeURIComponent(req.params.tripId)+'?tab='+tab+(req.params.section==='requirements'?'#dashboard-entry':''));
});

const pages = new Map([
  ["/", "index.html"],
  ["/explore", "explore.html"],
  ["/trip-planner", "trip-planner.html"],
  ["/packing-list", "packing-list.html"],
  ["/my-trips", "my-trips.html"],
  ["/about", "about.html"],
  ["/help", "help.html"],
  ["/emergency-contacts", "emergency-contacts.html"],
  ["/login", "login.html"],
  ["/signup", "signup.html"],
  ["/profile", "profile.html"],
  ["/assist-trip", "assist-trip.html"],
  ["/trip-itinerary", "trip-itinerary.html"],
  ["/assist-visa", "assist-visa.html"],
]);

pageRouter.get(
  ["/assist-flight", "/assist-stay", "/assist-store", "/assist-shop", "/trip-expenses"],
  (request, response) => {
    response.redirect(302, "/trip-planner");
  },
);

pageRouter.get(["/community", "/community-feed"], (request, response) => {
  response.redirect(302, "/#discover");
});

pageRouter.get("/travel-guide", (request, response) => {
  const destination = String(request.query.destination || "").trim();
  const target = destination
    ? `/?destination=${encodeURIComponent(destination)}#discover`
    : "/#discover";
  response.redirect(302, target);
});

pageRouter.get("/contact", (request, response) => {
  response.redirect(302, "/help#contact");
});

for (const [route, file] of pages) {
  pageRouter.get(route, (request, response) => {
    response.sendFile(path.join(publicDirectory, file));
  });
}
