const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

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

// Game state management
const games = new Map();
const waitingPlayers = new Map();

// Sample questions for the server
const sampleQuestions = [
  {
    id: 'q1',
    answer: "Newton's First Law",
    category: 'Physics',
    difficulty: 'medium',
    hints: [
      'This scientific principle changed how we understand motion',
      'Named after an English physicist and mathematician',
      'Also known as the Law of Inertia',
      'States that objects at rest stay at rest unless acted upon by force',
      'F = ma is related, but this is specifically about objects in motion or at rest'
    ]
  },
  {
    id: 'q2',
    answer: 'Leonardo da Vinci',
    category: 'Art & History',
    difficulty: 'easy',
    hints: [
      'This Renaissance master created some of the world\'s most famous paintings',
      'Born in Italy in the 15th century',
      'Known for both art and scientific inventions',
      'Painted the Mona Lisa',
      'Also painted The Last Supper'
    ]
  },
  {
    id: 'q3',
    answer: 'Photosynthesis',
    category: 'Biology',
    difficulty: 'medium',
    hints: [
      'This process is essential for life on Earth',
      'Involves converting light energy into chemical energy',
      'Plants use this to create food from sunlight',
      'Produces oxygen as a byproduct',
      'Uses chlorophyll and occurs mainly in leaves'
    ]
  },
  {
    id: 'q4',
    answer: 'Mount Everest',
    category: 'Geography',
    difficulty: 'easy',
    hints: [
      'This is the highest point on Earth',
      'Located in the Himalayas',
      'Sits on the border between Nepal and Tibet',
      'Many climbers attempt to reach its summit each year',
      'Also known as Sagarmatha in Nepali'
    ]
  },
  {
    id: 'q5',
    answer: 'World War II',
    category: 'History',
    difficulty: 'medium',
    hints: [
      'This global conflict lasted from 1939 to 1945',
      'Involved most of the world\'s nations',
      'Featured the Holocaust and atomic bomb usage',
      'Axis powers fought against Allied powers',
      'Ended with Germany and Japan\'s surrender'
    ]
  },
  {
    id: 'q6',
    answer: 'Albert Einstein',
    category: 'Science',
    difficulty: 'medium',
    hints: [
      'This scientist is often called the Father of Relativity',
      'He developed the famous equation E=mc²',
      'He won the Nobel Prize in Physics in 1921',
      'His wild hair and mustache made him instantly recognizable',
      'He was born in Germany but later became an American citizen'
    ]
  },
  {
    id: 'q7',
    answer: 'The Great Wall of China',
    category: 'Geography',
    difficulty: 'easy',
    hints: [
      'This ancient structure stretches for thousands of miles',
      'It was built to protect against invasions from the north',
      'Construction began in the 7th century BC',
      'It is visible from space (though this is a myth)',
      'It winds through deserts, grasslands, and mountains in Asia'
    ]
  },
  {
    id: 'q8',
    answer: 'William Shakespeare',
    category: 'Literature',
    difficulty: 'easy',
    hints: [
      'This English playwright is considered the greatest writer in the English language',
      'He wrote 39 plays and 154 sonnets',
      'His works include tragedies, comedies, and histories',
      'He created characters like Hamlet, Romeo, and Juliet',
      'He lived from 1564 to 1616 in Stratford-upon-Avon'
    ]
  },
  {
    id: 'q9',
    answer: 'The Titanic',
    category: 'History',
    difficulty: 'easy',
    hints: [
      'This "unsinkable" ship sank on its maiden voyage in 1912',
      'It hit an iceberg in the North Atlantic Ocean',
      'Over 1,500 people died in the disaster',
      'It was traveling from Southampton to New York City',
      'James Cameron made a famous movie about this tragedy'
    ]
  },
  {
    id: 'q10',
    answer: 'Jupiter',
    category: 'Science',
    difficulty: 'easy',
    hints: [
      'This is the largest planet in our solar system',
      'It is a gas giant with no solid surface',
      'It has a Great Red Spot that is actually a giant storm',
      'It has over 80 known moons',
      'Its four largest moons were discovered by Galileo'
    ]
  }
];

