import React, { useEffect, useRef, useState } from 'react';
import { Player } from '../../classes/Player.js';
import { Question } from '../../classes/Question.js';
import questionsData from '../../data/questions.json';
import HintDisplay from '../game/HintDisplay';
import GuessInput from '../game/GuessInput';
import Timer from '../common/Timer';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';

const MAX_TARGETS = 5;
const MAX_HINTS = 5;
const ROUND_RESULT_DELAY_MS = 3000;
const FIRST_HINT_DELAY_MS = 1000;
const HINT_INTERVAL_MS = 15000;
const QUESTION_TIME_SEC = 120;

const damageByHint = (hintCount) => {
  switch (hintCount) {
    case 1: return 1000;
    case 2: return 800;
    case 3: return 600;
    case 4: return 400;
    case 5: return 200;
    default: return 200;
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
  const [phase, setPhase] = useState('setup'); // setup | playing | finished
  const [qIndex, setQIndex] = useState(0);
  const [currentQ, setCurrentQ] = useState(null);
  const [revealed, setRevealed] = useState([]);
  const [result, setResult] = useState(null);
  const [timerKey, setTimerKey] = useState(0);
  const [human, setHuman] = useState(null);
  const [ai] = useState(new Player('ai', 'Agent 47', '🤖'));

  // Refs for internal logic that doesn't trigger re-renders
  const deckRef = useRef([]);
  const processingRef = useRef(false); // Prevents overlapping advanceRound calls
  const hintTimerRef = useRef(null);
  const questionIdRef = useRef(0); // Unique ID for each question instance

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

  // Build a new random deck of questions
  const buildDeck = () => {
    const arr = [...questionsData];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const start = Math.floor(Math.random() * Math.max(1, arr.length - MAX_TARGETS));
    deckRef.current = arr.slice(start, start + MAX_TARGETS);
  };

  // Set up a new question and its timers
  const mountQuestion = (index) => {
    const data = deckRef.current[index];
    if (!data) return;

    const questionId = ++questionIdRef.current;
    console.log(`Mounting question ${index + 1}: ${data.answer} (ID: ${questionId})`);

    const q = new Question(data.id, data.answer, data.category, data.difficulty);
    const hints = (data.hints || []).slice(0, MAX_HINTS);
    q.start();

    // Reset state for the new round
    setCurrentQ(q);
    setRevealed([]);
    setResult(null); // Clear result from previous round
    setTimerKey(k => k + 1);
    clearHintTimer();

    // Schedule first hint
    setTimeout(() => {
      if (questionIdRef.current !== questionId) return;
      if (hints[0]) {
        setRevealed([{ index: 0, text: hints[0], revealed: true }]);
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
          const next = { index: nextIdx, text: hints[nextIdx], revealed: true };
          scheduleAIGuess(q, nextIdx + 1, questionId, index);
          return [...prev, next];
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
    console.log(`Advancing to round ${nextIndex + 1}...`);

    setTimeout(() => {
      if (nextIndex < MAX_TARGETS && isAlive(human) && isAlive(ai)) {
        setResult(null); // Clear result before updating index
        setQIndex(nextIndex); // This triggers the useEffect to call mountQuestion
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
        console.log(`AI guess CORRECT for question ID ${questionId}`);
        const dmg = damageByHint(hintCount);
        setHuman((prev) => ({ ...prev, health: Math.max(0, (prev.health ?? 0) - dmg) }));
        setResult({ winner: 'ai', correctAnswer: q.correctAnswer, hintCount, healthLoss: dmg });
        advanceRound(index + 1);
      } else {
        console.log(`AI guess WRONG for question ID ${questionId}`);
      }
    }, delay);
  };

  // Human guess logic
  const onGuess = (guess) => {
    if (result && result.winner !== null) return; // Already a final result

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
    console.log('Starting new game...');
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
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-2xl w-full text-black border border-gray-200">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-red-600 mb-4 font-spy">MISSION BRIEFING</h2>
            <p className="text-lg mb-4 text-gray-800">Agent {playerName} vs Agent 47</p>
            <div className="bg-gray-800 p-4 rounded text-white text-sm">
              <p className="mb-2">🎯 <strong>Survive {MAX_TARGETS} targets with Agent 47</strong></p>
              <p className="mb-2">💡 <strong>Hints are FREE!</strong> Wait for clues or answer fast</p>
              <p className="mb-2">⚡ <strong>Speed matters:</strong> Earlier answers deal more damage</p>
              <p className="mb-2">❌ <strong>No penalties</strong> for wrong answers</p>
              <p>🏆 <strong>Win by having the most health remaining</strong></p>
            </div>
          </div>
          <div className="text-center">
            <Button onClick={startGame} size="lg" className="px-12">🎯 BEGIN MISSION</Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'finished') {
    const humanWon = (human?.health ?? 0) > ai.health || (isAlive(human) && !isAlive(ai));
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-gradient-to-br from-white to-gray-50 p-10 rounded-2xl shadow-2xl max-w-4xl w-full text-black border border-gray-200 backdrop-blur-sm">
          {/* Header Section */}
          <div className="text-center mb-8">
            <div className="mb-4">
              <div className="text-6xl mb-3">
                {humanWon ? '🏆' : '☠️'}
              </div>
              <h1 className="text-4xl font-bold font-spy mb-2 bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                {humanWon ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED'}
              </h1>
              <div className="w-24 h-1 bg-gradient-to-r from-red-500 to-red-700 mx-auto rounded-full mb-4"></div>
            </div>
            <p className="text-2xl mb-3 text-gray-700 font-medium">
              {humanWon ? `Congratulations Agent ${playerName}!` : 'Agent 47 completed the mission first.'}
            </p>
            <div className="inline-flex items-center px-4 py-2 bg-gray-100 rounded-full text-sm font-medium text-gray-600">
              <span className="mr-2">📊</span>
              Completed {qIndex + (result ? 1 : 0)} out of {MAX_TARGETS} targets
            </div>
          </div>

          {/* Enhanced Score Panels */}
          <ScorePanels human={human} ai={ai} playerName={playerName} />

          {/* Action Buttons */}
          <div className="flex space-x-4 mt-8">
            <Button
              onClick={startGame}
              variant="primary"
              className="flex-1 py-4 text-lg font-semibold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              🔄 NEW MISSION
            </Button>
            <Button
              onClick={onBackToMenu}
              variant="secondary"
              className="flex-1 py-4 text-lg font-semibold bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              🏠 BACK TO HQ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQ || !human) {
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
              <h2 className="text-xl font-spy">TARGET: {qIndex + 1} / {MAX_TARGETS}</h2>
              <p className="text-sm text-gray-300">Category: {currentQ.category}</p>
              <p className="text-xs text-gray-400">
                Hint {revealed.length}/{MAX_HINTS} • Damage: {damageByHint(revealed.length || 1)} HP
              </p>
            </div>
            <Timer
              duration={QUESTION_TIME_SEC}
              onComplete={onTimeUp}
              isActive={!isInputDisabled}
              key={`timer-${timerKey}`}
            />
          </div>
          <div className="grid grid-cols-2 gap-6 mb-6">
            <Panel title={human.name} health={human.health} isAI={false} />
            <Panel title="Agent 47" health={ai.health} isAI={true} />
          </div>
        </div>
        {result && <ResultBanner result={result} />}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <HintDisplay
            hints={revealed}
            totalHints={Math.min(MAX_HINTS, currentQ.hints?.length || 0)}
            key={`hints-${qIndex}`}
          />
          <GuessInput
            onSubmit={onGuess}
            disabled={isInputDisabled}
            placeholder="Take your shot (be precise)..."
            key={`input-${qIndex}`}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- UI Helpers ---------- */
function Panel({ title, health, isAI, isFinishedScreen = false }) {
  const pct = Math.max(0, Math.min(100, Math.round((health / 5000) * 100)));
  const color = pct > 75 ? (isAI ? 'from-red-500 to-red-400' : 'from-green-500 to-green-400')
    : pct > 50 ? (isAI ? 'from-purple-500 to-purple-400' : 'from-yellow-500 to-yellow-400')
    : pct > 25 ? (isAI ? 'from-pink-500 to-pink-400' : 'from-orange-500 to-orange-400')
    : 'from-red-500 to-red-400';

  // Use light background for finished screen, dark background for gameplay
  const backgroundClass = isFinishedScreen ? 'bg-gradient-to-br from-white to-gray-50' : 'bg-gray-900';
  const healthBarBgClass = isFinishedScreen ? 'bg-gray-300' : 'bg-gray-800';
  const percentageTextColor = isFinishedScreen ? 'text-gray-700' : 'text-gray-400';

  return (
    <div className={`${backgroundClass} p-6 rounded-xl border-2 ${isAI ? 'border-red-400' : 'border-green-400'} ${isFinishedScreen ? 'shadow-lg' : ''}`}>
      <div className="mb-3 text-center">
        <span className={`text-sm font-bold ${isAI ? 'text-red-500' : 'text-green-500'}`}>{title}</span>
      </div>
      <div className={`relative w-full h-14 ${healthBarBgClass} rounded-xl border overflow-hidden shadow-inner`}>
        <div className={`h-full transition-all duration-700 ease-out bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }}>
          <div className="absolute inset-0 bg-white bg-opacity-20 rounded-xl"></div>
          {pct <= 25 && pct > 0 && <div className="absolute inset-0 bg-white bg-opacity-30 rounded-xl animate-pulse"></div>}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-white drop-shadow-lg tracking-wider">{Math.max(0, health)} HP</span>
        </div>
      </div>
      <div className="flex justify-between items-center mt-2">
        <div className="flex items-center space-x-2">
          {health <= 0 && <span className="text-xs text-red-500 font-bold animate-bounce">☠️ ELIMINATED</span>}
          {pct <= 25 && health > 0 && <span className="text-xs text-red-500 font-bold animate-pulse">⚠️ CRITICAL</span>}
          {pct > 75 && <span className="text-xs text-green-500 font-bold">✨ EXCELLENT</span>}
        </div>
        <span className={`text-sm font-medium ${percentageTextColor}`}>{pct}%</span>
      </div>
    </div>
  );
}

function ScorePanels({ human, ai, playerName }) {
  const humanWon = (human?.health ?? 0) > ai.health || ((human?.health ?? 0) > 0 && ai.health <= 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
      {/* Human Player Panel */}
      <div className={`p-6 rounded-2xl shadow-xl transform transition-all duration-300 hover:scale-105 border-3 ${
        humanWon
          ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-500 shadow-green-200/50'
          : 'bg-gradient-to-br from-red-50 to-red-100 border-red-500 shadow-red-200/50'
      }`}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🕴</span>
              <h3 className="font-spy text-2xl font-bold text-gray-800">{human?.name || playerName}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {humanWon && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold text-green-700 bg-green-200">
                  🏆 Winner
                </span>
              )}
              {!humanWon && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold text-red-700 bg-red-200">
                  ⚫ Eliminated
                </span>
              )}
              {(human?.health ?? 0) <= 0 && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold text-red-700 bg-red-200">
                  ☠️ Terminated
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-red-600 mb-1">{human?.health || 0}</p>
            <p className="text-sm text-gray-500 font-medium">Health Points</p>
            <p className="text-xs text-gray-400 mt-1">{human?.totalCorrect || 0}/{human?.totalQuestions || 0} correct</p>
          </div>
        </div>
        <Panel title={human?.name || playerName} health={human?.health || 0} isAI={false} isFinishedScreen={true} />
      </div>

      {/* AI Player Panel */}
      <div className={`p-6 rounded-2xl shadow-xl transform transition-all duration-300 hover:scale-105 border-3 ${
        !humanWon
          ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-500 shadow-green-200/50'
          : 'bg-gradient-to-br from-red-50 to-red-100 border-red-500 shadow-red-200/50'
      }`}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🤖</span>
              <h3 className="font-spy text-2xl font-bold text-gray-800">Agent 47</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {!humanWon && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold text-green-700 bg-green-200">
                  🏆 Winner
                </span>
              )}
              {humanWon && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold text-red-700 bg-red-200">
                  ⚫ Eliminated
                </span>
              )}
              {ai.health <= 0 && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold text-red-700 bg-red-200">
                  ☠️ Terminated
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-red-600 mb-1">{ai.health}</p>
            <p className="text-sm text-gray-500 font-medium">Health Points</p>
            <p className="text-xs text-gray-400 mt-1">{ai.totalCorrect || 0}/{ai.totalQuestions || 0} correct</p>
          </div>
        </div>
        <Panel title="Agent 47" health={ai.health} isAI={true} isFinishedScreen={true} />
      </div>
    </div>
  );
}

function ResultBanner({ result }) {
  return (
    <div className={`mb-6 p-4 rounded-lg border-2 ${
      result.winner === 'human' ? 'bg-green-900 border-green-500' :
      result.winner === 'ai' ? 'bg-red-900 border-red-500' :
      result.winner === 'timeout' ? 'bg-orange-900 border-orange-500' :
      'bg-yellow-900 border-yellow-500'
    }`}>
      <div className="text-center text-white">
        {result.winner === 'human' && (
          <p className="text-lg font-bold">🎯 PERFECT SHOT! Opponent loses {result.healthLoss} HP (hint {result.hintCount})</p>
        )}
        {result.winner === 'ai' && (
          <p className="text-lg font-bold">🎯 Agent 47 shot first! You lose {result.healthLoss} HP (hint {result.hintCount})</p>
        )}
        {result.winner === 'timeout' && (
          <p className="text-lg font-bold">⏱️ TIME'S UP! Target escaped! No penalties.</p>
        )}
        {result.winner === null && (
          <p className="text-lg font-bold">❌ Missed shot. No penalties - keep trying!</p>
        )}
        {result.correctAnswer && (
          <p className="text-sm mt-2">The target was: <strong>{result.correctAnswer}</strong></p>
        )}
      </div>
    </div>
  );
}
