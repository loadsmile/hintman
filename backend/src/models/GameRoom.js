const Question = require('./Question');

class GameRoom {
  constructor(id, questionsData, questionCategory = 'general', gameMode = 'general') {
    this.id = id;
    this.players = [];
    this.currentQuestion = 0;
    this.questionCategory = questionCategory; // Always 'general' for mixed questions
    this.gameMode = gameMode; // 'general' or 'category' for matchmaking
    this.questions = this.shuffleQuestions(questionsData, questionCategory);
    this.gameState = 'waiting';
    this.currentHintIndex = 0;
    this.hintTimer = null;
    this.questionTimer = null;
    this.health = {};
    this.startTime = null;
    this.questionAnswered = false;
    this.questionsPerGame = 5;
    this.createdAt = Date.now(); // Add creation timestamp for cleanup
  }

  shuffleQuestions(questionsData, questionCategory) {
    let filteredQuestions = questionsData;

    // For mixed questions, use all questions
    if (questionCategory && questionCategory !== 'general') {
      filteredQuestions = questionsData.filter(q =>
        q.category.toLowerCase() === questionCategory.toLowerCase() ||
        q.category.toLowerCase().includes(questionCategory.toLowerCase())
      );

      console.log(`Filtered ${filteredQuestions.length} questions for category: ${questionCategory}`);
    }

    // If filtered results are too few, fall back to all questions
    if (filteredQuestions.length < this.questionsPerGame) {
      console.log(`Not enough ${questionCategory} questions (${filteredQuestions.length}), using all questions`);
      filteredQuestions = questionsData;
    }

    const allQuestions = filteredQuestions.map(q =>
      new Question(q.id, q.answer, q.category, q.difficulty, q.hints)
    );

    // Fisher-Yates shuffle algorithm
    const shuffled = [...allQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, this.questionsPerGame);
  }

  addPlayer(socket, playerName, gameMode = 'general', personalCategory = 'general') {
    if (this.players.length >= 2) return false;

    const player = {
      id: socket.id,
      name: playerName,
      health: 5000,
      gameMode: gameMode, // For tracking purposes
      personalCategory: personalCategory, // Personal preference
      socket: socket
    };

    this.players.push(player);
    this.health[socket.id] = 5000;

    return true;
  }

  removePlayer(socketId) {
    this.players = this.players.filter(p => p.id !== socketId);
    delete this.health[socketId];

    if (this.players.length === 0) {
      this.cleanup();
    }
  }

  updatePlayerHealth(socketId, healthChange) {
    if (this.health[socketId] !== undefined) {
      this.health[socketId] = Math.max(0, Math.min(5000, this.health[socketId] + healthChange));

      // Update player object as well
      const player = this.players.find(p => p.id === socketId);
      if (player) {
        player.health = this.health[socketId];
      }
    }
  }

  isPlayerAlive(socketId) {
    return this.health[socketId] > 0;
  }

  getAlivePlayersCount() {
    return this.players.filter(p => this.isPlayerAlive(p.id)).length;
  }

  // Broadcast health update to all players immediately
  broadcastHealthUpdate() {
    this.broadcast('healthUpdate', {
      health: this.health
    });
  }

  startGame() {
    if (this.players.length !== 2) return;

    console.log(`Game ${this.id}: Starting game with players:`, this.players.map(p => p.name));
    console.log(`Game ${this.id}: Playing ${this.questions.length} rounds from ${this.questions.length} available questions`);
    this.gameState = 'playing';
    this.currentQuestion = 0;
    this.startQuestion();
  }

  startQuestion() {
    // Check if we've completed all 5 rounds
    if (this.currentQuestion >= this.questionsPerGame || this.getAlivePlayersCount() < 2) {
      this.endGame();
      return;
    }

    const question = this.questions[this.currentQuestion];
    this.currentHintIndex = 0;
    this.startTime = Date.now();
    this.questionAnswered = false;

    console.log(`Game ${this.id}: Starting target ${this.currentQuestion + 1}/${this.questionsPerGame}: ${question.answer}`);

    this.broadcast('questionStart', {
      targetIndex: this.currentQuestion + 1,
      totalTargets: this.questionsPerGame,
      category: question.category,
      difficulty: question.difficulty,
      health: this.health
    });

    setTimeout(() => {
      this.revealHint();
    }, 1000);

    this.hintTimer = setInterval(() => {
      this.revealHint();
    }, 15000);

    this.questionTimer = setTimeout(() => {
      if (!this.questionAnswered) {
        this.handleQuestionTimeout();
      }
    }, 120000);
  }