class GameRoom {
  constructor(id) {
    this.id = id;
    this.players = [];
    this.currentQuestion = 0;
    this.questions = this.shuffleQuestions();
    this.gameState = 'waiting'; // waiting, playing, finished
    this.currentHintIndex = 0;
    this.hintTimer = null;
    this.questionTimer = null;
    this.scores = {};
    this.startTime = null;
    this.questionAnswered = false;
  }

  shuffleQuestions() {
    const shuffled = [...sampleQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 5); // Take 5 questions
  }

  addPlayer(socket, playerName) {
    if (this.players.length >= 2) return false;

    const player = {
      id: socket.id,
      name: playerName,
      score: 0,
      socket: socket
    };

    this.players.push(player);
    this.scores[socket.id] = 0;

    return true;
  }

  removePlayer(socketId) {
    this.players = this.players.filter(p => p.id !== socketId);
    delete this.scores[socketId];

    if (this.players.length === 0) {
      this.cleanup();
    }
  }

  startGame() {
    if (this.players.length !== 2) return;

    console.log('Starting game with players:', this.players.map(p => p.name));
    this.gameState = 'playing';
    this.currentQuestion = 0;
    this.startQuestion();
  }

  startQuestion() {
    if (this.currentQuestion >= this.questions.length) {
      this.endGame();
      return;
    }

    const question = this.questions[this.currentQuestion];
    this.currentHintIndex = 0;
    this.startTime = Date.now();
    this.questionAnswered = false;

    console.log(`Starting question ${this.currentQuestion + 1}: ${question.answer}`);

    // Send question start to all players
    this.broadcast('questionStart', {
      questionIndex: this.currentQuestion + 1,
      totalQuestions: this.questions.length,
      category: question.category,
      difficulty: question.difficulty
    });

    // Start hint revealing - first hint immediately
    setTimeout(() => {
      this.revealHint();
    }, 1000);

    // Set up hint timer for subsequent hints
    this.hintTimer = setInterval(() => {
      this.revealHint();
    }, 15000);

    // Set question timeout (2 minutes)
    this.questionTimer = setTimeout(() => {
      if (!this.questionAnswered) {
        this.handleQuestionTimeout();
      }
    }, 120000);
  }

  revealHint() {
    const question = this.questions[this.currentQuestion];
    if (this.currentHintIndex >= question.hints.length) return;

    const hint = {
      index: this.currentHintIndex,
      text: question.hints[this.currentHintIndex]
    };

    console.log(`Revealing hint ${this.currentHintIndex + 1}: ${hint.text}`);
    this.broadcast('hintRevealed', hint);
    this.currentHintIndex++;
  }

  handleGuess(socketId, guess) {
    const question = this.questions[this.currentQuestion];
    const player = this.players.find(p => p.id === socketId);

    if (!player || this.gameState !== 'playing' || this.questionAnswered) return;

    console.log(`${player.name} guessed: ${guess}`);

    const isCorrect = guess.toLowerCase().trim() === question.answer.toLowerCase().trim();
    const timeElapsed = (Date.now() - this.startTime) / 1000;

    if (isCorrect) {
      this.questionAnswered = true;

      // Calculate score based on time and hints used
      const timeBonus = Math.max(0, 100 - timeElapsed);
      const hintPenalty = this.currentHintIndex * 15;
      const points = Math.max(10, Math.round(200 + timeBonus - hintPenalty));

      this.scores[socketId] += points;

      console.log(`${player.name} got it right! Points: ${points}`);

      this.broadcast('questionResult', {
        winner: socketId,
        winnerName: player.name,
        correctAnswer: question.answer,
        points: points,
        timeElapsed: timeElapsed,
        scores: this.scores
      });

      this.nextQuestion();
    } else {
      // Wrong answer - send only to the player who guessed
      console.log(`${player.name} got it wrong`);
      player.socket.emit('wrongAnswer', { guess });
    }
  }

  handleQuestionTimeout() {
    if (this.questionAnswered) return;

    const question = this.questions[this.currentQuestion];
    console.log(`Question timeout: ${question.answer}`);

    this.broadcast('questionResult', {
      winner: null,
      correctAnswer: question.answer,
      points: 0,
      timeElapsed: 120,
      scores: this.scores
    });

    this.nextQuestion();
  }

