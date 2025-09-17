const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const GameManager = require('./src/services/GameManager');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:5173", // For local development
      "https://hintmangame.vercel.app" // Your Vercel production URL
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Initialize Game Manager
const gameManager = new GameManager();

// Keep-alive mechanism
let keepAliveInterval = null;

function startKeepAlive() {
  // Only enable keep-alive in production
  if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
    console.log('🔄 Starting keep-alive mechanism...');

    keepAliveInterval = setInterval(async () => {
      try {
        const stats = gameManager.getStats();
        console.log(`💓 Keep-alive ping: ${new Date().toISOString()} - Active games: ${stats.activeGames}, Waiting players: ${stats.waitingPlayers}`);

        // Clean up stale games during keep-alive
        gameManager.cleanupStaleGames();

        // Log memory usage
        const memUsage = process.memoryUsage();
        console.log(`📊 Memory usage: RSS=${Math.round(memUsage.rss/1024/1024)}MB, Heap=${Math.round(memUsage.heapUsed/1024/1024)}MB`);

      } catch (error) {
        console.error('❌ Keep-alive error:', error);
      }
    }, 10 * 60 * 1000); // 10 minutes

    console.log('✅ Keep-alive mechanism started (10-minute intervals)');
  } else {
    console.log('🔧 Keep-alive disabled in development mode');
  }
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('🛑 Keep-alive mechanism stopped');
  }
}

// Health check endpoints
app.get('/', (req, res) => {
  const stats = gameManager.getStats();
  const uptime = process.uptime();

  res.json({
    status: 'HINTMAN Server is running!',
    ...stats,
    timestamp: new Date().toISOString(),
    uptime: Math.round(uptime),
    uptimeFormatted: formatUptime(uptime),
    environment: process.env.NODE_ENV || 'development',
    keepAliveActive: keepAliveInterval !== null,
    memoryUsage: process.memoryUsage()
  });
});

app.get('/health', (req, res) => {
  const stats = gameManager.getStats();
  const uptime = process.uptime();

  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: Math.round(uptime),
    ...stats
  });
});

app.get('/ping', (req, res) => {
  // Simple ping endpoint for external monitoring
  res.json({
    pong: true,
    timestamp: new Date().toISOString(),
    server: 'HINTMAN'
  });
});

app.get('/stats', (req, res) => {
  const stats = gameManager.getDetailedStats();
  res.json(stats);
});

app.get('/wake', (req, res) => {
  // Special endpoint for wake-up calls
  console.log('🌅 Wake-up call received from:', req.ip);

  const stats = gameManager.getStats();
  res.json({
    message: 'Server is awake!',
    timestamp: new Date().toISOString(),
    ...stats
  });
});

// Utility function to format uptime
function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('findMatch', ({ playerName }) => {
    gameManager.findMatch(socket, playerName);
  });

  socket.on('submitGuess', ({ guess }) => {
    gameManager.handleGuess(socket, guess);
  });

  socket.on('disconnect', () => {
    gameManager.handleDisconnection(socket);
  });
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  stopKeepAlive();
  gameManager.cleanup();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  stopKeepAlive();
  gameManager.cleanup();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  stopKeepAlive();
  gameManager.cleanup();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 HINTMAN Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Questions loaded: ${gameManager.getStats().totalQuestions}`);
  console.log(`💾 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);

  // Start keep-alive mechanism
  startKeepAlive();

  console.log('🎯 Server ready to accept connections!');
});
