export class Question {
  constructor(id, correctAnswer, category, difficulty = 'medium') {
    this.id = id;
    this.correctAnswer = correctAnswer.toLowerCase().trim();
    this.category = category;
    this.difficulty = difficulty;
    this.hints = [];
    this.currentHintIndex = 0;
    this.startTime = null;
    this.maxPoints = this.calculateMaxPoints();
  }

  addHint(hintText, delaySeconds = 0) {
    this.hints.push({
      text: hintText,
      delay: delaySeconds,
      revealed: false
    });
    return this;
  }

  calculateMaxPoints() {
    const difficultyMultiplier = {
      'easy': 100,
      'medium': 200,
      'hard': 300
    };
    return difficultyMultiplier[this.difficulty] || 200;
  }

  getCurrentHint() {
    if (this.currentHintIndex < this.hints.length) {
      return this.hints[this.currentHintIndex];
    }
    return null;
  }

  revealNextHint() {
    if (this.currentHintIndex < this.hints.length) {
      this.hints[this.currentHintIndex].revealed = true;
      this.currentHintIndex++;
      return this.hints[this.currentHintIndex - 1];
    }
    return null;
  }

  getRevealedHints() {
    return this.hints.filter(hint => hint.revealed);
  }

  calculateScore(timeElapsed) {
    const timeBonus = Math.max(0, 100 - timeElapsed);
    const hintPenalty = this.currentHintIndex * 20;
    return Math.max(10, this.maxPoints + timeBonus - hintPenalty);
  }

  checkAnswer(playerAnswer) {
    const normalized = playerAnswer.toLowerCase().trim();
    return normalized === this.correctAnswer || this.isAlternativeAnswer(normalized);
  }

  isAlternativeAnswer(answer) {
    // Override this method for questions with multiple valid answers
    return false;
  }

  start() {
    this.startTime = Date.now();
  }

  getElapsedTime() {
    return this.startTime ? Date.now() - this.startTime : 0;
  }

  reset() {
    this.currentHintIndex = 0;
    this.startTime = null;
    this.hints.forEach(hint => hint.revealed = false);
  }
}
