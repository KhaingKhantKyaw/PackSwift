import {Router} from 'express';
import {randomBytes,createHash} from 'node:crypto';
import {rateLimit} from 'express-rate-limit';
import {getDatabasePool} from '../config/database.js';
import {requireAuth} from '../middleware/auth.js';
export const tripDraftRouter=Router();
const cookie='packswift_trip_draft';
const options={httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/api/trip-drafts',maxAge:20*60*1000};
const hash=token=>createHash('sha256').update(token).digest('hex');
// Expired payloads are removed within one minute while the server is running.
setInterval(()=>{getDatabasePool()?.execute('DELETE FROM temporary_trip_drafts WHERE expires_at <= UTC_TIMESTAMP()').catch(()=>{});},60000).unref();
tripDraftRouter.use(rateLimit({windowMs:60000,limit:20,standardHeaders:'draft-8',legacyHeaders:false}));
tripDraftRouter.post('/',async(req,res)=>{
  const {payload,action}=req.body||{};
  if(!['plan','save','board'].includes(action)||!payload||typeof payload!=='object'||Array.isArray(payload)||JSON.stringify(payload).length>100000)return res.status(400).json({message:'Trip draft is too large or incomplete.'});
  try{
    const db=getDatabasePool();const token=randomBytes(32).toString('hex');
    await db.execute('DELETE FROM temporary_trip_drafts WHERE expires_at <= UTC_TIMESTAMP()');
    await db.execute('INSERT INTO temporary_trip_drafts (token_hash,payload,action,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 20 MINUTE))',[hash(token),JSON.stringify(payload),action]);
    const old=req.cookies?.[cookie];if(typeof old==='string'&&/^[a-f0-9]{64}$/.test(old))await db.execute('DELETE FROM temporary_trip_drafts WHERE token_hash=?',[hash(old)]);
    res.cookie(cookie,token,options).status(201).json({expiresIn:1200});
  }catch{res.status(503).json({message:'Your temporary trip could not be saved. Please keep this page open and try again.'});}
});
tripDraftRouter.post('/restore',requireAuth,async(req,res)=>{
  const token=req.cookies?.[cookie];if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return res.status(410).json({message:'This temporary trip has expired. Please choose your trip details again.'});
  let connection;
  try{
    connection=await getDatabasePool().getConnection();await connection.beginTransaction();
    const [rows]=await connection.execute('SELECT payload,action FROM temporary_trip_drafts WHERE token_hash=? AND expires_at>UTC_TIMESTAMP() FOR UPDATE',[hash(token)]);
    await connection.execute('DELETE FROM temporary_trip_drafts WHERE token_hash=?',[hash(token)]);await connection.commit();
    res.clearCookie(cookie,{...options,maxAge:undefined});res.set('Cache-Control','no-store');
    if(!rows.length)return res.status(410).json({message:'This temporary trip has expired. Please choose your trip details again.'});
    res.json({...rows[0],payload:typeof rows[0].payload==='string'?JSON.parse(rows[0].payload):rows[0].payload});
  }catch{await connection?.rollback();res.status(503).json({message:'Unable to restore your trip. Refresh to try again.'});}finally{connection?.release();}
});
