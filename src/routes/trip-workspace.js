import {Router} from 'express';
import {requireAuth} from '../middleware/auth.js';
import {requireDatabase} from '../middleware/database.js';
import {getDatabasePool} from '../config/database.js';
import {getOwnedTrip,listTripTimeline,listPackingItems} from '../repositories/trip-repository.js';
import {tripDetails,workspaceProgress,validateWorkspaceChange} from '../services/trip-workspace.js';
import {destinationCatalog} from '../services/travel-planner.js';

export const tripWorkspaceRouter=Router();
const guard=[requireAuth,requireDatabase];
const validId=id=>/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(id);
// Child planning tables reference trip_sessions with ON DELETE CASCADE.
// Preferences (requirements and missing items) live on the trip row itself.
tripWorkspaceRouter.delete('/:tripId',...guard,async(req,res,next)=>{
  try {
    if(!validId(req.params.tripId))return res.status(400).json({error:'Invalid trip ID.'});
    const [result]=await getDatabasePool().execute('DELETE FROM trip_sessions WHERE public_id=? AND user_id=?',[req.params.tripId,req.auth.userId]);
    if(!result.affectedRows)return res.status(404).json({error:'Trip not found.'});
    res.status(200).json({removed:true,tripId:req.params.tripId});
  }catch(e){next(e);}
});
async function snapshot(user,id) {
  const trip=await getOwnedTrip(user,id);if(!trip)return null;
  const workspace=trip.preferences.workspace || {revision:0,requirements:{},needs:[]};
  const packing=await listPackingItems(user,id);
  const timeline=await listTripTimeline(user,id);
  return {tripId:id,details:tripDetails(trip),workspace,timeline,packing,itineraryPreferences:trip.preferences.detailPlanning?.itineraryPreferences||null,progress:workspaceProgress(trip,workspace,packing)};
}
tripWorkspaceRouter.get('/',...guard,async(req,res,next)=>{
  try {const [rows]=await getDatabasePool().execute('SELECT public_id FROM trip_sessions WHERE user_id=? ORDER BY updated_at DESC LIMIT 100',[req.auth.userId]);
    const trips=[];for(const row of rows){const s=await snapshot(req.auth.userId,row.public_id);if(s)trips.push({tripId:s.tripId,details:s.details,progress:s.progress});}res.json({trips});
  }catch(e){next(e);}
});
tripWorkspaceRouter.get('/:tripId/workspace',...guard,async(req,res,next)=>{
  try {if(!validId(req.params.tripId))return res.status(400).json({error:'Invalid trip ID.'});const result=await snapshot(req.auth.userId,req.params.tripId);if(!result)return res.status(404).json({error:'Trip not found.'});res.json(result);}catch(e){next(e);}
});
tripWorkspaceRouter.patch('/:tripId/workspace',...guard,async(req,res,next)=>{
  let connection;
  try {
    if(!validId(req.params.tripId))return res.status(400).json({error:'Invalid trip ID.'});
    const change=validateWorkspaceChange(req.body);connection=await getDatabasePool().getConnection();await connection.beginTransaction();
    const [rows]=await connection.execute('SELECT id, preferences_json FROM trip_sessions WHERE public_id=? AND user_id=? FOR UPDATE',[req.params.tripId,req.auth.userId]);
    if(!rows.length){await connection.rollback();return res.status(404).json({error:'Trip not found.'});}
    const preferences=typeof rows[0].preferences_json==='string'?JSON.parse(rows[0].preferences_json):rows[0].preferences_json||{};
    const state=preferences.workspace || {revision:0,requirements:{},needs:[]};
    if((state.revision||0)!==change.revision){await connection.rollback();return res.status(409).json({error:'This trip changed in another tab. Reload before saving.'});}
    if(change.action==='requirement'){state.requirements||={};state.requirements[change.key]=change.reviewed?new Date().toISOString():null;}
    if(change.action==='packing'){
      const [items]=await connection.execute('SELECT id FROM packing_lists WHERE id=? AND trip_session_id=?',[change.itemId,rows[0].id]);
      if(!items.length){await connection.rollback();return res.status(404).json({error:'Packing item not found.'});}
      await connection.execute('UPDATE packing_lists SET is_completed=? WHERE id=? AND trip_session_id=?',[change.state==='have',change.itemId,rows[0].id]);
      state.needs=(state.needs||[]).filter(id=>id!==change.itemId);if(change.state==='need')state.needs.push(change.itemId);
    }
    if(change.action==='itinerary'||change.action==='regenerate'){
      const trip=await getOwnedTrip(req.auth.userId,req.params.tripId),details=tripDetails(trip);
      const [existing]=await connection.execute('SELECT * FROM itinerary_timeline_items WHERE trip_session_id=?',[rows[0].id]);
      if(change.action==='regenerate'){
        const spots=trip.preferences.detailPlanning?.selected?.map(p=>p.title||p.name).filter(Boolean)||[];
        if(!spots.length)spots.push(...(destinationCatalog.find(c=>c.name.toLowerCase()===details.destination.toLowerCase())?.attractions||[]));
        change.items=[];
        for(let day=1;day<=details.nights+1;day++){
          if(change.day&&day!==change.day){change.items.push(...existing.filter(p=>p.day_number===day).map(p=>({id:p.id,day,title:p.title,startTime:String(p.start_time||'').slice(0,5)})));continue;}
          const titles=day===1?['Arrival and transfer','Check in and explore nearby']:day===details.nights+1?['Check out and prepare for departure']:[spots[(day-2)%Math.max(1,spots.length)]||`Explore ${details.destination} at your own pace`,'Local meal and time to rest'];
          change.items.push(...titles.map(title=>({day,title,startTime:null})));
        }
      }
      if(change.items.some(p=>p.day>details.nights+1))throw new RangeError('An activity is outside your travel dates.');
      await connection.execute('DELETE FROM itinerary_timeline_items WHERE trip_session_id=?',[rows[0].id]);
      for(const [index,p] of change.items.entries()){
        const old=existing.find(item=>item.id===p.id);
        await connection.execute('INSERT INTO itinerary_timeline_items (trip_session_id,day_number,sequence_number,start_time,item_type,title,description,location_name) VALUES (?,?,?,?,?,?,?,?)',[rows[0].id,p.day,index+1,p.startTime||null,old?.item_type||'activity',p.title.trim(),old?.description||'User-planned activity; verify timing and venue details.',old?.location_name||null]);
      }
      state.itineraryReviewedAt=null;
    }
    if(change.action==='review-itinerary')state.itineraryReviewedAt=new Date().toISOString();
    state.revision=(state.revision||0)+1;state.updatedAt=new Date().toISOString();
    await connection.execute("UPDATE trip_sessions SET preferences_json=JSON_SET(COALESCE(preferences_json,JSON_OBJECT()), '$.workspace',JSON_EXTRACT(?, '$')), updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",[JSON.stringify(state),rows[0].id,req.auth.userId]);
    await connection.commit();res.json(await snapshot(req.auth.userId,req.params.tripId));
  }catch(e){if(connection)await connection.rollback();if(e instanceof RangeError)return res.status(422).json({error:e.message});next(e);}finally{connection?.release();}
});
