const Question = require('./Question');

class GameRoom {
  constructor(id, questionsData, questionCategory = 'general', gameMode = 'general') {
    this.id = id;
    this.players = [];
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
    this.questionsPerGame = gameMode === 'category' ? 10 : 5;
    this.createdAt = Date.now();
    this.questionsData = questionsData;
    this.playerCategories = [];
    this.pausedState = null; // Store state when paused
  }

  damageByHint(hintCount) {
    switch (hintCount) {
      case 0:
      case 1: return 500;
      case 2: return 400;
      case 3: return 300;
      case 4: return 200;
      case 5: return 100;
      default: return 100;
    }
  }

  addPlayer(socket, playerName, gameMode = 'general', personalCategory = 'general') {
    if (this.players.length >= 2) return false;

    const player = {
      id: socket.id,
      name: playerName,
      health: 5000,
      gameMode: gameMode,
      personalCategory: personalCategory,
      socket: socket
    };

    this.players.push(player);
    this.health[socket.id] = 5000;
    this.playerCategories.push(personalCategory);

    if (this.players.length === 2) {
      this.questions = this.prepareGameQuestions();
    }

    return true;
  }

  prepareGameQuestions() {
    if (this.gameMode === 'general') {
      return this.getGeneralQuestions();
    }
    return this.getCategoryQuestions();
  }

  getGeneralQuestions() {
    const shuffled = this.shuffleArray([...this.questionsData]);
    const selected = shuffled.slice(0, this.questionsPerGame);
    return selected.map(q => new Question(q.id, q.answer, q.category, q.difficulty, q.hints));
  }

  getCategoryQuestions() {
    const [category1, category2] = this.playerCategories;
    const cat1Questions = this.getQuestionsForCategory(category1);
    const cat2Questions = this.getQuestionsForCategory(category2);

    const questionsPerCategory = 5;
    const selected1 = this.shuffleArray(cat1Questions).slice(0, questionsPerCategory);
    const selected2 = this.shuffleArray(cat2Questions).slice(0, questionsPerCategory);

    const combined = [...selected1, ...selected2];
    const shuffled = this.shuffleArray(combined);

    return shuffled.map(q => new Question(q.id, q.answer, q.category, q.difficulty, q.hints));
  }

  getQuestionsForCategory(playerCategory) {
    const categoryMapping = {
      'science & technology': ['Science', 'Technology', 'Physics', 'Biology', 'Chemistry'],
      'sports & games': ['Sports', 'Entertainment'],
      'history & politics': ['History'],
      'literature & arts': ['Literature', 'Art'],
      'geography & nature': ['Geography'],
      'entertainment & media': ['Entertainment', 'Music'],
      'food & culture': ['Food', 'Culture'],
      'science': ['Science', 'Physics', 'Biology', 'Chemistry'],
      'technology': ['Technology'],
      'sports': ['Sports'],
      'history': ['History'],
      'literature': ['Literature'],
      'art': ['Art'],
      'geography': ['Geography'],
      'entertainment': ['Entertainment', 'Music'],
      'food': ['Food'],
      'culture': ['Culture']
    };

    const categoryLower = playerCategory.toLowerCase().trim();
    let matchingCategories = categoryMapping[categoryLower] || [];

    if (categoryLower.includes('&')) {
      const parts = categoryLower.split('&').map(part => part.trim());
      matchingCategories = [];
      parts.forEach(part => {
        if (categoryMapping[part]) {
          matchingCategories.push(...categoryMapping[part]);
        }
      });
    }

    matchingCategories = [...new Set(matchingCategories)];

    return this.questionsData.filter(q => {
      const qCategory = q.category.toLowerCase();
      return matchingCategories.some(cat =>
        qCategory === cat.toLowerCase() ||
        qCategory.includes(cat.toLowerCase()) ||
        cat.toLowerCase().includes(qCategory)
      );
    });
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
    this.players = this.players.filter(p => p.id !== socketId);
    delete this.health[socketId];

    if (this.players.length === 0) {
      this.cleanup();
    }
  }

  updatePlayerHealth(socketId, healthChange) {
    if (this.health[socketId] !== undefined) {
      this.health[socketId] = Math.max(0, Math.min(5000, this.health[socketId] + healthChange));

      const player = this.players.find(p => p.id === socketId);
      if (player) {
        player.health = this.health[socketId];
      }
    }
  }

  isPlayerAlive(socketId) {
    return (this.health[socketId] || 0) > 0;
  }

  getAlivePlayersCount() {
    return this.players.filter(p => this.isPlayerAlive(p.id)).length;
  }

  pauseGame(reason = 'Game paused') {
    if (this.gameState !== 'playing') return false;

    this.pausedState = {
      currentQuestion: this.currentQuestion,
      currentHintIndex: this.currentHintIndex,
      questionAnswered: this.questionAnswered,
      startTime: this.startTime,
      pausedAt: Date.now(),
      reason: reason
    };

    this.gameState = 'paused';
    this.clearTimers();

    this.broadcast('gamePaused', {
      reason: reason,
      message: reason
    });

    return true;
  }

