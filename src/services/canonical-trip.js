import '../../public/js/canonical-itinerary.js';
import {placeReference,hydrateSelected} from './place-search-service.js';
export const canonical=globalThis.PackSwiftCanonical;
export function storedItinerary(plan){
 return {...plan,selectedPlaces:plan.selectedPlaces.map(placeReference)};
}
export async function displayItinerary(plan,destination){
 return {...plan,selectedPlaces:await hydrateSelected(plan.selectedPlaces,destination)};
}
