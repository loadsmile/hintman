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
    'https://hintman-frontend.vercel.app',
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

const sharedRedisClient = createClient({ url: REDIS_URL });
sharedRedisClient.on('error', (err) => console.error('❌ Redis Error:', err));
sharedRedisClient.on('connect', () => console.log('✅ Shared Redis Client Connected'));

const subClient = sharedRedisClient.duplicate();

let redisService = null;
let gameManager = null;
let isInitialized = false;

async function initializeServices() {
  if (isInitialized) return true;

  try {
    console.log('🔄 Connecting to Redis...');

    // Connect both clients
    await sharedRedisClient.connect();
    await subClient.connect();

    // Setup Socket.IO adapter
    io.adapter(createAdapter(sharedRedisClient, subClient));
    console.log('✅ Socket.IO Redis Adapter ready');

    // Create RedisService using the SAME connected client
    redisService = new RedisService(REDIS_URL, sharedRedisClient);
    await redisService.connect();
    console.log('✅ RedisService ready (persistence enabled)');

    gameManager = new GameManager(questionsData, redisService);
    console.log('✅ GameManager initialized WITH Redis persistence');

    isInitialized = true;
    return true;
  } catch (error) {
    console.error('❌ Redis initialization failed:', error.message);
    console.error('Stack:', error.stack);
    console.warn('⚠️  Starting without Redis persistence');

    gameManager = new GameManager(questionsData, null);
    console.log('✅ GameManager initialized (no persistence)');

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
    redisPersistence: redisService ? 'enabled' : 'disabled',
    players: stats.totalPlayers || 0,
    rooms: stats.totalRooms || 0
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Hintman Backend',
    version: '1.0.0',
    redis: redisService ? 'enabled' : 'disabled',
    initialized: isInitialized
  });
});

app.get('/admin/redis-test', async (req, res) => {
  if (!redisService) {
    return res.json({
      error: 'Redis not connected',
      redisService: 'null'
    });
  }

  try {
    // Test basic Redis operations
    await redisService.client.set('test:key', 'Hello Redis!', { EX: 60 });
    const value = await redisService.client.get('test:key');

    // Get all game-related keys
    const roomKeys = await redisService.getAllKeys('room:*');
    const survivalKeys = await redisService.getAllKeys('survival:*');
    const playerKeys = await redisService.getAllKeys('player:*');

    res.json({
      status: '✅ Redis is working!',
      testValue: value,
      persistence: {
        roomsInRedis: roomKeys.length,
        survivalRoomsInRedis: survivalKeys.length,
        playersInRedis: playerKeys.length
      },
      keys: {
        rooms: roomKeys,
        survivalRooms: survivalKeys,
        players: playerKeys
      }
    });
  } catch (error) {
    res.json({
      error: error.message,
      stack: error.stack
    });
  }
});

app.get('/admin/redis-connections', async (req, res) => {
  if (!redisService) {
    return res.json({
      error: 'Redis not connected',
      redisService: 'null'
    });
  }

  try {
    // Use the correct command for Redis v4+
    const clientList = await redisService.client.sendCommand(['CLIENT', 'LIST']);

    // Parse the client list
    const lines = clientList.split('\n').filter(line => line.trim());

    // Extract useful info from each connection
    const connections = lines.map(line => {
      const parts = {};
      line.split(' ').forEach(item => {
        const [key, value] = item.split('=');
        if (key && value) parts[key] = value;
      });
      return {
        id: parts.id,
        addr: parts.addr,
        age: parts.age + 's',
        idle: parts.idle + 's',
        name: parts.name || 'unnamed'
      };
    });

    res.json({
      totalConnections: lines.length,
      maxConnections: 50, // Free tier limit
      available: 50 - lines.length,
      percentUsed: ((lines.length / 50) * 100).toFixed(1) + '%',
      status: lines.length < 40 ? '✅ Healthy' : '⚠️ High usage',
      connections: connections.slice(0, 10), // Show first 10
      summary: {
        pubClient: connections.find(c => c.name.includes('pub')) || 'Active',
        subClient: connections.find(c => c.name.includes('sub')) || 'Active',
        sharedClient: 'Shared with pub/sub'
      }
    });
  } catch (error) {
    res.json({
      error: error.message,
      hint: 'Redis client might not support CLIENT LIST command',
      fallback: {
        totalConnections: '~2 (estimated)',
        maxConnections: 50,
        available: '~48',
        percentUsed: '~4%'
      }
    });
  }
});

app.get('/admin/stats', (req, res) => {
  res.json({
    server: {
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      redis: redisService ? 'enabled' : 'disabled',
      redisPersistence: redisService ? 'enabled' : 'disabled'
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

  if (sharedRedisClient && !redisService?.isSharedClient) {
    await sharedRedisClient.quit();
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
    console.log('✅ Redis Persistence:', redisService ? 'ENABLED' : 'DISABLED');
    console.log('✅ GameManager ready\n');
  });
}

startServer();

module.exports = { app, server, io };
