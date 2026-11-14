import {getDatabasePool} from '../config/database.js';
import {getOwnedTrip,listPackingItems,listTripTimeline} from './trip-repository.js';
import {tripDetails,workspaceProgress} from '../services/trip-workspace.js';
import {hydrateSelected} from '../services/place-search-service.js';
import '../../public/js/itinerary-plan-model.js';
import '../../public/js/activity-choices-model.js';

export async function getTripWorkspace(user,id,includeSelected=false,hydrate=true) {
  const trip=await getOwnedTrip(user,id);if(!trip)return null;
  const workspace=trip.preferences.workspace || {revision:0,requirements:{},needs:[]};
  const packing=await listPackingItems(user,id);
  const timeline=workspace.plannerDraft?[]:await listTripTimeline(user,id);
  const details=tripDetails(trip),saved=trip.preferences.detailPlanning;
  const fields=Object.fromEntries((saved?.fields||[]).map(f=>[f.name,f.value]));
  const editablePlan=globalThis.PackSwiftItineraryPlanModel.normalize(fields.itineraryPlan);
  const selectedSchedule=includeSelected&&hydrate&&!editablePlan&&saved?.selected?.length?globalThis.PackSwiftPlaceSearchModel.schedule(await hydrateSelected(saved.selected,details.destination),details.nights+1,{...saved.itineraryPreferences,walking:fields.comfortWalking,restBreaks:fields.restBreaks,arrivalTime:fields.arrivalTime}):null;
  const model=globalThis.PackSwiftActivityChoicesModel;
  const likedActivities=includeSelected?model.parse(fields.activityChoices).destinations.filter(d=>model.destinationKey(d.destination)===model.destinationKey(details.destination)).flatMap(d=>d.choices.filter(c=>c.vote==='up')):[];
  const briefing=includeSelected?Object.fromEntries(['arrivalTime','arrivalLocation','arrivalHotel','departureTime','departureLocation','transportation'].map(k=>[k,String(fields[k]||'').slice(0,300)])):null;
  return {tripId:id,details,workspace,timeline,packing,selectedSchedule,likedActivities,briefing,editablePlan:includeSelected?editablePlan:null,editableStopCount:editablePlan?.days.reduce((n,d)=>n+d.stops.length,0)||0,itineraryPreferences:saved?.itineraryPreferences||null,progress:workspaceProgress(trip,workspace,packing)};
}

// Shared by My Trips and Profile. Ownership is checked again by getTripWorkspace.
export async function getTripsForUser(userId){
 const [rows]=await getDatabasePool().execute('SELECT public_id FROM trip_sessions WHERE user_id=? ORDER BY updated_at DESC',[userId]);
 const trips=[];
 for(const row of rows){const s=await getTripWorkspace(userId,row.public_id);if(s)trips.push({tripId:s.tripId,details:s.details,progress:s.progress,status:s.progress.complete?'ready':'in_progress'});}
 return trips;
}
