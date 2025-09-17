export class Player {
  constructor(type, name, avatar = '👤') {
    this.type = type; // 'human' or 'ai'
    this.name = name;
    this.avatar = avatar;
    this.health = 5000; // Only health, no points
    this.maxHealth = 5000;
    this.totalQuestions = 0;
    this.totalCorrect = 0;
    this.currentStreak = 0;
    this.bestStreak = 0;
    this.averageTime = 0;
    this.totalTime = 0;
  }

  recordGuess(isCorrect, timeElapsed) {
    this.totalQuestions++;
    this.totalTime += timeElapsed;
    this.averageTime = this.totalTime / this.totalQuestions;

    if (isCorrect) {
      this.totalCorrect++;
      this.currentStreak++;
      if (this.currentStreak > this.bestStreak) {
        this.bestStreak = this.currentStreak;
      }
      // Restore health for correct answers
      this.addHealth(200);
    } else {
      this.currentStreak = 0;
      // Lose health for wrong answers
      this.loseHealth(500);
    }
  }

  addHealth(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  loseHealth(amount) {
    this.health = Math.max(0, this.health - amount);
  }

  loseHealthForTime(timeElapsed) {
    // Lose health based on time taken (1 point per second)
    const timePenalty = Math.floor(timeElapsed);
    this.loseHealth(timePenalty);
  }

  loseHealthForHints(hintCount) {
    // Lose health for each hint used (100 per hint)
    const hintPenalty = hintCount * 100;
    this.loseHealth(hintPenalty);
  }

  getHealthPercentage() {
    return (this.health / this.maxHealth) * 100;
  }

  getHealthStatus() {
    const percentage = this.getHealthPercentage();
    if (percentage > 75) return 'excellent';
    if (percentage > 50) return 'good';
    if (percentage > 25) return 'warning';
    return 'critical';
  }

  isAlive() {
    return this.health > 0;
  }

  resetForNewGame() {
    this.health = 5000;
    this.totalQuestions = 0;
    this.totalCorrect = 0;
    this.currentStreak = 0;
    this.totalTime = 0;
    this.averageTime = 0;
  }

  getStats() {
    return {
      name: this.name,
      health: this.health,
      maxHealth: this.maxHealth,
      healthPercentage: this.getHealthPercentage(),
      healthStatus: this.getHealthStatus(),
      totalQuestions: this.totalQuestions,
      totalCorrect: this.totalCorrect,
      accuracy: this.totalQuestions > 0 ? (this.totalCorrect / this.totalQuestions) * 100 : 0,
      currentStreak: this.currentStreak,
      bestStreak: this.bestStreak,
      averageTime: this.averageTime
    };
  }
}
