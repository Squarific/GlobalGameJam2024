const WebSocket = require('ws');

// The key of this array it the shop slot that will be bought
// The value is an array of all the socket ids that want to buy it this tick
var buyRequests = [[], [], [], [], [], [], [], [], [], []];

var NORMIE = 0;
var TIKTOKKER = 1;
var GAMER = 2;
var ARTIST = 3;
var PUNK = 4;
var JOCK = 5;
var QUEER = 6;
var PHILOSOPHER = 7;
var ELITE = 8;
var CRITIC = 9;

const ELITE_CONVERSION = [{
  type: TIKTOKKER,
  reward: 5
}, {
  type: GAMER,
  reward: 10
}, {
  type: ARTIST,
  reward: 20
}];

var state = {
  MAX_PLAYERS: 4,
  MAX_AUDIENCE: 500,
  MAX_PUNKS: 100,
  LAUGHS_PER_PUNK: 3,
  punks_bought: 0,
  currentTick: 0,
  shop: [
    { name: "Normie",      cost: 0,    amount: 1, color: "gray"    },
    { name: "Tiktokker",   cost: 1,    amount: 1, color: "#cd4c6f" },
    { name: "Gamer",       cost: 3,    amount: 1, color: "#eb48ef" },
    { name: "Artist",      cost: 9,    amount: 1, color: "#4c4fcd" },
    { name: "Punk",        cost: 100,  amount: 1, color: "#4f4f4f" },
    { name: "Jock",        cost: 300,  amount: 1, color: "#4ccd6f" },
    { name: "Queer",       cost: 900,  amount: 1, color: "#4cc0cd" },
    { name: "Philosopher", cost: 1000, amount: 1, color: "#521b65" },
    { name: "Elite",       cost: 3000, amount: 1, color: "#cd834c" },
    { name: "Critic",      cost: 9000, amount: 5, color: "#d3c749" }
  ],
  inventories: [],
  laughs: []
};

function addAudience (socketid, type, amount) {
  if (type == PUNK) {
    state.punks_bought += amount;
  }

  state.inventories[socketid].push({ type, amount, boughtOnTick: state.currentTick });
  removeTooMuchAudience(socketid);
}

function removeTooMuchAudience (socketid) {
  if (state.inventories[socketid].length == 0) return;

  var currentCount = countAudience(socketid);
  var toRemove = Math.max(0, currentCount - state.MAX_AUDIENCE);

  for (var k = 0; k < state.inventories[socketid].length; k++) {
    if (state.inventories[socketid][k].amount > toRemove) {
      state.inventories[socketid][k].amount -= toRemove;
      return;
    } else {
      toRemove -= state.inventories[socketid][k].amount;
      state.inventories[socketid].splice(k, 1);
      k--;
    }
  }
}

function removeAudience (socketid, type, amountToRemove) {
  if (state.inventories[socketid].length == 0) return;

  for (var k = 0; k < state.inventories[socketid].length; k++) {
    var thisType = state.inventories[socketid][k].type;
    if (thisType != type) continue;
    
    var thisAmount = state.inventories[socketid][k].amount;

    if (thisAmount > amountToRemove) {
      state.inventories[socketid][k].amount -= amountToRemove;
      return;
    } else {
      amountToRemove -= thisAmount;
      state.inventories[socketid].splice(k, 1);
      k--;
    }
  }
}

function processBuyRequests () {
  for (var audienceType = 1; audienceType < buyRequests.length; audienceType++) {
    if (buyRequests[audienceType].length == 0) continue;

    for (var i = 0; i < buyRequests[audienceType].length; i++) {
      var socketid = buyRequests[audienceType][i];
      var amountToAdd = Math.floor(state.shop[audienceType].amount / buyRequests[audienceType].length);

      if (audienceType == ELITE || audienceType == PHILOSOPHER) {
        amountToAdd = 1;
      }

      addAudience(socketid, audienceType, amountToAdd);

      var cost = state.shop[audienceType].cost;

      if (audienceType == QUEER) {
        cost -= countAudienceType(socketid, QUEER);
      }

      state.laughs[socketid] -= cost;
    }

    state.shop[audienceType].amount = 0;
    buyRequests[audienceType] = [];
  }
}

function countAudienceType (socketid, type) {
  var sum = 0;

  for (var k = 0; k < state.inventories[socketid].length; k++) {
    if (state.inventories[socketid].type != type) continue;
    sum += state.inventories[socketid][k].amount;
  }

  return sum;
}

function countAudience (socketid) {
  var sum = 0;

  for (var k = 0; k < state.inventories[socketid].length; k++) {
    sum += state.inventories[socketid][k].amount;
  }

  return sum;
}

function aggregatedAudience (socketid) {
  var summed = [];
  for (var k = 0; k < state.shop.length; k++) {
    summed[k] = 0;
  }

  for (var k = 0; k < state.inventories[socketid].length; k++) {
    var entry = state.inventories[socketid][k];
    summed[entry.type] += entry.amount;
  }

  return summed;
}

function tiktokkers () {
  for (var socketid = 0; socketid < state.inventories.length; socketid++) {
    for (var k = 0; k < state.inventories[socketid].length; k++) {
      if (state.inventories[socketid][k].type == TIKTOKKER) {
        if (state.currentTick >= state.inventories[socketid][k].boughtOnTick + 5) {
          state.inventories[socketid].splice(k, 1);
          k--;
        }
      }
    }
  }
}

