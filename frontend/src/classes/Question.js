export class Question {
  constructor(id, correctAnswer, category, difficulty) {
    this.id = id;
    this.correctAnswer = correctAnswer;
    this.category = category;
    this.difficulty = difficulty;
    this.hints = [];
    this.currentHintIndex = 0;
    this.startTime = null;
    this.isActive = false;
  }

  addHint(text, delay = 0) {
    this.hints.push({
      text: text,
      delay: delay,
      revealed: false
    });
  }

  start() {
    this.startTime = Date.now();
    this.isActive = true;
    this.currentHintIndex = 0;
  }

  revealNextHint() {
    if (this.currentHintIndex < this.hints.length) {
      this.hints[this.currentHintIndex].revealed = true;
      this.currentHintIndex++;
      return this.hints[this.currentHintIndex - 1];
    }
    return null;
  }

  checkAnswer(guess) {
    // Normalize both the guess and the correct answer
    const normalizedGuess = this.normalizeAnswer(guess);
    const normalizedAnswer = this.normalizeAnswer(this.correctAnswer);

    // Check for exact match first
    if (normalizedGuess === normalizedAnswer) {
      return true;
    }

    // Check if the guess contains all key words from the answer
    const answerWords = this.getKeyWords(normalizedAnswer);
    const guessWords = this.getKeyWords(normalizedGuess);

    // Check if all significant words from the answer are in the guess
    const hasAllKeyWords = answerWords.every(word =>
      guessWords.some(guessWord =>
        guessWord.includes(word) || word.includes(guessWord) ||
        this.calculateSimilarity(word, guessWord) > 0.8
      )
    );

    return hasAllKeyWords;
  }

  normalizeAnswer(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/^(the|a|an)\s+/i, '') // Remove leading articles
      .replace(/\s+(the|a|an)\s+/gi, ' ') // Remove middle articles
      .trim();
  }

  getKeyWords(text) {
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'it', 'its', 'this', 'that', 'these', 'those'
    ]);

    return text
      .split(' ')
      .filter(word => word.length > 2 && !commonWords.has(word))
      .filter(word => word.length > 0);
  }

  calculateSimilarity(str1, str2) {
    // Simple Levenshtein distance based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  getElapsedTime() {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }

  calculateScore(timeElapsed) {
    const baseScore = 1000;
    const timeBonus = Math.max(0, 120 - timeElapsed); // Bonus for speed
    const hintPenalty = this.currentHintIndex * 50; // Penalty for using hints

    return Math.max(100, baseScore + timeBonus - hintPenalty);
  }

  getRevealedHints() {
    return this.hints.filter(hint => hint.revealed);
  }

  isCompleted() {
    return !this.isActive;
  }

  end() {
    this.isActive = false;
  }
}
