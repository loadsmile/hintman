export class Player {
  constructor(id, name, avatar = null) {
    this.id = id;
    this.name = name;
    this.avatar = avatar;
    this.score = 0;
    this.currentStreak = 0;
    this.bestStreak = 0;
    this.totalCorrect = 0;
    this.totalQuestions = 0;
    this.isActive = true;
    this.lastGuessTime = null;
  }

  addScore(points) {
    this.score += points;
  }

  recordGuess(correct, timeElapsed) {
    this.totalQuestions++;
    this.lastGuessTime = timeElapsed;

    if (correct) {
      this.totalCorrect++;
      this.currentStreak++;
      this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
    } else {
      this.currentStreak = 0;
    }
  }

  getAccuracy() {
    return this.totalQuestions > 0 ? (this.totalCorrect / this.totalQuestions) * 100 : 0;
  }

  resetForNewGame() {
    this.score = 0;
    this.currentStreak = 0;
    this.totalCorrect = 0;
    this.totalQuestions = 0;
    this.lastGuessTime = null;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      avatar: this.avatar,
      score: this.score,
      currentStreak: this.currentStreak,
      accuracy: this.getAccuracy()
    };
  }
}
