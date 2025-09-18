const Question = require('./Question');

class GameRoom {
  constructor(id, questionsData, questionCategory = 'general', gameMode = 'general') {
    this.id = id;
    this.players = [];
    this.currentQuestion = 0;
    this.questionCategory = questionCategory;
    this.gameMode = gameMode;
    this.playerCategories = []; // Store both players' categories
    this.questions = [];
    this.gameState = 'waiting';
    this.currentHintIndex = 0;
    this.hintTimer = null;
    this.questionTimer = null;
    this.health = {};
    this.startTime = null;
    this.questionAnswered = false;
    this.questionsPerGame = gameMode === 'category' ? 10 : 5; // 10 for Under Cover, 5 for Quick
    this.createdAt = Date.now();
    this.questionsData = questionsData; // Store for later use
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

    // Store player categories for question mixing
    this.playerCategories.push(personalCategory);

    // If this is the second player and it's category mode, prepare mixed questions
    if (this.players.length === 2 && gameMode === 'category') {
      this.questions = this.createMixedQuestions();
    } else if (gameMode === 'general') {
      // For general mode, shuffle all questions
      this.questions = this.shuffleQuestions(this.questionsData, 'general');
    }

    return true;
  }

  createMixedQuestions() {
    console.log(`Game ${this.id}: Creating mixed questions for categories:`, this.playerCategories);

    const [category1, category2] = this.playerCategories;
    const questionsPerCategory = 5; // 5 questions from each category

    // Filter questions by each category
    const category1Questions = this.filterQuestionsByCategory(this.questionsData, category1);
    const category2Questions = this.filterQuestionsByCategory(this.questionsData, category2);

    console.log(`Game ${this.id}: Found ${category1Questions.length} questions for ${category1}`);
    console.log(`Game ${this.id}: Found ${category2Questions.length} questions for ${category2}`);

    // Get 5 random questions from each category
    const selectedCategory1 = this.getRandomQuestions(category1Questions, questionsPerCategory);
    const selectedCategory2 = this.getRandomQuestions(category2Questions, questionsPerCategory);

    // Combine and shuffle the questions
    const combinedQuestions = [...selectedCategory1, ...selectedCategory2];
    const shuffledQuestions = this.shuffleArray(combinedQuestions);

    console.log(`Game ${this.id}: Created ${shuffledQuestions.length} mixed questions`);

    return shuffledQuestions.map(q =>
      new Question(q.id, q.answer, q.category, q.difficulty, q.hints)
    );
  }

  filterQuestionsByCategory(questionsData, category) {
    if (category === 'general') {
      return questionsData;
    }

    return questionsData.filter(q => {
      const questionCategory = q.category.toLowerCase();
      const targetCategory = category.toLowerCase();

      // Flexible matching for categories
      return questionCategory.includes(targetCategory) ||
             targetCategory.includes(questionCategory) ||
             this.getCategoryMatches(questionCategory, targetCategory);
    });
  }

  getCategoryMatches(questionCategory, targetCategory) {
    const categoryMappings = {
      'history': ['history', 'ancient', 'war', 'historical'],
      'science': ['science', 'physics', 'chemistry', 'biology', 'astronomy'],
      'art': ['art', 'painting', 'sculpture', 'artist'],
      'literature': ['literature', 'book', 'novel', 'author', 'writer'],
      'geography': ['geography', 'country', 'city', 'mountain', 'river', 'ocean'],
      'sports': ['sport', 'game', 'athlete', 'olympic'],
      'music': ['music', 'song', 'composer', 'instrument'],
      'entertainment': ['entertainment', 'movie', 'film', 'tv', 'celebrity'],
      'food': ['food', 'cooking', 'cuisine', 'recipe'],
      'technology': ['technology', 'computer', 'internet', 'digital']
    };

    const targetMappings = categoryMappings[targetCategory] || [targetCategory];
    return targetMappings.some(mapping => questionCategory.includes(mapping));
  }

  getRandomQuestions(questions, count) {
    if (questions.length <= count) {
      return questions;
    }

    const shuffled = this.shuffleArray([...questions]);
    return shuffled.slice(0, count);
  }

  shuffleQuestions(questionsData, questionCategory) {
    let filteredQuestions = questionsData;

    // For general mode, use all questions
    if (questionCategory && questionCategory !== 'general') {
      filteredQuestions = this.filterQuestionsByCategory(questionsData, questionCategory);

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

    const shuffled = this.shuffleArray(allQuestions);
    return shuffled.slice(0, this.questionsPerGame);
  }

  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
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
    return this.health[socketId] > 0;
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
    if (this.players.length !== 2) return;

    console.log(`Game ${this.id}: Starting ${this.gameMode} game with players:`, this.players.map(p => `${p.name} (${p.personalCategory})`));
    console.log(`Game ${this.id}: Playing ${this.questions.length} questions`);

    if (this.gameMode === 'category') {
      console.log(`Game ${this.id}: Category breakdown:`, this.getQuestionCategoryBreakdown());
    }

    this.gameState = 'playing';
    this.currentQuestion = 0;
    this.startQuestion();
  }

  getQuestionCategoryBreakdown() {
    const breakdown = {};
    this.questions.forEach(q => {
      breakdown[q.category] = (breakdown[q.category] || 0) + 1;
    });
    return breakdown;
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

    console.log(`Game ${this.id}: Starting question ${this.currentQuestion + 1}/${this.questionsPerGame}: ${question.answer} (${question.category})`);

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

    const timePenalty = Math.floor(timeElapsed);
    this.updatePlayerHealth(socketId, -timePenalty);

    if (isCorrect) {
      this.questionAnswered = true;
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
      this.updatePlayerHealth(socketId, -500);

      console.log(`Game ${this.id}: ${player.name} got it wrong. Health: ${this.health[socketId]}`);

      player.socket.emit('wrongAnswer', {
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
    console.log(`Game ${this.id}: Question timeout: ${question.answer}`);

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

    console.log(`Game ${this.id}: Game ended after ${this.currentQuestion} questions. Final results:`, results);
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
      playerCategories: this.playerCategories,
      playerCount: this.players.length,
      gameState: this.gameState,
      currentTarget: this.currentQuestion + 1,
      totalTargets: this.questionsPerGame,
      questionsInDatabase: this.questions.length,
      playersHealth: this.health,
      alivePlayersCount: this.getAlivePlayersCount(),
      createdAt: this.createdAt,
      questionBreakdown: this.gameMode === 'category' ? this.getQuestionCategoryBreakdown() : null
    };
  }
}

module.exports = GameRoom;
