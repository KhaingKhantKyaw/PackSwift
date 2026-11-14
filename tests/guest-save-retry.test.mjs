import test from 'node:test';
import assert from 'node:assert/strict';
import { savePlannerDraft } from '../src/services/planner-draft.js';

const key='d8289fd4-2b19-4543-a131-5d83bc6ee6ff';
const fields=Object.entries({origin:'Yangon',destination:'Bangkok',startDate:'2027-12-01',endDate:'2027-12-06',adults:'2',children:'0',currency:'MMK'}).map(([name,value])=>({name,value,type:'text'}));

function database(){
  const rows=new Map();
  const pool={getConnection:async()=>({
    beginTransaction:async()=>{},rollback:async()=>{},commit:async()=>{},release(){},
    async execute(sql,args){
      if(sql.startsWith('SELECT id FROM destinations'))return [[]];
      if(sql.startsWith('INSERT INTO trip_sessions')){
        const [id,owner]=args.slice(-2);
        if(rows.has(id))throw Object.assign(new Error('Already exists'),{code:'ER_DUP_ENTRY'});
        rows.set(id,{owner,preferences_json:JSON.parse(args.at(-4))});return [{affectedRows:1}];
      }
      if(sql.startsWith('SELECT')&&sql.includes('FROM trip_sessions')){
        const row=rows.get(args[0]);return [row?.owner===args[1]?[{id:1,...row}]:[]];
      }
      throw Error('Unexpected query: '+sql);
    }
  })};
  return {pool,rows};
}

test('repeated saves of a guest handoff return the original trip for that owner',async()=>{
  const {pool,rows}=database(),body={fields,guestSaveId:key};
  const [a,b]=await Promise.all([savePlannerDraft(11,null,body,pool),savePlannerDraft(11,null,body,pool)]);
  assert.deepEqual(a,b);assert.equal(rows.size,1);
  const other=await savePlannerDraft(12,null,body,pool);
  assert.notEqual(a.tripId,other.tripId);assert.equal(rows.size,2);
});

test('unkeyed creations remain separate and malformed handoffs do not write',async()=>{
  const {pool,rows}=database();
  await assert.rejects(savePlannerDraft(11,null,{fields,guestSaveId:'invalid'},pool),{status:400});
  assert.equal(rows.size,0);
  await savePlannerDraft(11,null,{fields},pool);await savePlannerDraft(11,null,{fields},pool);
  assert.equal(rows.size,2);
});
