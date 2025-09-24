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
  }

  // Damage penalties
  damageByHint(hintCount) {
    switch (hintCount) {
      case 0:
      case 1: return 500;  // Update from 1000
      case 2: return 400;  // Update from 800
      case 3: return 300;  // Update from 600
      case 4: return 200;  // Update from 400
      case 5: return 100;  // Update from 200
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

    console.log(`🎯 Player added to room ${this.id}: ${playerName} (${socket.id}) - Health: 5000`);

    if (this.players.length === 2) {
      this.questions = this.prepareGameQuestions();
      console.log(`🎯 Room ${this.id} ready with 2 players - ${this.questions.length} questions prepared`);
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
      const oldHealth = this.health[socketId];
      this.health[socketId] = Math.max(0, Math.min(5000, this.health[socketId] + healthChange));

      const player = this.players.find(p => p.id === socketId);
      if (player) {
        player.health = this.health[socketId];
      }

      console.log(`🎯 Health update for ${player?.name || socketId}: ${oldHealth} -> ${this.health[socketId]} (${healthChange >= 0 ? '+' : ''}${healthChange})`);
    }
  }

  isPlayerAlive(socketId) {
    return (this.health[socketId] || 0) > 0;
  }

  getAlivePlayersCount() {
    return this.players.filter(p => this.isPlayerAlive(p.id)).length;
  }

  startGame() {
    if (this.players.length !== 2 || this.questions.length === 0) {
      console.warn(`GameRoom ${this.id}: Cannot start game`);
      return;
    }

    console.log(`🎯 Starting game in room ${this.id} with OneVsOne system`);
    this.gameState = 'playing';
    this.currentQuestion = 0;
    this.startQuestion();
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

    console.log(`🎯 Room ${this.id}: Starting question ${this.currentQuestion + 1}/${this.questionsPerGame} - "${question.answer}"`);

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

  // CRITICAL: OneVsOne system - NO HP deduction for hints
  revealHint() {
    console.log('🎯🎯🎯 REVEALING HINT - NO HP DEDUCTION 🎯🎯🎯');
    const question = this.questions[this.currentQuestion];
    if (!question || this.currentHintIndex >= 5 || this.currentHintIndex >= question.getTotalHints()) {
      return;
    }

    const hintText = question.getHint(this.currentHintIndex);

    // NO HP DEDUCTION HERE - OneVsOne system
    console.log('🎯 HEALTH BEFORE HINT:', JSON.stringify(this.health));

    this.broadcast('hintRevealed', {
      index: this.currentHintIndex,
      text: hintText,
      health: this.health
    });

    console.log('🎯 HEALTH AFTER HINT:', JSON.stringify(this.health), '- NO CHANGE (OneVsOne system)');
    this.currentHintIndex++;
  }

  handleGuess(socketId, guess) {
    const question = this.questions[this.currentQuestion];
    const player = this.players.find(p => p.id === socketId);

    if (!player || !question || this.gameState !== 'playing' || this.questionAnswered || !this.isPlayerAlive(socketId)) {
      return;
    }

    const isCorrect = question.checkAnswer(guess);

    console.log(`🎯 GUESS: "${guess}" by ${player.name} - ${isCorrect ? 'CORRECT' : 'WRONG'}`);
    console.log(`🎯 Health BEFORE guess: ${JSON.stringify(this.health)}`);

    if (isCorrect) {
      this.questionAnswered = true;

      const hintCount = this.currentHintIndex;
      const damageToOpponent = this.damageByHint(hintCount);

      console.log(`🎯 CORRECT! Dealing ${damageToOpponent} damage (hint ${hintCount})`);

      // Damage opponent
      this.players.forEach(p => {
        if (p.id !== socketId && this.isPlayerAlive(p.id)) {
          this.updatePlayerHealth(p.id, -damageToOpponent);
          console.log(`🎯 Damaged ${p.name}: ${this.health[p.id]} HP remaining`);
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
      console.log(`🎯 WRONG ANSWER - NO PENALTY! (OneVsOne system)`);

      // NO HP PENALTY for wrong answers in OneVsOne system
      this.broadcast('wrongAnswer', {
        playerId: socketId,
        playerName: player.name,
        guess
      });

      console.log(`🎯 Health AFTER wrong guess: ${JSON.stringify(this.health)} - NO CHANGE (OneVsOne system)`);

      if (this.getAlivePlayersCount() <= 1) {
        this.questionAnswered = true;
        this.endGame();
      }
    }
  }

  handleQuestionTimeout() {
    if (this.questionAnswered) return;

    const question = this.questions[this.currentQuestion];

    console.log(`🎯 TIMEOUT - NO PENALTY! Room: ${this.id}`);
    console.log(`🎯 Health after timeout: ${JSON.stringify(this.health)} - NO CHANGE (OneVsOne system)`);

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

    console.log(`🎯 Game ended in room ${this.id}. Final health: ${JSON.stringify(this.health)}`);

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
  }

  broadcast(event, data) {
    this.players.forEach(player => {
      if (player.socket && player.socket.connected) {
        try {
          player.socket.emit(event, data);
        } catch (error) {
          console.error(`GameRoom ${this.id}: Error broadcasting to ${player.id}:`, error.message);
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
      createdAt: this.createdAt
    };
  }
}

module.exports = GameRoom;