  resumeGame() {
    if (this.gameState !== 'paused' || !this.pausedState) return false;

    const pauseDuration = Date.now() - this.pausedState.pausedAt;

    // Restore state
    this.gameState = 'playing';
    this.currentQuestion = this.pausedState.currentQuestion;
    this.currentHintIndex = this.pausedState.currentHintIndex;
    this.questionAnswered = this.pausedState.questionAnswered;

    // Adjust start time to account for pause
    if (this.pausedState.startTime) {
      this.startTime = this.pausedState.startTime + pauseDuration;
    }

    this.pausedState = null;

    this.broadcast('gameResumed', {
      message: 'Game resumed',
      currentQuestion: this.currentQuestion + 1,
      totalQuestions: this.questionsPerGame
    });

    // Restart timers for current question
    const remainingHints = 5 - this.currentHintIndex;
    if (remainingHints > 0 && !this.questionAnswered) {
      this.hintTimer = setInterval(() => {
        if (this.gameState === 'playing' && !this.questionAnswered) {
          this.revealHint();
        }
      }, 15000);

      this.questionTimer = setTimeout(() => {
        if (this.gameState === 'playing' && !this.questionAnswered) {
          this.handleQuestionTimeout();
        }
      }, 120000);
    }

    return true;
  }

  startGame() {
    if (this.players.length !== 2 || this.questions.length === 0) {
      return false;
    }

    this.gameState = 'playing';
    this.currentQuestion = 0;
    this.startQuestion();
    return true;
  }

  startQuestion() {
    if (this.currentQuestion >= this.questionsPerGame || this.getAlivePlayersCount() < 2) {
      this.endGame();
      return;
    }

    const question = this.questions[this.currentQuestion];
    this.currentHintIndex = 0;
    this.startTime = Date.now();
    this.questionAnswered = false;

    this.broadcast('questionStart', {
      targetIndex: this.currentQuestion + 1,
      totalTargets: this.questionsPerGame,
      category: question.category,
      difficulty: question.difficulty,
      health: this.health
    });

    setTimeout(() => {
      if (this.gameState === 'playing' && !this.questionAnswered) {
        this.revealHint();
      }
    }, 1000);

    this.hintTimer = setInterval(() => {
      if (this.gameState === 'playing' && !this.questionAnswered) {
        this.revealHint();
      }
    }, 15000);

    this.questionTimer = setTimeout(() => {
      if (this.gameState === 'playing' && !this.questionAnswered) {
        this.handleQuestionTimeout();
      }
    }, 120000);
  }

  revealHint() {
    const question = this.questions[this.currentQuestion];
    if (!question || this.currentHintIndex >= 5 || this.currentHintIndex >= question.getTotalHints()) {
      return;
    }

    const hintText = question.getHint(this.currentHintIndex);

    this.broadcast('hintRevealed', {
      index: this.currentHintIndex,
      text: hintText,
      health: this.health
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

    if (isCorrect) {
      this.questionAnswered = true;

      const hintCount = this.currentHintIndex;
      const damageToOpponent = this.damageByHint(hintCount);

      this.players.forEach(p => {
        if (p.id !== socketId && this.isPlayerAlive(p.id)) {
          this.updatePlayerHealth(p.id, -damageToOpponent);
        }
      });

      this.broadcast('questionResult', {
        winner: socketId,
        winnerName: player.name,
        correctAnswer: question.answer,
        timeElapsed: (Date.now() - this.startTime) / 1000,
        health: this.health,
        hintCount: hintCount,
        healthLoss: damageToOpponent
      });

      this.nextQuestion();
    } else {
      this.broadcast('wrongAnswer', {
        playerId: socketId,
        playerName: player.name,
        guess
      });

      if (this.getAlivePlayersCount() <= 1) {
        this.questionAnswered = true;
        this.endGame();
      }
    }
  }

  handleQuestionTimeout() {
    if (this.questionAnswered) return;

    const question = this.questions[this.currentQuestion];

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
      isAlive: this.isPlayerAlive(p.id),
      category: p.personalCategory
    })).sort((a, b) => {
      if (a.isAlive && !b.isAlive) return -1;
      if (!a.isAlive && b.isAlive) return 1;
      return b.health - a.health;
    });

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
    this.pausedState = null;
  }

  broadcast(event, data) {
    this.players.forEach(player => {
      if (player.socket && player.socket.connected) {
        try {
          player.socket.emit(event, data);
        } catch (error) {
          console.error(`Broadcast error in room ${this.id}:`, error.message);
        }
      }
    });
  }

  getStats() {
    return {
      id: this.id,
      gameMode: this.gameMode,
      playerCategories: this.playerCategories,
      playerCount: this.players.length,
      gameState: this.gameState,
      currentTarget: this.currentQuestion + 1,
      totalTargets: this.questionsPerGame,
      questionsInDatabase: this.questions.length,
      playersHealth: this.health,
      alivePlayersCount: this.getAlivePlayersCount(),
      createdAt: this.createdAt,
      isPaused: this.gameState === 'paused'
    };
  }
}

module.exports = GameRoom;