  revealHint() {
    const question = this.questions[this.currentQuestion];
    if (this.currentHintIndex >= question.getTotalHints()) return;

    const hintText = question.getHint(this.currentHintIndex);
    const hint = {
      index: this.currentHintIndex,
      text: hintText
    };

    console.log(`Game ${this.id}: Revealing hint ${this.currentHintIndex + 1}: ${hintText}`);

    // All players lose health for each hint revealed (100 per hint)
    this.players.forEach(player => {
      if (this.isPlayerAlive(player.id)) {
        this.updatePlayerHealth(player.id, -100);
      }
    });

    this.broadcast('hintRevealed', {
      ...hint,
      health: this.health
    });

    this.currentHintIndex++;
  }

  handleGuess(socketId, guess) {
    const question = this.questions[this.currentQuestion];
    const player = this.players.find(p => p.id === socketId);

    if (!player || this.gameState !== 'playing' || this.questionAnswered || !this.isPlayerAlive(socketId)) {
      return;
    }

    console.log(`Game ${this.id}: ${player.name} guessed: "${guess}" (Answer: "${question.answer}")`);

    const isCorrect = question.checkAnswer(guess);
    const timeElapsed = (Date.now() - this.startTime) / 1000;

    console.log(`Game ${this.id}: Guess "${guess}" is ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);

    // Player loses health based on time elapsed (1 per second)
    const timePenalty = Math.floor(timeElapsed);
    this.updatePlayerHealth(socketId, -timePenalty);

    if (isCorrect) {
      this.questionAnswered = true;

      // Player gains significant health for correct answer (1000)
      this.updatePlayerHealth(socketId, 1000);

      console.log(`Game ${this.id}: ${player.name} got it right! Health: ${this.health[socketId]}`);

      this.broadcast('questionResult', {
        winner: socketId,
        winnerName: player.name,
        correctAnswer: question.answer,
        timeElapsed: timeElapsed,
        health: this.health,
        healthGained: 1000
      });

      this.nextQuestion();
    } else {
      // Wrong answer - player loses additional health IMMEDIATELY
      this.updatePlayerHealth(socketId, -500);

      console.log(`Game ${this.id}: ${player.name} got it wrong. Health: ${this.health[socketId]}`);

      // Send wrong answer response to the player who guessed
      player.socket.emit('wrongAnswer', {
        guess,
        healthLost: 500,
        currentHealth: this.health[socketId]
      });

      // Immediately broadcast health update to all players
      this.broadcastHealthUpdate();

      // Check if player died from wrong answer
      if (!this.isPlayerAlive(socketId)) {
        this.broadcast('playerEliminated', {
          eliminatedPlayer: socketId,
          eliminatedPlayerName: player.name,
          health: this.health
        });

        // If only one player left, end the game
        if (this.getAlivePlayersCount() <= 1) {
          this.questionAnswered = true;
          this.endGame();
        }
      }
    }
  }

  handleQuestionTimeout() {
    if (this.questionAnswered) return;

    const question = this.questions[this.currentQuestion];
    console.log(`Game ${this.id}: Target timeout: ${question.answer}`);

    // All alive players lose health for timeout (full 120 seconds)
    this.players.forEach(player => {
      if (this.isPlayerAlive(player.id)) {
        this.updatePlayerHealth(player.id, -120);
      }
    });

    this.broadcast('questionResult', {
      winner: null,
      correctAnswer: question.answer,
      timeElapsed: 120,
      health: this.health
    });

    this.nextQuestion();
  }

  nextQuestion() {
    this.clearTimers();

    setTimeout(() => {
      this.currentQuestion++;
      if (this.currentQuestion < this.questionsPerGame && this.getAlivePlayersCount() >= 2) {
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
      health: this.health[p.id] || 0,
      isAlive: this.isPlayerAlive(p.id)
    })).sort((a, b) => {
      // Sort by alive status first, then by health
      if (a.isAlive && !b.isAlive) return -1;
      if (!a.isAlive && b.isAlive) return 1;
      return b.health - a.health;
    });

    console.log(`Game ${this.id}: Game ended after ${this.currentQuestion} rounds. Final results:`, results);
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
    console.log(`Game ${this.id}: Cleaning up game room`);
    this.clearTimers();
    this.players = [];
    this.health = {};
  }

  broadcast(event, data) {
    console.log(`Game ${this.id}: Broadcasting ${event} to ${this.players.length} players`);
    this.players.forEach(player => {
      if (player.socket && player.socket.connected) {
        player.socket.emit(event, data);
      }
    });
  }

  getStats() {
    return {
      id: this.id,
      gameMode: this.gameMode,
      questionCategory: this.questionCategory,
      playerCount: this.players.length,
      gameState: this.gameState,
      currentTarget: this.currentQuestion + 1,
      totalTargets: this.questionsPerGame,
      questionsInDatabase: this.questions.length,
      playersHealth: this.health,
      alivePlayersCount: this.getAlivePlayersCount(),
      createdAt: this.createdAt
    };
  }
}

module.exports = GameRoom;
