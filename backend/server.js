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

// Socket connection handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Let GameManager handle the connection completely
  try {
    gameManager.handleConnection(socket);
  } catch (error) {
    console.error('Error in GameManager.handleConnection:', error);
    socket.emit('error', { message: 'Failed to initialize connection' });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');

  try {
    gameManager.shutdown();
  } catch (error) {
    console.error('Error during GameManager shutdown:', error);
  }

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');

  try {
    gameManager.shutdown();
  } catch (error) {
    console.error('Error during GameManager shutdown:', error);
  }

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log('GameManager initialized with', questionsData.length, 'questions');
  console.log('🚀 HINTMAN Server running on port', PORT);
  console.log('🌍 Environment:', process.env.NODE_ENV || 'production');
  console.log('📊 Questions loaded:', questionsData.length);
  console.log('💾 Memory usage:', `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  console.log('🎯 Server ready to accept connections!');
});
