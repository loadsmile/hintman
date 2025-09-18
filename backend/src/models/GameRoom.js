const Question = require('./Question');

class GameRoom {
  constructor(id, questionsData, category = 'general') {
    this.id = id;
    this.players = [];
    this.currentQuestion = 0;
    this.category = category; // Store selected category
    this.questions = this.shuffleQuestions(questionsData, category);
    this.gameState = 'waiting';
    this.currentHintIndex = 0;
    this.hintTimer = null;
    this.questionTimer = null;
    this.health = {};
    this.startTime = null;
    this.questionAnswered = false;
    this.questionsPerGame = 5;
  }

  shuffleQuestions(questionsData, category) {
    let filteredQuestions = questionsData;

    // Filter by category if not general
    if (category && category !== 'general') {
      filteredQuestions = questionsData.filter(q =>
        q.category.toLowerCase() === category.toLowerCase() ||
        q.category.toLowerCase().includes(category.toLowerCase())
      );

      console.log(`Filtered ${filteredQuestions.length} questions for category: ${category}`);
    }

    // If filtered results are too few, fall back to all questions
    if (filteredQuestions.length < this.questionsPerGame) {
      console.log(`Not enough ${category} questions (${filteredQuestions.length}), using all questions`);
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

  addPlayer(socket, playerName, category = 'general') {
    if (this.players.length >= 2) return false;

    const player = {
      id: socket.id,
      name: playerName,
      health: 5000,
      category: category, // Store player's category preference
      socket: socket
    };

    this.players.push(player);
    this.health[socket.id] = 5000;

    return true;
  }

  // ... rest of the methods remain the same as before

  getStats() {
    return {
      id: this.id,
      category: this.category,
      playerCount: this.players.length,
      gameState: this.gameState,
      currentTarget: this.currentQuestion + 1,
      totalTargets: this.questionsPerGame,
      questionsInDatabase: this.questions.length,
      playersHealth: this.health,
      alivePlayersCount: this.getAlivePlayersCount()
    };
  }
}

module.exports = GameRoom;
