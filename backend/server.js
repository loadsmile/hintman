const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

// Import questions data
let questionsData;
try {
  questionsData = require('./src/data/questions.json');
  console.log('✅ Questions loaded successfully:', questionsData.length);
} catch (error) {
  console.error('❌ Failed to load questions.json:', error.message);
  process.exit(1);
}

// Force clear require cache to ensure latest GameRoom.js is loaded
const gameRoomPath = path.resolve(__dirname, './src/models/GameRoom');
delete require.cache[gameRoomPath];
console.log('🔄 Cleared GameRoom cache, loading fresh version...');

// Clear GameManager cache too
const gameManagerPath = path.resolve(__dirname, './src/services/GameManager');
delete require.cache[gameManagerPath];
console.log('🔄 Cleared GameManager cache, loading fresh version...');

// Import GameManager
const GameManager = require('./src/services/GameManager');

const app = express();
const server = http.createServer(app);

// CORS configuration
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

// Socket.IO setup
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Initialize Game Manager
let gameManager;
try {
  gameManager = new GameManager(questionsData);
  console.log('✅ GameManager initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize GameManager:', error);
  process.exit(1);
}

// Health check endpoint
app.get('/health', (req, res) => {
  try {
    const stats = gameManager.getStats();
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      totalPlayers: stats.totalPlayers,
      totalRooms: stats.totalRooms,
      questionsLoaded: questionsData.length,
      nodeVersion: process.version
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

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Hintman Backend Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: ['/health', '/admin/stats'],
    websocket: 'enabled',
    questionsLoaded: questionsData.length
  });
});

// Admin stats endpoint
app.get('/admin/stats', (req, res) => {
  try {
    res.json({
      server: {
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        nodeVersion: process.version
      },
      game: gameManager.getStats()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket connection handling
io.on('connection', (socket) => {
  console.log('🔗 Player connected:', socket.id);

  try {
    gameManager.handleConnection(socket);
  } catch (error) {
    console.error('Error in GameManager.handleConnection:', error);
    socket.emit('connectionError', { message: 'Failed to initialize connection' });
  }

  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  socket.on('getServerStats', () => {
    try {
      socket.emit('serverStats', gameManager.getStats());
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

// Error handling for socket.io
io.engine.on('connection_error', (err) => {
  console.log('🚨 Socket.IO connection error:');
  console.log('  Request:', err.req?.url);
  console.log('  Origin:', err.req?.headers?.origin);
  console.log('  Error code:', err.code);
  console.log('  Error message:', err.message);
  console.log('  Error context:', err.context);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
    method: req.method
  });
});

// Graceful shutdown handlers
function gracefulShutdown(signal) {
  console.log(`\n🔄 Received ${signal}, starting graceful shutdown...`);

  try {
    gameManager.shutdown();
    console.log('✅ GameManager shutdown complete');
  } catch (error) {
    console.error('❌ Error during GameManager shutdown:', error);
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

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
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

// Start server
const PORT = process.env.PORT || 10000;

server.listen(PORT, '0.0.0.0', () => {
  console.log('🎯 HINTMAN SERVER STARTUP');
  console.log('========================');
  console.log('🚀 Server running on port:', PORT);
  console.log('🌍 Environment:', process.env.NODE_ENV || 'production');
  console.log('📊 Questions loaded:', questionsData.length);
  console.log('💾 Memory usage:', `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  console.log('🌐 CORS enabled for multiple origins');
  console.log('🎮 OneVsOne system: Hints FREE, Speed matters, No penalties');
  console.log('========================');

  if (gameManager) {
    console.log('✅ GameManager ready');
  }

  console.log('📝 Sample questions loaded:');
  questionsData.slice(0, 3).forEach((q, i) => {
    console.log(`   ${i + 1}. ${q.answer} (${q.category})`);
  });

  console.log('🎯 Server ready to accept connections!');
}).on('error', (err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

module.exports = { app, server, io, gameManager };
