const test = require('node:test');
const assert = require('node:assert/strict');

const SurvivalRoom = require('../src/models/SurvivalRoom');
const GameManager = require('../src/services/GameManager');

const QUESTIONS = [
  {
    id: 1,
    answer: 'Mercury',
    category: 'Science',
    difficulty: 'easy',
    hints: ['Planet', 'Closest to the sun', 'Roman god', 'Tiny world', 'Gray surface']
  }
];

class FakeSocket {
  constructor(id) {
    this.id = id;
    this.connected = true;
    this.serverEvents = [];
    this.handlers = new Map();
  }

  on(event, handler) {
    const existingHandlers = this.handlers.get(event) || [];
    existingHandlers.push(handler);
    this.handlers.set(event, existingHandlers);
  }

  emit(event, data) {
    this.serverEvents.push({ event, data });
  }

  trigger(event, data) {
    const handlers = this.handlers.get(event) || [];
    handlers.forEach((handler) => handler(data));
  }

  listenerCount(event) {
    return (this.handlers.get(event) || []).length;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createStartedRoom() {
  const room = new SurvivalRoom('SURVIVAL-TEST', QUESTIONS);
  room.FIRST_HINT_DELAY_MS = 25;
  room.HINT_INTERVAL_MS = 40;
  room.QUESTION_DURATION_MS = 140;
  room.ROUND_TRANSITION_DELAY_MS = 0;
  room.END_GAME_DELAY_MS = 10;

  const socketA = new FakeSocket('socket-a');
  const socketB = new FakeSocket('socket-b');

  room.addPlayer(socketA, 'Alice');
  room.addPlayer(socketB, 'Bob');
  room.setPlayerReady(socketA.id, true);
  room.setPlayerReady(socketB.id, true);
  room.startGame();

  return { room, socketA, socketB };
}

test('SurvivalRoom pause/resume preserves remaining hint and question timers', async () => {
  const { room, socketA } = createStartedRoom();

  await sleep(10);
  await sleep(10);

  const paused = room.pauseGame('Network interruption');
  assert.equal(paused, true);
  assert.equal(room.gameState, 'paused');
  assert.ok(room.pausedState.nextHintRemainingMs > 0);
  assert.ok(room.pausedState.questionRemainingMs > 0);

  const pausedHintCount = socketA.serverEvents.filter(({ event }) => event === 'hintRevealed').length;
  await sleep(room.pausedState.nextHintRemainingMs + 20);
  assert.equal(socketA.serverEvents.filter(({ event }) => event === 'hintRevealed').length, pausedHintCount);

  room.resumeGame();
  assert.equal(room.gameState, 'playing');

  await sleep(50);
  assert.ok(
    socketA.serverEvents.filter(({ event }) => event === 'hintRevealed').length >= pausedHintCount + 1,
    'expected hint scheduling to continue after resume'
  );

  await sleep(120);
  const timeoutEvent = socketA.serverEvents.find(({ event, data }) => event === 'questionResult' && data.isTimeout);
  assert.ok(timeoutEvent, 'expected timeout after resume with preserved remaining question time');

  room.cleanup();
});

test('GameManager reconnection does not duplicate socket handlers', async () => {
  const manager = new GameManager(QUESTIONS);
  const originalSocket = new FakeSocket('socket-a');
  const otherSocket = new FakeSocket('socket-b');

  const room = new SurvivalRoom('SURVIVAL-ROOM', QUESTIONS);
  room.addPlayer(originalSocket, 'Alice');
  room.addPlayer(otherSocket, 'Bob');
  room.health[originalSocket.id] = room.MAX_HEALTH;
  room.health[otherSocket.id] = room.MAX_HEALTH;
  room.gameState = 'paused';
  room.pausedState = {
    currentQuestion: 0,
    currentHintIndex: 1,
    questionAnswered: false,
    startTime: Date.now(),
    pausedAt: Date.now(),
    reason: 'Alice disconnected',
    nextHintRemainingMs: 25,
    questionRemainingMs: 80,
    nextQuestionRemainingMs: null,
    nextQuestionAction: null,
    endGameRemainingMs: null
  };

  manager.survivalRooms.set(room.id, room);
  manager.connectedPlayers.set(originalSocket.id, {
    socket: originalSocket,
    connectedAt: Date.now(),
    currentRoom: room.id,
    roomType: 'survival',
    playerName: 'Alice'
  });
  manager.disconnectedPlayers.set(`Alice:${room.id}`, {
    oldSocketId: originalSocket.id,
    roomId: room.id,
    roomType: 'survival',
    playerName: 'Alice',
    disconnectedAt: Date.now()
  });

  const reconnectingSocket = new FakeSocket('socket-c');
  manager.handleConnection(reconnectingSocket);
  assert.equal(reconnectingSocket.listenerCount('submitGuess'), 1);
  assert.equal(reconnectingSocket.listenerCount('playerReady'), 1);
  assert.equal(reconnectingSocket.listenerCount('playerUnready'), 1);
  assert.equal(reconnectingSocket.listenerCount('disconnect'), 1);

  await manager.handleReconnection(reconnectingSocket, room.id, 'Alice');

  assert.equal(reconnectingSocket.listenerCount('submitGuess'), 1);
  assert.equal(reconnectingSocket.listenerCount('playerReady'), 1);
  assert.equal(reconnectingSocket.listenerCount('playerUnready'), 1);
  assert.equal(reconnectingSocket.listenerCount('disconnect'), 1);

  room.cleanup();
  await manager.shutdown();
});
