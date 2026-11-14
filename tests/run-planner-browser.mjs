import express from 'express';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../public',import.meta.url)),app=express();
app.use(express.static(root));app.get('/trip-planner',(req,res)=>res.sendFile(root+'/trip-planner.html'));app.get('/api/auth/me',(req,res)=>res.json({user:null}));app.use('/api',(req,res)=>res.status(503).json({message:'Isolated test server: no live provider or account access.'}));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
try{for(const name of process.argv.slice(2)){await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[name],{stdio:'inherit',env:{...process.env,BASE_URL:'http://127.0.0.1:'+server.address().port}});child.on('exit',code=>code===0?resolve():reject(Error(name+' failed ('+code+')')));});}}
finally{await new Promise(resolve=>server.close(resolve));}
