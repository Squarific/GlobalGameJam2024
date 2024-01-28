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
var JOCKJR = 10;
var gameWonById;

const ELITE_CONVERSION = [{
  type: TIKTOKKER,
  reward: 30
}];

var state = {
  MAX_PLAYERS: 4,
  MAX_PUNKS: 100,
  QUEER_LOWEST_PRICE: 20,
  LAUGHS_PER_PUNK: 9,
  punks_bought: 0,
  currentTick: 0,
  shop: [
    { name: "Normie",      cost: 10000,    amount: 1, color: "gray"    },
    { name: "Tiktokker",   cost: 1,        amount: 4, color: "#cd4c6f" },
    { name: "Gamer",       cost: 3,        amount: 1, color: "#eb48ef" },
    { name: "Artist",      cost: 9,        amount: 1, color: "#4c4fcd" },
    { name: "Punk",        cost: 20,       amount: 1, color: "#4f4f4f" },
    { name: "Jock",        cost: 20,       amount: 1, color: "#4ccd6f" },
    { name: "Queer",       cost: 100,      amount: 1, color: "#4cc0cd" },
    { name: "Philosopher", cost: 1000,     amount: 1, color: "#521b65" },
    { name: "Elite",       cost: 1000,     amount: 1, color: "#cd834c" },
    { name: "Critic",      cost: 9000,     amount: 1, color: "#d3c749" },
    { name: "JockJr",      cost: 10000,    amount: 1, color: "#197b33" },
  ],
  inventories: [],
  laughs: [],
  stages: [],
  gains: []
};

function addAudience (socketid, type, amount) {
  if (type == PUNK) {
    state.punks_bought += amount;
  }

  if (type == CRITIC) {
    gameWonBy(socketid);
    clearInterval(stateInterval);
  }

  state.inventories[socketid].push({ type, amount, boughtOnTick: state.currentTick });
  removeTooMuchAudience(socketid);
}

function gameWonBy (socketId) {
  gameWonById = socketId;

  wss.clients.forEach(function each(ws) {
    ws.send(JSON.stringify({
      gameWonBy: socketId
    }));
  });

  setInterval(() => {
    process.exit();
  }, 2000);
}

