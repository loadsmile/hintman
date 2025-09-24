console.log('🔥🔥🔥 SURVIVALROOM.JS IS LOADING - NEW BATTLE ROYALE MODE 🔥🔥🔥');

const Question = require('./Question');

class SurvivalRoom {
  constructor(id, questionsData, questionCategory = 'general', gameMode = 'survival') {
    console.log('🚀🚀🚀 USING SURVIVAL ROOM - BATTLE ROYALE MODE ACTIVE 🚀🚀🚀');
    this.id = id;
    this.players = [];
    this.maxPlayers = 6;
    this.currentQuestion = 0;
    this.gameMode = gameMode;
    this.questions = [];
    this.gameState = 'waiting';
    this.currentHintIndex = 0;
    this.hintTimer = null;
    this.questionTimer = null;
    this.health = {};
    this.startTime = null;
    this.questionAnswered = false;
    this.questionsPerGame = 20; // Longer game for survival
    this.createdAt = Date.now();
    this.questionsData = questionsData;
    this.playerCategories = [];
    this.eliminatedPlayers = [];
    this.round = 1;
  }

  // Survival mode damage system - escalates with fewer players
  getSurvivalDamage(playersRemaining, isWrongAnswer = false) {
    if (isWrongAnswer) {
      // Wrong answer penalties increase as players are eliminated
      switch (playersRemaining) {
        case 6:
        case 5: return 800;
        case 4: return 1000;
        case 3: return 1200;
        case 2: return 1500;
        default: return 2000;
      }
    }

    // Time/hint penalties (per hint or time tick)
    switch (playersRemaining) {
      case 6:
      case 5: return 50;
      case 4: return 75;
      case 3: return 100;
      case 2: return 150;
      default: return 200;
    }
  }

  addPlayer(socket, playerName, gameMode = 'survival', personalCategory = 'general') {
    if (this.players.length >= this.maxPlayers) return false;

    const player = {
      id: socket.id,
      name: playerName,
      health: 5000,
      gameMode: gameMode,
      personalCategory: personalCategory,
      socket: socket,
      isEliminated: false,
      correctAnswers: 0,
      mistakes: 0
    };

    this.players.push(player);
    this.health[socket.id] = 5000;
    this.playerCategories.push(personalCategory);

    console.log(`🎯 Agent ${playerName} joined survival room ${this.id} (${socket.id}) - Health: 5000`);
    console.log(`🎯 Room ${this.id}: ${this.players.length}/${this.maxPlayers} agents ready`);

    // Prepare questions when we have at least 2 players
    if (this.players.length >= 2 && this.questions.length === 0) {
      this.questions = this.prepareGameQuestions();
      console.log(`🎯 Survival room ${this.id} prepared with ${this.questions.length} questions`);
    }

    return true;
  }

  prepareGameQuestions() {
    // Mix questions from all categories for variety
    const shuffled = this.shuffleArray([...this.questionsData]);
    const selected = shuffled.slice(0, this.questionsPerGame);
    return selected.map(q => new Question(q.id, q.answer, q.category, q.difficulty, q.hints));
  }

