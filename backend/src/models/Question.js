class Question {
  constructor(id, answer, category, difficulty, hints) {
    this.id = id;
    this.answer = answer;
    this.category = category;
    this.difficulty = difficulty;
    this.hints = hints;
  }

  checkAnswer(guess) {
    // Normalize both the guess and the correct answer
    const normalizedGuess = this.normalizeAnswer(guess);
    const normalizedAnswer = this.normalizeAnswer(this.answer);

    // Check for exact match first
    if (normalizedGuess === normalizedAnswer) {
      return true;
    }

    // Get key words from both
    const answerWords = this.getKeyWords(normalizedAnswer);
    const guessWords = this.getKeyWords(normalizedGuess);

    console.log(`Checking answer: "${guess}" vs "${this.answer}"`);
    console.log(`Answer words: [${answerWords.join(', ')}]`);
    console.log(`Guess words: [${guessWords.join(', ')}]`);

    // Must have at least the same number of key words
    if (guessWords.length < answerWords.length) {
      console.log('Not enough words in guess');
      return false;
    }

    // Check if all key words from the answer are matched in the guess
    let matchedWords = 0;
    for (const answerWord of answerWords) {
      let wordMatched = false;

      for (const guessWord of guessWords) {
        // Check for exact match or very high similarity
        if (guessWord === answerWord) {
          wordMatched = true;
          break;
        }

        // Check for partial matches (one word contains the other, minimum 4 characters)
        if (answerWord.length >= 4 && guessWord.length >= 4) {
          if (guessWord.includes(answerWord) || answerWord.includes(guessWord)) {
            wordMatched = true;
            break;
          }
        }

        // Check for high similarity (85% or higher) for longer words only
        if (answerWord.length >= 5 && guessWord.length >= 5) {
          const similarity = this.calculateSimilarity(answerWord, guessWord);
          if (similarity >= 0.85) {
            console.log(`High similarity match: ${answerWord} ≈ ${guessWord} (${Math.round(similarity * 100)}%)`);
            wordMatched = true;
            break;
          }
        }
      }

      if (wordMatched) {
        matchedWords++;
      } else {
        console.log(`Failed to match word: "${answerWord}"`);
      }
    }

    // All key words from answer must be matched
    const isCorrect = matchedWords === answerWords.length;
    console.log(`Match result: ${matchedWords}/${answerWords.length} words matched = ${isCorrect}`);

    return isCorrect;
  }

  normalizeAnswer(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()'"]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/^(the|a|an)\s+/i, '') // Remove leading articles
      .replace(/\s+(the|a|an)\s+/gi, ' ') // Remove middle articles
      .replace(/\s+(of|in|on|at|by|for|with)\s+/gi, ' ') // Remove some prepositions
      .trim();
  }

  getKeyWords(text) {
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'it', 'its', 'this', 'that', 'these', 'those', 'from', 'up', 'out',
      'so', 'as', 'if', 'no', 'not', 'only', 'own', 'same', 'such', 'than',
      'too', 'very', 'can', 'just', 'his', 'her', 'him', 'she', 'he'
    ]);

    return text
      .split(' ')
      .filter(word => word.length >= 3) // Minimum 3 characters
      .filter(word => !commonWords.has(word))
      .filter(word => !/^\d+$/.test(word)) // Remove pure numbers
      .filter(word => word.length > 0);
  }

  calculateSimilarity(str1, str2) {
    // Levenshtein distance based similarity
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
