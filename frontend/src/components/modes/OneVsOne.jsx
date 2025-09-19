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
  const [maxTargets] = useState(5);
  const [maxHints] = useState(5);
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

  const isPlayerAlive = (playerObj) => {
    if (!playerObj) return false;

    if (typeof playerObj.isAlive === 'function') {
      return playerObj.isAlive();
    }

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
    const gameQuestions = shuffled.slice(0, maxTargets);
    setShuffledQuestions(gameQuestions);
    return gameQuestions;
  };

  const loadQuestion = useCallback((index, questionArray) => {
    if (index < questionArray.length) {
      const questionData = questionArray[index];
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

  // Calculate health loss based on hint count when opponent answers correctly
  const calculateOpponentHealthLoss = (hintCount) => {
    // After 1st clue: 1000 hp loss
    // After 2nd clue: 800 hp loss
    // After 3rd clue: 600 hp loss
    // After 4th clue: 400 hp loss
    // After 5th clue: 200 hp loss
    const baseLoss = 1000;
    const reduction = Math.min(hintCount, 5) * 200;
    return Math.max(200, baseLoss - reduction);
  };

  const startGame = () => {
    if (!player) return;

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

        // NO MORE HEALTH LOSS FOR HINTS - removed the health penalties

        setPlayer(prevPlayer => ({ ...prevPlayer }));

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

    // Apply time penalty to AI
    if (typeof aiPlayer.loseHealthForTime === 'function') {
      aiPlayer.loseHealthForTime(timeElapsed);
    } else {
      const timePenalty = Math.floor(timeElapsed);
      aiPlayer.health = Math.max(0, aiPlayer.health - timePenalty);
    }

    if (isCorrect) {
      // AI got it right - player loses health based on hint count
      const playerHealthLoss = calculateOpponentHealthLoss(hintCount);
      player.health = Math.max(0, player.health - playerHealthLoss);

      if (typeof aiPlayer.recordGuess === 'function') {
        aiPlayer.recordGuess(true, timeElapsed);
      } else {
        aiPlayer.totalCorrect = (aiPlayer.totalCorrect || 0) + 1;
        aiPlayer.totalQuestions = (aiPlayer.totalQuestions || 0) + 1;
        // No health gain for AI - the player loses health instead
      }

      setGameResult({
        winner: 'ai',
        playerGuess: null,
        aiGuess: question.correctAnswer,
        correctAnswer: question.correctAnswer,
        hintCount: hintCount,
        healthLoss: playerHealthLoss
      });

      proceedToNextQuestion();
    } else {
      // AI got it wrong - only loses 500 health for wrong answer
      if (typeof aiPlayer.recordGuess === 'function') {
        aiPlayer.recordGuess(false, timeElapsed);
      } else {
        aiPlayer.totalQuestions = (aiPlayer.totalQuestions || 0) + 1;
        aiPlayer.health = Math.max(0, aiPlayer.health - 500);
      }
      setAiHasGuessed(prev => !prev && prev);
    }
  };

  const handlePlayerGuess = async (guess) => {
    if (!currentQuestion || gameStateRef.current !== 'playing' || isProcessingNextRef.current) return;

    const timeElapsed = currentQuestion.getElapsedTime ? currentQuestion.getElapsedTime() / 1000 : 30;
    const isCorrect = currentQuestion.checkAnswer ? currentQuestion.checkAnswer(guess) : false;
    const currentHintCount = revealedHints.length;

    // Apply time penalty to player
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
        // Player got it right - AI loses health based on hint count
        const aiHealthLoss = calculateOpponentHealthLoss(currentHintCount);
        aiPlayer.health = Math.max(0, aiPlayer.health - aiHealthLoss);
      } else {
        // Player got it wrong - loses 500 health
        player.health = Math.max(0, player.health - 500);
      }
      player.totalQuestions = (player.totalQuestions || 0) + 1;
    }

    setPlayer(prevPlayer => ({ ...prevPlayer }));

    if (isCorrect) {
      const aiHealthLoss = calculateOpponentHealthLoss(currentHintCount);

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
        healthLoss: 500
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

      // Both players lose health for timeout
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

      setPlayer(prevPlayer => ({ ...prevPlayer }));

      setGameResult({
        winner: 'timeout',
        playerGuess: null,
        aiGuess: null,
        correctAnswer: currentQuestion.correctAnswer,
        healthLoss: maxTime
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
    clearTimers();
    setIsProcessingNext(false);
    setGameState('finished');
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
                <p className="mb-2">❌ <strong>Wrong answers:</strong> -500 HP • <strong>Time penalty:</strong> -1 HP per second</p>
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
              <p className="text-xs text-gray-400">Hints revealed: {revealedHints.length}/{maxHints} (FREE)</p>
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
                <p className="text-lg font-bold">🎯 PERFECT SHOT! Opponent loses {gameResult.healthLoss} HP (after {gameResult.hintCount} hints)</p>
              )}
              {gameResult.winner === 'ai' && (
                <p className="text-lg font-bold">🔫 Agent 47 shot first! You lose {gameResult.healthLoss} HP (after {gameResult.hintCount} hints)</p>
              )}
              {gameResult.winner === 'timeout' && (
                <p className="text-lg font-bold">⏱️ TIME'S UP! Target escaped! Both lose {gameResult.healthLoss} HP</p>
              )}
              {!gameResult.winner && gameResult.winner !== 'timeout' && (
                <p className="text-lg font-bold">❌ Missed shot. You lose {gameResult.healthLoss} HP</p>
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
