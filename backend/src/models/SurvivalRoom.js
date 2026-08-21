const Question = require('./Question');

class SurvivalRoom {
  constructor(id, questionsData, questionCategory = 'general', gameMode = 'survival') {
    this.id = id;
    this.players = [];
    this.maxPlayers = 6;
    this.currentQuestion = 0;
    this.gameMode = gameMode;
    this.questions = [];
    this.gameState = 'waiting';
    this.currentHintIndex = 0;
    this.nextHintTimer = null;
    this.questionTimer = null;
    this.nextQuestionTimer = null;
    this.endGameTimer = null;
    this.nextHintAt = null;
    this.questionDeadlineAt = null;
    this.nextQuestionAt = null;
    this.nextQuestionAction = null;
    this.endGameAt = null;
    this.health = {};
    this.startTime = null;
    this.questionAnswered = false;
    this.questionsPerGame = 20;
    this.createdAt = Date.now();
    this.questionsData = questionsData;
    this.playerCategories = [];
    this.eliminatedPlayers = [];
    this.round = 1;
    this.readyPlayers = new Set();
    this.pausedState = null;
    this.MAX_HEALTH = 10000;
    this.MAX_HINTS = 5;
    this.FIRST_HINT_DELAY_MS = 1000;
    this.HINT_INTERVAL_MS = 12000;
    this.QUESTION_DURATION_MS = 120000;
    this.ROUND_TRANSITION_DELAY_MS = 3000;
    this.END_GAME_DELAY_MS = 2000;
  }

  getSurvivalDamage(playersRemaining, isWrongAnswer = false) {
    if (isWrongAnswer) {
      switch (playersRemaining) {
        case 6: return 400;
        case 5: return 500;
        case 4: return 600;
        case 3: return 700;
        case 2: return 800;
        default: return 900;
      }
    }

    switch (playersRemaining) {
      case 6: return 30;
      case 5: return 50;
      case 4: return 70;
      case 3: return 90;
      case 2: return 110;
      default: return 130;
    }
  }

  addPlayer(socket, playerName, gameMode = 'survival', personalCategory = 'general') {
    if (this.players.length >= this.maxPlayers) return false;

    const player = {
      id: socket.id,
      name: playerName,
      health: this.MAX_HEALTH,
      gameMode,
      personalCategory,
      socket,
      isEliminated: false,
      correctAnswers: 0,
      mistakes: 0,
      isReady: false
    };

    this.players.push(player);
    this.health[socket.id] = this.MAX_HEALTH;
    this.playerCategories.push(personalCategory);

    if (this.players.length >= 2 && this.questions.length === 0) {
      this.questions = this.prepareGameQuestions();
    }

    return true;
  }

  replacePlayerSocket(oldSocketId, socket) {
    const player = this.players.find((entry) => entry.id === oldSocketId);
    if (!player) return null;

    player.id = socket.id;
    player.socket = socket;

    if (this.health[oldSocketId] !== undefined) {
      this.health[socket.id] = this.health[oldSocketId];
      delete this.health[oldSocketId];
    }

    if (this.readyPlayers.has(oldSocketId)) {
      this.readyPlayers.delete(oldSocketId);
      this.readyPlayers.add(socket.id);
    }

    return player;
  }

  setPlayerReady(socketId, isReady) {
    const player = this.players.find((entry) => entry.id === socketId);
    if (!player) return false;

    player.isReady = isReady;

    if (isReady) {
      this.readyPlayers.add(socketId);
    } else {
      this.readyPlayers.delete(socketId);
    }

    return true;
  }

  areAllPlayersReady() {
    if (this.players.length < 2) return false;
    return this.players.length === this.readyPlayers.size;
  }

  getReadyPlayerIds() {
    return Array.from(this.readyPlayers);
  }

  prepareGameQuestions() {
    const shuffled = this.shuffleArray([...this.questionsData]);
    const selected = shuffled.slice(0, this.questionsPerGame);
    return selected.map((question) => new Question(question.id, question.answer, question.category, question.difficulty, question.hints));
  }

