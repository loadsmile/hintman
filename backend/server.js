require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const RedisService = require('./src/services/RedisService');

let questionsData;
try {
  questionsData = require('./src/data/questions.json');
  console.log('✅ Questions loaded:', questionsData.length);
} catch (error) {
  console.error('❌ Failed to load questions:', error.message);
  process.exit(1);
}

const GameManager = require('./src/services/GameManager');

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://hintman.vercel.app',
    /\.vercel\.app$/,
    /^https?:\/\/localhost(:\d+)?$/
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

const io = socketIo(server, {
  cors: corsOptions,
  transports: ['polling', 'websocket'],
  pingTimeout: 60000,
  pingInterval: 25000
});

const REDIS_URL = process.env.REDIS_URL || 'redis://red-d3jnigvfte5s73fuedh0.render.com:6379';

// Socket.IO Redis Adapter
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  console.log('✅ Socket.IO Redis Adapter ready');
}).catch((err) => {
  console.warn('⚠️  Redis Adapter failed:', err.message);
});

let redisService = null;
let gameManager = null;
let isInitialized = false;

async function initializeServices() {
  if (isInitialized) return true;

  try {
    console.log('🔄 Initializing Redis persistence...');

    redisService = new RedisService(REDIS_URL);
    await redisService.connect();
    console.log('✅ RedisService connected');

    gameManager = new GameManager(questionsData, redisService);
    console.log('✅ GameManager initialized with Redis');

    isInitialized = true;
    return true;
  } catch (error) {
    console.error('❌ Redis error:', error.message);
    console.warn('⚠️  Starting without persistence');

    gameManager = new GameManager(questionsData, null);
    console.log('✅ GameManager initialized (no Redis)');

    isInitialized = true;
    return false;
  }
}

app.get('/health', (req, res) => {
  const stats = gameManager ? gameManager.getStats() : {};
  res.json({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    redis: redisService ? 'connected' : 'disconnected',
    players: stats.totalPlayers || 0,
    rooms: stats.totalRooms || 0
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Hintman Backend',
    version: '1.0.0',
    redis: redisService ? 'enabled' : 'disabled'
  });
});

// Test endpoint to verify Redis persistence
app.get('/admin/redis-test', async (req, res) => {
  if (!redisService) {
    return res.json({ error: 'Redis not connected' });
  }

  try {
    // Test save
    await redisService.client.set('test:key', 'Hello Redis!', { EX: 60 });
    const value = await redisService.client.get('test:key');

    // Get all room keys
    const roomKeys = await redisService.getAllKeys('room:*');
    const survivalKeys = await redisService.getAllKeys('survival:*');

    res.json({
      status: 'Redis working!',
      testValue: value,
      roomsInRedis: roomKeys.length,
      survivalRoomsInRedis: survivalKeys.length,
      roomKeys,
      survivalKeys
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.get('/admin/stats', (req, res) => {
  res.json({
    server: {
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      redis: redisService ? 'enabled' : 'disabled'
    },
    game: gameManager ? gameManager.getStats() : {}
  });
});

io.on('connection', (socket) => {
  if (!isInitialized || !gameManager) {
    socket.emit('serverError', { message: 'Server initializing' });
    socket.disconnect();
    return;
  }

  try {
    gameManager.handleConnection(socket);
  } catch (error) {
    console.error('Connection error:', error);
    socket.disconnect();
  }

  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
  });
});

io.engine.on('connection_error', (err) => {
  if (err.code !== 1) {
    console.log('Socket error:', err.message);
  }
});

async function gracefulShutdown(signal) {
  console.log(`Shutting down (${signal})...`);

  if (gameManager) {
    await gameManager.shutdown();
  }

  if (redisService) {
    await redisService.disconnect();
  }

  if (pubClient) {
    await pubClient.quit();
  }

  if (subClient) {
    await subClient.quit();
  }

  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const PORT = process.env.PORT || 10000;

async function startServer() {
  await initializeServices();

  server.listen(PORT, '0.0.0.0', () => {
    console.log('\n✅ Server running on port', PORT);
    console.log('✅ Redis:', redisService ? 'ENABLED' : 'DISABLED');
    console.log('✅ GameManager ready\n');
  });
}

startServer();

module.exports = { app, server, io };
