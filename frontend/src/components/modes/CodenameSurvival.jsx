import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import io from 'socket.io-client';
import HintDisplay from '../game/HintDisplay';
import GuessInput from '../game/GuessInput';
import Timer from '../common/Timer';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import CategoryService from '../../services/CategoryService';

// Constants
const MAX_HEALTH = 10000;
const MAX_PLAYERS = 6;
const QUESTION_TIME_SEC = 120;
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:10000';

const getDamageValues = (playersRemaining, isWrongAnswer = false) => {
  if (isWrongAnswer) {
    const wrongAnswerDamage = { 6: 400, 5: 500, 4: 600, 3: 700, 2: 800 };
    return wrongAnswerDamage[playersRemaining] || 900;
  }
  const timeDamage = { 6: 30, 5: 50, 4: 70, 3: 90, 2: 110 };
  return timeDamage[playersRemaining] || 130;
};

const getHealthStatus = (currentHealth) => {
  const percentage = (currentHealth / MAX_HEALTH) * 100;
  if (percentage <= 0) return { status: 'eliminated', color: 'text-red-500', icon: '☠️' };
  if (percentage <= 20) return { status: 'critical', color: 'text-red-400', icon: '⚠️' };
  if (percentage <= 40) return { status: 'wounded', color: 'text-orange-400', icon: '🩸' };
  if (percentage <= 60) return { status: 'injured', color: 'text-yellow-400', icon: '⚡' };
  return { status: 'healthy', color: 'text-green-400', icon: '💚' };
};

const generateCodename = (name, index) => {
  const prefixes = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
  return `${prefixes[index % prefixes.length]}-${name}`;
};