  nextQuestion() {
    this.clearTimers();

    setTimeout(() => {
      this.currentQuestion++;
      if (this.currentQuestion < this.questions.length) {
        this.startQuestion();
      } else {
        this.endGame();
      }
    }, 3000); // 3 second delay before next question
  }

  endGame() {
    this.clearTimers();
    this.gameState = 'finished';

    const results = this.players.map(p => ({
      id: p.id,
      name: p.name,
      score: this.scores[p.id] || 0
    })).sort((a, b) => b.score - a.score);

    console.log('Game ended. Final results:', results);
    this.broadcast('gameEnd', { results });
  }

  clearTimers() {
    if (this.hintTimer) {
      clearInterval(this.hintTimer);
      this.hintTimer = null;
    }
    if (this.questionTimer) {
      clearTimeout(this.questionTimer);
      this.questionTimer = null;
    }
  }

  cleanup() {
    console.log(`Cleaning up game room ${this.id}`);
    this.clearTimers();
    games.delete(this.id);
  }

  broadcast(event, data) {
    console.log(`Broadcasting ${event} to ${this.players.length} players`);
    this.players.forEach(player => {
      player.socket.emit(event, data);
    });
  }
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'HINTMAN Server is running!',
    activeGames: games.size,
    waitingPlayers: waitingPlayers.size
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    activeGames: games.size,
    waitingPlayers: waitingPlayers.size
  });
});

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('findMatch', ({ playerName }) => {
    console.log(`${playerName} (${socket.id}) looking for match...`);

    // Check if there's a waiting player
    const waitingPlayerEntries = Array.from(waitingPlayers.entries());
    const waitingPlayerEntry = waitingPlayerEntries.find(([id]) => id !== socket.id);

    if (waitingPlayerEntry) {
      const [waitingPlayerId, waitingPlayerName] = waitingPlayerEntry;
      const waitingPlayerSocket = io.sockets.sockets.get(waitingPlayerId);

      if (waitingPlayerSocket) {
        // Create new game room
        const gameId = uuidv4();
        const gameRoom = new GameRoom(gameId);

        // Add both players
        gameRoom.addPlayer(waitingPlayerSocket, waitingPlayerName);
        gameRoom.addPlayer(socket, playerName);

        // Remove from waiting
        waitingPlayers.delete(waitingPlayerId);

        // Join socket rooms
        waitingPlayerSocket.join(gameId);
        socket.join(gameId);

        // Store game
        games.set(gameId, gameRoom);

        console.log(`Match found! ${waitingPlayerName} vs ${playerName}`);

        // Notify players
        gameRoom.broadcast('matchFound', {
          gameId: gameId,
          players: gameRoom.players.map(p => ({ id: p.id, name: p.name }))
        });

        // Start game after brief delay
        setTimeout(() => {
          gameRoom.startGame();
        }, 2000);
      } else {
        // Waiting player socket no longer exists, clean up
        waitingPlayers.delete(waitingPlayerId);
        waitingPlayers.set(socket.id, playerName);
        socket.emit('waitingForMatch');
      }
    } else {
      // Add to waiting list
      console.log(`${playerName} added to waiting list`);
      waitingPlayers.set(socket.id, playerName);
      socket.emit('waitingForMatch');
    }
  });

  socket.on('submitGuess', ({ guess }) => {
    // Find which game this player is in
    for (const [gameId, game] of games) {
      const player = game.players.find(p => p.id === socket.id);
      if (player) {
        game.handleGuess(socket.id, guess);
        break;
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);

    // Remove from waiting list
    waitingPlayers.delete(socket.id);

    // Remove from any active games
    for (const [gameId, game] of games) {
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const disconnectedPlayer = game.players[playerIndex];
        console.log(`${disconnectedPlayer.name} left game ${gameId}`);

        game.removePlayer(socket.id);

        // Notify remaining player
        if (game.players.length === 1) {
          game.broadcast('playerDisconnected');
          // End the game after a delay
          setTimeout(() => {
            game.cleanup();
          }, 5000);
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`HINTMAN Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