  shuffleArray(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  removePlayer(socketId) {
    const player = this.players.find(p => p.id === socketId);
    if (player) {
      console.log(`🎯 Agent ${player.name} disconnected from survival room ${this.id}`);

      // If game is active, treat as elimination
      if (this.gameState === 'playing' && !player.isEliminated) {
        this.eliminatePlayer(socketId, 'disconnection');
      }
    }

    this.players = this.players.filter(p => p.id !== socketId);
    delete this.health[socketId];

    if (this.players.length === 0) {
      this.cleanup();
    } else if (this.gameState === 'playing' && this.getAlivePlayersCount() <= 1) {
      this.endGame();
    }
  }

  updatePlayerHealth(socketId, healthChange, reason = 'unknown') {
    if (this.health[socketId] !== undefined) {
      const oldHealth = this.health[socketId];
      this.health[socketId] = Math.max(0, Math.min(5000, this.health[socketId] + healthChange));

      const player = this.players.find(p => p.id === socketId);
      if (player) {
        player.health = this.health[socketId];
      }

      console.log(`🎯 Agent ${player?.name || socketId} health update: ${oldHealth} -> ${this.health[socketId]} (${healthChange >= 0 ? '+' : ''}${healthChange}) - ${reason}`);

      // Check for elimination
      if (this.health[socketId] <= 0 && player && !player.isEliminated) {
        this.eliminatePlayer(socketId, reason);
      }
    }
  }

  eliminatePlayer(socketId, reason = 'health_depletion') {
    const player = this.players.find(p => p.id === socketId);
    if (!player || player.isEliminated) return;

    player.isEliminated = true;
    this.health[socketId] = 0;
    this.eliminatedPlayers.push({
      id: socketId,
      name: player.name,
      eliminatedAt: Date.now(),
      reason: reason,
      finalRound: this.round
    });

    const alivePlayers = this.getAlivePlayersCount();
    console.log(`☠️ AGENT ${player.name} ELIMINATED! ${alivePlayers} agents remaining (reason: ${reason})`);

    // Broadcast elimination
    this.broadcast('playerEliminated', {
      eliminatedPlayerId: socketId,
      eliminatedPlayerName: player.name,
      health: this.health,
      playersRemaining: alivePlayers,
      reason: reason
    });

    // Check if game should end
    if (alivePlayers <= 1) {
      setTimeout(() => {
        this.endGame();
      }, 2000); // Brief delay to show elimination message
    }
  }

  isPlayerAlive(socketId) {
    const player = this.players.find(p => p.id === socketId);
    return player && !player.isEliminated && (this.health[socketId] || 0) > 0;
  }

  getAlivePlayersCount() {
    return this.players.filter(p => this.isPlayerAlive(p.id)).length;
  }

  canStartGame() {
    return this.players.length >= 2 && this.questions.length > 0;
  }

  startGame() {
    if (!this.canStartGame()) {
      console.warn(`SurvivalRoom ${this.id}: Cannot start game - need at least 2 players`);
      return;
    }

    console.log(`🎯 Starting SURVIVAL BATTLE ROYALE in room ${this.id} with ${this.players.length} agents`);
    this.gameState = 'playing';
    this.currentQuestion = 0;
    this.round = 1;

    // Brief delay before first question
    this.broadcast('gameStart', { round: this.round });

    setTimeout(() => {
      this.startQuestion();
    }, 3000);
  }

  startQuestion() {
    if (this.currentQuestion >= this.questionsPerGame || this.getAlivePlayersCount() <= 1) {
      this.endGame();
      return;
    }

    const question = this.questions[this.currentQuestion];
    this.currentHintIndex = 0;
    this.startTime = Date.now();
    this.questionAnswered = false;

    console.log(`🎯 Survival Room ${this.id}: Round ${this.round}, Question ${this.currentQuestion + 1}/${this.questionsPerGame} - "${question.answer}"`);
    console.log(`🎯 ${this.getAlivePlayersCount()} agents still alive`);

    this.broadcast('questionStart', {
      targetIndex: this.currentQuestion + 1,
      totalTargets: this.questionsPerGame,
      category: question.category,
      difficulty: question.difficulty,
      health: this.health,
      round: this.round
    });

    // First hint after 1 second
    setTimeout(() => {
      if (this.gameState === 'playing' && !this.questionAnswered && this.getAlivePlayersCount() > 1) {
        this.revealHint();
      }
    }, 1000);

    // Subsequent hints every 12 seconds (faster pace for battle royale)
    this.hintTimer = setInterval(() => {
      if (this.gameState === 'playing' && !this.questionAnswered && this.getAlivePlayersCount() > 1) {
        this.revealHint();
      }
    }, 12000);

    // Question timeout after 90 seconds (shorter for faster pace)
    this.questionTimer = setTimeout(() => {
      if (this.gameState === 'playing' && !this.questionAnswered && this.getAlivePlayersCount() > 1) {
        this.handleQuestionTimeout();
      }
    }, 90000);
  }

  revealHint() {
    console.log('🎯🎯🎯 REVEALING SURVIVAL HINT - TIME PENALTY TO ALL! 🎯🎯🎯');
    const question = this.questions[this.currentQuestion];
    if (!question || this.currentHintIndex >= 5 || this.currentHintIndex >= question.getTotalHints()) {
      return;
    }

    const hintText = question.getHint(this.currentHintIndex);
    const alivePlayers = this.getAlivePlayersCount();
    const timePenalty = this.getSurvivalDamage(alivePlayers, false);

    console.log(`🎯 Hint ${this.currentHintIndex + 1} revealed - ${timePenalty} HP penalty to ${alivePlayers} alive agents`);

    // Apply time penalty to all alive players
    this.players.forEach(player => {
      if (this.isPlayerAlive(player.id)) {
        this.updatePlayerHealth(player.id, -timePenalty, `hint_${this.currentHintIndex + 1}_penalty`);
      }
    });

    this.broadcast('hintRevealed', {
      index: this.currentHintIndex,
      text: hintText,
      health: this.health,
      timePenalty: timePenalty
    });

    this.currentHintIndex++;
  }

  handleGuess(socketId, guess) {
    const question = this.questions[this.currentQuestion];
    const player = this.players.find(p => p.id === socketId);

    if (!player || !question || this.gameState !== 'playing' || this.questionAnswered || !this.isPlayerAlive(socketId)) {
      return;
    }

    const isCorrect = question.checkAnswer(guess);
    const alivePlayers = this.getAlivePlayersCount();

    console.log(`🎯 SURVIVAL GUESS: "${guess}" by ${player.name} - ${isCorrect ? 'CORRECT' : 'WRONG'}`);

    if (isCorrect) {
      this.questionAnswered = true;
      player.correctAnswers++;

      console.log(`🎯 CORRECT! ${player.name} survives this round`);

      this.broadcast('questionResult', {
        winner: socketId,
        winnerName: player.name,
        correctAnswer: question.answer,
        timeElapsed: (Date.now() - this.startTime) / 1000,
        health: this.health
      });

      this.nextQuestion();
    } else {
      // Wrong answer - massive damage in survival mode
      const wrongAnswerDamage = this.getSurvivalDamage(alivePlayers, true);
      player.mistakes++;

      console.log(`🎯 WRONG ANSWER - ${wrongAnswerDamage} HP damage to ${player.name}`);

      this.updatePlayerHealth(socketId, -wrongAnswerDamage, 'wrong_answer');

      this.broadcast('wrongAnswer', {
        playerId: socketId,
        playerName: player.name,
        guess: guess,
        damage: wrongAnswerDamage,
        health: this.health
      });

      // Check if this was the last player
      if (this.getAlivePlayersCount() <= 1) {
        this.questionAnswered = true;
        setTimeout(() => {
          this.endGame();
        }, 1000);
      }
    }
  }

  handleQuestionTimeout() {
    if (this.questionAnswered) return;

    const question = this.questions[this.currentQuestion];
    const alivePlayers = this.getAlivePlayersCount();
    const timeoutPenalty = this.getSurvivalDamage(alivePlayers, true) / 2; // Half damage for timeout

    console.log(`🎯 SURVIVAL TIMEOUT - ${timeoutPenalty} HP penalty to ${alivePlayers} alive agents`);

    // Apply timeout penalty to all alive players
    this.players.forEach(player => {
      if (this.isPlayerAlive(player.id)) {
        this.updatePlayerHealth(player.id, -timeoutPenalty, 'timeout_penalty');
      }
    });

    this.broadcast('questionResult', {
      winner: null,
      correctAnswer: question.answer,
      timeElapsed: 90,
      health: this.health,
      timeoutPenalty: timeoutPenalty
    });

    this.nextQuestion();
  }

  nextQuestion() {
    this.clearTimers();
    this.round++;

    setTimeout(() => {
      this.currentQuestion++;
      if (this.currentQuestion < this.questionsPerGame && this.getAlivePlayersCount() > 1) {
        this.startQuestion();
      } else {
        this.endGame();
      }
    }, 3000);
  }

  endGame() {
    this.clearTimers();
    this.gameState = 'finished';

    console.log(`🎯 SURVIVAL BATTLE ROYALE ended in room ${this.id}. Final health: ${JSON.stringify(this.health)}`);

    // Create results with all players
    const results = this.players.map(p => ({
      id: p.id,
      name: p.name,
      health: this.health[p.id] || 0,
      isAlive: this.isPlayerAlive(p.id),
      correctAnswers: p.correctAnswers || 0,
      mistakes: p.mistakes || 0,
      category: p.personalCategory,
      isEliminated: p.isEliminated
    })).sort((a, b) => {
      // Sort by: alive first, then by health, then by correct answers
      if (a.isAlive && !b.isAlive) return -1;
      if (!a.isAlive && b.isAlive) return 1;
      if (a.health !== b.health) return b.health - a.health;
      return b.correctAnswers - a.correctAnswers;
    });

    const winner = results.find(p => p.isAlive) || results[0];

    console.log(`🏆 SURVIVAL WINNER: ${winner?.name || 'Unknown'} with ${winner?.health || 0} HP`);

    this.broadcast('gameEnd', {
      winner: winner,
      results: results,
      totalRounds: this.round,
      eliminatedPlayers: this.eliminatedPlayers
    });
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
    console.log(`🗑️ Survival room ${this.id} cleaned up`);
  }

  broadcast(event, data) {
    this.players.forEach(player => {
      if (player.socket && player.socket.connected) {
        try {
          player.socket.emit(event, data);
        } catch (error) {
          console.error(`SurvivalRoom ${this.id}: Error broadcasting to ${player.id}:`, error.message);
        }
      }
    });
  }

  getStats() {
    return {
      id: this.id,
      gameMode: this.gameMode,
      playerCount: this.players.length,
      maxPlayers: this.maxPlayers,
      gameState: this.gameState,
      currentRound: this.round,
      currentQuestion: this.currentQuestion + 1,
      totalQuestions: this.questionsPerGame,
      questionsInDatabase: this.questions.length,
      playersHealth: this.health,
      alivePlayersCount: this.getAlivePlayersCount(),
      eliminatedCount: this.eliminatedPlayers.length,
      createdAt: this.createdAt
    };
  }
}

module.exports = SurvivalRoom;
