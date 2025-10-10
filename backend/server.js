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

const gameRoomPath = path.resolve(__dirname, './src/models/GameRoom');
delete require.cache[gameRoomPath];

const gameManagerPath = path.resolve(__dirname, './src/services/GameManager');
delete require.cache[gameManagerPath];

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

const REDIS_URL =
  process.env.REDIS_URL ||
  (process.env.NODE_ENV === 'production' ? PROD_REDIS_URL : 'redis://localhost:6379');

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

let redisService;
let gameManager;

async function initializeServices() {
  try {
    redisService = new RedisService(REDIS_URL);
    await redisService.connect();
    console.log('✅ RedisService connected');

    gameManager = new GameManager(questionsData, redisService);
    console.log('✅ GameManager initialized');

    return true;
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    console.warn('⚠️  Starting without Redis persistence');
    gameManager = new GameManager(questionsData, null);
    return false;
  }
}

app.get('/health', (req, res) => {
  try {
    const stats = gameManager ? gameManager.getStats() : {};
    res.status(200).json({
      status: 'healthy',
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
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

app.get('/', (req, res) => {
  res.json({
    message: 'Hintman Backend Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: ['/health', '/admin/stats'],
    websocket: 'enabled',
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
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        nodeVersion: process.version,
        redisPersistence: redisService ? 'enabled' : 'disabled'
      },
      game: gameManager ? gameManager.getStats() : {}
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

io.on('connection', (socket) => {
  console.log('🔗 Player connected:', socket.id);

  try {
    if (gameManager && typeof gameManager.handleConnection === 'function') {
      gameManager.handleConnection(socket);
    } else {
      console.error('❌ GameManager not ready or handleConnection not available');
      socket.emit('connectionError', { message: 'Server initializing, please retry' });
      socket.disconnect();
    }
  } catch (error) {
    console.error('Error in GameManager.handleConnection:', error);
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
    console.error('⚠️  Socket error for', socket.id, ':', error);
  });
});

io.engine.on('connection_error', (err) => {
  console.log('🚨 Socket.IO connection error:');
  console.log('  Request:', err.req?.url);
  console.log('  Origin:', err.req?.headers?.origin);
  console.log('  Error code:', err.code);
  console.log('  Error message:', err.message);
  console.log('  Error context:', err.context);
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
    path: req.originalUrl,
    method: req.method
  });
});

async function gracefulShutdown(signal) {
  console.log(`\n🔄 Received ${signal}, starting graceful shutdown...`);

  try {
    if (gameManager) {
      await gameManager.shutdown();
      console.log('✅ GameManager shutdown complete');
    }
  } catch (error) {
    console.error('❌ Error during GameManager shutdown:', error);
  }

  try {
    if (redisService) {
      await redisService.disconnect();
      console.log('✅ Redis disconnected');
    }
  } catch (error) {
    console.error('❌ Error disconnecting Redis:', error);
  }

  server.close((err) => {
    if (err) {
      console.error('❌ Error closing HTTP server:', err);
    } else {
      console.log('🔒 HTTP server closed');
    }
    process.exit(err ? 1 : 0);
  });

  setTimeout(() => {
    console.log('⏰ Forcing shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  console.error('Stack:', err.stack);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  gracefulShutdown('unhandledRejection');
});

const PORT = process.env.PORT || 10000;

// CRITICAL: Wait for services to initialize before starting server
initializeServices()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log('🎯 HINTMAN SERVER STARTUP');
      console.log('========================');
      console.log('🚀 Server running on port:', PORT);
      console.log('🌍 Environment:', process.env.NODE_ENV || 'production');
      console.log('📊 Questions loaded:', questionsData.length);
      console.log('💾 Memory usage:', `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
      console.log('🌐 CORS enabled');
      console.log('💾 Redis Persistence:', redisService ? 'ENABLED ✅' : 'DISABLED ❌');
      console.log('✅ GameManager ready');
      console.log('========================');
      console.log('🎯 Server ready to accept connections!');
    }).on('error', (err) => {
      console.error('❌ Failed to start server:', err);
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error('❌ Fatal error during initialization:', err);
    process.exit(1);
  });

module.exports = { app, server, io, gameManager, redisService };
