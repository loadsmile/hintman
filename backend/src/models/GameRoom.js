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
    this.categoryMix = null;

    // Validate questions data
    if (!questionsData || !Array.isArray(questionsData) || questionsData.length === 0) {
      console.warn(`GameRoom ${id}: Invalid questions data provided, using fallback`);
      this.questionsData = this.createFallbackQuestions();
    }
  }

  createFallbackQuestions() {
    return [
      {
        id: 1,
        answer: "The Mona Lisa",
        category: "Art",
        difficulty: "medium",
        hints: [
          "This painting is displayed in the Louvre Museum",
          "It was painted by Leonardo da Vinci",
          "The subject has a mysterious smile",
          "It's one of the most famous paintings in the world",
          "The subject is believed to be Lisa Gherardini"
        ]
      },
      {
        id: 2,
        answer: "Mount Everest",
        category: "Geography",
        difficulty: "easy",
        hints: [
          "It's the highest mountain on Earth",
          "Located in the Himalayas",
          "First summited in 1953",
          "It's on the border of Nepal and Tibet",
          "Its height is approximately 8,848 meters"
        ]
      },
      {
        id: 3,
        answer: "William Shakespeare",
        category: "Literature",
        difficulty: "medium",
        hints: [
          "He wrote many famous plays and sonnets",
          "Born in Stratford-upon-Avon",
          "Known as the Bard of Avon",
          "Wrote Romeo and Juliet",
          "Considered the greatest writer in the English language"
        ]
      }
    ];
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
        // Store category mix info for frontend display
        this.categoryMix = {
          player1: { name: this.players[0].name, category: this.players[0].personalCategory },
          player2: { name: this.players[1].name, category: this.players[1].personalCategory }
        };

        this.questions = this.prepareGameQuestions();
        console.log(`GameRoom ${this.id}: Prepared ${this.questions.length} questions for ${gameMode} mode`);
      } catch (error) {
        console.error(`GameRoom ${this.id}: Error preparing questions:`, error);
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
      console.error(`GameRoom ${this.id}: Error in getMixedCategoryQuestions:`, error);
      return this.getSimpleQuestions();
    }
  }

  getMixedCategoryQuestions() {
    const [category1, category2] = this.playerCategories;

    // Get questions for each category with enhanced logic
    const cat1Questions = this.getQuestionsForPlayerCategory(category1);
    const cat2Questions = this.getQuestionsForPlayerCategory(category2);

    console.log(`GameRoom ${this.id}: Category questions - ${category1}: ${cat1Questions.length}, ${category2}: ${cat2Questions.length}`);

    // Enhanced fallback logic - try broader matching if insufficient questions
    if (cat1Questions.length < 3 || cat2Questions.length < 3) {
      return this.getEnhancedFallbackQuestions(cat1Questions, cat2Questions, category1, category2);
    }

    // Take equal amounts from each category (5 from each for 10 total)
    const questionsPerCategory = Math.min(5, Math.floor(this.questionsPerGame / 2));
    const selected1 = this.shuffleArray(cat1Questions).slice(0, questionsPerCategory);
    const selected2 = this.shuffleArray(cat2Questions).slice(0, questionsPerCategory);

    // Combine and ensure we have the right number of questions
    const combined = [...selected1, ...selected2];

    // If we need more questions to reach the target, fill from remaining
    if (combined.length < this.questionsPerGame) {
      const usedIds = new Set(combined.map(q => q.id));
      const remaining = [...cat1Questions, ...cat2Questions]
        .filter(q => !usedIds.has(q.id));
      const needed = this.questionsPerGame - combined.length;
      const additional = this.shuffleArray(remaining).slice(0, needed);
      combined.push(...additional);
    }

    // Final shuffle
    const shuffled = this.shuffleArray(combined);
    return shuffled.map(q => new Question(q.id, q.answer, q.category, q.difficulty, q.hints));
  }

  getQuestionsForPlayerCategory(playerCategory) {
    // Enhanced category mapping with exact matches for compound categories
    const categoryMapping = {
      // Direct compound category matches
      'science & technology': ['Science', 'Technology', 'Physics', 'Biology', 'Chemistry', 'Medicine'],
      'sports & games': ['Sports', 'Entertainment'],
      'history & politics': ['History'],
      'literature & arts': ['Literature', 'Art'],
      'geography & nature': ['Geography'],
      'entertainment & media': ['Entertainment', 'Music'],
      'food & culture': ['Food', 'Culture'],

      // Individual category matches
      'science': ['Science', 'Physics', 'Biology', 'Chemistry'],
      'technology': ['Technology'],
      'physics': ['Physics'],
      'biology': ['Biology'],
      'chemistry': ['Chemistry'],
      'medicine': ['Medicine'],

      'sports': ['Sports'],
      'games': ['Sports', 'Entertainment'],

      'history': ['History'],
      'politics': ['History'],

      'literature': ['Literature'],
      'art': ['Art'],

      'geography': ['Geography'],
      'nature': ['Geography', 'Science'],

      'entertainment': ['Entertainment', 'Music'],
      'media': ['Entertainment', 'Music'],
      'music': ['Music'],

      'food': ['Food'],
      'culture': ['Culture']
    };

    // Get available categories in our questions database for validation
    const availableCategories = [...new Set(this.questionsData.map(q => q.category))];

    // Normalize the player category for exact matching
    const categoryLower = playerCategory.toLowerCase().trim();
    let matchingQuestionCategories = [];

    // First, try exact compound category match
    if (categoryMapping[categoryLower]) {
      matchingQuestionCategories = [...categoryMapping[categoryLower]];
    } else {
      // Parse compound categories manually
      if (categoryLower.includes('&')) {
        const parts = categoryLower.split('&').map(part => part.trim());

        parts.forEach(part => {
          // Try exact matches first
          if (categoryMapping[part]) {
            matchingQuestionCategories.push(...categoryMapping[part]);
          } else {
            // Fuzzy matching as fallback
            for (const [key, questionCats] of Object.entries(categoryMapping)) {
              if (part.includes(key) || key.includes(part)) {
                matchingQuestionCategories.push(...questionCats);
              }
            }
          }
        });
      } else {
        // Single category - try exact match first
        if (categoryMapping[categoryLower]) {
          matchingQuestionCategories = [...categoryMapping[categoryLower]];
        } else {
          // Fuzzy matching as fallback
          for (const [key, questionCats] of Object.entries(categoryMapping)) {
            if (categoryLower.includes(key) || key.includes(categoryLower)) {
              matchingQuestionCategories.push(...questionCats);
            }
          }
        }
      }
    }

    // Remove duplicates and validate against available categories
    matchingQuestionCategories = [...new Set(matchingQuestionCategories)];

    // Filter to only include categories that actually exist in our database
    matchingQuestionCategories = matchingQuestionCategories.filter(cat =>
      availableCategories.some(availCat =>
        availCat.toLowerCase() === cat.toLowerCase() ||
        availCat.toLowerCase().includes(cat.toLowerCase()) ||
        cat.toLowerCase().includes(availCat.toLowerCase())
      )
    );

    // Filter questions based on matching categories
    const filtered = this.questionsData.filter(q => {
      const qCategory = q.category;
      return matchingQuestionCategories.some(cat =>
        qCategory.toLowerCase() === cat.toLowerCase() ||
        qCategory.toLowerCase().includes(cat.toLowerCase()) ||
        cat.toLowerCase().includes(qCategory.toLowerCase())
      );
    });

    return filtered;
  }

  getEnhancedFallbackQuestions(cat1Questions, cat2Questions, category1, category2) {
    // If one category has no questions, try broader matching
    let enhancedCat1 = cat1Questions;
    let enhancedCat2 = cat2Questions;

    if (cat1Questions.length === 0) {
      enhancedCat1 = this.getBroaderCategoryQuestions(category1);
    }
    if (cat2Questions.length === 0) {
      enhancedCat2 = this.getBroaderCategoryQuestions(category2);
    }

    // Combine all available questions from both categories
    const combined = [...enhancedCat1, ...enhancedCat2];

    // Remove duplicates based on question ID
    const uniqueQuestions = combined.filter((question, index, self) =>
      index === self.findIndex(q => q.id === question.id)
    );

    // If we still don't have enough questions, fill with random questions
    if (uniqueQuestions.length < this.questionsPerGame) {
      const usedIds = new Set(uniqueQuestions.map(q => q.id));
      const remainingQuestions = this.questionsData.filter(q => !usedIds.has(q.id));
      const needed = this.questionsPerGame - uniqueQuestions.length;
      const randomQuestions = this.shuffleArray(remainingQuestions).slice(0, needed);
      uniqueQuestions.push(...randomQuestions);
    }

    // Try to maintain some balance - take at least some from each category if possible
    let finalQuestions = [];

    if (enhancedCat1.length > 0 && enhancedCat2.length > 0) {
      const questionsPerCategory = Math.floor(this.questionsPerGame / 2);
      const selected1 = this.shuffleArray(enhancedCat1).slice(0, questionsPerCategory);
      const selected2 = this.shuffleArray(enhancedCat2).slice(0, questionsPerCategory);
      finalQuestions = [...selected1, ...selected2];

      // Fill remaining slots
      if (finalQuestions.length < this.questionsPerGame) {
        const usedIds = new Set(finalQuestions.map(q => q.id));
        const remaining = uniqueQuestions.filter(q => !usedIds.has(q.id));
        const needed = this.questionsPerGame - finalQuestions.length;
        finalQuestions.push(...remaining.slice(0, needed));
      }
    } else {
      finalQuestions = uniqueQuestions.slice(0, this.questionsPerGame);
    }

    const shuffled = this.shuffleArray(finalQuestions);
    return shuffled.map(q => new Question(q.id, q.answer, q.category, q.difficulty, q.hints));
  }

  getBroaderCategoryQuestions(originalCategory) {
    // Broader category mappings for when specific categories have insufficient questions
    const broaderMappings = {
      'sports': ['Entertainment', 'Culture'], // Sports questions might be under Entertainment
      'games': ['Entertainment', 'Technology'],
      'sports & games': ['Sports', 'Entertainment', 'Culture'],
      'politics': ['History', 'Geography'],
      'nature': ['Science', 'Geography', 'Biology'],
      'health': ['Medicine', 'Biology', 'Science'],
      'media': ['Entertainment', 'Culture'],
      'technology': ['Science', 'Technology']
    };

    const categoryLower = originalCategory.toLowerCase();
    let broaderCategories = [];

    // Try exact match first
    if (broaderMappings[categoryLower]) {
      broaderCategories = [...broaderMappings[categoryLower]];
    } else {
      // Fuzzy matching
      for (const [key, categories] of Object.entries(broaderMappings)) {
        if (categoryLower.includes(key) || key.includes(categoryLower)) {
          broaderCategories.push(...categories);
        }
      }
    }

    // Remove duplicates
    broaderCategories = [...new Set(broaderCategories)];

    // Filter questions based on broader categories
    return this.questionsData.filter(q => {
      const qCategory = q.category;
      return broaderCategories.some(cat =>
        qCategory.toLowerCase() === cat.toLowerCase() ||
        qCategory.toLowerCase().includes(cat.toLowerCase()) ||
        cat.toLowerCase().includes(qCategory.toLowerCase())
      );
    });
  }

  getSimpleQuestions() {
    try {
      const shuffled = this.shuffleArray([...this.questionsData]);
      const selected = shuffled.slice(0, this.questionsPerGame);
      return selected.map(q => new Question(q.id, q.answer, q.category, q.difficulty, q.hints));
    } catch (error) {
      console.error(`GameRoom ${this.id}: Error in getSimpleQuestions:`, error);
      // Return fallback questions
      const fallback = this.createFallbackQuestions();
      return fallback.slice(0, this.questionsPerGame).map(q => new Question(q.id, q.answer, q.category, q.difficulty, q.hints));
    }
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
      console.warn(`GameRoom ${this.id}: Cannot start game - players: ${this.players.length}, questions: ${this.questions.length}`);
      return;
    }

    console.log(`GameRoom ${this.id}: Starting game with ${this.questions.length} questions`);
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
      console.error(`GameRoom ${this.id}: Question ${this.currentQuestion} is undefined`);
      this.endGame();
      return;
    }

    this.currentHintIndex = 0;
    this.startTime = Date.now();
    this.questionAnswered = false;

    // Include category mix info in the question start event
    const questionData = {
      targetIndex: this.currentQuestion + 1,
      totalTargets: this.questionsPerGame,
      category: question.category,
      difficulty: question.difficulty,
      health: this.health
    };

    // Add category mix info for Under Cover missions
    if (this.gameMode === 'category' && this.categoryMix) {
      questionData.categoryMix = this.categoryMix;
    }

    this.broadcast('questionStart', questionData);

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
    if (!question || this.currentHintIndex >= question.getTotalHints() || this.currentHintIndex >= 5) {
      return;
    }

    const hintText = question.getHint(this.currentHintIndex);

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

    const isCorrect = question.checkAnswer(guess);
    const timeElapsed = (Date.now() - this.startTime) / 1000;

    // Time penalty
    const timePenalty = Math.floor(timeElapsed);
    this.updatePlayerHealth(socketId, -timePenalty);

    if (isCorrect) {
      this.questionAnswered = true;
      this.updatePlayerHealth(socketId, 1000);

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
      createdAt: this.createdAt,
      categoryMix: this.categoryMix
    };
  }
}

module.exports = GameRoom;