  shuffleArray(array) {
    const result = [...array];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  removePlayer(socketId) {
    const player = this.players.find((entry) => entry.id === socketId);
    if (!player) return;

    this.readyPlayers.delete(socketId);

    if (this.gameState === 'playing' || this.gameState === 'paused') {
      this.handlePermanentDisconnect(socketId);
      return;
    }

    this.players = this.players.filter((entry) => entry.id !== socketId);
    delete this.health[socketId];

    if (this.players.length === 0) {
      this.cleanup();
    }
  }

  handlePermanentDisconnect(socketId, reason = 'disconnection') {
    const player = this.players.find((entry) => entry.id === socketId);
    if (!player) return false;

    this.readyPlayers.delete(socketId);
    player.socket = null;

    if (!player.isEliminated) {
      this.eliminatePlayer(socketId, reason);
    }

    return true;
  }

  updatePlayerHealth(socketId, healthChange, reason = 'unknown') {
    if (this.health[socketId] === undefined) return;

    this.health[socketId] = Math.max(0, Math.min(this.MAX_HEALTH, this.health[socketId] + healthChange));

    const player = this.players.find((entry) => entry.id === socketId);
    if (player) {
      player.health = this.health[socketId];
    }

    if (this.health[socketId] <= 0 && player && !player.isEliminated) {
      this.eliminatePlayer(socketId, reason);
    }
  }

  eliminatePlayer(socketId, reason = 'health_depletion') {
    const player = this.players.find((entry) => entry.id === socketId);
    if (!player || player.isEliminated) return;

    player.isEliminated = true;
    player.health = 0;
    this.health[socketId] = 0;
    this.eliminatedPlayers.push({
      id: socketId,
      name: player.name,
      eliminatedAt: Date.now(),
      reason,
      finalRound: this.round
    });

    const alivePlayers = this.getAlivePlayersCount();

    this.broadcast('playerEliminated', {
      eliminatedPlayerId: socketId,
      eliminatedPlayerName: player.name,
      health: this.health,
      playersRemaining: alivePlayers,
      reason
    });

    if (alivePlayers <= 1) {
      this.scheduleGameEnd(this.END_GAME_DELAY_MS);
    }
  }

  isPlayerAlive(socketId) {
    const player = this.players.find((entry) => entry.id === socketId);
    return Boolean(player && !player.isEliminated && (this.health[socketId] || 0) > 0);
  }

  getAlivePlayersCount() {
    return this.players.filter((player) => this.isPlayerAlive(player.id)).length;
  }

  canStartGame() {
    return this.players.length >= 2 && this.questions.length > 0 && this.areAllPlayersReady();
  }

  startGame() {
    if (!this.canStartGame()) {
      return false;
    }

    this.clearTimers();
    this.pausedState = null;
    this.gameState = 'playing';
    this.currentQuestion = 0;
    this.round = 1;
    this.currentHintIndex = 0;
    this.questionAnswered = false;
    this.eliminatedPlayers = [];

    this.players.forEach((player) => {
      player.health = this.MAX_HEALTH;
      player.isEliminated = false;
      player.correctAnswers = 0;
      player.mistakes = 0;
      this.health[player.id] = this.MAX_HEALTH;
    });

    this.broadcast('gameStart', {
      round: this.round,
      health: this.health
    });

    this.scheduleNextQuestionAction(this.ROUND_TRANSITION_DELAY_MS, 'start-current-question');
    return true;
  }

  startQuestion() {
    if (this.currentQuestion >= this.questionsPerGame || this.getAlivePlayersCount() <= 1) {
      this.endGame();
      return;
    }

    const question = this.questions[this.currentQuestion];
    if (!question) {
      this.endGame();
      return;
    }

    this.clearQuestionTimers();
    this.currentHintIndex = 0;
    this.startTime = Date.now();
    this.questionAnswered = false;
    question.start?.();

    this.broadcast('questionStart', {
      targetIndex: this.currentQuestion + 1,
      totalTargets: this.questionsPerGame,
      category: question.category,
      difficulty: question.difficulty,
      health: this.health,
      round: this.round,
      remainingQuestionTimeMs: this.QUESTION_DURATION_MS
    });

    this.scheduleQuestionTimeout(this.QUESTION_DURATION_MS);

    if (this.getMaxHintsForCurrentQuestion() > 0) {
      this.scheduleNextHint(this.FIRST_HINT_DELAY_MS);
    }
  }

  revealHint() {
    if (this.gameState !== 'playing' || this.questionAnswered || this.getAlivePlayersCount() <= 1) {
      return;
    }

    const question = this.questions[this.currentQuestion];
    const maxHints = this.getMaxHintsForCurrentQuestion();
    if (!question || this.currentHintIndex >= maxHints) {
      return;
    }

    const hintText = question.getHint(this.currentHintIndex);
    const alivePlayers = this.getAlivePlayersCount();
    const timePenalty = this.getSurvivalDamage(alivePlayers, false);

    this.players.forEach((player) => {
      if (this.isPlayerAlive(player.id)) {
        this.updatePlayerHealth(player.id, -timePenalty, `hint_${this.currentHintIndex + 1}_penalty`);
      }
    });

    this.broadcast('hintRevealed', {
      index: this.currentHintIndex,
      text: hintText,
      health: this.health,
      timePenalty,
      remainingQuestionTimeMs: this.getRemainingQuestionTimeMs()
    });

    this.currentHintIndex += 1;

    if (this.currentHintIndex < maxHints && this.gameState === 'playing' && !this.questionAnswered && this.getAlivePlayersCount() > 1) {
      this.scheduleNextHint(this.HINT_INTERVAL_MS);
    }
  }

  handleGuess(socketId, guess) {
    const question = this.questions[this.currentQuestion];
    const player = this.players.find((entry) => entry.id === socketId);

    if (!player || !question || this.gameState !== 'playing' || this.questionAnswered || !this.isPlayerAlive(socketId)) {
      return;
    }

    const isCorrect = question.checkAnswer(guess);
    const alivePlayers = this.getAlivePlayersCount();

    if (isCorrect) {
      this.questionAnswered = true;
      this.clearQuestionTimers();
      player.correctAnswers += 1;

      this.broadcast('questionResult', {
        winner: socketId,
        winnerName: player.name,
        correctAnswer: question.answer,
        timeElapsed: (Date.now() - this.startTime) / 1000,
        health: this.health
      });

      this.nextQuestion();
      return;
    }

    const wrongAnswerDamage = this.getSurvivalDamage(alivePlayers, true);
    player.mistakes += 1;
    this.updatePlayerHealth(socketId, -wrongAnswerDamage, 'wrong_answer');

    this.broadcast('wrongAnswer', {
      playerId: socketId,
      playerName: player.name,
      guess,
      damage: wrongAnswerDamage,
      health: this.health
    });

    if (this.getAlivePlayersCount() <= 1) {
      this.questionAnswered = true;
      this.clearQuestionTimers();
      this.scheduleGameEnd(1000);
    }
  }

  handleQuestionTimeout() {
    if (this.questionAnswered) return;

    const question = this.questions[this.currentQuestion];
    if (!question) {
      this.endGame();
      return;
    }

    this.questionAnswered = true;
    this.clearQuestionTimers();

    const alivePlayers = this.getAlivePlayersCount();
    const timeoutPenalty = this.getSurvivalDamage(alivePlayers, true) / 2;

    this.players.forEach((player) => {
      if (this.isPlayerAlive(player.id)) {
        this.updatePlayerHealth(player.id, -timeoutPenalty, 'timeout_penalty');
      }
    });

    this.broadcast('questionResult', {
      winner: null,
      winnerName: null,
      correctAnswer: question.answer,
      timeElapsed: this.QUESTION_DURATION_MS / 1000,
      health: this.health,
      timeoutPenalty,
      isTimeout: true
    });

    this.nextQuestion();
  }

  nextQuestion() {
    this.clearQuestionTimers();
    this.round += 1;
    this.scheduleNextQuestionAction(this.ROUND_TRANSITION_DELAY_MS, 'advance-question');
  }

  pauseGame(reason = 'Game paused') {
    if (this.gameState !== 'playing') return false;

    this.pausedState = {
      currentQuestion: this.currentQuestion,
      currentHintIndex: this.currentHintIndex,
      questionAnswered: this.questionAnswered,
      startTime: this.startTime,
      pausedAt: Date.now(),
      reason,
      nextHintRemainingMs: this.getRemainingNextHintTimeMs(),
      questionRemainingMs: this.getRemainingQuestionTimeMs(),
      nextQuestionRemainingMs: this.getRemainingNextQuestionTimeMs(),
      nextQuestionAction: this.nextQuestionAction,
      endGameRemainingMs: this.getRemainingEndGameTimeMs()
    };

    this.gameState = 'paused';
    this.clearTimers();

    this.broadcast('gamePaused', {
      reason,
      message: reason
    });

    return true;
  }

  resumeGame() {
    if (this.gameState !== 'paused' || !this.pausedState) return false;

    const pausedState = this.pausedState;
    this.gameState = 'playing';
    this.currentQuestion = pausedState.currentQuestion;
    this.currentHintIndex = pausedState.currentHintIndex;
    this.questionAnswered = pausedState.questionAnswered;
    this.startTime = pausedState.startTime;
    this.pausedState = null;

    if (pausedState.questionRemainingMs !== null) {
      this.startTime = Date.now() - (this.QUESTION_DURATION_MS - pausedState.questionRemainingMs);
      this.scheduleQuestionTimeout(pausedState.questionRemainingMs);
    }

    if (pausedState.nextHintRemainingMs !== null && !this.questionAnswered && this.getAlivePlayersCount() > 1) {
      this.scheduleNextHint(pausedState.nextHintRemainingMs);
    }

    if (pausedState.nextQuestionRemainingMs !== null && pausedState.nextQuestionAction) {
      this.scheduleNextQuestionAction(pausedState.nextQuestionRemainingMs, pausedState.nextQuestionAction);
    }

    if (pausedState.endGameRemainingMs !== null) {
      this.scheduleGameEnd(pausedState.endGameRemainingMs);
    }

    const question = this.questions[this.currentQuestion];
    this.broadcast('gameResumed', {
      message: 'Game resumed',
      currentQuestion: this.currentQuestion + 1,
      totalQuestions: this.questionsPerGame,
      round: this.round,
      category: question?.category,
      difficulty: question?.difficulty,
      remainingQuestionTimeMs: this.getRemainingQuestionTimeMs()
    });

    return true;
  }

  scheduleNextHint(delayMs) {
    if (this.nextHintTimer) {
      clearTimeout(this.nextHintTimer);
    }

    const delay = Math.max(0, delayMs);
    this.nextHintAt = Date.now() + delay;
    this.nextHintTimer = setTimeout(() => {
      this.nextHintTimer = null;
      this.nextHintAt = null;
      this.revealHint();
    }, delay);
  }

  scheduleQuestionTimeout(delayMs) {
    if (this.questionTimer) {
      clearTimeout(this.questionTimer);
    }

    const delay = Math.max(0, delayMs);
    this.questionDeadlineAt = Date.now() + delay;
    this.questionTimer = setTimeout(() => {
      this.questionTimer = null;
      this.questionDeadlineAt = null;
      this.handleQuestionTimeout();
    }, delay);
  }

  scheduleNextQuestionAction(delayMs, action) {
    if (this.nextQuestionTimer) {
      clearTimeout(this.nextQuestionTimer);
    }

    const delay = Math.max(0, delayMs);
    this.nextQuestionAction = action;
    this.nextQuestionAt = Date.now() + delay;
    this.nextQuestionTimer = setTimeout(() => {
      const nextAction = this.nextQuestionAction;
      this.nextQuestionTimer = null;
      this.nextQuestionAt = null;
      this.nextQuestionAction = null;

      if (nextAction === 'advance-question') {
        this.currentQuestion += 1;
      }

      if (this.currentQuestion < this.questionsPerGame && this.getAlivePlayersCount() > 1) {
        this.startQuestion();
      } else {
        this.endGame();
      }
    }, delay);
  }

  scheduleGameEnd(delayMs = 0) {
    if (this.endGameTimer) {
      clearTimeout(this.endGameTimer);
    }

    const delay = Math.max(0, delayMs);
    this.endGameAt = Date.now() + delay;
    this.endGameTimer = setTimeout(() => {
      this.endGameTimer = null;
      this.endGameAt = null;
      this.endGame();
    }, delay);
  }

  endGame() {
    this.clearTimers();
    this.gameState = 'finished';
    this.pausedState = null;

    const results = this.players.map((player) => ({
      id: player.id,
      name: player.name,
      health: this.health[player.id] || 0,
      isAlive: this.isPlayerAlive(player.id),
      correctAnswers: player.correctAnswers || 0,
      mistakes: player.mistakes || 0,
      category: player.personalCategory,
      isEliminated: player.isEliminated
    })).sort((first, second) => {
      if (first.isAlive && !second.isAlive) return -1;
      if (!first.isAlive && second.isAlive) return 1;
      if (first.health !== second.health) return second.health - first.health;
      return second.correctAnswers - first.correctAnswers;
    });

    const winner = results.find((player) => player.isAlive) || results[0] || null;

    this.broadcast('gameEnd', {
      winner,
      results,
      totalRounds: this.round,
      eliminatedPlayers: this.eliminatedPlayers
    });
  }

  getMaxHintsForCurrentQuestion() {
    const question = this.questions[this.currentQuestion];
    if (!question) return 0;
    return Math.min(this.MAX_HINTS, question.getTotalHints());
  }

  getRemainingTime(deadlineAt) {
    if (deadlineAt === null || deadlineAt === undefined) return null;
    return Math.max(0, deadlineAt - Date.now());
  }

  getRemainingQuestionTimeMs() {
    if (this.gameState === 'paused' && this.pausedState) {
      return this.pausedState.questionRemainingMs;
    }
    return this.getRemainingTime(this.questionDeadlineAt);
  }

  getRemainingNextHintTimeMs() {
    if (this.gameState === 'paused' && this.pausedState) {
      return this.pausedState.nextHintRemainingMs;
    }
    return this.getRemainingTime(this.nextHintAt);
  }

  getRemainingNextQuestionTimeMs() {
    if (this.gameState === 'paused' && this.pausedState) {
      return this.pausedState.nextQuestionRemainingMs;
    }
    return this.getRemainingTime(this.nextQuestionAt);
  }

  getRemainingEndGameTimeMs() {
    if (this.gameState === 'paused' && this.pausedState) {
      return this.pausedState.endGameRemainingMs;
    }
    return this.getRemainingTime(this.endGameAt);
  }

  getRevealedHints() {
    const question = this.questions[this.currentQuestion];
    if (!question) return [];

    const hints = [];
    for (let index = 0; index < this.currentHintIndex; index += 1) {
      if (index < question.getTotalHints()) {
        hints.push({
          index,
          text: question.getHint(index)
        });
      }
    }

    return hints;
  }

  getReconnectState() {
    const question = this.questions[this.currentQuestion];
    const questionActive = this.getRemainingQuestionTimeMs() !== null && !this.questionAnswered;

    return {
      roomId: this.id,
      gameState: this.gameState,
      round: this.round,
      currentQuestion: this.currentQuestion + 1,
      totalQuestions: this.questionsPerGame,
      health: { ...this.health },
      players: this.players.map((player) => ({
        id: player.id,
        name: player.name,
        health: this.health[player.id] || 0,
        gameMode: player.gameMode,
        personalCategory: player.personalCategory,
        isEliminated: player.isEliminated
      })),
      category: questionActive ? question?.category : null,
      difficulty: questionActive ? question?.difficulty : null,
      hints: this.getRevealedHints(),
      readyPlayers: this.getReadyPlayerIds(),
      remainingQuestionTimeMs: this.getRemainingQuestionTimeMs(),
      questionActive,
      pauseReason: this.pausedState?.reason || null
    };
  }

  clearQuestionTimers() {
    if (this.nextHintTimer) {
      clearTimeout(this.nextHintTimer);
      this.nextHintTimer = null;
    }
    if (this.questionTimer) {
      clearTimeout(this.questionTimer);
      this.questionTimer = null;
    }
    this.nextHintAt = null;
    this.questionDeadlineAt = null;
  }

  clearTimers() {
    this.clearQuestionTimers();

    if (this.nextQuestionTimer) {
      clearTimeout(this.nextQuestionTimer);
      this.nextQuestionTimer = null;
    }
    if (this.endGameTimer) {
      clearTimeout(this.endGameTimer);
      this.endGameTimer = null;
    }

    this.nextQuestionAt = null;
    this.nextQuestionAction = null;
    this.endGameAt = null;
  }

  cleanup() {
    this.clearTimers();
    this.readyPlayers.clear();
    this.pausedState = null;
  }

  broadcast(event, data) {
    this.players.forEach((player) => {
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
      readyPlayersCount: this.readyPlayers.size,
      allPlayersReady: this.areAllPlayersReady(),
      maxHealth: this.MAX_HEALTH,
      createdAt: this.createdAt,
      remainingQuestionTimeMs: this.getRemainingQuestionTimeMs(),
      remainingNextHintTimeMs: this.getRemainingNextHintTimeMs(),
      remainingNextQuestionTimeMs: this.getRemainingNextQuestionTimeMs()
    };
  }
}

module.exports = SurvivalRoom;
