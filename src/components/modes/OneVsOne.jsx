import React, { useState, useEffect, useCallback } from 'react';
import { Player } from '../../classes/Player.js';
import { Question } from '../../classes/Question.js';
import { sampleQuestions } from '../../data/questions.js';
import HintDisplay from '../game/HintDisplay';
import GuessInput from '../game/GuessInput';
import Timer from '../common/Timer';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';

const OneVsOne = ({ playerName, onBackToMenu }) => {
  const [gameState, setGameState] = useState('setup'); // setup, playing, paused, finished
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [player, setPlayer] = useState(null);
  const [aiPlayer] = useState(new Player('ai', 'Agent 47', '🤖'));
  const [hintTimer, setHintTimer] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [updateCounter, setUpdateCounter] = useState(0);
  const [shuffledQuestions, setShuffledQuestions] = useState([]); // New state for shuffled questions
  const [maxQuestions] = useState(5); // Number of questions per game

  useEffect(() => {
    if (!player) {
      setPlayer(new Player('human', playerName, '👤'));
    }
  }, [playerName, player]);

  // Fisher-Yates shuffle algorithm
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Initialize shuffled questions when game starts
  const initializeQuestions = () => {
    const shuffled = shuffleArray(sampleQuestions);
    const gameQuestions = shuffled.slice(0, maxQuestions); // Take only the number we need
    setShuffledQuestions(gameQuestions);
    return gameQuestions;
  };

  const loadQuestion = useCallback((index, questionArray) => {
    if (index < questionArray.length) {
      const questionData = questionArray[index];
      const question = new Question(questionData.id, questionData.answer, questionData.category, questionData.difficulty);

      questionData.hints.forEach((hint, hintIndex) => {
        question.addHint(hint, hintIndex * 15); // 15 second intervals
      });

      question.start();
      setCurrentQuestion(question);
      return question;
    }
    return null;
  }, []);

  const forceUpdate = () => {
    setUpdateCounter(prev => prev + 1);
  };

  const startGame = () => {
    player.resetForNewGame();
    aiPlayer.resetForNewGame();
    setQuestionIndex(0);
    setGameState('playing');

    // Initialize and shuffle questions
    const gameQuestions = initializeQuestions();
    const question = loadQuestion(0, gameQuestions);

    if (question) {
      // Start hint timer
      const timer = setInterval(() => {
        question.revealNextHint();
        forceUpdate();

        // AI has chance to guess after each hint
        if (Math.random() < 0.3) {
          setTimeout(() => {
            handleAIGuess(question);
          }, Math.random() * 3000 + 1000);
        }
      }, 15000);

      setHintTimer(timer);

      // Reveal first hint immediately
      setTimeout(() => {
        question.revealNextHint();
        forceUpdate();
      }, 1000);
    }
  };

  const handleAIGuess = (question) => {
    if (gameState !== 'playing') return;

    const timeElapsed = question.getElapsedTime() / 1000;
    const hintCount = question.getRevealedHints().length;

    // AI gets more likely to be correct with more hints
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

      nextQuestion();
    } else {
      aiPlayer.recordGuess(false, timeElapsed);
    }
  };

  const handlePlayerGuess = async (guess) => {
    if (!currentQuestion || gameState !== 'playing') return;

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

      nextQuestion();
    } else {
      // Wrong answer, continue playing
      setGameResult({
        winner: null,
        playerGuess: guess,
        aiGuess: null,
        correctAnswer: null,
        points: 0
      });

      setTimeout(() => setGameResult(null), 2000);
    }
  };

  const nextQuestion = () => {
    if (hintTimer) {
      clearInterval(hintTimer);
      setHintTimer(null);
    }

    setTimeout(() => {
      setGameResult(null);
      const nextIndex = questionIndex + 1;

      if (nextIndex < shuffledQuestions.length) {
        setQuestionIndex(nextIndex);
        const question = loadQuestion(nextIndex, shuffledQuestions);

        if (question) {
          const timer = setInterval(() => {
            question.revealNextHint();
            forceUpdate();

            if (Math.random() < 0.3) {
              setTimeout(() => {
                handleAIGuess(question);
              }, Math.random() * 3000 + 1000);
            }
          }, 15000);

          setHintTimer(timer);

          setTimeout(() => {
            question.revealNextHint();
            forceUpdate();
          }, 1000);
        }
      } else {
        endGame();
      }
    }, 3000);
  };

  const endGame = () => {
    if (hintTimer) {
      clearInterval(hintTimer);
      setHintTimer(null);
    }
    setGameState('finished');
  };

  if (gameState === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-hitman-black to-hitman-darkGray flex items-center justify-center p-4">
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
    const humanWon = player.score > aiPlayer.score;
    return (
      <div className="min-h-screen bg-gradient-to-b from-hitman-black to-hitman-darkGray flex items-center justify-center p-4">
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
              <h3 className="font-spy text-lg mb-2">👤 {player.name}</h3>
              <p className="text-2xl font-bold text-hitman-red">{player.score} points</p>
              <p className="text-sm text-hitman-gray">{player.totalCorrect}/{player.totalQuestions} correct</p>
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
      <div className="min-h-screen bg-gradient-to-b from-hitman-black to-hitman-darkGray flex items-center justify-center">
        <LoadingSpinner size="lg" message="Preparing mission..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-hitman-black to-hitman-darkGray p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-hitman-black p-4 rounded-lg mb-6 border border-hitman-red">
          <div className="flex justify-between items-center mb-4">
            <div className="text-hitman-white">
              <h2 className="text-xl font-spy">TARGET: {questionIndex + 1} / {shuffledQuestions.length}</h2>
              <p className="text-sm text-hitman-gray">Category: {currentQuestion.category}</p>
            </div>
            <Timer
              duration={120}
              onComplete={() => nextQuestion()}
              isActive={gameState === 'playing'}
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
            'bg-yellow-900 border-yellow-500'
          }`}>
            <div className="text-center text-white">
              {gameResult.winner === 'human' && (
                <p className="text-lg font-bold">🎯 EXCELLENT SHOT! +{gameResult.points} points</p>
              )}
              {gameResult.winner === 'ai' && (
                <p className="text-lg font-bold">💀 Agent 47 eliminated the target first!</p>
              )}
              {!gameResult.winner && (
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
            hints={currentQuestion.hints}
            currentHintIndex={currentQuestion.currentHintIndex}
            key={updateCounter}
          />

          {/* Guess Input */}
          <GuessInput
            onSubmit={handlePlayerGuess}
            disabled={gameState !== 'playing' || gameResult?.winner}
            placeholder="Enter your target identification..."
          />
        </div>
      </div>
    </div>
  );
};

export default OneVsOne;
