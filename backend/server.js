const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const questionsData = require('./data/questions.json');
const GameManager = require('./src/services/GameManager');

const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://hintmangame.vercel.app',
    'https://hintman-frontend.vercel.app'
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Socket.IO setup with CORS
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['polling', 'websocket'],
  allowEIO3: true
});

// Initialize Game Manager
const gameManager = new GameManager(questionsData);

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    ...gameManager.getStats()
  });
});

// Admin stats endpoint
app.get('/admin/stats', (req, res) => {
  res.json({
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    },
    game: gameManager.getStats()
  });
});

// Admin rooms endpoint
app.get('/admin/rooms', (req, res) => {
  res.json(gameManager.getAllRooms());
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Let GameManager handle all socket events
  gameManager.handleConnection(socket);

  // Additional socket events can be handled here if needed
  socket.on('ping', () => {
    socket.emit('pong');
  });

  socket.on('getStats', () => {
    socket.emit('stats', gameManager.getStats());
  });
});

// Keep-alive mechanism for Render
let keepAliveInterval;

function startKeepAlive() {
  console.log('🔄 Starting keep-alive mechanism...');

  keepAliveInterval = setInterval(() => {
    // Internal health check
    const stats = gameManager.getStats();
    console.log(`💓 Keep-alive: ${stats.totalPlayers} players, ${stats.totalRooms} rooms`);

    // Cleanup abandoned rooms
    gameManager.cleanupAbandonedRooms();
  }, 10 * 60 * 1000); // Every 10 minutes

  console.log('✅ Keep-alive mechanism started (10-minute intervals)');
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('🛑 Keep-alive mechanism stopped');
  }
}

// Graceful shutdown handling
function gracefulShutdown(signal) {
  console.log(`\n🔄 Received ${signal}, starting graceful shutdown...`);

  stopKeepAlive();

  // Shutdown GameManager
  gameManager.shutdown();

  // Close server
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
  console.error('Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start server
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log('🚀 HINTMAN Server running on port', PORT);
  console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
  console.log('📊 Questions loaded:', questionsData.length);
  console.log('💾 Memory usage:', `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);

  startKeepAlive();

  console.log('🎯 Server ready to accept connections!');
});

module.exports = { app, server, io };
