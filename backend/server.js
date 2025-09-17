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
    origin: "http://localhost:5173", // Vite dev server
    methods: ["GET", "POST"]
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
  }
];

class GameRoom {
  constructor(id) {
    this.id = id;
    this.players = [];
    this.currentQuestion = 0;
    this.questions = this.shuffleQuestions();
    this.gameState = 'waiting';
    this.currentHintIndex = 0;
    this.hintTimer = null;
    this.questionTimer = null;
    this.scores = {};
    this.startTime = null;
  }

  shuffleQuestions() {
    const shuffled = [...sampleQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 5);
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

    this.broadcast('questionStart', {
      questionIndex: this.currentQuestion + 1,
      totalQuestions: this.questions.length,
      category: question.category,
      difficulty: question.difficulty
    });

    this.revealHint();
    this.hintTimer = setInterval(() => {
      this.revealHint();
    }, 15000);

    this.questionTimer = setTimeout(() => {
      this.handleQuestionTimeout();
    }, 120000);
  }

  revealHint() {
    const question = this.questions[this.currentQuestion];
    if (this.currentHintIndex >= question.hints.length) return;

    const hint = {
      index: this.currentHintIndex,
      text: question.hints[this.currentHintIndex]
    };

    this.broadcast('hintRevealed', hint);
    this.currentHintIndex++;
  }

  handleGuess(socketId, guess) {
    const question = this.questions[this.currentQuestion];
    const player = this.players.find(p => p.id === socketId);

    if (!player || this.gameState !== 'playing') return;

    const isCorrect = guess.toLowerCase().trim() === question.answer.toLowerCase().trim();
    const timeElapsed = (Date.now() - this.startTime) / 1000;

    if (isCorrect) {
      const timeBonus = Math.max(0, 100 - timeElapsed);
      const hintPenalty = this.currentHintIndex * 20;
      const points = Math.max(10, 200 + timeBonus - hintPenalty);

      this.scores[socketId] += points;

      this.broadcast('questionResult', {
        winner: socketId,
        winnerName: player.name,
        correctAnswer: question.answer,
        points: points,
        timeElapsed: timeElapsed
      });

      this.nextQuestion();
    } else {
      player.socket.emit('wrongAnswer', { guess });
    }
  }

  handleQuestionTimeout() {
    const question = this.questions[this.currentQuestion];

    this.broadcast('questionResult', {
      winner: null,
      correctAnswer: question.answer,
      points: 0,
      timeElapsed: 120
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
    }, 3000);
  }

  endGame() {
    this.clearTimers();
    this.gameState = 'finished';

    const results = this.players.map(p => ({
      id: p.id,
      name: p.name,
      score: this.scores[p.id]
    })).sort((a, b) => b.score - a.score);

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
    this.clearTimers();
    games.delete(this.id);
  }

  broadcast(event, data) {
    this.players.forEach(player => {
      player.socket.emit(event, data);
    });
  }
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('findMatch', ({ playerName }) => {
    console.log(`${playerName} looking for match...`);

    const waitingPlayer = Array.from(waitingPlayers.values())[0];

    if (waitingPlayer && waitingPlayer.id !== socket.id) {
      const gameId = uuidv4();
      const gameRoom = new GameRoom(gameId);

      gameRoom.addPlayer(waitingPlayer, waitingPlayers.get(waitingPlayer.id));
      gameRoom.addPlayer(socket, playerName);

      waitingPlayers.delete(waitingPlayer.id);

      waitingPlayer.join(gameId);
      socket.join(gameId);

      games.set(gameId, gameRoom);

      gameRoom.broadcast('matchFound', {
        gameId: gameId,
        players: gameRoom.players.map(p => ({ id: p.id, name: p.name }))
      });

      setTimeout(() => {
        gameRoom.startGame();
      }, 2000);

    } else {
      waitingPlayers.set(socket.id, playerName);
      socket.emit('waitingForMatch');
    }
  });

  socket.on('submitGuess', ({ guess }) => {
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

    waitingPlayers.delete(socket.id);

    for (const [gameId, game] of games) {
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        game.removePlayer(socket.id);

        if (game.players.length === 1) {
          game.broadcast('playerDisconnected');
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`HINTMAN Server running on port ${PORT}`);
});
