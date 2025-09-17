class Question {
  constructor(id, answer, category, difficulty, hints) {
    this.id = id;
    this.answer = answer;
    this.category = category;
    this.difficulty = difficulty;
    this.hints = hints;
  }

  checkAnswer(guess) {
    return guess.toLowerCase().trim() === this.answer.toLowerCase().trim();
  }

  getHint(index) {
    return this.hints[index] || null;
  }

  getTotalHints() {
    return this.hints.length;
  }

  toJSON() {
    return {
      id: this.id,
      answer: this.answer,
      category: this.category,
      difficulty: this.difficulty,
      hints: this.hints
    };
  }
}

module.exports = Question;
