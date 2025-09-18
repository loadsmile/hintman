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
        console.log(`Game ${this.id}: Question categories:`, this.questions.map(q => `${q.answer} (${q.category})`));
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

    // Get questions for each category with strict matching
    const cat1Questions = this.getStrictCategoryQuestions(category1);
    const cat2Questions = this.getStrictCategoryQuestions(category2);

    console.log(`Game ${this.id}: Found ${cat1Questions.length} questions for "${category1}"`);
    console.log(`Game ${this.id}: Found ${cat2Questions.length} questions for "${category2}"`);

    // If we don't have enough questions for either category, fall back to broader matching
    if (cat1Questions.length < 5 || cat2Questions.length < 5) {
      console.warn(`Game ${this.id}: Not enough strict matches, trying broader matching...`);
      return this.getBroaderCategoryQuestions(category1, category2);
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

  getStrictCategoryQuestions(playerCategory) {
    console.log(`Game ${this.id}: Strict filtering for "${playerCategory}"`);

    // Map player category selections to exact question categories
    const categoryMap = {
      // Player selections -> Question categories
      'food': ['Food', 'food', 'cooking', 'cuisine'],
      'science': ['Science', 'Physics', 'Chemistry', 'Biology', 'Astronomy'],
      'technology': ['Technology', 'Computer', 'Internet', 'Digital'],
      'history': ['History', 'Historical', 'Ancient', 'War'],
      'art': ['Art', 'Artist', 'Painting', 'Sculpture'],
      'literature': ['Literature', 'Book', 'Novel', 'Author'],
      'geography': ['Geography', 'Country', 'City', 'Mountain', 'River', 'Ocean'],
      'sports': ['Sport', 'Sports', 'Athletic', 'Olympic'],
      'music': ['Music', 'Composer', 'Song', 'Instrument'],
      'entertainment': ['Entertainment', 'Movie', 'Film', 'TV', 'Celebrity'],
      'medicine': ['Medicine', 'Medical', 'Doctor', 'Health'],
      'culture': ['Culture', 'Cultural', 'Tradition', 'Society']
    };

    // Extract main keywords from player category
    const categoryLower = playerCategory.toLowerCase();
    let matchingTerms = [];

    // Handle compound categories like "Food & Culture"
    if (categoryLower.includes('&')) {
      const parts = categoryLower.split('&').map(part => part.trim());
      parts.forEach(part => {
        for (const [key, terms] of Object.entries(categoryMap)) {
          if (part.includes(key) || key.includes(part)) {
            matchingTerms.push(...terms);
          }
        }
      });
    } else {
      // Single category
      for (const [key, terms] of Object.entries(categoryMap)) {
        if (categoryLower.includes(key) || key.includes(categoryLower)) {
          matchingTerms.push(...terms);
        }
      }
    }

    console.log(`Game ${this.id}: Matching terms for "${playerCategory}":`, matchingTerms);

    // Filter questions with exact category matches
    const filtered = this.questionsData.filter(q => {
      const qCategory = q.category;
      return matchingTerms.some(term =>
        qCategory.toLowerCase() === term.toLowerCase() ||
        qCategory.toLowerCase().includes(term.toLowerCase()) ||
        term.toLowerCase().includes(qCategory.toLowerCase())
      );
    });

    console.log(`Game ${this.id}: Strict filtered ${filtered.length} questions for "${playerCategory}"`);
    if (filtered.length > 0) {
      console.log(`Game ${this.id}: Sample strict questions:`, filtered.slice(0, 3).map(q => `${q.answer} (${q.category})`));
    }

    return filtered;
  }

  getBroaderCategoryQuestions(category1, category2) {
    console.log(`Game ${this.id}: Using broader matching for "${category1}" and "${category2}"`);

    // If strict matching fails, use broader keyword matching
    const cat1Questions = this.getQuestionsForCategory(category1);
    const cat2Questions = this.getQuestionsForCategory(category2);

    console.log(`Game ${this.id}: Broader search found ${cat1Questions.length} for "${category1}", ${cat2Questions.length} for "${category2}"`);

    // Ensure we have enough questions
    if (cat1Questions.length < 5 && cat2Questions.length < 5) {
      console.warn(`Game ${this.id}: Still not enough questions, using all available`);
      return this.getSimpleQuestions();
    }

    // Take what we can from each category
    const take1 = Math.min(5, cat1Questions.length);
    const take2 = Math.min(5, cat2Questions.length);
    const remaining = 10 - take1 - take2;

    const selected1 = this.shuffleArray(cat1Questions).slice(0, take1);
    const selected2 = this.shuffleArray(cat2Questions).slice(0, take2);

    let combined = [...selected1, ...selected2];

    // Fill remaining slots with general questions if needed
    if (remaining > 0) {
      const usedIds = new Set(combined.map(q => q.id));
      const remaining_questions = this.questionsData
        .filter(q => !usedIds.has(q.id))
        .slice(0, remaining);
      combined = [...combined, ...remaining_questions];
    }

    console.log(`Game ${this.id}: Final broader selection:`, combined.map(q => `${q.answer} (${q.category})`));

    const shuffled = this.shuffleArray(combined);
    return shuffled.map(q => new Question(q.id, q.answer, q.category, q.difficulty, q.hints));
  }

  getQuestionsForCategory(category) {
    if (!category || category === 'general') {
      return this.questionsData;
    }

    console.log(`Game ${this.id}: Broader filtering for category "${category}"`);

    // Broader category matching (fallback)
    const categoryMappings = {
      'food': ['food', 'cooking', 'cuisine', 'recipe', 'chef', 'restaurant', 'drink'],
      'science': ['science', 'physics', 'chemistry', 'biology', 'astronomy', 'scientific', 'scientist', 'dna', 'atom'],
      'technology': ['technology', 'computer', 'internet', 'digital', 'tech', 'software', 'web'],
      'history': ['history', 'historical', 'ancient', 'war', 'civilization', 'empire', 'revolution'],
      'art': ['art', 'artist', 'painting', 'sculpture', 'artwork', 'painter', 'draw'],
      'literature': ['literature', 'book', 'novel', 'author', 'writer', 'poet', 'play'],
      'geography': ['geography', 'country', 'city', 'mountain', 'river', 'ocean', 'continent', 'capital'],
      'sports': ['sport', 'athlete', 'olympic', 'game', 'team', 'championship', 'football'],
      'music': ['music', 'composer', 'song', 'instrument', 'orchestra', 'symphony', 'band'],
      'entertainment': ['entertainment', 'movie', 'film', 'tv', 'celebrity', 'actor', 'show'],
      'medicine': ['medicine', 'medical', 'doctor', 'disease', 'health', 'hospital', 'drug'],
      'culture': ['culture', 'cultural', 'tradition', 'society', 'custom', 'heritage']
    };

    const categoryLower = category.toLowerCase();
    const keyTerms = [];

    // Check for compound categories like "Food & Culture"
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

    console.log(`Game ${this.id}: Broader key terms for "${category}":`, keyTerms);

    // Filter questions based on key terms
    const filtered = this.questionsData.filter(q => {
      const qCategoryLower = q.category.toLowerCase();
      const qAnswerLower = q.answer.toLowerCase();

      // Check if any key term matches the question category or answer
      return keyTerms.some(term =>
        qCategoryLower.includes(term) ||
        term.includes(qCategoryLower) ||
        qAnswerLower.includes(term)
      );
    });

    console.log(`Game ${this.id}: Broader filtered ${filtered.length} questions for "${category}"`);

    return filtered.length >= 5 ? filtered : this.questionsData;
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
        healthGained: 1000
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
        currentHealth: this.health[socketId]
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
