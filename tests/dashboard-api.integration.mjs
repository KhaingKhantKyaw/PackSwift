// Route/auth integration with an in-memory SQL adapter: no real accounts or DB writes.
import assert from 'node:assert/strict';
import express from 'express';
process.env.NODE_ENV='development';
const {getDatabasePool}=await import('../src/config/database.js');
const {issueAuthToken}=await import('../src/config/auth.js');
const {profileRouter}=await import('../src/routes/profile.js');
const pool=getDatabasePool(),original={execute:pool.execute,getConnection:pool.getConnection};
const rows=new Map([[1,{picture:'keep-photo',nationality:'Myanmar',wishlist:[{name:'Temple',detail:'Bangkok'}]}]]);
let released=0,rolledBack=0,queries=[];
async function execute(sql,args){
 queries.push({sql,args});
 if(sql.startsWith('SELECT preferences'))return [[...(rows.has(args[0])?[{preferences:JSON.stringify(rows.get(args[0]))}]:[])]];
 if(sql.startsWith('INSERT IGNORE')){if(!rows.has(args[0]))rows.set(args[0],{});return [{affectedRows:1}];}
 if(sql.startsWith('UPDATE user_profile_preferences SET preferences = ?')){rows.set(args[1],JSON.parse(args[0]));return [{affectedRows:1}];}
 throw Error('Unexpected SQL: '+sql);
}
pool.execute=execute;
pool.getConnection=async()=>({execute,beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{rolledBack++;},release:()=>{released++;}});
const app=express();app.use(express.json());app.use('/api/profile',profileRouter);app.use((e,q,s,n)=>s.status(e instanceof RangeError?422:500).json({error:e.message}));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
const token=id=>issueAuthToken({id,username:'test'+id,email:'test'+id+'@example.com'});
async function request(method,user,body){const res=await fetch(base+'/api/profile/dashboard',{method,headers:{...(user?{Authorization:'Bearer '+token(user)}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,cache:res.headers.get('cache-control'),data:await res.json()};}
try{
 assert.equal((await request('GET')).status,401);
 const initial=await request('GET',1);assert.equal(initial.status,200);assert.equal(initial.cache,'no-store');
 const saved=await request('PUT',1,{...initial.data.dashboard,currency:'THB',experience:'first'});assert.equal(saved.status,200);assert.equal(saved.data.dashboard.revision,1);
 assert.equal(rows.get(1).picture,'keep-photo');assert.equal(rows.get(1).nationality,'Myanmar');assert.equal(rows.get(1).wishlist.length,1);
 assert.equal((await request('GET',2)).data.dashboard.currency,'USD','Other accounts cannot read the dashboard');
 assert.equal((await request('GET',1)).data.dashboard.experience,'first');
 assert.equal((await request('PUT',1,initial.data.dashboard)).status,409,'Stale versions cannot overwrite');
 assert.equal(rolledBack,1);assert.equal(released,2);
 const before=queries.length;assert.equal((await request('PUT',1,{...saved.data.dashboard,currency:'<x>'})).status,422);assert.equal(queries.length,before);
 assert.equal(rows.get(1).dashboard.revision,1);
 assert.ok(queries.filter(q=>q.sql.startsWith('SELECT preferences')).every(q=>q.args[0]===1||q.args[0]===2),'Reads are account-scoped');
 console.log('Dashboard API integration passed: authentication, account isolation, persisted reload, preference preservation, validation, revision conflicts and connection release.');
}finally{pool.execute=original.execute;pool.getConnection=original.getConnection;server.closeAllConnections();await new Promise(r=>server.close(r));await pool.end();}
