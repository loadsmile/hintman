import React, { useEffect, useRef, useState } from 'react';
import { Player } from '../../classes/Player.js';
import { Question } from '../../classes/Question.js';
import questionsData from '../../data/questions.json';
import HintDisplay from '../game/HintDisplay';
import GuessInput from '../game/GuessInput';
import Timer from '../common/Timer';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';

const MAX_TARGETS = 10;
const MAX_HINTS = 5;
const ROUND_RESULT_DELAY_MS = 3000;
const FIRST_HINT_DELAY_MS = 1000;
const HINT_INTERVAL_MS = 15000;
const QUESTION_TIME_SEC = 120;

const damageByHint = (hintCount) => {
  switch (hintCount) {
    case 1: return 500;
    case 2: return 400;
    case 3: return 300;
    case 4: return 200;
    case 5: return 100;
    default: return 100;
  }
};

const aiGuessChance = (hintCount) => {
  switch (hintCount) {
    case 1: return 0.15;
    case 2: return 0.25;
    case 3: return 0.50;
    case 4: return 0.65;
    case 5: return 0.80;
    default: return 0.90;
  }
};

export default function OneVsOne({ playerName, onBackToMenu }) {
  // Core game state
  const [phase, setPhase] = useState('setup');
  const [qIndex, setQIndex] = useState(0);
  const [currentQ, setCurrentQ] = useState(null);
  const [revealed, setRevealed] = useState([]);
  const [result, setResult] = useState(null);
  const [timerKey, setTimerKey] = useState(0);
  const [human, setHuman] = useState(null);
  const [ai] = useState(new Player('ai', 'Agent 47', '🤖'));

  // Refs for internal logic that doesn't trigger re-renders
  const deckRef = useRef([]);
  const processingRef = useRef(false);
  const hintTimerRef = useRef(null);
  const questionIdRef = useRef(0);
  const usedQuestionsRef = useRef(new Set());

  // Main game loop driver: mounts a new question when qIndex changes
  useEffect(() => {
    if (phase === 'playing') {
      mountQuestion(qIndex);
    }
  }, [qIndex, phase]);

  // Init player and cleanup
  useEffect(() => {
    if (!human && playerName) setHuman(new Player('human', playerName, '🕴'));
    return () => clearHintTimer();
  }, [playerName, human]);

  const clearHintTimer = () => {
    if (hintTimerRef.current) {
      clearInterval(hintTimerRef.current);
      hintTimerRef.current = null;
    }
  };

  const isAlive = (p) => !!p && (p.health ?? 0) > 0;

  // Enhanced deck building with better randomization and avoiding recently used questions
  const buildDeck = () => {
    // If we've used more than 80% of questions, reset the used questions set
    if (usedQuestionsRef.current.size > questionsData.length * 0.8) {
      usedQuestionsRef.current.clear();
    }

    // Filter out recently used questions
    const availableQuestions = questionsData.filter(q => !usedQuestionsRef.current.has(q.id));

    // If we don't have enough unused questions, use all questions
    const questionPool = availableQuestions.length >= MAX_TARGETS ? availableQuestions : [...questionsData];

    // Enhanced Fisher-Yates shuffle for better randomization
    const shuffled = [...questionPool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const randomValue = window.crypto && window.crypto.getRandomValues
        ? window.crypto.getRandomValues(new Uint32Array(1))[0] / (0xFFFFFFFF + 1)
        : Math.random();

      const j = Math.floor(randomValue * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Select questions ensuring variety across categories and difficulties
    const selectedQuestions = selectDiverseQuestions(shuffled, MAX_TARGETS);

    // Mark these questions as used
    selectedQuestions.forEach(q => usedQuestionsRef.current.add(q.id));

    deckRef.current = selectedQuestions;
  };

  // Select questions with better category and difficulty distribution
  const selectDiverseQuestions = (shuffledQuestions, count) => {
    const selected = [];
    const usedCategories = new Set();
    const usedDifficulties = new Set();

    // First pass: Try to get diverse categories and difficulties
    for (const question of shuffledQuestions) {
      if (selected.length >= count) break;

      const categoryCount = Array.from(usedCategories).filter(cat => cat === question.category).length;
      const difficultyCount = Array.from(usedDifficulties).filter(diff => diff === question.difficulty).length;

      // Prefer questions from less used categories and difficulties
      if (categoryCount < Math.ceil(count / 3) && difficultyCount < Math.ceil(count / 2)) {
        selected.push(question);
        usedCategories.add(question.category);
        usedDifficulties.add(question.difficulty);
      }
    }

    // Second pass: Fill remaining slots with any available questions
    for (const question of shuffledQuestions) {
      if (selected.length >= count) break;
      if (!selected.includes(question)) {
        selected.push(question);
      }
    }

    // Final shuffle of selected questions
    for (let i = selected.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [selected[i], selected[j]] = [selected[j], selected[i]];
    }

    return selected;
  };

  // Set up a new question and its timers
  const mountQuestion = (index) => {
    const data = deckRef.current[index];
    if (!data) return;

    const questionId = ++questionIdRef.current;

    const q = new Question(data.id, data.answer, data.category, data.difficulty);
    const hints = (data.hints || []).slice(0, MAX_HINTS);
    q.start();

    // Reset state for the new round
    setCurrentQ(q);
    setRevealed([]);
    setResult(null);
    setTimerKey(k => k + 1);
    clearHintTimer();

    // Schedule first hint
    setTimeout(() => {
      if (questionIdRef.current !== questionId) return;
      if (hints[0]) {
        // Add first hint to the beginning (newest at top)
        setRevealed([{ index: 0, text: hints[0] }]);
        scheduleAIGuess(q, 1, questionId, index);
      }
    }, FIRST_HINT_DELAY_MS);

    // Schedule subsequent hints
    hintTimerRef.current = setInterval(() => {
      if (questionIdRef.current !== questionId) {
        clearHintTimer();
        return;
      }
      setRevealed((prev) => {
        const nextIdx = prev.length;
        if (nextIdx < Math.min(MAX_HINTS, hints.length)) {
          // Add new hints to the beginning of the array (newest first)
          const next = { index: nextIdx, text: hints[nextIdx] };
          scheduleAIGuess(q, nextIdx + 1, questionId, index);
          return [next, ...prev];
        } else {
          clearHintTimer();
          return prev;
        }
      });
    }, HINT_INTERVAL_MS);
  };

  // Handle end-of-round logic and transition to the next
  const advanceRound = (nextIndex) => {
    if (processingRef.current) return;
    processingRef.current = true;

    clearHintTimer();

    setTimeout(() => {
      if (nextIndex < MAX_TARGETS && isAlive(human) && isAlive(ai)) {
        setResult(null);
        setQIndex(nextIndex);
      } else {
        setPhase('finished');
      }
      processingRef.current = false;
    }, ROUND_RESULT_DELAY_MS);
  };

  // AI guess logic
  const scheduleAIGuess = (q, hintCount, questionId, index) => {
    const delay = 2000 + Math.random() * 6000;
    setTimeout(() => {
      if (questionIdRef.current !== questionId || processingRef.current || result) return;

      if (Math.random() < aiGuessChance(hintCount)) {
        const dmg = damageByHint(hintCount);
        setHuman((prev) => ({ ...prev, health: Math.max(0, (prev.health ?? 0) - dmg) }));
        setResult({ winner: 'ai', correctAnswer: q.correctAnswer, hintCount, healthLoss: dmg });
        advanceRound(index + 1);
      }
    }, delay);
  };

  // Human guess logic
  const onGuess = (guess) => {
    if (result && result.winner !== null) return;

    const correct = currentQ.checkAnswer(guess);
    if (correct) {
      const dmg = damageByHint(revealed.length || 1);
      ai.health = Math.max(0, ai.health - dmg);
      setResult({ winner: 'human', playerGuess: guess, correctAnswer: currentQ.correctAnswer, hintCount: revealed.length || 1, healthLoss: dmg });
      advanceRound(qIndex + 1);
    } else {
      setResult({ winner: null, playerGuess: guess });
      setTimeout(() => {
        if (!processingRef.current) {
          setResult(null);
        }
      }, 1200);
    }
  };

  // Handle timeout
  const onTimeUp = () => {
    if (result && result.winner !== null) return;
    setResult({ winner: 'timeout', correctAnswer: currentQ?.correctAnswer, hintCount: revealed.length });
    advanceRound(qIndex + 1);
  };

  // Start a new game
  const startGame = () => {
    human.health = 5000;
    ai.health = 5000;
    processingRef.current = false;
    questionIdRef.current = 0;
    buildDeck();

    setResult(null);
    setPhase('playing');
    if (qIndex === 0) {
      mountQuestion(0);
    } else {
      setQIndex(0);
    }
  };

  const isInputDisabled = (result && result.winner !== null) || phase !== 'playing' || !isAlive(human);

  // Render logic
  if (phase === 'setup') {
    return (
      <div className="relative z-20 flex min-h-screen items-center justify-center p-3 sm:p-4">
        <div className="max-w-xl sm:max-w-2xl w-full mx-2 sm:mx-4">
          {/* Title Section */}
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6 font-spy tracking-wider drop-shadow-2xl">
              MISSION BRIEFING
            </h2>
            <p className="text-gray-200 text-lg sm:text-xl drop-shadow-lg mb-6 sm:mb-8 px-2">
              Agent {playerName} vs Agent 47
            </p>
          </div>

          {/* Mission Rules - Pure Floating Text Elements */}
          <div className="space-y-4 sm:space-y-6 mb-8 sm:mb-12 px-2">
            <div className="flex items-start space-x-3 sm:space-x-4">
              <span className="text-red-400 text-xl sm:text-2xl drop-shadow-lg flex-shrink-0">🎯</span>
              <div className="min-w-0">
                <span className="font-semibold text-red-400 text-base sm:text-lg drop-shadow-lg">Objective:</span>
                <span className="text-white text-base sm:text-lg ml-2 sm:ml-3 drop-shadow-lg break-words">
                  Survive {MAX_TARGETS} targets with Agent 47
                </span>
              </div>
            </div>

            <div className="flex items-start space-x-3 sm:space-x-4">
              <span className="text-red-400 text-xl sm:text-2xl drop-shadow-lg flex-shrink-0">💡</span>
              <div className="min-w-0">
                <span className="font-semibold text-red-400 text-base sm:text-lg drop-shadow-lg">Intelligence:</span>
                <span className="text-white text-base sm:text-lg ml-2 sm:ml-3 drop-shadow-lg break-words">
                  Hints are FREE! Wait for clues or answer fast
                </span>
              </div>
            </div>

            <div className="flex items-start space-x-3 sm:space-x-4">
              <span className="text-red-400 text-xl sm:text-2xl drop-shadow-lg flex-shrink-0">⚡</span>
              <div className="min-w-0">
                <span className="font-semibold text-red-400 text-base sm:text-lg drop-shadow-lg">Tactics:</span>
                <span className="text-white text-base sm:text-lg ml-2 sm:ml-3 drop-shadow-lg break-words">
                  Speed matters - Earlier answers deal more damage
                </span>
              </div>
            </div>

            <div className="flex items-start space-x-3 sm:space-x-4">
              <span className="text-red-400 text-xl sm:text-2xl drop-shadow-lg flex-shrink-0">❌</span>
              <div className="min-w-0">
                <span className="font-semibold text-red-400 text-base sm:text-lg drop-shadow-lg">Protocol:</span>
                <span className="text-white text-base sm:text-lg ml-2 sm:ml-3 drop-shadow-lg break-words">
                  No penalties for wrong answers
                </span>
              </div>
            </div>

            <div className="flex items-start space-x-3 sm:space-x-4">
              <span className="text-red-400 text-xl sm:text-2xl drop-shadow-lg flex-shrink-0">🏆</span>
              <div className="min-w-0">
                <span className="font-semibold text-red-400 text-base sm:text-lg drop-shadow-lg">Victory:</span>
                <span className="text-white text-base sm:text-lg ml-2 sm:ml-3 drop-shadow-lg break-words">
                  Win by having the most health remaining
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6 px-2">
            <Button
              onClick={startGame}
              size="lg"
              className="w-full sm:w-auto px-8 sm:px-16 py-3 sm:py-4 bg-red-800/90 hover:bg-red-700/90 backdrop-blur-sm border border-red-700/60 hover:border-red-600/80 text-white text-base sm:text-lg font-semibold rounded-xl transition-all duration-300 shadow-2xl hover:shadow-red-900/30"
            >
              BEGIN MISSION
            </Button>

            <Button
              onClick={onBackToMenu}
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto px-8 sm:px-16 py-3 sm:py-4 bg-gray-800/90 hover:bg-gray-700/90 backdrop-blur-sm border border-gray-700/60 hover:border-gray-600/80 text-white text-base sm:text-lg font-semibold rounded-xl transition-all duration-300 shadow-2xl hover:shadow-gray-900/30"
            >
              BACK TO HQ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'finished') {
    const humanWon = (human?.health ?? 0) > ai.health || (isAlive(human) && !isAlive(ai));
    return (
      <div className="relative z-20 flex min-h-screen items-center justify-center p-3 sm:p-4">
        <div className="max-w-sm sm:max-w-4xl w-full mx-2 sm:mx-4">
          {/* Title Section */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="text-4xl sm:text-6xl mb-4 sm:mb-6 drop-shadow-2xl">
              {humanWon ? '🏆' : '☠️'}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6 font-spy tracking-wider drop-shadow-2xl px-2">
              {humanWon ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED'}
            </h1>
            <p className="text-gray-200 text-lg sm:text-2xl drop-shadow-lg mb-3 sm:mb-4 px-2">
              {humanWon ? `Congratulations Agent ${playerName}!` : 'Agent 47 completed the mission first.'}
            </p>
            <p className="text-gray-300 drop-shadow-lg text-sm sm:text-base px-2">
              Completed {qIndex + (result ? 1 : 0)} out of {MAX_TARGETS} targets
            </p>
          </div>

          {/* Floating Score Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-8 sm:mb-12 px-2">
            {/* Human Player Card */}
            <div className={`backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-2xl border-2 transition-all duration-300 hover:scale-105 ${
              humanWon
                ? 'bg-green-900/80 border-green-500/60'
                : 'bg-red-900/80 border-red-500/60'
            }`}>
              <div className="text-center mb-4 sm:mb-6">
                <h3 className="text-xl sm:text-2xl font-spy font-bold text-white drop-shadow-lg mb-2">
                  {human?.name || playerName}
                </h3>
                <div className="flex justify-center">
                  {humanWon && (
                    <span className="inline-flex items-center px-3 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-semibold text-green-200 bg-green-700/60 backdrop-blur-sm">
                      🏆 VICTOR
                    </span>
                  )}
                  {!humanWon && (
                    <span className="inline-flex items-center px-3 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-semibold text-red-200 bg-red-700/60 backdrop-blur-sm">
                      ☠️ ELIMINATED
                    </span>
                  )}
                </div>
              </div>

              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-white drop-shadow-lg mb-2">
                  {human?.health || 0} HP
                </div>
                <div className="text-gray-300 text-xs sm:text-sm drop-shadow-lg">
                  Final Health Points
                </div>
              </div>

              {/* Health Bar Visualization */}
              <div className="mt-3 sm:mt-4">
                <FloatingHealthBar
                  health={human?.health || 0}
                  maxHealth={5000}
                  isWinner={humanWon}
                />
              </div>
            </div>

            {/* AI Player Card */}
            <div className={`backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-2xl border-2 transition-all duration-300 hover:scale-105 ${
              !humanWon
                ? 'bg-green-900/80 border-green-500/60'
                : 'bg-red-900/80 border-red-500/60'
            }`}>
              <div className="text-center mb-4 sm:mb-6">
                <h3 className="text-xl sm:text-2xl font-spy font-bold text-white drop-shadow-lg mb-2">
                  Agent 47
                </h3>
                <div className="flex justify-center">
                  {!humanWon && (
                    <span className="inline-flex items-center px-3 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-semibold text-green-200 bg-green-700/60 backdrop-blur-sm">
                      🏆 VICTOR
                    </span>
                  )}
                  {humanWon && (
                    <span className="inline-flex items-center px-3 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-semibold text-red-200 bg-red-700/60 backdrop-blur-sm">
                      ☠️ ELIMINATED
                    </span>
                  )}
                </div>
              </div>

              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-white drop-shadow-lg mb-2">
                  {ai.health} HP
                </div>
                <div className="text-gray-300 text-xs sm:text-sm drop-shadow-lg">
                  Final Health Points
                </div>
              </div>

              {/* Health Bar Visualization */}
              <div className="mt-3 sm:mt-4">
                <FloatingHealthBar
                  health={ai.health}
                  maxHealth={5000}
                  isWinner={!humanWon}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6 px-2">
            <Button
              onClick={startGame}
              variant="primary"
              className="w-full sm:w-auto px-8 sm:px-16 py-3 sm:py-4 bg-red-800/90 hover:bg-red-700/90 backdrop-blur-sm border border-red-700/60 hover:border-red-600/80 text-white text-base sm:text-lg font-semibold rounded-xl transition-all duration-300 shadow-2xl hover:shadow-red-900/30"
            >
              NEW MISSION
            </Button>

            <Button
              onClick={onBackToMenu}
              variant="secondary"
              className="w-full sm:w-auto px-8 sm:px-16 py-3 sm:py-4 bg-gray-800/90 hover:bg-gray-700/90 backdrop-blur-sm border border-gray-700/60 hover:border-gray-600/80 text-white text-base sm:text-lg font-semibold rounded-xl transition-all duration-300 shadow-2xl hover:shadow-gray-900/30"
            >
              BACK TO HQ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQ || !human) {
    return (
      <div className="relative z-20 flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" message="Preparing mission..." />
      </div>
    );
  }

  return (
    <div className="relative z-20 min-h-screen p-2 sm:p-4">
      <div className="max-w-6xl mx-auto">
        {/* Game Header */}
        <div className="bg-black bg-opacity-90 p-3 sm:p-6 rounded-lg mb-4 sm:mb-6 border border-red-600">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 space-y-3 sm:space-y-0">
            <div className="text-white">
              <h2 className="text-lg sm:text-xl font-spy">TARGET: {qIndex + 1} / {MAX_TARGETS}</h2>
              <p className="text-sm text-gray-300">Category: {currentQ.category}</p>
              <p className="text-xs text-gray-400">
                Hint {revealed.length}/{MAX_HINTS} • Damage: {damageByHint(revealed.length || 1)} HP
              </p>
            </div>
            <div className="w-full sm:w-auto flex justify-center">
              <Timer
                duration={QUESTION_TIME_SEC}
                onComplete={onTimeUp}
                isActive={!isInputDisabled}
                key={`timer-${timerKey}`}
              />
            </div>
          </div>

          {/* Health Panels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <Panel title={human.name} health={human.health} isAI={false} />
            <Panel title="Agent 47" health={ai.health} isAI={true} />
          </div>
        </div>

        {/* Result Banner */}
        {result && (
          <div className="mb-4 sm:mb-6">
            <ResultBanner result={result} />
          </div>
        )}

        {/* Game Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="order-2 lg:order-1">
            <HintDisplay
              hints={revealed}
              totalHints={Math.min(MAX_HINTS, currentQ.hints?.length || 0)}
              key={`hints-${qIndex}`}
            />
          </div>
          <div className="order-1 lg:order-2">
            <GuessInput
              onSubmit={onGuess}
              disabled={isInputDisabled}
              placeholder="Take your shot (be precise)..."
              key={`input-${qIndex}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- UI Helpers ---------- */
function FloatingHealthBar({ health, maxHealth, isWinner }) {
  const percentage = Math.max(0, Math.min(100, (health / maxHealth) * 100));

  return (
    <div className="relative w-full h-3 sm:h-4 bg-gray-700/60 rounded-full overflow-hidden backdrop-blur-sm">
      <div
        className={`h-full transition-all duration-700 ease-out ${
          isWinner ? 'bg-gradient-to-r from-green-500 to-green-400' : 'bg-gradient-to-r from-red-500 to-red-400'
        }`}
        style={{ width: `${percentage}%` }}
      >
        <div className="absolute inset-0 bg-white bg-opacity-20 rounded-full"></div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-white drop-shadow-lg">
          {percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function Panel({ title, health, isAI, isFinishedScreen = false }) {
  const pct = Math.max(0, Math.min(100, Math.round((health / 5000) * 100)));
  const color = pct > 75 ? (isAI ? 'from-red-500 to-red-400' : 'from-green-500 to-green-400')
    : pct > 50 ? (isAI ? 'from-purple-500 to-purple-400' : 'from-yellow-500 to-yellow-400')
    : pct > 25 ? (isAI ? 'from-pink-500 to-pink-400' : 'from-orange-500 to-orange-400')
    : 'from-red-500 to-red-400';

  const backgroundClass = isFinishedScreen ? 'bg-gradient-to-br from-white to-gray-50' : 'bg-gray-900';
  const healthBarBgClass = isFinishedScreen ? 'bg-gray-300' : 'bg-gray-800';
  const percentageTextColor = isFinishedScreen ? 'text-gray-700' : 'text-gray-400';

  return (
    <div className={`${backgroundClass} p-3 sm:p-6 rounded-xl border-2 ${isAI ? 'border-red-400' : 'border-green-400'} ${isFinishedScreen ? 'shadow-lg' : ''}`}>
      <div className="mb-2 sm:mb-3 text-center">
        <span className={`text-xs sm:text-sm font-bold ${isAI ? 'text-red-500' : 'text-green-500'}`}>{title}</span>
      </div>
      <div className={`relative w-full h-10 sm:h-14 ${healthBarBgClass} rounded-xl border overflow-hidden shadow-inner`}>
        <div className={`h-full transition-all duration-700 ease-out bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }}>
          <div className="absolute inset-0 bg-white bg-opacity-20 rounded-xl"></div>
          {pct <= 25 && pct > 0 && <div className="absolute inset-0 bg-white bg-opacity-30 rounded-xl animate-pulse"></div>}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm sm:text-xl font-bold text-white drop-shadow-lg tracking-wider">{Math.max(0, health)} HP</span>
        </div>
      </div>
      <div className="flex justify-between items-center mt-1 sm:mt-2">
        <div className="flex items-center space-x-1 sm:space-x-2">
          {health <= 0 && <span className="text-xs text-red-500 font-bold animate-bounce">☠️ ELIMINATED</span>}
          {pct <= 25 && health > 0 && <span className="text-xs text-red-500 font-bold animate-pulse">⚠️ CRITICAL</span>}
          {pct > 75 && <span className="text-xs text-green-500 font-bold">✨ EXCELLENT</span>}
        </div>
        <span className={`text-xs sm:text-sm font-medium ${percentageTextColor}`}>{pct}%</span>
      </div>
    </div>
  );
}

function ResultBanner({ result }) {
  return (
    <div className={`p-3 sm:p-4 rounded-lg border-2 ${
      result.winner === 'human' ? 'bg-green-900 border-green-500' :
      result.winner === 'ai' ? 'bg-red-900 border-red-500' :
      result.winner === 'timeout' ? 'bg-orange-900 border-orange-500' :
      'bg-yellow-900 border-yellow-500'
    }`}>
      <div className="text-center text-white">
        {result.winner === 'human' && (
          <p className="text-base sm:text-lg font-bold">🎯 PERFECT SHOT! Opponent loses {result.healthLoss} HP (hint {result.hintCount})</p>
        )}
        {result.winner === 'ai' && (
          <p className="text-base sm:text-lg font-bold">🎯 Agent 47 shot first! You lose {result.healthLoss} HP (hint {result.hintCount})</p>
        )}
        {result.winner === 'timeout' && (
          <p className="text-base sm:text-lg font-bold">⏱️ TIME'S UP! Target escaped! No penalties.</p>
        )}
        {result.winner === null && (
          <p className="text-base sm:text-lg font-bold">❌ Missed shot. No penalties - keep trying!</p>
        )}
        {result.correctAnswer && (
          <p className="text-sm mt-2">The target was: <strong>{result.correctAnswer}</strong></p>
        )}
      </div>
    </div>
  );
}
