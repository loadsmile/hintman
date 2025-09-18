class Question {
  constructor(id, answer, category, difficulty, hints) {
    this.id = id;
    this.answer = answer;
    this.category = category;
    this.difficulty = difficulty;
    this.hints = hints || [];
  }

  getHint(index) {
    if (index >= 0 && index < this.hints.length) {
      return this.hints[index];
    }
    return null;
  }

  getTotalHints() {
    return this.hints.length;
  }

  checkAnswer(guess) {
    if (!guess || typeof guess !== 'string') {
      return false;
    }

    // Normalize both the correct answer and the guess
    const normalizedAnswer = this.normalizeAnswer(this.answer);
    const normalizedGuess = this.normalizeAnswer(guess);

    console.log(`Question ${this.id}: Checking "${guess}" against "${this.answer}"`);
    console.log(`Question ${this.id}: Normalized guess: "${normalizedGuess}" vs normalized answer: "${normalizedAnswer}"`);

    // Direct match after normalization
    if (normalizedGuess === normalizedAnswer) {
      console.log(`Question ${this.id}: EXACT MATCH`);
      return true;
    }

    // Check if guess matches any alternative forms
    const alternativeForms = this.generateAlternativeForms(this.answer);
    console.log(`Question ${this.id}: Checking alternatives:`, alternativeForms);

    for (const alternative of alternativeForms) {
      const normalizedAlternative = this.normalizeAnswer(alternative);
      if (normalizedGuess === normalizedAlternative) {
        console.log(`Question ${this.id}: ALTERNATIVE MATCH: "${alternative}"`);
        return true;
      }
    }

    // Check for acceptable word-level matches (strict spelling required)
    if (this.checkWordLevelMatch(normalizedGuess, normalizedAnswer)) {
      console.log(`Question ${this.id}: WORD-LEVEL MATCH`);
      return true;
    }

    console.log(`Question ${this.id}: NO MATCH`);
    return false;
  }

  normalizeAnswer(text) {
    return text
      .toLowerCase()
      .trim()
      // Remove extra spaces
      .replace(/\s+/g, ' ')
      // Remove common punctuation but keep letters and spaces
      .replace(/['".,!?;:()[\]{}]/g, '')
      // Keep hyphens and apostrophes in words
      .replace(/\s*-\s*/g, '-')
      .replace(/\s*'\s*/g, "'");
  }

  generateAlternativeForms(answer) {
    const alternatives = [];
    const normalized = this.normalizeAnswer(answer);

    // Add the original normalized form
    alternatives.push(normalized);

    // Remove common articles and prepositions
    const articlesAndPrepositions = ['the', 'a', 'an', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'to'];

    for (const word of articlesAndPrepositions) {
      // Remove word at the beginning
      if (normalized.startsWith(word + ' ')) {
        alternatives.push(normalized.substring(word.length + 1));
      }

      // Remove word at the end
      if (normalized.endsWith(' ' + word)) {
        alternatives.push(normalized.substring(0, normalized.length - word.length - 1));
      }

      // Remove word in the middle
      const withoutMiddle = normalized.replace(new RegExp(`\\s+${word}\\s+`, 'g'), ' ');
      if (withoutMiddle !== normalized) {
        alternatives.push(withoutMiddle);
      }
    }

    // Add specific variations for common answers
    if (normalized.includes('first law')) {
      alternatives.push(normalized.replace('first law', 'law of inertia'));
      alternatives.push(normalized.replace('first law', 'inertia'));
    }

    if (normalized.includes('leonardo da vinci')) {
      alternatives.push('leonardo');
      alternatives.push('da vinci');
    }

    if (normalized.includes('william shakespeare')) {
      alternatives.push('shakespeare');
      alternatives.push('william shakespeare');
    }

    if (normalized.includes('albert einstein')) {
      alternatives.push('einstein');
    }

    if (normalized.includes('marie curie')) {
      alternatives.push('curie');
    }

    if (normalized.includes('charles darwin')) {
      alternatives.push('darwin');
    }

    if (normalized.includes('vincent van gogh')) {
      alternatives.push('van gogh');
      alternatives.push('vincent van gogh');
    }

    // Remove duplicates and return
    return [...new Set(alternatives)];
  }

  checkWordLevelMatch(guess, answer) {
    const guessWords = guess.split(/\s+/).filter(word => word.length > 0);
    const answerWords = answer.split(/\s+/).filter(word => word.length > 0);

    // If the guess has the same number of significant words, check each word exactly
    const significantGuessWords = guessWords.filter(word =>
      !['the', 'a', 'an', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'to'].includes(word)
    );

    const significantAnswerWords = answerWords.filter(word =>
      !['the', 'a', 'an', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'to'].includes(word)
    );

    // Must have the same number of significant words
    if (significantGuessWords.length !== significantAnswerWords.length) {
      return false;
    }

    // Each word must match exactly (no typos allowed)
    for (let i = 0; i < significantAnswerWords.length; i++) {
      const answerWord = significantAnswerWords[i];

      // Check if any guess word matches this answer word exactly
      const hasExactMatch = significantGuessWords.some(guessWord =>
        guessWord === answerWord || this.isAcceptableVariation(guessWord, answerWord)
      );

      if (!hasExactMatch) {
        return false;
      }
    }

    return true;
  }

  isAcceptableVariation(guessWord, answerWord) {
    // Only allow very specific acceptable variations, NO typos

    // Plural/singular forms
    if (guessWord === answerWord + 's' || answerWord === guessWord + 's') {
      return true;
    }

    if (guessWord === answerWord + 'es' || answerWord === guessWord + 'es') {
      return true;
    }

    // Common abbreviations (but spelled correctly)
    const abbreviations = {
      'united states': ['us', 'usa', 'america'],
      'united kingdom': ['uk', 'britain'],
      'dna': ['deoxyribonucleic acid'],
      'cpu': ['central processing unit'],
      'cpr': ['cardiopulmonary resuscitation'],
      'mri': ['magnetic resonance imaging'],
      'aids': ['acquired immune deficiency syndrome'],
      'laser': ['light amplification by stimulated emission of radiation']
    };

    for (const [full, abbrevs] of Object.entries(abbreviations)) {
      if ((guessWord === full && abbrevs.includes(answerWord)) ||
          (answerWord === full && abbrevs.includes(guessWord))) {
        return true;
      }
    }

    // No other variations allowed - must be exact spelling
    return false;
  }
}

module.exports = Question;
