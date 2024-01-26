const WebSocket = require('ws');
 
function heartbeat() {
  this.isAlive = true;
}

function handleMessage (message) {
  var socket = this;
  console.log(socket.ip, typeof message);
}
 
const wss = new WebSocket.Server({
  port: 8080,
  maxPayload: 1024
});
 
wss.on('connection', function connection(ws, req) {
  ws.isAlive = true;
  ws.ip = req.socket.remoteAddress;
  console.log("Connection", ws.ip);
  ws.on('pong', heartbeat);
  ws.on('message', handleMessage);
});
 
const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate();
 
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);
 
wss.on('close', function close() {
  clearInterval(interval);
});