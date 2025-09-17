const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const GameManager = require('./src/services/GameManager'); // Fixed path

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

// Health check endpoints
app.get('/', (req, res) => {
  const stats = gameManager.getStats();
  res.json({
    status: 'HINTMAN Server is running!',
    ...stats,
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  const stats = gameManager.getStats();
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    ...stats
  });
});

app.get('/stats', (req, res) => {
  const stats = gameManager.getStats();
  res.json(stats);
});

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

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  gameManager.cleanup();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  gameManager.cleanup();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`HINTMAN Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Questions loaded: ${gameManager.getStats().totalQuestions}`);
});
