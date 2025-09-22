import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player } from '../../classes/Player.js';
import { Question } from '../../classes/Question.js';
import questionsData from '../../../backend/src/data/questions.json'; // Import the correct 300+ questions
import HintDisplay from '../game/HintDisplay';
import GuessInput from '../game/GuessInput';
import Timer from '../common/Timer';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';

const OneVsOne = ({ playerName, onBackToMenu }) => {
  const [gameState, setGameState] = useState('setup');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [player, setPlayer] = useState(null);
  const [aiPlayer] = useState(new Player('ai', 'Agent 47', '🤖'));
  const [hintTimer, setHintTimer] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [shuffledQuestions, setShuffledQuestions] = useState([]);
  const [maxTargets] = useState(5);
  const [maxHints] = useState(5);
  const [isProcessingNext, setIsProcessingNext] = useState(false);
  const [revealedHints, setRevealedHints] = useState([]);
  const [aiHasGuessed, setAiHasGuessed] = useState(false);

  const gameStateRef = useRef(gameState);
  const isProcessingNextRef = useRef(isProcessingNext);
  const aiHasGuessedRef = useRef(aiHasGuessed);
  const revealedHintsRef = useRef(revealedHints);
  const shuffledQuestionsRef = useRef([]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    isProcessingNextRef.current = isProcessingNext;
  }, [isProcessingNext]);

  useEffect(() => {
    aiHasGuessedRef.current = aiHasGuessed;
  }, [aiHasGuessed]);

  useEffect(() => {
    revealedHintsRef.current = revealedHints;
  }, [revealedHints]);

  useEffect(() => {
    shuffledQuestionsRef.current = shuffledQuestions;
  }, [shuffledQuestions]);

  useEffect(() => {
    if (!player && playerName) {
      setPlayer(new Player('human', playerName, '👤'));
    }
  }, [playerName, player]);

  useEffect(() => {
    return () => {
      if (hintTimer) {
        clearInterval(hintTimer);
      }
    };
  }, [hintTimer]);

  const isPlayerAlive = (playerObj) => {
    if (!playerObj) return false;

    if (typeof playerObj.isAlive === 'function') {
      return playerObj.isAlive();
    }

    return playerObj.health > 0;
  };

  // Enhanced shuffle algorithm for better randomization
  const shuffleArray = (array) => {
    const shuffled = [...array];

    // Use crypto random for better randomization if available
    const getRandomValue = () => {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const randomBuffer = new Uint32Array(1);
        crypto.getRandomValues(randomBuffer);
        return randomBuffer[0] / (0xFFFFFFFF + 1);
      }
      return Math.random();
    };

    // Multiple shuffle passes for better randomization
    for (let pass = 0; pass < 3; pass++) {
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(getRandomValue() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
    }
    return shuffled;
  };

  const initializeQuestions = () => {
    // Enhanced randomization - show selection from larger pool
    const totalQuestions = questionsData.length;
    console.log(`Total questions available: ${totalQuestions}`);

    if (totalQuestions < maxTargets) {
      console.error(`Not enough questions! Need ${maxTargets}, but only have ${totalQuestions}`);
      return questionsData; // Return all available questions
    }

    // Create a thoroughly shuffled copy
    const shuffled = shuffleArray([...questionsData]);

    // Take from a random starting point to ensure variety
    const maxStartIndex = Math.max(0, shuffled.length - maxTargets);
    const startIndex = Math.floor(Math.random() * maxStartIndex);
    const gameQuestions = shuffled.slice(startIndex, startIndex + maxTargets);

    console.log(`Selected ${maxTargets} questions from index ${startIndex} to ${startIndex + maxTargets} out of ${totalQuestions} total`);
    console.log('Game questions:', gameQuestions.map(q => q.answer));

    return gameQuestions;
  };

  const loadQuestion = useCallback((index, questionArray) => {
    console.log(`Loading question ${index} from array of ${questionArray.length} questions`);

    if (!questionArray || questionArray.length === 0) {
      console.error('Question array is empty or undefined');
      return null;
    }

    if (index < 0 || index >= questionArray.length) {
      console.error(`Question index ${index} out of bounds (array length: ${questionArray.length})`);
      return null;
    }

    const questionData = questionArray[index];
    if (!questionData) {
      console.error(`Question data at index ${index} is undefined`);
      return null;
    }

    const question = new Question(questionData.id, questionData.answer, questionData.category, questionData.difficulty);

    const hintsToUse = questionData.hints ? questionData.hints.slice(0, maxHints) : [];

    hintsToUse.forEach((hint, hintIndex) => {
      question.addHint(hint, hintIndex * 15);
    });

    question.start();
    setCurrentQuestion(question);
    setRevealedHints([]);
    setAiHasGuessed(false);
    return question;
  }, [maxHints]);

  const clearTimers = useCallback(() => {
    if (hintTimer) {
      clearInterval(hintTimer);
      setHintTimer(null);
    }
  }, [hintTimer]);

  const addRevealedHint = (hintText, hintIndex) => {
    if (hintIndex >= maxHints) {
      return;
    }

    const newHint = {
      text: hintText,
      index: hintIndex,
      revealed: true
    };
    setRevealedHints(prev => {
      const filtered = prev.filter(hint => hint.index !== hintIndex);
      const updated = [...filtered, newHint];

      if (updated.length > maxHints) {
        return updated.slice(0, maxHints);
      }

      return updated;
    });
  };

  // Calculate damage based on which hint is currently shown
  const calculateDamageByHintCount = (hintCount) => {
    // 1st clue (hintCount = 1): 1000 damage
    // 2nd clue (hintCount = 2): 800 damage
    // 3rd clue (hintCount = 3): 600 damage
    // 4th clue (hintCount = 4): 400 damage
    // 5th clue (hintCount = 5): 200 damage
    switch (hintCount) {
      case 1: return 1000;
      case 2: return 800;
      case 3: return 600;
      case 4: return 400;
      case 5: return 200;
      default: return 200; // Minimum damage for 5+ hints
    }
  };

  const endGame = useCallback(() => {
    console.log('Ending game');
    clearTimers();
    setIsProcessingNext(false);
    setGameState('finished');
  }, [clearTimers]);

  const startQuestion = useCallback((index, questionArray) => {
    console.log(`Starting question ${index + 1}/${maxTargets}`);
    clearTimers();
    setGameResult(null);

    // Use the current shuffled questions if questionArray is not provided
    const questionsToUse = questionArray || shuffledQuestionsRef.current;

    console.log(`Using question array with ${questionsToUse.length} questions`);

    const question = loadQuestion(index, questionsToUse);
    if (!question) {
      console.error('Failed to load question, ending game');
      endGame();
      return;
    }

    // Reveal first hint after 1 second
    setTimeout(() => {
      if (gameStateRef.current === 'playing' && question.hints && question.hints.length > 0) {
        const firstHint = question.hints[0];
        addRevealedHint(firstHint.text, 0);
        if (typeof question.revealNextHint === 'function') {
          question.revealNextHint();
        }

        // Schedule AI to potentially guess after first hint
        scheduleAIGuess(question, 0);
      }
    }, 1000);

    // Timer to reveal subsequent hints
    const timer = setInterval(() => {
      if (gameStateRef.current !== 'playing' || isProcessingNextRef.current) {
        clearInterval(timer);
        return;
      }

      const currentHintCount = revealedHintsRef.current.length;

      if (currentHintCount >= maxHints) {
        clearInterval(timer);
        return;
      }

      const nextHintIndex = currentHintCount;
      if (question.hints && nextHintIndex < question.hints.length && nextHintIndex < maxHints) {
        const nextHint = question.hints[nextHintIndex];

        addRevealedHint(nextHint.text, nextHintIndex);
        if (typeof question.revealNextHint === 'function') {
          question.revealNextHint();
        }

        // Schedule AI to potentially guess after this hint
        scheduleAIGuess(question, nextHintIndex);

        setPlayer(prevPlayer => ({ ...prevPlayer }));
      } else {
        clearInterval(timer);
      }
    }, 15000);

    setHintTimer(timer);
  }, [maxTargets, clearTimers, loadQuestion, endGame, maxHints]);

  const proceedToNextQuestion = useCallback(() => {
    if (isProcessingNextRef.current) {
      console.log('Already processing next question, skipping');
      return;
    }

    console.log(`Proceeding to next question: current=${questionIndex}, max=${maxTargets}`);
    console.log(`Available questions: ${shuffledQuestionsRef.current.length}`);

    setIsProcessingNext(true);
    clearTimers();

    // Immediate state update for next question
    const nextIndex = questionIndex + 1;
    console.log(`Next question index: ${nextIndex}`);

    setTimeout(() => {
      if (nextIndex < maxTargets && isPlayerAlive(player) && isPlayerAlive(aiPlayer)) {
        console.log('Starting next question');
        setQuestionIndex(nextIndex);
        startQuestion(nextIndex); // Don't pass questionArray, let it use the ref
        setIsProcessingNext(false);
      } else {
        console.log('Game should end - calling endGame()');
        endGame();
      }
    }, 3000);
  }, [questionIndex, maxTargets, player, aiPlayer, clearTimers, startQuestion, endGame]);

  // Enhanced AI decision making
  const scheduleAIGuess = (question, hintIndex) => {
    if (aiHasGuessedRef.current || !question) return;

    const currentHintCount = hintIndex + 1; // Convert index to count

    // AI gets more likely to guess with each hint
    let guessChance;
    switch (currentHintCount) {
      case 1: guessChance = 0.15; // 15% chance after 1st hint
      break;
      case 2: guessChance = 0.25; // 25% chance after 2nd hint
      break;
      case 3: guessChance = 0.35; // 35% chance after 3rd hint
      break;
      case 4: guessChance = 0.50; // 50% chance after 4th hint
      break;
      case 5: guessChance = 0.70; // 70% chance after 5th hint
      break;
      default: guessChance = 0.80; // 80% chance after more hints
    }

    // Random delay before attempting guess (2-8 seconds after hint is revealed)
    const delay = Math.random() * 6000 + 2000;

    setTimeout(() => {
      if (gameStateRef.current === 'playing' && !isProcessingNextRef.current && !aiHasGuessedRef.current) {
        if (Math.random() < guessChance) {
          handleAIGuess(question, currentHintCount);
        }
      }
    }, delay);
  };

  const startGame = () => {
    if (!player) return;

    console.log('Starting new game...');

    if (typeof player.resetForNewGame === 'function') {
      player.resetForNewGame();
    } else {
      player.health = player.maxHealth || 5000;
      player.totalCorrect = 0;
      player.totalQuestions = 0;
      player.currentStreak = 0;
    }

    if (typeof aiPlayer.resetForNewGame === 'function') {
      aiPlayer.resetForNewGame();
    } else {
      aiPlayer.health = aiPlayer.maxHealth || 5000;
      aiPlayer.totalCorrect = 0;
      aiPlayer.totalQuestions = 0;
      aiPlayer.currentStreak = 0;
    }

    setQuestionIndex(0);
    setIsProcessingNext(false);
    setGameResult(null);
    setRevealedHints([]);

    const gameQuestions = initializeQuestions();
    setShuffledQuestions(gameQuestions);
    setGameState('playing');

    setTimeout(() => {
      startQuestion(0, gameQuestions);
    }, 100);
  };

  const handleAIGuess = (question, hintCount) => {
    if (gameStateRef.current !== 'playing' || isProcessingNextRef.current || aiHasGuessedRef.current) {
      console.log('AI guess blocked - state check failed');
      return;
    }

    console.log(`AI making guess attempt - processing: ${isProcessingNextRef.current}, hasGuessed: ${aiHasGuessedRef.current}`);
    setAiHasGuessed(true);

    // AI accuracy based on hint count
    let correctChance;
    switch (hintCount) {
      case 1: correctChance = 0.20; // 20% chance with 1 hint
      break;
      case 2: correctChance = 0.35; // 35% chance with 2 hints
      break;
      case 3: correctChance = 0.50; // 50% chance with 3 hints
      break;
      case 4: correctChance = 0.65; // 65% chance with 4 hints
      break;
      case 5: correctChance = 0.80; // 80% chance with 5 hints
      break;
      default: correctChance = 0.90; // 90% chance with more hints
    }

    const isCorrect = Math.random() < correctChance;

    console.log(`AI attempting guess with ${hintCount} hints, ${Math.round(correctChance * 100)}% chance, result: ${isCorrect ? 'CORRECT' : 'WRONG'}`);

    if (isCorrect) {
      // AI got it right - PLAYER loses health based on current hint count
      const currentHintCount = revealedHintsRef.current.length;
      const playerHealthLoss = calculateDamageByHintCount(currentHintCount);

      console.log(`AI correct! Player loses ${playerHealthLoss} HP`);

      // Apply damage to the PLAYER (not AI)
      setPlayer(prevPlayer => {
        const newPlayer = { ...prevPlayer };
        newPlayer.health = Math.max(0, newPlayer.health - playerHealthLoss);
        return newPlayer;
      });

      // Update AI stats but NO health changes for AI
      aiPlayer.totalCorrect = (aiPlayer.totalCorrect || 0) + 1;
      aiPlayer.totalQuestions = (aiPlayer.totalQuestions || 0) + 1;

      // Clear any timers immediately
      clearTimers();

      setGameResult({
        winner: 'ai',
        playerGuess: null,
        aiGuess: question.correctAnswer,
        correctAnswer: question.correctAnswer,
        hintCount: currentHintCount,
        healthLoss: playerHealthLoss
      });

      console.log('AI win - proceeding to next question');
      // Immediately proceed to next question
      proceedToNextQuestion();

    } else {
      console.log('AI wrong guess - can try again');
      // AI got it wrong - NO PENALTIES AT ALL
      aiPlayer.totalQuestions = (aiPlayer.totalQuestions || 0) + 1;

      // Reset AI guess status so it can try again after a short delay
      setTimeout(() => {
        if (gameStateRef.current === 'playing' && !isProcessingNextRef.current) {
          setAiHasGuessed(false);
        }
      }, 3000); // Wait 3 seconds before allowing AI to guess again
    }
  };

  const handlePlayerGuess = async (guess) => {
    if (!currentQuestion || gameStateRef.current !== 'playing' || isProcessingNextRef.current) return;

    const isCorrect = currentQuestion.checkAnswer ? currentQuestion.checkAnswer(guess) : false;
    const currentHintCount = revealedHints.length;

    if (isCorrect) {
      player.totalCorrect = (player.totalCorrect || 0) + 1;
      // Player got it right - AI loses health based on current hint count
      const aiHealthLoss = calculateDamageByHintCount(currentHintCount);
      aiPlayer.health = Math.max(0, aiPlayer.health - aiHealthLoss);

      // Clear any timers immediately
      clearTimers();
    }
    // NO PENALTIES for wrong answers - just update question count
    player.totalQuestions = (player.totalQuestions || 0) + 1;

    setPlayer(prevPlayer => ({ ...prevPlayer }));

    if (isCorrect) {
      const aiHealthLoss = calculateDamageByHintCount(currentHintCount);

      setGameResult({
        winner: 'human',
        playerGuess: guess,
        aiGuess: null,
        correctAnswer: currentQuestion.correctAnswer,
        hintCount: currentHintCount,
        healthLoss: aiHealthLoss
      });

      proceedToNextQuestion();
    } else {
      setGameResult({
        winner: null,
        playerGuess: guess,
        aiGuess: null,
        correctAnswer: null,
        healthLoss: 0
      });

      setTimeout(() => {
        if (gameStateRef.current === 'playing') {
          setGameResult(null);
        }
      }, 2000);
    }
  };

  const handleTimeUp = () => {
    if (gameStateRef.current !== 'playing' || isProcessingNextRef.current) return;

    if (player && currentQuestion) {
      // NO PENALTIES for timeout - just update question counts
      player.totalQuestions = (player.totalQuestions || 0) + 1;

      if (!aiHasGuessedRef.current) {
        aiPlayer.totalQuestions = (aiPlayer.totalQuestions || 0) + 1;
      }

      setPlayer(prevPlayer => ({ ...prevPlayer }));

      setGameResult({
        winner: 'timeout',
        playerGuess: null,
        aiGuess: null,
        correctAnswer: currentQuestion.correctAnswer,
        healthLoss: 0
      });
    }

    proceedToNextQuestion();
  };

  // Enhanced GeoGuessr-style Health Bar
  const HealthBar = ({ player: p, playerName, isAI = false }) => {
    if (!p) return null;

    const maxHealth = p.maxHealth || 5000;
    const currentHealth = p.health || 0;
    const healthPercentage = (currentHealth / maxHealth) * 100;

    const getHealthColor = () => {
      if (healthPercentage > 75) return isAI ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-green-500 to-green-400';
      if (healthPercentage > 50) return isAI ? 'bg-gradient-to-r from-purple-500 to-purple-400' : 'bg-gradient-to-r from-yellow-500 to-yellow-400';
      if (healthPercentage > 25) return isAI ? 'bg-gradient-to-r from-pink-500 to-pink-400' : 'bg-gradient-to-r from-orange-500 to-orange-400';
      return 'bg-gradient-to-r from-red-500 to-red-400';
    };

    const getHealthTextColor = () => {
      return 'text-white';
    };

    const getBorderColor = () => {
      if (isAI) return 'border-red-300';
      return 'border-green-300';
    };

    return (
      <div className="relative w-full">
        {/* Player name above health bar */}
        <div className="mb-2 text-center">
          <span className={`text-sm font-bold ${isAI ? 'text-red-400' : 'text-green-400'}`}>
            {playerName || p.name}
          </span>
        </div>

        {/* Main health bar container - GeoGuessr style */}
        <div className={`relative w-full h-12 bg-gray-800 rounded-lg border-2 ${getBorderColor()} overflow-hidden shadow-lg`}>
          {/* Health fill with gradient */}
          <div
            className={`h-full transition-all duration-500 ease-out ${getHealthColor()} relative`}
            style={{ width: `${healthPercentage}%` }}
          >
            {/* Inner glow effect */}
            <div className="absolute inset-0 bg-white bg-opacity-20 rounded-lg"></div>

            {/* Animated pulse effect for low health */}
            {healthPercentage <= 25 && (
              <div className="absolute inset-0 bg-white bg-opacity-30 rounded-lg animate-pulse"></div>
            )}
          </div>

          {/* Health text centered in the bar */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-lg font-bold ${getHealthTextColor()} drop-shadow-lg tracking-wider`}>
              {currentHealth} HP
            </span>
          </div>

          {/* Shine effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-10 transform -skew-x-12 animate-pulse"></div>
        </div>

        {/* Status indicators */}
        <div className="flex justify-between items-center mt-1">
          <div className="flex items-center space-x-2">
            {currentHealth <= 0 && (
              <span className="text-xs text-red-400 font-bold animate-bounce">💀 SHOT DOWN</span>
            )}
            {healthPercentage <= 25 && currentHealth > 0 && (
              <span className="text-xs text-red-400 font-bold animate-pulse">⚠️ CRITICAL</span>
            )}
            {healthPercentage > 75 && (
              <span className="text-xs text-green-400 font-bold">✨ EXCELLENT</span>
            )}
          </div>

          <div className="text-xs text-gray-400">
            {Math.round(healthPercentage)}%
          </div>
        </div>
      </div>
    );
  };

  if (gameState === 'setup') {
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-2xl w-full text-black border border-gray-200">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-red-600 mb-4 font-spy">MISSION BRIEFING</h2>
            <p className="text-lg mb-4 text-gray-800">Agent {playerName} vs Agent 47</p>
            <div className="bg-gray-800 p-4 rounded text-white text-sm">
              <p className="mb-2">🎯 <strong>Survive {maxTargets} targets with Agent 47</strong></p>
              <p className="mb-2">💡 <strong>Hints are FREE!</strong> Wait for clues or answer fast</p>
              <p className="mb-2">⚡ <strong>Speed matters:</strong> Early answers deal more damage to opponent</p>
              <p className="mb-2">❌ <strong>No penalties</strong> for wrong answers or time</p>
              <p>🏆 <strong>Win by having the most health remaining</strong></p>
            </div>
          </div>

          <div className="text-center">
            <Button onClick={startGame} size="lg" className="px-12">
              🎯 BEGIN MISSION
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    const humanWon = player?.health > aiPlayer.health || (isPlayerAlive(player) && !isPlayerAlive(aiPlayer));
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-3xl w-full text-black border border-gray-200">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-red-600 mb-4 font-spy">
              {humanWon ? '🏆 MISSION ACCOMPLISHED' : '💀 MISSION FAILED'}
            </h2>
            <p className="text-xl mb-6 text-gray-800">
              {humanWon ? `Congratulations Agent ${playerName}!` : 'Agent 47 completed the mission first.'}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Completed {questionIndex + (gameResult ? 1 : 0)} out of {maxTargets} targets
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className={`p-4 rounded ${humanWon ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-100'}`}>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-spy text-lg">👤 {player?.name || 'Player'}</h3>
                  {humanWon && <span className="text-sm text-green-600">🏆 Winner</span>}
                  {!isPlayerAlive(player) && <span className="text-sm text-red-600">🔫 Shot Down</span>}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-red-600">{player?.health || 0} HP</p>
                  <p className="text-sm text-gray-600">{player?.totalCorrect || 0}/{player?.totalQuestions || 0} correct</p>
                </div>
              </div>
              <HealthBar player={player} playerName={player?.name || playerName} isAI={false} />
            </div>

            <div className={`p-4 rounded ${!humanWon ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-100'}`}>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-spy text-lg">🤖 Agent 47</h3>
                  {!humanWon && <span className="text-sm text-green-600">🏆 Winner</span>}
                  {!isPlayerAlive(aiPlayer) && <span className="text-sm text-red-600">🔫 Shot Down</span>}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-red-600">{aiPlayer.health} HP</p>
                  <p className="text-sm text-gray-600">{aiPlayer.totalCorrect}/{aiPlayer.totalQuestions} correct</p>
                </div>
              </div>
              <HealthBar player={aiPlayer} playerName="Agent 47" isAI={true} />
            </div>
          </div>

          <div className="flex space-x-4">
            <Button onClick={startGame} variant="primary" className="flex-1">
              🔄 NEW MISSION
            </Button>
            <Button onClick={onBackToMenu} variant="secondary" className="flex-1">
              🏠 BACK TO HQ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion || !player) {
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center">
        <LoadingSpinner size="lg" message="Preparing mission..." />
      </div>
    );
  }

  return (
    <div className="relative z-20 min-h-[calc(100vh-120px)] p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-black bg-opacity-90 p-6 rounded-lg mb-6 border border-red-600">
          <div className="flex justify-between items-center mb-6">
            <div className="text-white">
              <h2 className="text-xl font-spy">TARGET: {questionIndex + 1} / {maxTargets}</h2>
              <p className="text-sm text-gray-300">Category: {currentQuestion.category}</p>
              <p className="text-xs text-gray-400">
                Hint {revealedHints.length}/{maxHints} • Damage: {calculateDamageByHintCount(revealedHints.length)} HP
              </p>
            </div>
            <Timer
              duration={120}
              onComplete={handleTimeUp}
              isActive={gameState === 'playing' && !isProcessingNext}
              key={`timer-${questionIndex}`}
            />
          </div>

          {/* Enhanced GeoGuessr-style Health Bars */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-900 p-4 rounded-lg border-2 border-green-400">
              <HealthBar
                player={player}
                playerName={player.name}
                isAI={false}
              />
              <div className="mt-3 text-center">
                <p className="text-xs text-gray-400">Streak: {player.currentStreak || 0}</p>
              </div>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg border-2 border-red-400">
              <HealthBar
                player={aiPlayer}
                playerName="Agent 47"
                isAI={true}
              />
              <div className="mt-3 text-center">
                <p className="text-xs text-gray-400">Streak: {aiPlayer.currentStreak || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {gameResult && (
          <div className={`mb-6 p-4 rounded-lg border-2 ${
            gameResult.winner === 'human' ? 'bg-green-900 border-green-500' :
            gameResult.winner === 'ai' ? 'bg-red-900 border-red-500' :
            gameResult.winner === 'timeout' ? 'bg-orange-900 border-orange-500' :
            'bg-yellow-900 border-yellow-500'
          }`}>
            <div className="text-center text-white">
              {gameResult.winner === 'human' && (
                <p className="text-lg font-bold">🎯 PERFECT SHOT! Opponent loses {gameResult.healthLoss} HP (hint {gameResult.hintCount})</p>
              )}
              {gameResult.winner === 'ai' && (
                <p className="text-lg font-bold">🔫 Agent 47 shot first! You lose {gameResult.healthLoss} HP (hint {gameResult.hintCount})</p>
              )}
              {gameResult.winner === 'timeout' && (
                <p className="text-lg font-bold">⏱️ TIME'S UP! Target escaped! No penalties.</p>
              )}
              {!gameResult.winner && gameResult.winner !== 'timeout' && (
                <p className="text-lg font-bold">❌ Missed shot. No penalties - keep trying!</p>
              )}
              {gameResult.correctAnswer && (
                <p className="text-sm mt-2">The target was: <strong>{gameResult.correctAnswer}</strong></p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <HintDisplay
            hints={revealedHints}
            totalHints={Math.min(maxHints, currentQuestion.hints ? currentQuestion.hints.length : 0)}
            key={`hints-${questionIndex}-${revealedHints.length}`}
          />

          <GuessInput
            onSubmit={handlePlayerGuess}
            disabled={gameState !== 'playing' || isProcessingNext || gameResult?.winner || !isPlayerAlive(player)}
            placeholder="Take your shot (be precise)..."
            key={`input-${questionIndex}`}
          />
        </div>
      </div>
    </div>
  );
};

export default OneVsOne;
