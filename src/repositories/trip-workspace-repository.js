import {getDatabasePool} from '../config/database.js';
import {getOwnedTrip,listPackingItems,listTripTimeline} from './trip-repository.js';
import {tripDetails,workspaceProgress} from '../services/trip-workspace.js';
import {canonical,displayItinerary} from '../services/canonical-trip.js';

export async function getTripWorkspace(user,id,includeSelected=false) {
  const trip=await getOwnedTrip(user,id);if(!trip)return null;
  const workspace=trip.preferences.workspace || {revision:0,requirements:{},needs:[]};
  const packing=await listPackingItems(user,id);
  const details=tripDetails(trip),saved=trip.preferences.detailPlanning;
  let itinerary=trip.preferences.canonicalItinerary;
  if(!itinerary)itinerary=canonical.legacy(saved?.selected||[],await listTripTimeline(user,id),details.nights+1,saved?.itineraryPreferences);
  if(includeSelected)itinerary=await displayItinerary(itinerary,details.destination);
  return {tripId:id,details,workspace,timeline:canonical.rows(itinerary),itinerary,itineraryWarnings:canonical.conflicts(itinerary,saved?.itineraryPreferences||{}),packing,itineraryPreferences:saved?.itineraryPreferences||null,progress:workspaceProgress(trip,workspace,packing)};
}

// Shared by My Trips and Profile. Ownership is checked again by getTripWorkspace.
export async function getTripsForUser(userId){
 const [rows]=await getDatabasePool().execute('SELECT public_id FROM trip_sessions WHERE user_id=? ORDER BY updated_at DESC',[userId]);
 const trips=[];
 for(const row of rows){const s=await getTripWorkspace(userId,row.public_id);if(s)trips.push({tripId:s.tripId,details:s.details,progress:s.progress,status:s.progress.complete?'ready':'in_progress'});}
 return trips;
}
