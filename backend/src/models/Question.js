class Question {
  constructor(id, answer, category, difficulty, hints = []) {
    this.id = id;
    this.answer = answer;
    this.category = category;
    this.difficulty = difficulty;
    this.hints = hints || [];
    this.currentHintIndex = 0;
    this.startTime = null;
  }

  start() {
    this.startTime = Date.now();
    this.currentHintIndex = 0;
  }

  addHint(hintText, delay = 0) {
    if (typeof hintText === 'string') {
      this.hints.push({
        text: hintText,
        delay: delay,
        revealed: false
      });
    }
  }

  getHint(index) {
    if (index >= 0 && index < this.hints.length) {
      if (typeof this.hints[index] === 'string') {
        return this.hints[index];
      } else if (this.hints[index] && this.hints[index].text) {
        return this.hints[index].text;
      }
    }
    return null;
  }

  getTotalHints() {
    return this.hints.length;
  }

  revealNextHint() {
    if (this.currentHintIndex < this.hints.length) {
      if (this.hints[this.currentHintIndex] && typeof this.hints[this.currentHintIndex] === 'object') {
        this.hints[this.currentHintIndex].revealed = true;
      }
      this.currentHintIndex++;
      return true;
    }
    return false;
  }

  checkAnswer(userAnswer) {
    if (!userAnswer || typeof userAnswer !== 'string') {
      return false;
    }

    const normalizeText = (text) => {
      return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ');
    };

    const normalizedAnswer = normalizeText(this.answer);
    const normalizedUserAnswer = normalizeText(userAnswer);

    // Exact match
    if (normalizedAnswer === normalizedUserAnswer) {
      return true;
    }

    // Check if user answer is contained in correct answer or vice versa
    if (normalizedAnswer.includes(normalizedUserAnswer) || normalizedUserAnswer.includes(normalizedAnswer)) {
      // Only allow if it's a significant portion (at least 60% of the shorter string)
      const shorter = Math.min(normalizedAnswer.length, normalizedUserAnswer.length);
      const longer = Math.max(normalizedAnswer.length, normalizedUserAnswer.length);
      if (shorter / longer >= 0.6) {
        return true;
      }
    }

    // Check individual words for partial matches
    const answerWords = normalizedAnswer.split(' ').filter(word => word.length > 2);
    const userWords = normalizedUserAnswer.split(' ').filter(word => word.length > 2);

    if (answerWords.length > 0 && userWords.length > 0) {
      const matchingWords = answerWords.filter(word =>
        userWords.some(userWord => userWord === word || word.includes(userWord) || userWord.includes(word))
      );

      // If most words match, consider it correct
      if (matchingWords.length / answerWords.length >= 0.7) {
        return true;
      }
    }

    return false;
  }

  getElapsedTime() {
    if (this.startTime) {
      return Date.now() - this.startTime;
    }
    return 0;
  }

  isExpired(timeLimit = 120000) { // 2 minutes default
    return this.getElapsedTime() > timeLimit;
  }
}

module.exports = Question;
