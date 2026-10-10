import test from 'node:test';import assert from 'node:assert/strict';
import {preserveRequestIp} from '../src/middleware/request-ip.js';
test('rate-limit identity survives socket teardown without changing Express proxy resolution',()=>{
 for(const ip of ['127.0.0.1','::1','203.0.113.12']){
  const socket={remoteAddress:ip},request={get ip(){return socket.remoteAddress;}},calls=[];
  preserveRequestIp(request,{},error=>calls.push(error));
  socket.remoteAddress=undefined;
  assert.equal(request.ip,ip);assert.deepEqual(calls,[undefined]);
 }
});
test('unidentifiable requests cannot bypass the rate limiter',()=>{
 const errors=[];preserveRequestIp({ip:undefined},{},e=>errors.push(e));assert.equal(errors[0].status,400);
 let called=false;preserveRequestIp({ip:undefined,destroyed:true},{},()=>called=true);assert.equal(called,false);
});
