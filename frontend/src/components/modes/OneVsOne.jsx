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
  const [maxQuestions] = useState(5); // Fixed to 5 questions
  const [isProcessingNext, setIsProcessingNext] = useState(false);
  const [revealedHints, setRevealedHints] = useState([]);
  const [aiHasGuessed, setAiHasGuessed] = useState(false);

  const gameStateRef = useRef(gameState);
  const isProcessingNextRef = useRef(isProcessingNext);
  const aiHasGuessedRef = useRef(aiHasGuessed);

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
    const gameQuestions = shuffled.slice(0, maxQuestions);
    setShuffledQuestions(gameQuestions);
    return gameQuestions;
  };

  const loadQuestion = useCallback((index, questionArray) => {
    if (index < questionArray.length) {
      const questionData = questionArray[index];
      const question = new Question(questionData.id, questionData.answer, questionData.category, questionData.difficulty);

      questionData.hints.forEach((hint, hintIndex) => {
        question.addHint(hint, hintIndex * 15);
      });

      question.start();
      setCurrentQuestion(question);
      setRevealedHints([]);
      setAiHasGuessed(false);
      return question;
    }
    return null;
  }, []);

  const clearTimers = () => {
    if (hintTimer) {
      clearInterval(hintTimer);
      setHintTimer(null);
    }
  };

  const addRevealedHint = (hintText, hintIndex) => {
    const newHint = {
      text: hintText,
      index: hintIndex,
      revealed: true
    };
    setRevealedHints(prev => [...prev, newHint]);
  };

  const startGame = () => {
    if (!player) return;

    player.resetForNewGame();
    aiPlayer.resetForNewGame();
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
      if (gameStateRef.current === 'playing' && question.hints.length > 0) {
        const firstHint = question.hints[0];
        addRevealedHint(firstHint.text, 0);
        question.revealNextHint();
      }
    }, 1000);

    const timer = setInterval(() => {
      if (gameStateRef.current !== 'playing' || isProcessingNextRef.current) {
        clearInterval(timer);
        return;
      }

      const nextHintIndex = revealedHints.length;
      if (nextHintIndex < question.hints.length) {
        const nextHint = question.hints[nextHintIndex];
        addRevealedHint(nextHint.text, nextHintIndex);
        question.revealNextHint();

        // Both players lose health for each hint revealed
        player.loseHealthForHints(1);
        aiPlayer.loseHealthForHints(1);

        // AI guess logic
        if (!aiHasGuessedRef.current && nextHintIndex >= 2) {
          const guessChance = Math.min(0.2, nextHintIndex * 0.05);

          if (Math.random() < guessChance) {
            setTimeout(() => {
              if (gameStateRef.current === 'playing' && !isProcessingNextRef.current && !aiHasGuessedRef.current) {
                handleAIGuess(question, nextHintIndex + 1);
              }
            }, Math.random() * 8000 + 3000);
          }
        }
      }
    }, 15000);

    setHintTimer(timer);
  };

  const handleAIGuess = (question, hintCount) => {
    if (gameStateRef.current !== 'playing' || isProcessingNextRef.current || aiHasGuessedRef.current) return;

    setAiHasGuessed(true);

    const timeElapsed = question.getElapsedTime() / 1000;
    const correctChance = Math.min(0.5, (hintCount - 2) * 0.15);
    const isCorrect = Math.random() < correctChance;

    // AI loses health for time elapsed
    aiPlayer.loseHealthForTime(timeElapsed);

    if (isCorrect) {
      aiPlayer.recordGuess(true, timeElapsed);

      setGameResult({
        winner: 'ai',
        playerGuess: null,
        aiGuess: question.correctAnswer,
        correctAnswer: question.correctAnswer
      });

      proceedToNextQuestion();
    } else {
      aiPlayer.recordGuess(false, timeElapsed);
    }
  };

  const handlePlayerGuess = async (guess) => {
    if (!currentQuestion || gameStateRef.current !== 'playing' || isProcessingNextRef.current) return;

    const timeElapsed = currentQuestion.getElapsedTime() / 1000;
    const isCorrect = currentQuestion.checkAnswer(guess);

    // Player loses health for time elapsed
    player.loseHealthForTime(timeElapsed);
    player.recordGuess(isCorrect, timeElapsed);

    if (isCorrect) {
      setGameResult({
        winner: 'human',
        playerGuess: guess,
        aiGuess: null,
        correctAnswer: currentQuestion.correctAnswer
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
      player.loseHealthForTime(maxTime);
      player.recordGuess(false, maxTime);

      if (!aiHasGuessedRef.current) {
        aiPlayer.loseHealthForTime(maxTime);
        aiPlayer.recordGuess(false, maxTime);
      }

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

      if (nextIndex < shuffledQuestions.length && player.isAlive() && aiPlayer.isAlive()) {
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

  // Health Bar Component
  const HealthBar = ({ player: p }) => {
    const healthPercentage = p.getHealthPercentage();
    const healthStatus = p.getHealthStatus();

    const getHealthColor = () => {
      switch (healthStatus) {
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
          <span className="text-xs text-hitman-gray">{p.health}/{p.maxHealth}</span>
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
        <div className="bg-hitman-white p-8 rounded-lg shadow-2xl max-w-2xl w-full text-hitman-black">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-hitman-red mb-4 font-spy">MISSION BRIEFING</h2>
            <p className="text-lg mb-4">Agent {playerName} vs Agent 47</p>
            <div className="bg-hitman-darkGray p-4 rounded text-hitman-white text-sm">
              <p className="mb-2">🎯 <strong>Objective:</strong> Survive {maxQuestions} targets with the most health</p>
              <p className="mb-2">📋 <strong>Intel:</strong> Clues will be revealed every 15 seconds</p>
              <p className="mb-2">❤️ <strong>Health:</strong> Start with 5000 health, lose health for time and wrong answers</p>
              <p className="mb-2">💡 <strong>Hints:</strong> Each hint costs 100 health for both players</p>
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
    const humanWon = player?.health > aiPlayer.health || (player?.isAlive() && !aiPlayer.isAlive());
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-hitman-white p-8 rounded-lg shadow-2xl max-w-2xl w-full text-hitman-black">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-hitman-red mb-4 font-spy">
              {humanWon ? '🏆 MISSION ACCOMPLISHED' : '💀 MISSION FAILED'}
            </h2>
            <p className="text-xl mb-6">
              {humanWon ? `Congratulations Agent ${playerName}!` : 'Agent 47 completed the mission first.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className={`p-4 rounded ${humanWon ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-100'}`}>
              <h3 className="font-spy text-lg mb-2">👤 {player?.name || 'Player'}</h3>
              <p className="text-2xl font-bold text-hitman-red">{player?.health || 0} health</p>
              <p className="text-sm text-hitman-gray">{player?.totalCorrect || 0}/{player?.totalQuestions || 0} correct</p>
              <div className="mt-2">
                <HealthBar player={player} />
              </div>
            </div>

            <div className={`p-4 rounded ${!humanWon ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-100'}`}>
              <h3 className="font-spy text-lg mb-2">🤖 Agent 47</h3>
              <p className="text-2xl font-bold text-hitman-red">{aiPlayer.health} health</p>
              <p className="text-sm text-hitman-gray">{aiPlayer.totalCorrect}/{aiPlayer.totalQuestions} correct</p>
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
        <div className="bg-hitman-black bg-opacity-90 p-4 rounded-lg mb-6 border border-hitman-red">
          <div className="flex justify-between items-center mb-4">
            <div className="text-hitman-white">
              <h2 className="text-xl font-spy">TARGET: {questionIndex + 1} / {shuffledQuestions.length}</h2>
              <p className="text-sm text-hitman-gray">Category: {currentQuestion.category}</p>
            </div>
            <Timer
              duration={120}
              onComplete={handleTimeUp}
              isActive={gameState === 'playing' && !isProcessingNext}
              key={`timer-${questionIndex}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-hitman-darkGray p-3 rounded">
              <h3 className="font-spy text-hitman-red mb-1">👤 {player.name}</h3>
              <p className="text-hitman-white font-bold">{player.health} health</p>
              <p className="text-xs text-hitman-gray mb-2">Streak: {player.currentStreak}</p>
              <HealthBar player={player} />
            </div>
            <div className="bg-hitman-darkGray p-3 rounded">
              <h3 className="font-spy text-hitman-red mb-1">🤖 Agent 47</h3>
              <p className="text-hitman-white font-bold">{aiPlayer.health} health</p>
              <p className="text-xs text-hitman-gray mb-2">Streak: {aiPlayer.currentStreak}</p>
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
                <p className="text-lg font-bold">🎯 EXCELLENT SHOT! +200 Health</p>
              )}
              {gameResult.winner === 'ai' && (
                <p className="text-lg font-bold">💀 Agent 47 eliminated the target first!</p>
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
            totalHints={currentQuestion.hints.length}
            key={`hints-${questionIndex}-${revealedHints.length}`}
          />

          <GuessInput
            onSubmit={handlePlayerGuess}
            disabled={gameState !== 'playing' || isProcessingNext || gameResult?.winner || !player?.isAlive()}
            placeholder="Enter your target identification..."
            key={`input-${questionIndex}`}
          />
        </div>
      </div>
    </div>
  );
};

export default OneVsOne;
