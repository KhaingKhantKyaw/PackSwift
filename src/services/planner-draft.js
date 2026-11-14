import { createHash, randomUUID } from 'node:crypto';
import { getDatabasePool } from '../config/database.js';
import { routeLocation, currencyRatesToUsd } from './travel-planner.js';
import { placeReference } from './place-search-service.js';
import '../../public/js/itinerary-preferences-model.js';
import '../../public/js/activity-choices-model.js';
import '../../public/js/itinerary-plan-model.js';
import '../../public/js/travel-guidance-model.js';

const fail=message=>{const error=new Error(message);error.status=400;error.statusCode=400;throw error;};
const json=(value,fallback={})=>{if(value&&typeof value==='object')return value;try{return JSON.parse(value)||fallback;}catch{return fallback;}};
const packingKey=item=>String(item.category)+'\u0000'+String(item.name??item.item_name);
export function scheduleSignature(details={}){
 const fields=Object.fromEntries((details.fields||[]).filter(f=>!['radio','checkbox'].includes(f.type)||f.checked).map(f=>[f.name,f.value]));
 const names=['origin','destination','startDate','endDate','adults','children','childAges','arrivalTime','arrivalLocation','arrivalHotel','departureTime','itineraryTransport','comfortWalking','restBreaks','itineraryPlan'];
 return JSON.stringify([names.map(name=>fields[name]||''),(details.selected||[]).map(place=>place.id||place.placeId),globalThis.PackSwiftItineraryPreferenceModel.normalize(details.itineraryPreferences||json(fields.itineraryPreferences),details.selected||[])]);
}
export function reconcilePacking(existing,previous,incoming){
 const old=new Map(previous.map(item=>[packingKey(item),item])),saved=new Map(existing.map(item=>[packingKey(item),item]));
 return [...new Map(incoming.map(item=>[packingKey(item),item])).values()].map(item=>{const row=saved.get(packingKey(item)),baseline=old.get(packingKey(item));return {...item,databaseId:row?.id||null,packed:row&&baseline&&Boolean(item.packed)===Boolean(baseline.packed)?Boolean(row.is_completed):Boolean(item.packed)};});
}
export function normalizePlannerDraft(body={}){
 if(JSON.stringify(body).length>80000||!Array.isArray(body.fields))fail('Trip details are incomplete or too large.');
 const fields=body.fields.filter(f=>f&&typeof f.name==='string'&&!['password','currentPassword','itinerary-mode-choice'].includes(f.name));
 const values=Object.fromEntries(fields.filter(f=>!['radio','checkbox'].includes(f.type)||f.checked).map(f=>[f.name,f.value]));
 const destination=routeLocation(values.destination),origin=routeLocation(values.origin||values.destination);
 if(!destination||!origin)fail('Choose an origin and destination from the city suggestions.');
 const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 const days=Math.round((Date.parse(values.endDate)-Date.parse(values.startDate))/86400000)+1;
 if(!validDate(values.startDate)||!validDate(values.endDate)||days<2||days>91)fail('Choose valid dates for 1–90 nights.');
 const adults=Number(values.adults),children=Number(values.children||0);
 if(!Number.isInteger(adults)||adults<1||adults>9||!Number.isInteger(children)||children<0||children>8)fail('Choose 1–9 adults and up to 8 children.');
 const currency=String(values.currency||'').toUpperCase();if(!Object.hasOwn(currencyRatesToUsd,currency))fail('Choose a supported trip currency.');
 const selected=(Array.isArray(body.selected)?body.selected:[]).map(placeReference);
 const packing=json(values.packingSnapshot,[]);if(!Array.isArray(packing)||packing.length>300||packing.some(p=>!p||typeof p.name!=='string'||p.name.length>100||typeof p.category!=='string'||p.category.length>80||!Number.isInteger(Number(p.quantity))||Number(p.quantity)<1||Number(p.quantity)>99))fail('Check your packing item names and quantities.');
 if(selected.length>100)fail('Keep up to 100 selected places in a trip.');
 const preferences=globalThis.PackSwiftItineraryPreferenceModel.normalize(body.itineraryPreferences||json(values.itineraryPreferences),selected);
 const errors=globalThis.PackSwiftItineraryPreferenceModel.validate(preferences,days);if(errors.length)fail(errors.join(' '));
 const support=json(values.planningSupport),costs=support.costs||{};
 const context=['origin','destination','startDate','endDate','adults','children','childAges'].map(n=>values[n]||'').join('|');
 const complete=['flights','stay','daily'].every(k=>costs[k]!==''&&costs[k]!=null&&Number.isFinite(Number(costs[k]))&&Number(costs[k])>=0)&&support.costCurrency===currency&&support.costContext===context;
 const budget=complete?Math.round((Number(costs.flights)+Number(costs.stay)+Number(costs.daily)*days)*100)/100:null;
 if(budget!==null&&budget>9999999999.99)fail('The budget exceeds the supported amount.');
 for(const field of fields){if(field.name==='activityChoices')field.value=JSON.stringify(globalThis.PackSwiftActivityChoicesModel.parse(field.value));if(field.name==='budget')field.value=budget===null?'':String(budget);
  if(field.name==='travelGuidance')field.value=JSON.stringify(globalThis.PackSwiftTravelGuidanceModel.normalize(field.value));
  if(field.name==='itineraryPlan'&&field.value){const plan=globalThis.PackSwiftItineraryPlanModel.normalize(field.value);if(!plan)fail('Your itinerary could not be read. Reopen the editor and try again.');field.value=JSON.stringify(globalThis.PackSwiftItineraryPlanModel.persist(plan));}
 }
 return {destination,origin,adults,children,currency,budget,days,packing,packingProvided:values.packingSnapshot!==undefined,start:values.startDate,end:values.endDate,pace:preferences.tripPace,purpose:String(values.tripPurpose||'').slice(0,50),interests:json(values.travelPurposes,[]),details:{fields:fields.filter(f=>f.name!=='itineraryPreferences'),selected,rejected:Array.isArray(body.rejected)?body.rejected.slice(0,100):[],itineraryPreferences:preferences}};
}

