const Question = require('./Question');

class GameRoom {
  constructor(id, questionsData, questionCategory = 'general', gameMode = 'general') {
    this.id = id;
    this.players = [];
    this.currentQuestion = 0;
    this.questionCategory = questionCategory;
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

    // Prepare questions when we have 2 players
    if (this.players.length === 2) {
      try {
        this.questions = this.prepareGameQuestions();
        console.log(`Game ${this.id}: Prepared ${this.questions.length} questions`);
        console.log(`Game ${this.id}: Question categories:`, this.questions.map(q => q.category));
      } catch (error) {
        console.error(`Game ${this.id}: Error preparing questions:`, error);
        this.questions = this.getSimpleQuestions();
      }
    }

    return true;
  }

  prepareGameQuestions() {
    if (this.gameMode === 'general') {
      return this.getSimpleQuestions();
    }

    // For category mode, create proper category mix
    try {
      return this.getMixedCategoryQuestions();
    } catch (error) {
      console.error(`Game ${this.id}: Error creating mixed questions:`, error);
      return this.getSimpleQuestions();
    }
  }

  getMixedCategoryQuestions() {
    const [category1, category2] = this.playerCategories;

    console.log(`Game ${this.id}: Creating questions for "${category1}" vs "${category2}"`);

    // Get questions for each category with improved matching
    const cat1Questions = this.getQuestionsForCategory(category1);
    const cat2Questions = this.getQuestionsForCategory(category2);

    console.log(`Game ${this.id}: Found ${cat1Questions.length} questions for "${category1}"`);
    console.log(`Game ${this.id}: Found ${cat2Questions.length} questions for "${category2}"`);

    // If we don't have enough questions for either category, log the issue
    if (cat1Questions.length < 5) {
      console.warn(`Game ${this.id}: Only ${cat1Questions.length} questions found for ${category1}`);
    }
    if (cat2Questions.length < 5) {
      console.warn(`Game ${this.id}: Only ${cat2Questions.length} questions found for ${category2}`);
    }

    // Take 5 from each category
    const selected1 = this.shuffleArray(cat1Questions).slice(0, 5);
    const selected2 = this.shuffleArray(cat2Questions).slice(0, 5);

    console.log(`Game ${this.id}: Selected questions:`, {
      category1: selected1.map(q => `${q.answer} (${q.category})`),
      category2: selected2.map(q => `${q.answer} (${q.category})`)
    });

    // Combine and shuffle
    const combined = [...selected1, ...selected2];
    const shuffled = this.shuffleArray(combined);

    return shuffled.map(q => new Question(q.id, q.answer, q.category, q.difficulty, q.hints));
  }

  getQuestionsForCategory(category) {
    if (!category || category === 'general') {
      return this.questionsData;
    }

    console.log(`Game ${this.id}: Filtering questions for category "${category}"`);

    // Improved category mapping
    const categoryMappings = {
      'food': ['food', 'cooking', 'cuisine', 'recipe', 'chef', 'restaurant'],
      'science': ['science', 'physics', 'chemistry', 'biology', 'astronomy', 'scientific', 'scientist'],
      'technology': ['technology', 'computer', 'internet', 'digital', 'tech', 'software'],
      'history': ['history', 'historical', 'ancient', 'war', 'civilization', 'empire'],
      'art': ['art', 'artist', 'painting', 'sculpture', 'artwork', 'painter'],
      'literature': ['literature', 'book', 'novel', 'author', 'writer', 'poet'],
      'geography': ['geography', 'country', 'city', 'mountain', 'river', 'ocean', 'continent'],
      'sports': ['sport', 'athlete', 'olympic', 'game', 'team', 'championship'],
      'music': ['music', 'composer', 'song', 'instrument', 'orchestra', 'symphony'],
      'entertainment': ['entertainment', 'movie', 'film', 'tv', 'celebrity', 'actor'],
      'medicine': ['medicine', 'medical', 'doctor', 'disease', 'health', 'hospital']
    };

    // Extract key terms from the category name
    const categoryLower = category.toLowerCase();
    const keyTerms = [];

    // Check for compound categories like "Food & Culture" or "Science & Technology"
    if (categoryLower.includes('&')) {
      const parts = categoryLower.split('&').map(part => part.trim());
      parts.forEach(part => {
        for (const [key, terms] of Object.entries(categoryMappings)) {
          if (part.includes(key) || key.includes(part)) {
            keyTerms.push(...terms);
          }
        }
      });
    } else {
      // Single category
      for (const [key, terms] of Object.entries(categoryMappings)) {
        if (categoryLower.includes(key) || key.includes(categoryLower)) {
          keyTerms.push(...terms);
        }
      }
    }

    console.log(`Game ${this.id}: Key terms for "${category}":`, keyTerms);

    // Filter questions based on key terms
    const filtered = this.questionsData.filter(q => {
      const qCategoryLower = q.category.toLowerCase();

      // Check if any key term matches the question category
      return keyTerms.some(term =>
        qCategoryLower.includes(term) || term.includes(qCategoryLower)
      );
    });

    console.log(`Game ${this.id}: Filtered ${filtered.length} questions for "${category}"`);
    console.log(`Game ${this.id}: Sample filtered questions:`, filtered.slice(0, 3).map(q => `${q.answer} (${q.category})`));

    // If we have enough questions, return filtered. Otherwise, return all questions.
    if (filtered.length >= 5) {
      return filtered;
    } else {
      console.warn(`Game ${this.id}: Not enough questions for "${category}", using all questions`);
      return this.questionsData;
    }
  }

