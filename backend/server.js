require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const redisAdapter = require('socket.io-redis');
const url = require('url');

const RedisService = require('./src/services/RedisService');

let questionsData;
try {
  questionsData = require('./src/data/questions.json');
  console.log('✅ Questions loaded:', questionsData.length);
} catch (error) {
  console.error('❌ Failed to load questions.json:', error.message);
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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

const io = socketIo(server, {
  cors: corsOptions,
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

const PROD_REDIS_URL = 'redis://red-d3jnigvfte5s73fuedh0:6379';
const REDIS_URL = process.env.REDIS_URL || (process.env.NODE_ENV === 'production' ? PROD_REDIS_URL : 'redis://localhost:6379');

const redisConn = url.parse(REDIS_URL);
const redisOpts = {
  host: redisConn.hostname,
  port: redisConn.port ? parseInt(redisConn.port, 10) : 6379,
};
if (redisConn.auth) {
  redisOpts.auth_pass = redisConn.auth.split(':')[1];
}
if (redisConn.protocol === 'rediss:') {
  redisOpts.tls = {};
}
io.adapter(redisAdapter(redisOpts));

let redisService = null;
let gameManager = null;
let isInitialized = false;

async function initializeServices() {
  if (isInitialized) {
    console.log('⚠️  Services already initialized');
    return true;
  }

  try {
    console.log('🔄 Initializing services...');

    redisService = new RedisService(REDIS_URL);
    await redisService.connect();
    console.log('✅ RedisService connected');

    gameManager = new GameManager(questionsData, redisService);
    console.log('✅ GameManager initialized');

    isInitialized = true;
    return true;
  } catch (error) {
    console.error('❌ Redis initialization failed:', error.message);
    console.warn('⚠️  Starting without Redis persistence');

    gameManager = new GameManager(questionsData, null);
    console.log('✅ GameManager initialized (without Redis)');

    isInitialized = true;
    return false;
  }
}

app.get('/health', (req, res) => {
  try {
    const stats = gameManager ? gameManager.getStats() : {};
    res.status(200).json({
      status: 'healthy',
      initialized: isInitialized,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      totalPlayers: stats.totalPlayers || 0,
      totalRooms: stats.totalRooms || 0,
      questionsLoaded: questionsData.length,
      nodeVersion: process.version,
      redisPersistence: redisService ? 'enabled' : 'disabled'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      initialized: isInitialized,
      error: error.message
    });
  }
});

app.get('/', (req, res) => {
  res.json({
    message: 'Hintman Backend Server',
    version: '1.0.0',
    initialized: isInitialized,
    timestamp: new Date().toISOString(),
    questionsLoaded: questionsData.length,
    redisPersistence: redisService ? 'enabled' : 'disabled'
  });
});

app.get('/admin/stats', (req, res) => {
  try {
    res.json({
      server: {
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        initialized: isInitialized,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        nodeVersion: process.version,
        redisPersistence: redisService ? 'enabled' : 'disabled'
      },
      game: gameManager ? gameManager.getStats() : { error: 'GameManager not initialized' }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

io.on('connection', (socket) => {
  console.log('🔗 Player connected:', socket.id);

  if (!isInitialized || !gameManager) {
    console.error('❌ Server not ready - GameManager not initialized');
    socket.emit('serverError', {
      message: 'Server is initializing. Please wait a moment and try again.',
      code: 'SERVER_INITIALIZING'
    });
    setTimeout(() => socket.disconnect(), 1000);
    return;
  }

  try {
    gameManager.handleConnection(socket);
  } catch (error) {
    console.error('❌ Error in handleConnection:', error);
    socket.emit('connectionError', { message: 'Failed to initialize connection' });
  }

  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  socket.on('getServerStats', () => {
    try {
      socket.emit('serverStats', gameManager ? gameManager.getStats() : {});
    } catch (error) {
      socket.emit('serverStats', { error: error.message });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Player disconnected:', socket.id, 'reason:', reason);
  });

  socket.on('error', (error) => {
    console.error('⚠️  Socket error:', socket.id, error);
  });
});

io.engine.on('connection_error', (err) => {
  if (err.code === 1 && err.message === 'Session ID unknown') {
    return;
  }
  console.log('🚨 Socket.IO connection error:', err.message);
});

app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl
  });
});

async function gracefulShutdown(signal) {
  console.log(`\n🔄 Received ${signal}, shutting down...`);

  if (gameManager) {
    try {
      await gameManager.shutdown();
      console.log('✅ GameManager shutdown');
    } catch (error) {
      console.error('❌ GameManager shutdown error:', error);
    }
  }

  if (redisService) {
    try {
      await redisService.disconnect();
      console.log('✅ Redis disconnected');
    } catch (error) {
      console.error('❌ Redis disconnect error:', error);
    }
  }

  server.close((err) => {
    console.log(err ? '❌ Server close error' : '✅ Server closed');
    process.exit(err ? 1 : 0);
  });

  setTimeout(() => {
    console.log('⏰ Force exit');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
  gracefulShutdown('unhandledRejection');
});

const PORT = process.env.PORT || 10000;

async function startServer() {
  try {
    await initializeServices();

    server.listen(PORT, '0.0.0.0', () => {
      console.log('\n🎯 HINTMAN SERVER STARTED');
      console.log('========================');
      console.log('🚀 Port:', PORT);
      console.log('📊 Questions:', questionsData.length);
      console.log('💾 Redis:', redisService ? 'ENABLED ✅' : 'DISABLED ❌');
      console.log('✅ GameManager: READY');
      console.log('========================\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, server, io };
