import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import {canonical,storedItinerary} from '../services/canonical-trip.js';
import {requireAuth} from '../middleware/auth.js';
import {requireDatabase} from '../middleware/database.js';
import {getDatabasePool} from '../config/database.js';
import {getOwnedTrip} from '../repositories/trip-repository.js';
import {tripDetails,validateWorkspaceChange} from '../services/trip-workspace.js';
import {getTripWorkspace as snapshot,getTripsForUser} from '../repositories/trip-workspace-repository.js';

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
tripWorkspaceRouter.get('/',...guard,async(req,res,next)=>{
  try {res.set('Cache-Control','no-store').json({trips:await getTripsForUser(req.auth.userId)});
  }catch(e){next(e);}
});
tripWorkspaceRouter.get('/:tripId/workspace',...guard,async(req,res,next)=>{
  try {if(!validId(req.params.tripId))return res.status(400).json({error:'Invalid trip ID.'});const result=await snapshot(req.auth.userId,req.params.tripId,true);if(!result)return res.status(404).json({error:'Trip not found.'});res.set('Cache-Control','no-store').json(result);}catch(e){next(e);}
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
      const current=await snapshot(req.auth.userId,req.params.tripId,true);
      let plan=current.itinerary;
      if(change.action==='regenerate'){
        const fresh=canonical.reconcile(plan.selectedPlaces,null,details.nights+1,preferences.detailPlanning?.itineraryPreferences,details.start);
        plan=change.day?{...plan,items:plan.items.map(i=>i.day===change.day?{...i,startTime:'',userModified:false}:i)}:fresh;
      }else{
        const selected=new Map(plan.selectedPlaces.map(p=>[canonical.identity(p),p]));
        const previous=new Map(plan.items.map(i=>[i.id,i]));
        const items=change.items.map((p,index)=>{
          const old=previous.get(p.id);const id=old?.selectedPlaceId||p.selectedPlaceId||'custom:'+randomUUID();
          if(!selected.has(id)){if(old||p.selectedPlaceId)throw new RangeError('Unknown selected place.');selected.set(id,{id,source:'custom',title:p.title});}
          return {...old,id:old?.id||'item:'+id,selectedPlaceId:id,type:old?.type||'custom',day:p.day,startTime:p.startTime||'',notes:p.notes||'',title:p.title,order:index,userModified:true};
        });
        const refs=new Set(items.map(i=>i.selectedPlaceId));
        plan={...plan,selectedPlaces:[...selected.values()].filter(p=>refs.has(canonical.identity(p))),items};
      }
      canonical.validate(plan,details.nights+1);
      preferences.canonicalItinerary=storedItinerary(plan);
      if(preferences.detailPlanning){
        preferences.detailPlanning.selected=preferences.canonicalItinerary.selectedPlaces;
        const ids=new Set(plan.selectedPlaces.map(canonical.identity)),p=preferences.detailPlanning.itineraryPreferences;
        if(p)p.activityPreferences=(p.activityPreferences||[]).filter(a=>ids.has(a.activityId));
      }
      state.itineraryReviewedAt=null;
    }
    if(change.action==='review-itinerary')state.itineraryReviewedAt=new Date().toISOString();
    state.revision=(state.revision||0)+1;state.updatedAt=new Date().toISOString();
    preferences.workspace=state;
    await connection.execute("UPDATE trip_sessions SET preferences_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",[JSON.stringify(preferences),rows[0].id,req.auth.userId]);
    await connection.commit();res.json(await snapshot(req.auth.userId,req.params.tripId,true));
  }catch(e){if(connection)await connection.rollback();if(e instanceof RangeError)return res.status(422).json({error:e.message});next(e);}finally{connection?.release();}
});
