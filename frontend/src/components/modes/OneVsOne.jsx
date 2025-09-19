import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player } from '../../classes/Player.js';
import { Question } from '../../classes/Question.js';
import { sampleQuestions } from '../../data/questions.js';
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
  const [maxTargets] = useState(5); // FIXED: Always 5 targets/rounds
  const [maxHints] = useState(5); // FIXED: Maximum 5 hints per question
  const [isProcessingNext, setIsProcessingNext] = useState(false);
  const [revealedHints, setRevealedHints] = useState([]);
  const [aiHasGuessed, setAiHasGuessed] = useState(false);

  const gameStateRef = useRef(gameState);
  const isProcessingNextRef = useRef(isProcessingNext);
  const aiHasGuessedRef = useRef(aiHasGuessed);
  const revealedHintsRef = useRef(revealedHints);

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

  // Helper function to check if a player is alive
  const isPlayerAlive = (playerObj) => {
    if (!playerObj) return false;

    // Check if the player has an isAlive method
    if (typeof playerObj.isAlive === 'function') {
      return playerObj.isAlive();
    }

    // Fallback: check if health is greater than 0
    return playerObj.health > 0;
  };

  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const initializeQuestions = () => {
    const shuffled = shuffleArray(sampleQuestions);
    // IMPORTANT: Always take exactly 5 questions for the game
    const gameQuestions = shuffled.slice(0, maxTargets);
    setShuffledQuestions(gameQuestions);
    console.log(`Initialized ${gameQuestions.length} questions for the game from ${sampleQuestions.length} available questions`);
    return gameQuestions;
  };

  const loadQuestion = useCallback((index, questionArray) => {
    if (index < questionArray.length) {
      const questionData = questionArray[index];
      const question = new Question(questionData.id, questionData.answer, questionData.category, questionData.difficulty);

      // Ensure we only take the first 5 hints
      const hintsToUse = questionData.hints ? questionData.hints.slice(0, maxHints) : [];

      hintsToUse.forEach((hint, hintIndex) => {
        question.addHint(hint, hintIndex * 15);
      });

      question.start();
      setCurrentQuestion(question);
      setRevealedHints([]);
      setAiHasGuessed(false);
      return question;
    }
    return null;
  }, [maxHints]);

  const clearTimers = () => {
    if (hintTimer) {
      clearInterval(hintTimer);
      setHintTimer(null);
    }
  };

  const addRevealedHint = (hintText, hintIndex) => {
    // Double check we don't exceed maxHints
    if (hintIndex >= maxHints) {
      console.log(`Prevented adding hint ${hintIndex + 1} - exceeds maximum of ${maxHints}`);
      return;
    }

    const newHint = {
      text: hintText,
      index: hintIndex,
      revealed: true
    };
    setRevealedHints(prev => {
      // Prevent duplicate hints and enforce max limit
      const filtered = prev.filter(hint => hint.index !== hintIndex);
      const updated = [...filtered, newHint];

      // Ensure we don't exceed maxHints
      if (updated.length > maxHints) {
        console.log(`Limiting hints to maximum of ${maxHints}`);
        return updated.slice(0, maxHints);
      }

      return updated;
    });
  };

  const startGame = () => {
    if (!player) return;

    // Reset players for new game
    if (typeof player.resetForNewGame === 'function') {
      player.resetForNewGame();
    } else {
      // Fallback reset
      player.health = player.maxHealth || 5000;
      player.totalCorrect = 0;
      player.totalQuestions = 0;
      player.currentStreak = 0;
    }

    if (typeof aiPlayer.resetForNewGame === 'function') {
      aiPlayer.resetForNewGame();
    } else {
      // Fallback reset
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
    setGameState('playing');

    setTimeout(() => {
      startQuestion(0, gameQuestions);
    }, 100);
  };

  const startQuestion = (index, questionArray) => {
    clearTimers();
    setGameResult(null);

    const question = loadQuestion(index, questionArray);
    if (!question) return;

    console.log(`Starting question ${index + 1}/${maxTargets}: ${question.correctAnswer}`);
    console.log(`Question has ${question.hints ? question.hints.length : 0} hints available`);

    setTimeout(() => {
      if (gameStateRef.current === 'playing' && question.hints && question.hints.length > 0) {
        const firstHint = question.hints[0];
        addRevealedHint(firstHint.text, 0);
        if (typeof question.revealNextHint === 'function') {
          question.revealNextHint();
        }
      }
    }, 1000);

    const timer = setInterval(() => {
      if (gameStateRef.current !== 'playing' || isProcessingNextRef.current) {
        clearInterval(timer);
        return;
      }

      const currentHintCount = revealedHintsRef.current.length;

      // CRITICAL: Stop revealing hints if we've reached the maximum
      if (currentHintCount >= maxHints) {
        console.log(`Maximum hints (${maxHints}) reached. Stopping hint timer.`);
        clearInterval(timer);
        return;
      }

      const nextHintIndex = currentHintCount;
      if (question.hints && nextHintIndex < question.hints.length && nextHintIndex < maxHints) {
        const nextHint = question.hints[nextHintIndex];
        console.log(`Revealing hint ${nextHintIndex + 1}/${maxHints}: ${nextHint.text}`);

        addRevealedHint(nextHint.text, nextHintIndex);
        if (typeof question.revealNextHint === 'function') {
          question.revealNextHint();
        }

        // Both players lose health for each hint revealed
        if (typeof player.loseHealthForHints === 'function') {
          player.loseHealthForHints(1);
        } else {
          player.health = Math.max(0, player.health - 100);
        }

        if (typeof aiPlayer.loseHealthForHints === 'function') {
          aiPlayer.loseHealthForHints(1);
        } else {
          aiPlayer.health = Math.max(0, aiPlayer.health - 100);
        }

        // Force re-render to show updated health immediately
        setPlayer(prevPlayer => ({ ...prevPlayer }));

        // AI guess logic - only after hint 2 and before max hints
        if (!aiHasGuessedRef.current && nextHintIndex >= 2 && nextHintIndex < maxHints - 1) {
          const guessChance = Math.min(0.2, nextHintIndex * 0.05);

          if (Math.random() < guessChance) {
            setTimeout(() => {
              if (gameStateRef.current === 'playing' && !isProcessingNextRef.current && !aiHasGuessedRef.current) {
                handleAIGuess(question, nextHintIndex + 1);
              }
            }, Math.random() * 8000 + 3000);
          }
        }
      } else {
        // No more hints available - stop the timer
        console.log(`No more hints available. Stopping timer.`);
        clearInterval(timer);
      }
    }, 15000);

    setHintTimer(timer);
  };

  const handleAIGuess = (question, hintCount) => {
    if (gameStateRef.current !== 'playing' || isProcessingNextRef.current || aiHasGuessedRef.current) return;

    setAiHasGuessed(true);

    const timeElapsed = question.getElapsedTime ? question.getElapsedTime() / 1000 : 30;
    const correctChance = Math.min(0.5, (hintCount - 2) * 0.15);
    const isCorrect = Math.random() < correctChance;

    // AI loses health for time elapsed
    if (typeof aiPlayer.loseHealthForTime === 'function') {
      aiPlayer.loseHealthForTime(timeElapsed);
    } else {
      const timePenalty = Math.floor(timeElapsed);
      aiPlayer.health = Math.max(0, aiPlayer.health - timePenalty);
    }

    if (isCorrect) {
      if (typeof aiPlayer.recordGuess === 'function') {
        aiPlayer.recordGuess(true, timeElapsed);
      } else {
        aiPlayer.totalCorrect = (aiPlayer.totalCorrect || 0) + 1;
        aiPlayer.totalQuestions = (aiPlayer.totalQuestions || 0) + 1;
        aiPlayer.health = Math.min(aiPlayer.maxHealth || 5000, aiPlayer.health + 1000);
      }

      setGameResult({
        winner: 'ai',
        playerGuess: null,
        aiGuess: question.correctAnswer,
        correctAnswer: question.correctAnswer,
        healthGained: 1000
      });

      proceedToNextQuestion();
    } else {
      if (typeof aiPlayer.recordGuess === 'function') {
        aiPlayer.recordGuess(false, timeElapsed);
      } else {
        aiPlayer.totalQuestions = (aiPlayer.totalQuestions || 0) + 1;
        aiPlayer.health = Math.max(0, aiPlayer.health - 500);
      }
      // Force re-render to show AI health loss immediately
      setAiHasGuessed(prev => !prev && prev); // Trigger re-render
    }
  };

  const handlePlayerGuess = async (guess) => {
    if (!currentQuestion || gameStateRef.current !== 'playing' || isProcessingNextRef.current) return;

    const timeElapsed = currentQuestion.getElapsedTime ? currentQuestion.getElapsedTime() / 1000 : 30;
    const isCorrect = currentQuestion.checkAnswer ? currentQuestion.checkAnswer(guess) : false;

    console.log(`Player guessed: "${guess}" for answer: "${currentQuestion.correctAnswer}" - ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);

    // Player loses health for time elapsed
    if (typeof player.loseHealthForTime === 'function') {
      player.loseHealthForTime(timeElapsed);
    } else {
      const timePenalty = Math.floor(timeElapsed);
      player.health = Math.max(0, player.health - timePenalty);
    }

    if (typeof player.recordGuess === 'function') {
      player.recordGuess(isCorrect, timeElapsed);
    } else {
      if (isCorrect) {
        player.totalCorrect = (player.totalCorrect || 0) + 1;
        player.health = Math.min(player.maxHealth || 5000, player.health + 1000);
      } else {
        player.health = Math.max(0, player.health - 500);
      }
      player.totalQuestions = (player.totalQuestions || 0) + 1;
    }

    // Force immediate re-render to show health changes
    setPlayer(prevPlayer => ({ ...prevPlayer }));

    if (isCorrect) {
      setGameResult({
        winner: 'human',
        playerGuess: guess,
        aiGuess: null,
        correctAnswer: currentQuestion.correctAnswer,
        healthGained: 1000
      });

      proceedToNextQuestion();
    } else {
      setGameResult({
        winner: null,
        playerGuess: guess,
        aiGuess: null,
        correctAnswer: null
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
      const maxTime = 120;

      if (typeof player.loseHealthForTime === 'function') {
        player.loseHealthForTime(maxTime);
        player.recordGuess(false, maxTime);
      } else {
        player.health = Math.max(0, player.health - maxTime);
        player.totalQuestions = (player.totalQuestions || 0) + 1;
      }

      if (!aiHasGuessedRef.current) {
        if (typeof aiPlayer.loseHealthForTime === 'function') {
          aiPlayer.loseHealthForTime(maxTime);
          aiPlayer.recordGuess(false, maxTime);
        } else {
          aiPlayer.health = Math.max(0, aiPlayer.health - maxTime);
          aiPlayer.totalQuestions = (aiPlayer.totalQuestions || 0) + 1;
        }
      }

      // Force re-render to show health changes
      setPlayer(prevPlayer => ({ ...prevPlayer }));

      setGameResult({
        winner: 'timeout',
        playerGuess: null,
        aiGuess: null,
        correctAnswer: currentQuestion.correctAnswer
      });
    }

    proceedToNextQuestion();
  };

  const proceedToNextQuestion = () => {
    if (isProcessingNextRef.current) return;

    setIsProcessingNext(true);
    clearTimers();

    setTimeout(() => {
      const nextIndex = questionIndex + 1;

      // IMPORTANT: Check against maxTargets (5), and ensure both players are alive
      if (nextIndex < maxTargets && isPlayerAlive(player) && isPlayerAlive(aiPlayer)) {
        setQuestionIndex(nextIndex);
        startQuestion(nextIndex, shuffledQuestions);
        setIsProcessingNext(false);
      } else {
        endGame();
      }
    }, 3000);
  };

  const endGame = () => {
    console.log(`Game ended after ${questionIndex + 1} rounds`);
    clearTimers();
    setIsProcessingNext(false);
    setGameState('finished');
  };

  // Health Bar Component
  const HealthBar = ({ player: p }) => {
    if (!p) return null;

    const maxHealth = p.maxHealth || 5000;
    const currentHealth = p.health || 0;
    const healthPercentage = (currentHealth / maxHealth) * 100;

    const getHealthStatus = () => {
      if (typeof p.getHealthStatus === 'function') {
        return p.getHealthStatus();
      }
      // Fallback health status calculation
      if (healthPercentage > 75) return 'excellent';
      if (healthPercentage > 50) return 'good';
      if (healthPercentage > 25) return 'warning';
      return 'critical';
    };

    const getHealthColor = () => {
      const status = getHealthStatus();
      switch (status) {
        case 'excellent': return 'bg-green-500';
        case 'good': return 'bg-yellow-500';
        case 'warning': return 'bg-orange-500';
        case 'critical': return 'bg-red-500';
        default: return 'bg-gray-500';
      }
    };

    return (
      <div className="w-full">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-hitman-gray">Health</span>
          <span className="text-xs text-hitman-gray">{currentHealth}/{maxHealth}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getHealthColor()}`}
            style={{ width: `${healthPercentage}%` }}
          />
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
              <p className="mb-2">🎯 <strong>Objective:</strong> Survive exactly {maxTargets} targets with the most health</p>
              <p className="mb-2">📋 <strong>Intel:</strong> Maximum {maxHints} clues will be revealed every 15 seconds</p>
              <p className="mb-2">❤️ <strong>Health:</strong> Start with 5000 health, lose health for time and wrong answers</p>
              <p className="mb-2">💡 <strong>Hints:</strong> Each hint costs 100 health for both players</p>
              <p className="mb-2">❌ <strong>Mistakes:</strong> Wrong answers cost 500 health</p>
              <p className="mb-2">✅ <strong>Rewards:</strong> Correct answers restore 1000 health</p>
              <p className="mb-2">🔤 <strong>Answers:</strong> Use exact spelling (e.g., "Pacific Ocean", "Mount Everest")</p>
              <p>🏆 <strong>Victory:</strong> Survive with the most health (or last agent standing)</p>
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
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-2xl w-full text-black border border-gray-200">
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
              <h3 className="font-spy text-lg mb-2">👤 {player?.name || 'Player'}</h3>
              <p className="text-2xl font-bold text-red-600">{player?.health || 0} health</p>
              <p className="text-sm text-gray-600">{player?.totalCorrect || 0}/{player?.totalQuestions || 0} correct</p>
              <div className="mt-2">
                <HealthBar player={player} />
              </div>
            </div>

            <div className={`p-4 rounded ${!humanWon ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-100'}`}>
              <h3 className="font-spy text-lg mb-2">🤖 Agent 47</h3>
              <p className="text-2xl font-bold text-red-600">{aiPlayer.health} health</p>
              <p className="text-sm text-gray-600">{aiPlayer.totalCorrect}/{aiPlayer.totalQuestions} correct</p>
              <div className="mt-2">
                <HealthBar player={aiPlayer} />
              </div>
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
        {/* Header */}
        <div className="bg-black bg-opacity-90 p-4 rounded-lg mb-6 border border-red-600">
          <div className="flex justify-between items-center mb-4">
            <div className="text-white">
              <h2 className="text-xl font-spy">TARGET: {questionIndex + 1} / {maxTargets}</h2>
              <p className="text-sm text-gray-300">Category: {currentQuestion.category}</p>
            </div>
            <Timer
              duration={120}
              onComplete={handleTimeUp}
              isActive={gameState === 'playing' && !isProcessingNext}
              key={`timer-${questionIndex}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 p-3 rounded">
              <h3 className="font-spy text-red-500 mb-1">👤 {player.name}</h3>
              <p className="text-white font-bold">{player.health} health</p>
              <p className="text-xs text-gray-400 mb-2">Streak: {player.currentStreak || 0}</p>
              <HealthBar player={player} />
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <h3 className="font-spy text-red-500 mb-1">🤖 Agent 47</h3>
              <p className="text-white font-bold">{aiPlayer.health} health</p>
              <p className="text-xs text-gray-400 mb-2">Streak: {aiPlayer.currentStreak || 0}</p>
              <HealthBar player={aiPlayer} />
            </div>
          </div>
        </div>

        {/* Game Result */}
        {gameResult && (
          <div className={`mb-6 p-4 rounded-lg border-2 ${
            gameResult.winner === 'human' ? 'bg-green-900 border-green-500' :
            gameResult.winner === 'ai' ? 'bg-red-900 border-red-500' :
            gameResult.winner === 'timeout' ? 'bg-orange-900 border-orange-500' :
            'bg-yellow-900 border-yellow-500'
          }`}>
            <div className="text-center text-white">
              {gameResult.winner === 'human' && (
                <p className="text-lg font-bold">🎯 EXCELLENT SHOT! +{gameResult.healthGained || 1000} Health</p>
              )}
              {gameResult.winner === 'ai' && (
                <p className="text-lg font-bold">💀 Agent 47 eliminated the target first! +{gameResult.healthGained || 1000} Health</p>
              )}
              {gameResult.winner === 'timeout' && (
                <p className="text-lg font-bold">⏱️ TIME'S UP! Target escaped! -120 Health</p>
              )}
              {!gameResult.winner && gameResult.winner !== 'timeout' && (
                <p className="text-lg font-bold">❌ Incorrect. Continue the hunt... -500 Health</p>
              )}
              {gameResult.correctAnswer && (
                <p className="text-sm mt-2">The answer was: <strong>{gameResult.correctAnswer}</strong></p>
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
            placeholder="Enter your target identification (be precise)..."
            key={`input-${questionIndex}`}
          />
        </div>
      </div>
    </div>
  );
};

export default OneVsOne;