const AgentsList = ({ players, health, myPlayerId, readyPlayers, showReadyStatus }) => {
  const sortedPlayers = useMemo(() =>
    [...players].sort((a, b) => {
      const aHealth = health[a.id] ?? MAX_HEALTH;
      const bHealth = health[b.id] ?? MAX_HEALTH;
      const aAlive = aHealth > 0;
      const bAlive = bHealth > 0;
      if (aAlive && !bAlive) return -1;
      if (!aAlive && bAlive) return 1;
      return bHealth - aHealth;
    }), [players, health]);
  const alivePlayers = sortedPlayers.filter(p => (health[p.id] || 0) > 0);

  return (
    <div className="bg-gray-900 rounded-lg p-4 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-white font-spy">AGENT STATUS</h3>
        <div className="text-green-400 font-bold">
          {showReadyStatus ? `${players.length} AGENTS IN LOBBY` : `${alivePlayers.length} AGENTS REMAINING`}
        </div>
      </div>
      <div className="space-y-2">
        {sortedPlayers.map((player, index) => {
          const playerHealth = health[player.id] ?? MAX_HEALTH;
          const healthStatus = getHealthStatus(playerHealth);
          const isMe = player.id === myPlayerId;
          const playerReady = readyPlayers.has(player.id);
          const isEliminated = playerHealth <= 0;
          return (
            <div
              key={player.id}
              className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                isEliminated
                  ? 'bg-red-900/50 border-red-600'
                  : isMe
                    ? 'bg-blue-900 border-blue-400'
                    : 'bg-gray-800 border-gray-600'
              }`}>
              <div className="flex items-center space-x-3">
                <span className="text-2xl">
                  {showReadyStatus ? (playerReady ? '✅' : '⏳') : healthStatus.icon}
                </span>
                <div>
                  <div className={`font-bold ${isEliminated ? 'text-red-300 line-through' : 'text-white'}`}>
                    {generateCodename(player.name, index)}
                    {isMe && <span className="text-blue-400 ml-2">(YOU)</span>}
                  </div>
                  <div className={`text-sm ${showReadyStatus ? 'text-gray-300' : healthStatus.color}`}>
                    {showReadyStatus ? (playerReady ? 'READY' : 'WAITING') : `${playerHealth} HP • ${healthStatus.status.toUpperCase()}`}
                  </div>
                </div>
              </div>
              {!showReadyStatus && (
                <div className="w-24">
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isEliminated
                          ? 'bg-red-600'
                          : healthStatus.status === 'healthy'
                            ? 'bg-green-500'
                            : healthStatus.status === 'injured'
                              ? 'bg-yellow-500'
                              : healthStatus.status === 'wounded'
                                ? 'bg-orange-500'
                                : 'bg-red-500'
                      }`}
                      style={{ width: `${(playerHealth / MAX_HEALTH) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CodenameSurvival = ({ playerName, onBackToMenu }) => {
  const [gameState, setGameState] = useState('connecting');
  const [players, setPlayers] = useState([]);
  const [currentTarget, setCurrentTarget] = useState(null);
  const [hints, setHints] = useState([]);
  const [gameResult, setGameResult] = useState(null);
  const [health, setHealth] = useState({});
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [survivalRound, setSurvivalRound] = useState(1);
  const [isReady, setIsReady] = useState(false);
  const [readyPlayers, setReadyPlayers] = useState(new Set());
  const [connectionError, setConnectionError] = useState(false);
  const [gameData, setGameData] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [reconnectCountdown, setReconnectCountdown] = useState(0);
  const [reconnectInfo, setReconnectInfo] = useState(null);
  const [timerDuration, setTimerDuration] = useState(QUESTION_TIME_SEC);
  const [timerKey, setTimerKey] = useState(0);

  const socketRef = useRef(null);
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);
  const countdownIntervalRef = useRef(null);

  const mergeHealthState = useCallback((currentHealth, newHealth) => {
    const merged = { ...currentHealth };
    if (newHealth) {
      Object.keys(newHealth).forEach(playerId => {
        merged[playerId] = newHealth[playerId];
      });
    }
    return merged;
  }, []);

  const resetPauseState = useCallback(() => {
    setIsPaused(false);
    setPauseReason('');
    setReconnectCountdown(0);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const startReconnectCountdown = useCallback((seconds) => {
    setReconnectCountdown(seconds);

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    countdownIntervalRef.current = setInterval(() => {
      setReconnectCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const syncQuestionTimer = useCallback((remainingQuestionTimeMs) => {
    const nextDuration = remainingQuestionTimeMs == null
      ? QUESTION_TIME_SEC
      : Math.max(0, Math.ceil(remainingQuestionTimeMs / 1000));

    setTimerDuration(nextDuration);
    setTimerKey(prev => prev + 1);
  }, []);

  const alivePlayers = useMemo(() =>
    players.filter(p => (health[p.id] || 0) > 0), [players, health]);
  const myHealth = useMemo(() => health[myPlayerId] ?? MAX_HEALTH, [health, myPlayerId]);
  const isEliminated = myHealth <= 0;
  const allPlayersReady = players.length > 0 && players.length === readyPlayers.size;

  // --- SOCKET ---
  const initializeSocket = useCallback(() => {
    if (socketRef.current || initializedRef.current) return;
    initializedRef.current = true;
    setConnectionError(false);

    const socket = io(backendUrl, {
      transports: ['polling', 'websocket'],
      timeout: 30000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
      autoConnect: true
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (!mountedRef.current) return;
      setMyPlayerId(socket.id);
      setGameState('matchmaking');
      setConnectionError(false);
      socket.emit('checkReconnect', { playerName });
    });

    socket.on('disconnect', (reason) => {
      if (!mountedRef.current) return;
      if (reason !== 'io client disconnect') {
        setConnectionError(true);
        setGameState('connecting');
      }
    });

    socket.on('connect_error', () => {
      if (!mountedRef.current) return;
      setConnectionError(true);
      setGameState('connecting');
    });

    socket.on('canReconnect', (data) => {
      if (!mountedRef.current) return;
      if (data.canReconnect !== false && data.roomId) {
        setReconnectInfo(data);
        setGameState('reconnect-available');
      }
    });

    socket.on('reconnectSuccess', (data) => {
      if (!mountedRef.current) return;

      setPlayers(data.players || []);
      setHealth(data.health || {});
      setMyPlayerId(socket.id);
      setSurvivalRound(data.round || 1);
      setReadyPlayers(new Set(data.readyPlayers || []));
      setIsReady((data.readyPlayers || []).includes(socket.id));
      setHints(Array.isArray(data.hints) ? data.hints : []);
      setReconnectInfo(null);
      setConnectionError(false);
      setGameResult(null);
      setGameData(null);

      if (data.questionActive && data.category) {
        setCurrentTarget({
          targetIndex: data.currentQuestion,
          totalTargets: data.totalQuestions,
          category: data.category,
          difficulty: data.difficulty
        });
      } else {
        setCurrentTarget(null);
      }

      if (data.gameState === 'paused') {
        setIsPaused(true);
        setPauseReason(data.pauseReason || 'Game paused');
      } else {
        resetPauseState();
      }

      syncQuestionTimer(data.remainingQuestionTimeMs);
      setGameState('playing');
    });

    socket.on('reconnectFailed', () => {
      if (!mountedRef.current) return;
      setReconnectInfo(null);
      resetPauseState();
      setGameState('matchmaking');
    });

    socket.on('waitingForMatch', ({ playersInRoom }) => {
      if (!mountedRef.current) return;
      setGameState('waiting');
      setGameData({ playersInRoom });
    });

    socket.on('matchFound', ({ players: matchedPlayers }) => {
      if (!mountedRef.current) return;
      setPlayers(matchedPlayers);
      setGameState('lobby');
      resetPauseState();
      const initialHealth = {};
      matchedPlayers.forEach(player => {
        initialHealth[player.id] = MAX_HEALTH;
      });
      setHealth(initialHealth);
      setReadyPlayers(new Set());
      setIsReady(false);
    });

    socket.on('playerReady', ({ readyPlayers: allReadyPlayers }) => {
      if (!mountedRef.current) return;
      setReadyPlayers(new Set(allReadyPlayers));
    });
    socket.on('playerUnready', ({ readyPlayers: allReadyPlayers }) => {
      if (!mountedRef.current) return;
      setReadyPlayers(new Set(allReadyPlayers));
    });

    socket.on('allPlayersReady', () => {
      if (!mountedRef.current) return;
      setGameState('briefing');
    });

    socket.on('gameStart', ({ round, health: gameHealth }) => {
      if (!mountedRef.current) return;
      setSurvivalRound(round);
      setGameState('playing');
      setCurrentTarget(null);
      syncQuestionTimer(QUESTION_TIME_SEC * 1000);
      resetPauseState();
      if (gameHealth) {
        const verifiedHealth = {};
        Object.keys(gameHealth).forEach(playerId => {
          verifiedHealth[playerId] = gameHealth[playerId] || MAX_HEALTH;
        });
        setHealth(verifiedHealth);
      }
    });

    socket.on('questionStart', ({ targetIndex, totalTargets, category, difficulty, health: newHealth, round, remainingQuestionTimeMs }) => {
      if (!mountedRef.current) return;
      setCurrentTarget({ targetIndex, totalTargets, category, difficulty });
      setHints([]);
      setGameResult(null);
      setSurvivalRound(round);
      syncQuestionTimer(remainingQuestionTimeMs);
      if (newHealth) setHealth(prev => mergeHealthState(prev, newHealth));
    });

    socket.on('hintRevealed', ({ index, text, health: newHealth }) => {
      if (!mountedRef.current) return;
      setHints(prev => [{ index, text }, ...prev]);
      if (newHealth) setHealth(prev => mergeHealthState(prev, newHealth));
    });

    socket.on('questionResult', ({ winner, winnerName, correctAnswer, health: newHealth, isTimeout, timeoutPenalty }) => {
      if (!mountedRef.current) return;
      if (newHealth) setHealth(prev => mergeHealthState(prev, newHealth));
      if (isTimeout) {
        setGameResult({
          type: 'timeout',
          correctAnswer,
          timeoutPenalty,
          message: 'Time\'s up! No one answered correctly'
        });
      } else {
        setGameResult({ winner, winnerName, correctAnswer, type: 'correct' });
      }
    });

    socket.on('wrongAnswer', ({ playerId, playerName: pName, guess, damage, health: newHealth }) => {
      if (!mountedRef.current) return;
      if (newHealth) setHealth(prev => mergeHealthState(prev, newHealth));
      setGameResult({ type: 'wrong', playerId, playerName: pName, guess, damage });
      setTimeout(() => mountedRef.current && setGameResult(null), 3000);
    });

    socket.on('playerEliminated', ({ eliminatedPlayerId, eliminatedPlayerName, health: newHealth, playersRemaining }) => {
      if (!mountedRef.current) return;
      setHealth(prev => {
        const updatedHealth = mergeHealthState(prev, newHealth);
        if (eliminatedPlayerId && updatedHealth[eliminatedPlayerId] !== 0) {
          updatedHealth[eliminatedPlayerId] = 0;
        }
        return updatedHealth;
      });
      setGameResult({ type: 'elimination', eliminatedPlayerName, playersRemaining });
      setTimeout(() => mountedRef.current && setGameResult(null), 3000);
    });

    socket.on('gameEnd', ({ winner, results }) => {
      if (!mountedRef.current) return;
      resetPauseState();
      setGameState('finished');
      setGameData({ winner, results });
    });

    socket.on('gamePaused', ({ message }) => {
      if (!mountedRef.current) return;
      setIsPaused(true);
      setPauseReason(message || 'Game paused');
    });

    socket.on('gameResumed', ({ message, remainingQuestionTimeMs }) => {
      if (!mountedRef.current) return;
      resetPauseState();
      if (message) {
        setGameResult({ type: 'status', message });
        setTimeout(() => mountedRef.current && setGameResult(null), 2000);
      }
      if (remainingQuestionTimeMs != null) {
        syncQuestionTimer(remainingQuestionTimeMs);
      }
    });

    socket.on('playerDisconnectedTemporary', ({ playerName: disconnectedName, reconnectTimeLeft, message }) => {
      if (!mountedRef.current) return;
      setIsPaused(true);
      setPauseReason(message || `${disconnectedName} disconnected. Waiting for reconnection...`);
      startReconnectCountdown(reconnectTimeLeft);
    });

    socket.on('playerReconnected', ({ playerName: reconnectedName, message, pendingReconnects }) => {
      if (!mountedRef.current) return;
      if (!pendingReconnects) {
        resetPauseState();
      }
      setGameResult({
        type: 'status',
        message: message || `Agent ${reconnectedName} reconnected`
      });
      setTimeout(() => mountedRef.current && setGameResult(null), 2500);
    });

    socket.on('playerDisconnectedPermanent', ({ playerName: disconnectedName, message }) => {
      if (!mountedRef.current) return;
      setGameResult({
        type: 'disconnect',
        message: message || `Agent ${disconnectedName} did not reconnect`
      });
      setTimeout(() => mountedRef.current && setGameResult(null), 3000);
    });

    socket.on('playerDisconnected', ({ disconnectedPlayer, disconnectedPlayerId, playersRemaining }) => {
      if (!mountedRef.current) return;
      if (disconnectedPlayerId) {
        setHealth(prev => ({
          ...prev,
          [disconnectedPlayerId]: 0
        }));
      }
      setGameResult({
        type: 'disconnect',
        message: `Agent ${disconnectedPlayer} disconnected`,
        playersRemaining
      });
    });
  }, [mergeHealthState, playerName, resetPauseState, startReconnectCountdown, syncQuestionTimer]);

  useEffect(() => {
    mountedRef.current = true;
    initializeSocket();
    return () => {
      mountedRef.current = false;
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.close();
        socketRef.current = null;
      }
      initializedRef.current = false;
    };
  }, [initializeSocket]);

  // Actions
  const findMatch = useCallback(() => {
    if (!socketRef.current?.connected) {
      setConnectionError(true);
      return;
    }
    const generalCategory = CategoryService.getGeneralCategory();
    socketRef.current.emit('findSurvivalMatch', {
      playerName,
      gameMode: 'survival',
      personalCategory: generalCategory?.id || 'general',
      personalCategoryName: generalCategory?.name || 'General Knowledge'
    });
    setReconnectInfo(null);
    setGameState('waiting');
  }, [playerName]);

  const toggleReady = useCallback(() => {
    if (!socketRef.current?.connected) return;
    const newReadyState = !isReady;
    setIsReady(newReadyState);
    socketRef.current.emit(newReadyState ? 'playerReady' : 'playerUnready');
  }, [isReady]);

  const submitGuess = useCallback((guess) => {
    if (!socketRef.current?.connected || gameState !== 'playing' || isEliminated) return;
    socketRef.current.emit('submitGuess', { guess });
  }, [gameState, isEliminated]);

  const handleCancel = useCallback(() => {
    resetPauseState();
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.close();
      socketRef.current = null;
    }
    initializedRef.current = false;
    onBackToMenu();
  }, [onBackToMenu, resetPauseState]);

  const handleReconnect = useCallback(() => {
    if (reconnectInfo && socketRef.current) {
      socketRef.current.emit('reconnectToGame', {
        roomId: reconnectInfo.roomId,
        playerName
      });
      setGameState('connecting');
    }
  }, [playerName, reconnectInfo]);

  // UI Screens
  if (gameState === 'reconnect-available' && reconnectInfo) {
    return (
      <div className="relative z-20 flex min-h-screen items-center justify-center p-3 sm:p-4">
        <div className="bg-white p-4 sm:p-8 rounded-lg shadow-2xl max-w-xs sm:max-w-md w-full text-black text-center border border-gray-200">
          <h2 className="text-lg sm:text-2xl font-bold text-green-600 mb-3 sm:mb-4 font-spy">RECONNECT AVAILABLE</h2>
          <div className="mb-4 sm:mb-6">
            <p className="text-sm sm:text-base mb-2">Your survival mission is still active.</p>
            <div className="bg-blue-100 border border-blue-300 rounded p-2 sm:p-3">
              <p className="text-xs sm:text-sm text-blue-800">
                <strong>Room:</strong> {reconnectInfo.roomId}<br />
                <strong>Player:</strong> {reconnectInfo.playerName}<br />
                <strong>Time Remaining:</strong> {Math.floor(reconnectInfo.timeRemaining / 1000)}s
              </p>
            </div>
          </div>
          <div className="space-y-2 sm:space-y-3">
            <Button onClick={handleReconnect} variant="primary" className="w-full text-sm sm:text-base py-2 sm:py-3">
              Reconnect to Mission
            </Button>
            <Button onClick={handleCancel} variant="secondary" className="w-full text-sm sm:text-base py-2 sm:py-3">
              Back to Main Menu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="relative z-20 flex min-h-screen items-center justify-center p-3 sm:p-4">
        <div className="bg-white p-4 sm:p-8 rounded-lg shadow-2xl max-w-xs sm:max-w-md w-full text-black text-center border border-gray-200">
          <h2 className="text-lg sm:text-2xl font-bold text-red-600 mb-3 sm:mb-4 font-spy">SERVER UNAVAILABLE</h2>
          <p className="mb-3 sm:mb-4 text-sm sm:text-base">Unable to establish a connection. Please try again shortly.</p>
          <div className="space-y-2 sm:space-y-3">
            <Button onClick={() => window.location.reload()} variant="primary" className="w-full text-sm sm:text-base py-2 sm:py-3">
              Retry Connection
            </Button>
            <Button onClick={onBackToMenu} variant="secondary" className="w-full text-sm sm:text-base py-2 sm:py-3">
              Back to Main Menu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'connecting') {
    return (
      <div className="relative z-20 flex min-h-screen items-center justify-center p-3 sm:p-4">
        <div className="bg-white p-4 sm:p-8 rounded-lg shadow-2xl max-w-xs sm:max-w-md w-full text-black text-center border border-gray-200">
          <LoadingSpinner size="lg" message="Connecting to Survival HQ..." />
          <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base">
            Establishing secure connection...
          </p>
          <Button onClick={onBackToMenu} variant="secondary" className="mt-4 sm:mt-6 w-full text-sm sm:text-base py-2 sm:py-3">
            Back to Main Menu
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === 'matchmaking') {
    return (
      <div className="relative z-20 flex min-h-screen items-center justify-center p-3 sm:p-4">
        <div className="bg-white p-4 sm:p-8 rounded-lg shadow-2xl max-w-sm sm:max-w-2xl w-full text-black border border-gray-200">
          <div className="text-center mb-4 sm:mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-red-600 mb-3 sm:mb-4 font-spy">CODENAME: SURVIVAL</h2>
            <p className="text-base sm:text-lg mb-3 sm:mb-4 text-gray-800">Agent {playerName}, prepare for elimination protocol</p>
            <div className="bg-gray-900 p-3 sm:p-4 rounded text-white text-xs sm:text-sm">
              <h3 className="text-red-400 font-bold mb-2 sm:mb-3">⚠️ MISSION BRIEFING ⚠️</h3>
              <div className="text-left space-y-1 sm:space-y-2">
                <p>🎯 <strong>Objective:</strong> Be the last agent standing</p>
                <p>👥 <strong>Agents:</strong> Up to {MAX_PLAYERS} players</p>
                <p>💀 <strong>Health:</strong> {MAX_HEALTH.toLocaleString()} HP</p>
                <p>⚡ <strong>Wrong Answer:</strong> 400-900 HP damage</p>
                <p>⏱️ <strong>Time Penalty:</strong> 30-130 HP/sec</p>
                <p>💡 <strong>Hints:</strong> Free, but time costs health</p>
                <p>🏆 <strong>Victory:</strong> Survive until the end</p>
              </div>
            </div>
          </div>
          <div className="justify-center text-center">
            <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
              <Button onClick={findMatch} size="lg" className="w-full sm:w-auto px-6 sm:px-12 text-sm sm:text-base py-2 sm:py-3">
                Enter Survival Mode
              </Button>
              <Button onClick={onBackToMenu} variant="secondary" size="lg" className="w-full sm:w-auto px-6 sm:px-12 text-sm sm:text-base py-2 sm:py-3">
                Back to Main Menu
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'waiting') {
    const playersInRoom = gameData?.playersInRoom || 1;
    return (
      <div className="relative z-20 flex min-h-screen items-center justify-center p-3 sm:p-4">
        <div className="bg-white p-4 sm:p-8 rounded-lg shadow-2xl max-w-xs sm:max-w-md w-full text-black text-center border border-gray-200">
          <LoadingSpinner size="lg" message="Recruiting agents..." />
          <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base">Waiting for more agents to join</p>
          <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-gray-100 rounded-lg">
            <div className="text-xl sm:text-2xl font-bold text-red-600">{playersInRoom}/{MAX_PLAYERS}</div>
            <div className="text-xs sm:text-sm text-gray-700">Agents in Lobby</div>
          </div>
          <div className="mt-3 sm:mt-4 text-xs text-blue-800">
            Mode: Survival Battle Royale
          </div>
          <p className="mt-2 text-xs text-gray-500">All players must ready up to start</p>
          <Button onClick={onBackToMenu} variant="secondary" className="mt-4 sm:mt-6 w-full text-sm sm:text-base py-2 sm:py-3">
            Abort Mission
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === 'lobby') {
    return (
      <div className="relative z-20 flex min-h-screen items-center justify-center p-3 sm:p-4">
        <div className="bg-black p-4 sm:p-8 rounded-lg shadow-2xl max-w-sm sm:max-w-4xl w-full text-white border-2 border-red-600">
          <div className="text-center mb-6 sm:mb-8">
            <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">☠️</div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-red-500 mb-2 font-spy">MISSION: SURVIVAL</h1>
            <p className="text-lg sm:text-xl text-gray-300">Elimination Protocol Ready</p>
          </div>
          <AgentsList
            players={players}
            health={health}
            myPlayerId={myPlayerId}
            readyPlayers={readyPlayers}
            showReadyStatus={true}
          />
          <div className="bg-red-900 p-3 sm:p-4 rounded-lg mb-4 sm:mb-6">
            <h3 className="text-base sm:text-lg font-bold text-red-300 mb-2 sm:mb-3">⚠️ SURVIVAL RULES ⚠️</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
              <div>
                <p className="mb-1 sm:mb-2">💀 <strong>Wrong Answer:</strong> 400-900 HP damage</p>
                <p className="mb-1 sm:mb-2">⏱️ <strong>Time Penalty:</strong> 30-130 HP/sec</p>
                <p className="mb-1 sm:mb-2">💡 <strong>Hints:</strong> Free, but time costs health</p>
              </div>
              <div>
                <p className="mb-1 sm:mb-2">📈 <strong>Escalation:</strong> Damage increases as agents fall</p>
                <p className="mb-1 sm:mb-2">🎯 <strong>Victory:</strong> Last agent standing</p>
                <p className="mb-1 sm:mb-2">🏆 <strong>Health Pool:</strong> {MAX_HEALTH.toLocaleString()} HP per agent</p>
              </div>
            </div>
          </div>
          <div className="text-center">
            <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4 mb-4 sm:mb-6">
              <Button
                onClick={toggleReady}
                variant={isReady ? "secondary" : "primary"}
                className={`w-full sm:w-auto px-8 sm:px-12 text-sm sm:text-base py-2 sm:py-3 ${
                  isReady ? 'bg-gray-600 hover:bg-gray-500' : 'bg-green-600 hover:bg-green-500'
                }`}
              >
                {isReady ? 'Cancel Ready' : 'Ready Up'}
              </Button>
              <Button onClick={onBackToMenu} variant="secondary" className="w-full sm:w-auto px-8 sm:px-12 text-sm sm:text-base py-2 sm:py-3">
                Back to Main Menu
              </Button>
            </div>
            {allPlayersReady ? (
              <div className="animate-pulse text-green-500 font-bold text-sm sm:text-base">
                All agents ready - starting mission...
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm sm:text-base text-gray-300">
                  Waiting for all agents to ready up ({readyPlayers.size}/{players.length})
                </p>
                <p className="text-xs text-yellow-400">
                  All players must click ready to start
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'briefing') {
    return (
      <div className="relative z-20 flex min-h-screen items-center justify-center p-3 sm:p-4">
        <div className="bg-black p-4 sm:p-8 rounded-lg shadow-2xl max-w-sm sm:max-w-4xl w-full text-white border-2 border-red-600">
          <div className="text-center mb-6 sm:mb-8">
            <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">☠️</div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-red-500 mb-2 font-spy">MISSION: SURVIVAL</h1>
            <p className="text-lg sm:text-xl text-gray-300">Elimination Protocol Activated</p>
          </div>
          <AgentsList
            players={players}
            health={health}
            myPlayerId={myPlayerId}
            readyPlayers={readyPlayers}
            showReadyStatus={false}
          />
          <div className="bg-red-900 p-3 sm:p-4 rounded-lg mb-4 sm:mb-6">
            <h3 className="text-base sm:text-lg font-bold text-red-300 mb-2 sm:mb-3">⚠️ SURVIVAL RULES ⚠️</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
              <div>
                <p className="mb-1 sm:mb-2">💀 <strong>Wrong Answer:</strong> Balanced damage (400-900 HP)</p>
                <p className="mb-1 sm:mb-2">⏱️ <strong>Time Penalty:</strong> Gradual health loss</p>
                <p className="mb-1 sm:mb-2">💡 <strong>Hints:</strong> Free, but time costs health</p>
              </div>
              <div>
                <p className="mb-1 sm:mb-2">📈 <strong>Escalation:</strong> Damage increases as agents fall</p>
                <p className="mb-1 sm:mb-2">🎯 <strong>Victory:</strong> Last agent standing</p>
                <p className="mb-1 sm:mb-2">🏆 <strong>Strategy:</strong> Speed and accuracy are key</p>
              </div>
            </div>
          </div>
          <div className="text-center">
            <p className="text-base sm:text-lg text-gray-300 mb-3 sm:mb-4">Game starting soon...</p>
            <div className="animate-pulse text-red-500 font-bold text-sm sm:text-base">Prepare for Elimination</div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'playing' && !currentTarget) {
    return (
      <div className="relative z-20 flex min-h-screen items-center justify-center p-3 sm:p-4">
        <div className="bg-black p-4 sm:p-8 rounded-lg shadow-2xl max-w-xs sm:max-w-md w-full text-white text-center border-2 border-red-600">
          <LoadingSpinner size="lg" message={isPaused ? 'Mission paused' : 'Restoring survival round...'} />
          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-300">
            {isPaused ? (pauseReason || 'Waiting for all agents to reconnect...') : 'Preparing the next survival question...'}
          </p>
          {isPaused && reconnectCountdown > 0 && (
            <p className="mt-2 text-xs sm:text-sm text-yellow-400">
              Reconnect window: {reconnectCountdown}s
            </p>
          )}
        </div>
      </div>
    );
  }

  if (gameState === 'playing' && currentTarget) {
    return (
      <div className="relative z-20 min-h-screen p-2 sm:p-4">
        <div className="max-w-6xl mx-auto">
          {isPaused && (
            <div className="mb-4 sm:mb-6 rounded-lg border-2 border-yellow-500 bg-yellow-900/80 p-3 sm:p-4 text-center text-white">
              <p className="text-sm sm:text-lg font-bold">MISSION PAUSED</p>
              <p className="mt-1 text-xs sm:text-sm text-yellow-100">
                {pauseReason || 'Waiting for disconnected agents to reconnect...'}
              </p>
              {reconnectCountdown > 0 && (
                <p className="mt-2 text-xs sm:text-sm text-yellow-300">
                  Reconnect window: {reconnectCountdown}s
                </p>
              )}
            </div>
          )}

          <div className="bg-black bg-opacity-90 p-3 sm:p-6 rounded-lg mb-4 sm:mb-6 border border-red-600">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 space-y-2 sm:space-y-0">
              <div className="text-white text-sm sm:text-base">
                <h2 className="text-lg sm:text-xl font-spy">SURVIVAL ROUND: {survivalRound}</h2>
                <p className="text-xs sm:text-sm text-gray-300">
                  Question {currentTarget.targetIndex} • {currentTarget.category}
                </p>
                <p className="text-xs text-red-400">
                  Wrong Answer: -{getDamageValues(alivePlayers.length, true)} HP • Time: -{getDamageValues(alivePlayers.length)}/sec
                </p>
              </div>
              <div className="w-full sm:w-auto flex justify-center">
                <Timer
                  duration={timerDuration}
                  isActive={!isEliminated && !isPaused}
                  key={`timer-${currentTarget.targetIndex}-${timerKey}`}
                />
              </div>
            </div>
            <AgentsList
              players={players}
              health={health}
              myPlayerId={myPlayerId}
              readyPlayers={readyPlayers}
              showReadyStatus={false}
            />
          </div>
          {/* Game Result Display */}
          <div className="relative mb-4 sm:mb-6">
            <div className="h-16 sm:h-20">
              {gameResult && (
                <div className={`absolute top-0 left-0 right-0 p-3 sm:p-4 rounded-lg border-2 transition-all duration-300 ease-in-out ${
                  gameResult.type === 'correct' ? 'bg-green-900 border-green-500' :
                  gameResult.type === 'wrong' ? 'bg-red-900 border-red-500' :
                  gameResult.type === 'elimination' ? 'bg-purple-900 border-purple-500' :
                  gameResult.type === 'timeout' ? 'bg-yellow-900 border-yellow-500' :
                  'bg-blue-900 border-blue-500'
                }`}>
                  <div className="text-center text-white">
                    {gameResult.type === 'correct' && (
                      <p className="text-sm sm:text-lg font-bold">🎯 Agent {gameResult.winnerName} secured the intel!</p>
                    )}
                    {gameResult.type === 'wrong' && (
                      <p className="text-sm sm:text-lg font-bold">💥 Agent {gameResult.playerName} missed: "{gameResult.guess}" (-{gameResult.damage} HP)</p>
                    )}
                    {gameResult.type === 'timeout' && (
                      <div>
                        <p className="text-sm sm:text-lg font-bold">⏱️ TIME'S UP! No one answered correctly</p>
                        <p className="text-xs sm:text-sm mt-1 sm:mt-2">
                          The answer was: <strong>{gameResult.correctAnswer}</strong> • All agents lost {gameResult.timeoutPenalty} HP
                        </p>
                      </div>
                    )}
                    {gameResult.type === 'elimination' && (
                      <div>
                        <p className="text-sm sm:text-lg font-bold">☠️ AGENT {gameResult.eliminatedPlayerName} HAS BEEN ELIMINATED</p>
                        <p className="text-xs sm:text-sm mt-1 sm:mt-2">{gameResult.playersRemaining} agents remaining</p>
                      </div>
                    )}
                    {gameResult.type === 'disconnect' && (
                      <p className="text-sm sm:text-lg font-bold">📡 {gameResult.message} ({gameResult.playersRemaining} remaining)</p>
                    )}
                    {gameResult.type === 'status' && (
                      <p className="text-sm sm:text-lg font-bold">📡 {gameResult.message}</p>
                    )}
                    {gameResult.correctAnswer && gameResult.type === 'correct' && (
                      <p className="text-xs sm:text-sm mt-1 sm:mt-2">The intel was: <strong>{gameResult.correctAnswer}</strong></p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="order-2 lg:order-1">
              <HintDisplay
                hints={hints}
                totalHints={5}
                key={`hints-${currentTarget.targetIndex}-${hints.length}`}
              />
            </div>
            <div className="order-1 lg:order-2">
              <GuessInput
                onSubmit={submitGuess}
                disabled={isEliminated}
                placeholder={isEliminated ? "You have been eliminated..." : "Submit your intel..."}
                key={`input-${currentTarget.targetIndex}`}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    const winner = gameData?.winner;
    const results = gameData?.results || [];
    const isWinner = winner?.name === playerName;
    return (
      <div className="relative z-20 flex min-h-screen items-center justify-center p-3 sm:p-4">
        <div className="bg-white p-4 sm:p-8 rounded-lg shadow-2xl max-w-sm sm:max-w-4xl w-full text-black border border-gray-200">
          <div className="text-center mb-6 sm:mb-8">
            <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">
              {isWinner ? '🏆' : '☠️'}
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-red-600 mb-2 font-spy">
              {isWinner ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED'}
            </h1>
            <p className="text-lg sm:text-xl text-gray-800">
              {isWinner ? `Agent ${playerName} survived the elimination!` : `Agent ${winner?.name} is the sole survivor!`}
            </p>
          </div>
          <div className="bg-gray-900 rounded-lg p-3 sm:p-6 mb-6 sm:mb-8">
            <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 text-center">FINAL AGENT STATUS</h3>
            <div className="space-y-2 sm:space-y-3">
              {results.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 sm:p-4 rounded-lg ${
                    index === 0 ? 'bg-green-600' : player.isAlive ? 'bg-gray-700' : 'bg-red-900'
                  }`}>
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <span className="text-lg sm:text-2xl">
                      {index === 0 ? '🏆' : player.isAlive ? '💚' : '☠️'}
                    </span>
                    <div>
                      <div className="font-bold text-white text-sm sm:text-base">
                        #{index + 1} {generateCodename(player.name, index)}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-300">
                        {player.health} HP • {player.isAlive ? 'SURVIVOR' : 'ELIMINATED'}
                      </div>
                    </div>
                  </div>
                  {index === 0 && (
                    <div className="text-yellow-400 font-bold text-sm sm:text-base">WINNER</div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
            <Button onClick={() => window.location.reload()} variant="primary" className="flex-1 text-sm sm:text-base py-2 sm:py-3">
              New Survival Mission
            </Button>
            <Button onClick={handleCancel} variant="secondary" className="flex-1 text-sm sm:text-base py-2 sm:py-3">
              Back to Main Menu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-20 flex min-h-screen items-center justify-center">
      <LoadingSpinner size="lg" message="Initializing survival mode..." />
    </div>
  );
};

export default CodenameSurvival;
