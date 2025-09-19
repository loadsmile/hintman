const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

// Fix the path to questions.json - it's in src/data/questions.json
const questionsData = require('./src/data/questions.json');

// Import GameManager with correct path
const GameManager = require('./src/services/GameManager');

const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://hintmangame.vercel.app',
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Socket.IO setup
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['polling', 'websocket'],
  allowEIO3: true
});

// Initialize Game Manager
const gameManager = new GameManager(questionsData);

// Health check endpoint
app.get('/health', (req, res) => {
  const stats = gameManager.getStats();
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    totalPlayers: stats.totalPlayers,
    totalRooms: stats.totalRooms,
    questionsLoaded: questionsData.length
  });
});

// Admin stats endpoint (optional)
app.get('/admin/stats', (req, res) => {
  res.json({
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production'
    },
    game: gameManager.getStats()
  });
});

// Socket connection handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Let GameManager handle the connection completely
  try {
    gameManager.handleConnection(socket);
  } catch (error) {
    console.error('Error in GameManager.handleConnection:', error);
    socket.emit('connectionError', { message: 'Failed to initialize connection' });
  }

  // Additional socket events for debugging/admin
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  socket.on('getServerStats', () => {
    socket.emit('serverStats', gameManager.getStats());
  });
});

// Error handling for socket.io
io.engine.on('connection_error', (err) => {
  console.log('Socket.IO connection error:', err.req);
  console.log('Error code:', err.code);
  console.log('Error message:', err.message);
  console.log('Error context:', err.context);
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

  server.close(() => {
    console.log('🔒 HTTP server closed');
    process.exit(0);
  });

  // Force close after 30 seconds
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

server.listen(PORT, () => {
  console.log('GameManager initialized with', questionsData.length, 'questions');
  console.log('🚀 HINTMAN Server running on port', PORT);
  console.log('🌍 Environment:', process.env.NODE_ENV || 'production');
  console.log('📊 Questions loaded:', questionsData.length);
  console.log('💾 Memory usage:', `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  console.log('📁 Working directory:', __dirname);
  console.log('🎯 Server ready to accept connections!');

  // Log first few questions for verification
  if (questionsData.length > 0) {
    console.log('📝 Sample questions loaded:');
    questionsData.slice(0, 3).forEach((q, i) => {
      console.log(`   ${i + 1}. ${q.answer} (${q.category})`);
    });
  }
});

// Export for testing if needed
module.exports = { app, server, io, gameManager };