// A guest save intent is generated once, before sign-in. Namespace it to the
// authenticated owner; the existing UNIQUE(public_id) serializes racing creates.
function guestTripId(userId,key){
 if(key===undefined)return null;
 if(typeof key!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))fail('This trip save could not be identified. Please try saving again.');
 const bytes=createHash('sha256').update(JSON.stringify(['PackSwift/guest-save/v1',String(userId),key.toLowerCase()])).digest().subarray(0,16);
 // Existing trip URLs and API validators expect the version-4 UUID format.
 bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;
 const hex=bytes.toString('hex');return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}

// All visible trip facts and the editable draft are written in one owner-scoped transaction.
export async function savePlannerDraft(userId,publicId,body,pool=getDatabasePool()){
 const handoffId=publicId?null:guestTripId(userId,body?.guestSaveId);
 const draft=normalizePlannerDraft(body),connection=await pool.getConnection();
 let insertingHandoff=false;
 try{
  await connection.beginTransaction();let old={};
  if(publicId){const [rows]=await connection.execute('SELECT id, preferences_json FROM trip_sessions WHERE public_id=? AND user_id=? FOR UPDATE',[publicId,userId]);if(!rows.length){const error=new Error('Trip not found.');error.status=404;throw error;}old=json(rows[0].preferences_json);}
  const scheduleChanged=!old.detailPlanning||scheduleSignature(old.detailPlanning)!==scheduleSignature(draft.details);
  const workspace={...old.workspace,revision:Number(old.workspace?.revision||0)+1};
  if(scheduleChanged)Object.assign(workspace,{itineraryReviewedAt:null,requirements:{},plannerDraft:true});
  const preferences={...old,detailPlanning:draft.details,budgetStatus:draft.budget===null?'unfinished':'estimated',route:{origin:draft.origin,destination:draft.destination},adults:draft.adults,children:draft.children,workspace};
  const [destinations]=await connection.execute('SELECT id FROM destinations WHERE slug=? LIMIT 1',[draft.destination.slug]);
  const values=[destinations[0]?.id||null,draft.destination.slug,draft.destination.name,draft.origin.country===draft.destination.country?'domestic':'international',draft.origin.name,draft.origin.country,draft.origin.code,draft.destination.code,draft.start,draft.end,draft.budget,draft.currency,draft.adults+draft.children,draft.adults,draft.children,draft.purpose,draft.pace,JSON.stringify(draft.interests),JSON.stringify(preferences),`${draft.origin.name} → ${draft.destination.name}`];
  if(publicId){await connection.execute("UPDATE trip_sessions SET destination_id=?,destination_slug=?,destination_name=?,trip_scope=?,origin_name=?,origin_country=?,origin_airport_code=?,arrival_airport_code=?,start_date=?,end_date=?,budget_amount=?,budget_currency=?,travelers=?,adult_count=?,child_count=?,trip_purpose=?,pace=?,interests_json=?,preferences_json=?,summary=?,status='draft',updated_at=CURRENT_TIMESTAMP WHERE public_id=? AND user_id=?",[...values,publicId,userId]);}
  else{publicId=handoffId||randomUUID();insertingHandoff=Boolean(handoffId);await connection.execute("INSERT INTO trip_sessions (destination_id,destination_slug,destination_name,trip_scope,origin_name,origin_country,origin_airport_code,arrival_airport_code,start_date,end_date,budget_amount,budget_currency,travelers,adult_count,child_count,trip_purpose,pace,interests_json,preferences_json,summary,public_id,user_id,recommendation_score,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,'draft')",[...values,publicId,userId]);insertingHandoff=false;}
  const [saved]=await connection.execute('SELECT id FROM trip_sessions WHERE public_id=? AND user_id=?',[publicId,userId]);
  if(draft.packingProvided){
   const [existing]=await connection.execute('SELECT id,category,item_name,is_completed FROM packing_lists WHERE trip_session_id=?',[saved[0].id]);
   const previous=json(old.detailPlanning?.fields?.find(f=>f.name==='packingSnapshot')?.value,[]),merged=reconcilePacking(existing,Array.isArray(previous)?previous:[],draft.packing),keep=new Set();
   for(const item of merged){const args=[item.category,item.name,Number(item.quantity),Boolean(item.packed),String(item.reason||'').slice(0,255)];
    if(item.databaseId){await connection.execute('UPDATE packing_lists SET category=?,item_name=?,quantity=?,is_completed=?,reason_text=? WHERE id=? AND trip_session_id=?',[...args,item.databaseId,saved[0].id]);keep.add(item.databaseId);}
    else{const [result]=await connection.execute("INSERT INTO packing_lists (trip_session_id,traveler_group,category,item_name,quantity,is_completed,reason_text) VALUES (?,'general',?,?,?,?,?)",[saved[0].id,...args]);keep.add(result.insertId);}
   }
   for(const item of existing)if(!keep.has(item.id))await connection.execute('DELETE FROM packing_lists WHERE id=? AND trip_session_id=?',[item.id,saved[0].id]);
   preferences.workspace.needs=(old.workspace?.needs||[]).filter(id=>keep.has(id));
   const snapshot=preferences.detailPlanning.fields.find(f=>f.name==='packingSnapshot');snapshot.value=JSON.stringify(merged.map(({databaseId,...item})=>item));
   const checklist=preferences.detailPlanning.fields.find(f=>f.name==='packingChecklist');if(checklist){const state=json(checklist.value);state.edits||={};for(const item of merged)if(item.id)state.edits[item.id]={...state.edits[item.id],packed:item.packed};checklist.value=JSON.stringify(state);}
   await connection.execute('UPDATE trip_sessions SET preferences_json=? WHERE public_id=? AND user_id=?',[JSON.stringify(preferences),publicId,userId]);
  }
  await connection.commit();return {saved:true,tripId:publicId,budgetStatus:preferences.budgetStatus};
 }catch(error){
  await connection.rollback();
  if(insertingHandoff&&error.code==='ER_DUP_ENTRY'){
   // Read after rollback so repeatable-read isolation sees the committed winner.
   const [rows]=await connection.execute('SELECT preferences_json FROM trip_sessions WHERE public_id=? AND user_id=?',[handoffId,userId]);
   if(rows.length)return {saved:true,tripId:handoffId,budgetStatus:json(rows[0].preferences_json).budgetStatus};
  }
  throw error;
 }finally{connection.release();}
}