function increaseShop () {
  state.shop[TIKTOKKER].amount++;
  state.shop[GAMER].amount++;
  state.shop[ARTIST].amount++;
  state.shop[QUEER].amount++;
  state.shop[JOCK].amount++;
  state.shop[PUNK].amount++;

  state.shop[JOCK].amount = Math.min(state.shop[JOCK].amount, 10);
  state.shop[PUNK].amount = Math.min(state.shop[PUNK].amount, state.MAX_PUNKS - state.punks_bought);
  state.shop[PHILOSOPHER].amount = 1;
  state.shop[ELITE].amount = 1;
  state.shop[CRITIC].amount = 5;
}

function giveIncome () {
  wss.clients.forEach(function each(ws) {
    var inventory = aggregatedAudience(ws.id);
    var standardIncome = inventory[NORMIE] + inventory[TIKTOKKER] + inventory[GAMER] + inventory[ARTIST] + inventory[JOCK] + inventory[PUNK] * state.LAUGHS_PER_PUNK + inventory[QUEER] + inventory[ELITE];
    standardIncome += Math.min(inventory[QUEER], inventory[ARTIST]);
    state.laughs[ws.id] += Math.floor(standardIncome / 3);
  });
}

function sendState () {
  wss.clients.forEach(function each(ws) {
    ws.send(JSON.stringify({
      id: ws.id,
      state: state
    }));
  });
}

function jocks () {
  if (state.currentTick % 5 == 0) {
    for (var socketid = 0; socketid < state.inventories.length; socketid++) {
      var jockcount = countAudienceType(socketid, JOCK);
      if (jockcount != 0) addAudience(socketid, JOCK, jockcount);
    }
  }
}

function elites () {
  for (var socketid = 0; socketid < state.inventories.length; socketid++) {
    var toConvert = countAudienceType(socketid, ELITE);

    var i = 0;
    while (toConvert > 0 && i < ELITE_CONVERSION.length) {
      var amount = Math.min(toConvert, countAudienceType(socketid, ELITE_CONVERSION[i].type));
      toConvert -= amount;
      state.laughs[socketid] += amount * ELITE_CONVERSION[i].reward;
      removeAudience(socketid, ELITE_CONVERSION[i].type, amount);
      i++;
    }
  }
}

function philosophers () {
  for (var socketid = 0; socketid < state.inventories.length; socketid++) {
    for (var k = 0; k < state.inventories[socketid].length; k++) {
      if (state.inventories[socketid][k].type == PHILOSOPHER) {
        var placesBefore = [];
        var placesAfter = [];
        
        if (k >= 4) {
          for (var i = 0; i < Math.min(state.inventories[socketid][k - 4].amount, 1); i++) {
            placesBefore.push(state.inventories[socketid][k - 4]);
          }
        }

        if (k >= 3) {
          for (var i = 0; i < Math.min(state.inventories[socketid][k - 3].amount, 2); i++) {
            placesBefore.push(state.inventories[socketid][k - 3]).type;
          }
        }
        
        if (k >= 2) {
          for (var i = 0; i < Math.min(state.inventories[socketid][k - 2].amount, 3); i++) {
            placesBefore.push(state.inventories[socketid][k - 2].type);
          }
        }
        
        if (k >= 1) {
          for (var i = 0; i < Math.min(state.inventories[socketid][k - 1].amount, 4); i++) {
            placesBefore.push(state.inventories[socketid][k - 1].type);
          }
        }

        for (var i = 0; i < Math.min(state.inventories[socketid][k + 1].amount, 4); i++) {
          placesAfter.push(state.inventories[socketid][k + 1]);
        }

        for (var i = 0; i < Math.min(state.inventories[socketid][k + 2].amount, 3); i++) {
          placesAfter.push(state.inventories[socketid][k + 2]).type;
        }
        
        for (var i = 0; i < Math.min(state.inventories[socketid][k + 3].amount, 2); i++) {
          placesAfter.push(state.inventories[socketid][k + 3].type);
        }
        
        for (var i = 0; i < Math.min(state.inventories[socketid][k + 4].amount, 1); i++) {
          placesAfter.push(state.inventories[socketid][k + 4].type);
        }


        var used = [];
        for (var i = 1; placesBefore.length - i >= 0; i--) {
          used[placesBefore[i].type] = true;
        }
        
        for (var i = 0; i < placesAfter.length && i < 4; i++) {
          used[placesAfter[i].type] = true;
        }

        var amount = 0;
        for (var i = 0; i < used.length; i++) {
          amount++;
        }

        if (amount == 0) continue;
        state.laughs[socketid] += Math.pow(2, amount - 1);
      }
    }
  }
}

function tick () {
  processBuyRequests();
  increaseShop();
  philosophers();
  elites();
  giveIncome();
  tiktokkers();
  jocks();
  state.currentTick++;
  sendState();
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

  if (state.laughs[ws.id] == undefined) {
    state.laughs[ws.id] = 100000;
    state.inventories[ws.id] = [];
    //addAudience(ws.id, 0, 3);
  }

  ws.send(JSON.stringify({
    id: ws.id,
    state: state
  }));

  id++;
  id = id % state.MAX_PLAYERS;
});

const stateInterval = setInterval(() => {
  for (var i = 0; i < state.MAX_PLAYERS; i++) {
    if (state.laughs[i] == undefined) return;
  }

  tick();
}, 5000);
 
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