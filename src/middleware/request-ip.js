// Express derives req.ip from the socket. An aborted request may lose its socket
// address while an earlier asynchronous middleware is still completing. Preserve
// Express's existing trust-proxy decision before body parsing or other async work.
export function preserveRequestIp(request,response,next){
 const ip=request.ip;
 if(typeof ip==='string'&&ip){
  Object.defineProperty(request,'ip',{value:ip,configurable:true,enumerable:true});
  next();return;
 }
 if(request.destroyed)return;
 next(Object.assign(new Error('Unable to identify the request connection.'),{status:400}));
}