function removeTooMuchAudience (socketid) {
  if (state.inventories[socketid].length == 0) return;

  var currentCount = countAudience(socketid);
  var toRemove = Math.max(0, currentCount - state.stages[socketid].size);

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
      var amountToAdd = state.shop[audienceType].amount;

      if (audienceType == ELITE || audienceType == PHILOSOPHER) {
        amountToAdd = 1;
      }

      addAudience(socketid, audienceType, amountToAdd);

      var cost = state.shop[audienceType].cost;

      if (audienceType == QUEER) {
        cost -= Math.min(countAudienceType(socketid, QUEER), state.QUEER_LOWEST_PRICE);
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
    if (state.inventories[socketid][k].type != type) continue;
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
  state.shop[TIKTOKKER].amount += 4;
  state.shop[GAMER].amount++;
  state.shop[ARTIST].amount++;
  state.shop[QUEER].amount++;
  state.shop[JOCK].amount++;

  if (state.currentTick % 4 == 0) {
    state.shop[PUNK].amount++;
  }

  state.shop[PUNK].amount = Math.min(state.shop[PUNK].amount, state.MAX_PUNKS - state.punks_bought);
  state.shop[PHILOSOPHER].amount = 1;
  state.shop[ELITE].amount = 1;
  state.shop[CRITIC].amount = 5;
}

function giveIncome () {
  for (var socketid = 0; socketid < state.inventories.length; socketid++) {
    var inventory = aggregatedAudience(socketid);
    var standardIncome = inventory[NORMIE] + inventory[TIKTOKKER] + inventory[GAMER] + inventory[ARTIST] + inventory[JOCK] + inventory[PUNK] * state.LAUGHS_PER_PUNK + inventory[QUEER] + inventory[ELITE] + inventory[JOCKJR];
    standardIncome += Math.min(inventory[QUEER], inventory[ARTIST]);
    state.laughs[socketid] += Math.floor(standardIncome / 3);
  }
}

function sendState () {
  var players = 4;

  wss.clients.forEach(function each(ws) {
    if (ws.id >= 0) players--;

    ws.send(JSON.stringify({
      gameWonBy: gameWonById,
      id: ws.id,
      state: state
    }));
  });

  // No players left
  if (players == 4) gameWonBy(0);
}

function jocks () {
  for (var socketid = 0; socketid < state.inventories.length; socketid++) {
    var jockCount = countAudienceType(socketid, JOCK);
    var jockJrCount = countAudienceType(socketid, JOCKJR);
    var toAdd = Math.floor(jockCount / 5);
    var MAX_FREE_JOCKS = Math.floor(state.stages[socketid].size / 2);

    if (jockCount + jockJrCount + toAdd > MAX_FREE_JOCKS)
      toAdd = MAX_FREE_JOCKS - (jockCount + jockJrCount);

    if (toAdd > 0) addAudience(socketid, JOCKJR, toAdd);
  }
}

function elites () {
  for (var socketid = 0; socketid < state.inventories.length; socketid++) {
    var toConvert = countAudienceType(socketid, ELITE);
    var sum = 0;

    var i = 0;
    while (toConvert > 0 && i < ELITE_CONVERSION.length) {
      var amount = Math.min(toConvert, countAudienceType(socketid, ELITE_CONVERSION[i].type));
      toConvert -= amount;
      state.laughs[socketid] += amount * ELITE_CONVERSION[i].reward;
      sum += amount * ELITE_CONVERSION[i].reward;
      removeAudience(socketid, ELITE_CONVERSION[i].type, amount);
      i++;
    }

    state.gains[socketid].elites = sum;
  }
}

function unmapInventory (socketid) {
  var seats = [];

  for (var k = 0; k < state.inventories[socketid].length; k++) {
    for (var j = 0; j < state.inventories[socketid][k].amount; j++) {
      seats.push(state.inventories[socketid][k].type);
    }
  }

  return seats;
}

function philosophers () {
  for (var socketid = 0; socketid < state.inventories.length; socketid++) {
    var seats = unmapInventory(socketid);
    var sum = 0;
    for (var i = 0; i < seats.length; i++) {
      if (seats[i] == PHILOSOPHER) {
        var audienceByType = [];
        if (i >= 4) audienceByType[seats[i - 4]] = true;
        if (i >= 3) audienceByType[seats[i - 3]] = true;
        if (i >= 2) audienceByType[seats[i - 2]] = true;
        if (i >= 1) audienceByType[seats[i - 1]] = true;
        if (i + 1 < seats.length) audienceByType[seats[i + 1]] = true;
        if (i + 2 < seats.length) audienceByType[seats[i + 2]] = true;
        if (i + 3 < seats.length) audienceByType[seats[i + 3]] = true;
        if (i + 4 < seats.length) audienceByType[seats[i + 4]] = true;

        var amount = 0;
        for (var j = 0; j < audienceByType.length; j++) {
          if (audienceByType[j]) amount++;
        }

        if (amount == 0) continue;
        state.laughs[socketid] += Math.pow(2, amount - 1);
        sum += Math.pow(2, amount - 1);
      }
    }

    state.gains[socketid].philosophers = sum;
  }
}

function buyMoreStage (socketid) {
  if (state.laughs[socketid] >= state.stages[socketid].cost) {
    state.stages[socketid].size += 50;
    state.laughs[socketid] -= state.stages[socketid].cost;
    state.stages[socketid].cost *= 3;
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

  if (socket.id == -1) return;

  var parsed;
  try {
    parsed = JSON.parse(message);
  } catch (e) {
    return;
  }

  if (typeof parsed.buy == "number" && !isNaN(parsed.buy)) {
    buyRequests[parsed.buy].push(socket.id);
  }

  if (parsed.buyMoreStage) {
    buyMoreStage(socket.id);
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

  ws.on('pong', heartbeat);
  ws.on('message', handleMessage);

  if (state.laughs[ws.id] == undefined) {
    state.laughs[ws.id] = 3;
    state.inventories[ws.id] = [];
    state.stages[ws.id] = { size: 50, cost: 5 };
    state.gains[ws.id] = {};
    addAudience(ws.id, 0, 3);
  }

  ws.send(JSON.stringify({
    gameWonBy: gameWonById,
    id: ws.id,
    state: state
  }));

  if (id == -1) return;
  id++;
  if (id >= state.MAX_PLAYERS) id = -1;
});

let started = false;
const stateInterval = setInterval(() => {
  if (started) tick();

  for (var i = 0; i < state.MAX_PLAYERS; i++) {
    if (state.laughs[i] == undefined) return;
  }

  started = true;
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