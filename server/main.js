const WebSocket = require('ws');

// The key of this array it the shop slot that will be bought
// The value is an array of all the socket ids that want to buy it this tick
var buyRequests = [[], [], [], [], [], [], [], [], []];

var state = {
  shop: [
    { name: "oldie", cost: 1, amount: 1, color: "#cd4c6f" },
    { name: "queer", cost: 2, amount: 1, color: "#cc4ccd" },
    { name: "youngster", cost: 3, amount: 1, color: "#4c4fcd" },
    { name: "punk", cost: 4, amount: 1, color: "#4cc0cd" },
    { name: "stoner", cost: 5, amount: 1, color: "#4ccd6f" },
    { name: "nerd", cost: 6, amount: 1, color: "#accd4c" },
    { name: "jock", cost: 7, amount: 1, color: "#cdb84c" },
    { name: "elite", cost: 8, amount: 1, color: "#cd834c" },
    { name: "reviewer", cost: 9, amount: 1, color: "#cd4c4c" }
  ],
  inventories: []
};

function addAudience (socketid, slot, amount) {
  console.log("add audience", socketid, slot, amount)
  state.inventories[socketid] = state.inventories[socketid] || [];
  state.inventories[socketid][slot] = state.inventories[socketid][slot] || 0;
  state.inventories[socketid][slot] += amount;
}

function processBuyRequests () {
  for (var k = 0; k < buyRequests.length; k++) {
    if (buyRequests[k].length == 0) continue;

    for (var i = 0; i < buyRequests[k].length; i++) {
      addAudience(buyRequests[k][i], k, Math.floor(state.shop[k].amount / buyRequests[k].length));
    }

    state.shop[k].amount = 0;
    buyRequests[k] = [];
  }
}

function tick () {
  processBuyRequests();

  state.shop.forEach((audience) => {
    audience.amount += 1;
  })
  
  wss.clients.forEach(function each(ws) {
    ws.send(JSON.stringify({
      id: ws.id,
      state: state
    }));
  });
}

function heartbeat() {
  this.isAlive = true;
}

function handleMessage (message) {
  var socket = this;
  var parsed;
  try {
    parsed = JSON.parse(message);
  } catch (e) {
    return;
  }

  if (typeof parsed.buy == "number" && !isNaN(parsed.buy)) {
    buyRequests[parsed.buy].push(socket.id);
  }
}
 
const wss = new WebSocket.Server({
  port: 8080,
  maxPayload: 1024
});

let id = 0;
wss.on('connection', function connection(ws, req) {
  ws.isAlive = true;
  ws.ip = req.socket.remoteAddress;
  ws.id = id;
  console.log("Connection", ws.ip);
  ws.on('pong', heartbeat);
  ws.on('message', handleMessage);
  ws.send(JSON.stringify({
    id: ws.id,
    state: state
  }));

  id++;
});

const stateInterval = setInterval(() => {
  tick();
}, 3000);
 
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