  getSimpleQuestions() {
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

  broadcastHealthUpdate() {
    this.broadcast('healthUpdate', {
      health: this.health
    });
  }

  startGame() {
    if (this.players.length !== 2 || this.questions.length === 0) {
      console.error(`Game ${this.id}: Cannot start game - players: ${this.players.length}, questions: ${this.questions.length}`);
      return;
    }

    console.log(`Game ${this.id}: Starting ${this.gameMode} game with ${this.questions.length} questions`);
    console.log(`Game ${this.id}: Players: ${this.players.map(p => `${p.name} (${p.personalCategory})`).join(' vs ')}`);

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
    if (!question) {
      console.error(`Game ${this.id}: No question found at index ${this.currentQuestion}`);
      this.endGame();
      return;
    }

    this.currentHintIndex = 0;
    this.startTime = Date.now();
    this.questionAnswered = false;

    console.log(`Game ${this.id}: Question ${this.currentQuestion + 1}/${this.questionsPerGame}: ${question.answer} (${question.category})`);

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
    if (!question || this.currentHintIndex >= question.getTotalHints()) {
      return;
    }

    const hintText = question.getHint(this.currentHintIndex);

    console.log(`Game ${this.id}: Revealing hint ${this.currentHintIndex + 1}: ${hintText}`);

    // Deduct health for hint
    this.players.forEach(player => {
      if (this.isPlayerAlive(player.id)) {
        this.updatePlayerHealth(player.id, -100);
      }
    });

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

    console.log(`Game ${this.id}: ${player.name} guessed: "${guess}" for "${question.answer}"`);

    const isCorrect = question.checkAnswer(guess);
    const timeElapsed = (Date.now() - this.startTime) / 1000;

    // Time penalty
    const timePenalty = Math.floor(timeElapsed);
    this.updatePlayerHealth(socketId, -timePenalty);

    if (isCorrect) {
      this.questionAnswered = true;
      this.updatePlayerHealth(socketId, 1000);

      console.log(`Game ${this.id}: ${player.name} CORRECT! Health: ${this.health[socketId]}`);

      this.broadcast('questionResult', {
        winner: socketId,
        winnerName: player.name,
        correctAnswer: question.answer,
        timeElapsed: timeElapsed,
        health: this.health,
        healthGained: 1000,
        isCorrect: true // Add this flag
      });

      this.nextQuestion();
    } else {
      this.updatePlayerHealth(socketId, -500);

      console.log(`Game ${this.id}: ${player.name} WRONG. Health: ${this.health[socketId]}`);

      // Send wrong answer notification with player ID for tracking
      this.broadcast('wrongAnswer', {
        playerId: socketId,
        playerName: player.name,
        guess,
        healthLost: 500,
        currentHealth: this.health[socketId],
        isCorrect: false // Add this flag
      });

      this.broadcastHealthUpdate();

      if (!this.isPlayerAlive(socketId)) {
        this.broadcast('playerEliminated', {
          eliminatedPlayer: socketId,
          eliminatedPlayerName: player.name,
          health: this.health
        });

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
    console.log(`Game ${this.id}: Timeout: ${question.answer}`);

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
      isAlive: this.isPlayerAlive(p.id),
      category: p.personalCategory
    })).sort((a, b) => {
      if (a.isAlive && !b.isAlive) return -1;
      if (!a.isAlive && b.isAlive) return 1;
      return b.health - a.health;
    });

    console.log(`Game ${this.id}: Game ended. Results:`, results);
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
    console.log(`Game ${this.id}: Cleaning up`);
    this.clearTimers();
  }

  broadcast(event, data) {
    this.players.forEach(player => {
      if (player.socket && player.socket.connected) {
        try {
          player.socket.emit(event, data);
        } catch (error) {
          console.error(`Game ${this.id}: Error broadcasting to ${player.name}:`, error);
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
