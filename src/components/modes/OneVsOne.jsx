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
  const [maxQuestions] = useState(5);
  const [isProcessingNext, setIsProcessingNext] = useState(false);
  const [updateTrigger, setUpdateTrigger] = useState(0); // Force re-renders

  // Use refs to track current values
  const gameStateRef = useRef(gameState);
  const isProcessingNextRef = useRef(isProcessingNext);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    isProcessingNextRef.current = isProcessingNext;
  }, [isProcessingNext]);

  useEffect(() => {
    if (!player) {
      setPlayer(new Player('human', playerName, '👤'));
    }
  }, [playerName, player]);

  // Cleanup effect
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

  const forceUpdate = () => {
    setUpdateTrigger(prev => prev + 1);
  };

  const revealHint = (question) => {
    const newHint = question.revealNextHint();
    if (newHint) {
      forceUpdate(); // Force component re-render
    }
    return newHint;
  };

  const startGame = () => {
    if (!player) return;

    player.resetForNewGame();
    aiPlayer.resetForNewGame();
    setQuestionIndex(0);
    setIsProcessingNext(false);
    setGameResult(null);

    const gameQuestions = initializeQuestions();

    // Set game state and start first question
    setGameState('playing');

    // Start the first question after state updates
    setTimeout(() => {
      startQuestion(0, gameQuestions);
    }, 50);
  };

  const startQuestion = (index, questionArray) => {
    clearTimers();
    setGameResult(null);

    const question = loadQuestion(index, questionArray);
    if (!question) return;

    // Reveal first hint after 1 second
    const firstHintTimeout = setTimeout(() => {
      if (gameStateRef.current === 'playing' && !isProcessingNextRef.current) {
        revealHint(question);
      }
    }, 1000);

    // Start hint timer for subsequent hints (every 15 seconds)
    const timer = setInterval(() => {
      if (gameStateRef.current !== 'playing' || isProcessingNextRef.current) {
        clearInterval(timer);
        return;
      }

      const revealed = revealHint(question);

      // AI guess logic - only if hint was actually revealed
      if (revealed && Math.random() < 0.3) {
        setTimeout(() => {
          if (gameStateRef.current === 'playing' && !isProcessingNextRef.current) {
            handleAIGuess(question);
          }
        }, Math.random() * 3000 + 1000);
      }
    }, 15000);

    setHintTimer(timer);

    // Cleanup first hint timeout when component unmounts or question changes
    return () => {
      clearTimeout(firstHintTimeout);
    };
  };

  const handleAIGuess = (question) => {
    if (gameStateRef.current !== 'playing' || isProcessingNextRef.current) return;

    const timeElapsed = question.getElapsedTime() / 1000;
    const hintCount = question.getRevealedHints().length;

    const correctChance = Math.min(0.9, hintCount * 0.15 + 0.1);
    const isCorrect = Math.random() < correctChance;

    if (isCorrect) {
      const points = question.calculateScore(timeElapsed);
      aiPlayer.recordGuess(true, timeElapsed);
      aiPlayer.addScore(points);

      setGameResult({
        winner: 'ai',
        playerGuess: null,
        aiGuess: question.correctAnswer,
        correctAnswer: question.correctAnswer,
        points: points
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

    player.recordGuess(isCorrect, timeElapsed);

    if (isCorrect) {
      const points = currentQuestion.calculateScore(timeElapsed);
      player.addScore(points);

      setGameResult({
        winner: 'human',
        playerGuess: guess,
        aiGuess: null,
        correctAnswer: currentQuestion.correctAnswer,
        points: points
      });

      proceedToNextQuestion();
    } else {
      setGameResult({
        winner: null,
        playerGuess: guess,
        aiGuess: null,
        correctAnswer: null,
        points: 0
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
      player.recordGuess(false, currentQuestion.getElapsedTime() / 1000);
      aiPlayer.recordGuess(false, currentQuestion.getElapsedTime() / 1000);

      setGameResult({
        winner: 'timeout',
        playerGuess: null,
        aiGuess: null,
        correctAnswer: currentQuestion.correctAnswer,
        points: 0
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

      if (nextIndex < shuffledQuestions.length) {
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

  if (gameState === 'setup') {
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-hitman-white p-8 rounded-lg shadow-2xl max-w-2xl w-full text-hitman-black">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-hitman-red mb-4 font-spy">MISSION BRIEFING</h2>
            <p className="text-lg mb-4">Agent {playerName} vs Agent 47</p>
            <div className="bg-hitman-darkGray p-4 rounded text-hitman-white text-sm">
              <p className="mb-2">🎯 <strong>Objective:</strong> Identify targets faster than your opponent</p>
              <p className="mb-2">📋 <strong>Intel:</strong> Clues will be revealed every 15 seconds</p>
              <p className="mb-2">⚡ <strong>Scoring:</strong> Speed and fewer clues = higher points</p>
              <p>🏆 <strong>Victory:</strong> Highest score after {maxQuestions} targets wins</p>
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
    const humanWon = player?.score > aiPlayer.score;
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
              <p className="text-2xl font-bold text-hitman-red">{player?.score || 0} points</p>
              <p className="text-sm text-hitman-gray">{player?.totalCorrect || 0}/{player?.totalQuestions || 0} correct</p>
            </div>

            <div className={`p-4 rounded ${!humanWon ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-100'}`}>
              <h3 className="font-spy text-lg mb-2">🤖 Agent 47</h3>
              <p className="text-2xl font-bold text-hitman-red">{aiPlayer.score} points</p>
              <p className="text-sm text-hitman-gray">{aiPlayer.totalCorrect}/{aiPlayer.totalQuestions} correct</p>
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
              <p className="text-hitman-white font-bold">{player.score} points</p>
              <p className="text-xs text-hitman-gray">Streak: {player.currentStreak}</p>
            </div>
            <div className="bg-hitman-darkGray p-3 rounded">
              <h3 className="font-spy text-hitman-red mb-1">🤖 Agent 47</h3>
              <p className="text-hitman-white font-bold">{aiPlayer.score} points</p>
              <p className="text-xs text-hitman-gray">Streak: {aiPlayer.currentStreak}</p>
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
                <p className="text-lg font-bold">🎯 EXCELLENT SHOT! +{gameResult.points} points</p>
              )}
              {gameResult.winner === 'ai' && (
                <p className="text-lg font-bold">💀 Agent 47 eliminated the target first!</p>
              )}
              {gameResult.winner === 'timeout' && (
                <p className="text-lg font-bold">⏱️ TIME'S UP! Target escaped!</p>
              )}
              {!gameResult.winner && gameResult.winner !== 'timeout' && (
                <p className="text-lg font-bold">❌ Incorrect. Continue the hunt...</p>
              )}
              {gameResult.correctAnswer && (
                <p className="text-sm mt-2">The answer was: <strong>{gameResult.correctAnswer}</strong></p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hints */}
          <HintDisplay
            hints={currentQuestion.getRevealedHints()}
            currentHintIndex={currentQuestion.getRevealedHints().length}
            totalHints={currentQuestion.hints.length}
            key={`hints-${questionIndex}-${updateTrigger}`}
          />

          {/* Guess Input */}
          <GuessInput
            onSubmit={handlePlayerGuess}
            disabled={gameState !== 'playing' || isProcessingNext || gameResult?.winner}
            placeholder="Enter your target identification..."
            key={`input-${questionIndex}`}
          />
        </div>
      </div>
    </div>
  );
};

export default OneVsOne;
