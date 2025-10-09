import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import HintDisplay from '../game/HintDisplay';
import GuessInput from '../game/GuessInput';
import Timer from '../common/Timer';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import ModeSelector from '../game/ModeSelector';
import CategorySelector from '../game/CategorySelector';
import CategoryService from '../../services/CategoryService';
import MissionTracker from '../game/MissionTracker';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:10000';

const OneVsOneMultiplayer = ({ playerName, onBackToMenu }) => {
  const [gameState, setGameState] = useState('mode-selection');
  const [gameData, setGameData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [currentTarget, setCurrentTarget] = useState(null);
  const [hints, setHints] = useState([]);
  const [gameResult, setGameResult] = useState(null);
  const [health, setHealth] = useState({});
  const [finalHealth, setFinalHealth] = useState({});
  const [connectionError, setConnectionError] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [selectedMode, setSelectedMode] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking');
  const [playerStats, setPlayerStats] = useState({});
  const [serverUrl, setServerUrl] = useState(backendUrl);

  const socketRef = useRef(null);
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);

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

  const initializePlayerStats = (players) => {
    const initialStats = {};
    players.forEach(player => {
      initialStats[player.id] = {
        correctAnswers: 0,
        mistakes: 0,
        name: player.name
      };
    });
    setPlayerStats(initialStats);
  };

  const updatePlayerStats = (playerId, isCorrect) => {
    setPlayerStats(prev => {
      const updated = {
        ...prev,
        [playerId]: {
          ...prev[playerId],
          correctAnswers: prev[playerId]?.correctAnswers + (isCorrect ? 1 : 0),
          mistakes: prev[playerId]?.mistakes + (isCorrect ? 0 : 1)
        }
      };
      return updated;
    });
  };

  const HealthBar = ({ playerId, playerName, isMe = false }) => {
    const currentHealth = health[playerId] || 0;
    const maxHealth = 5000;
    const healthPercentage = (currentHealth / maxHealth) * 100;

    const getHealthColor = () => {
      if (healthPercentage > 75) return isMe ? 'from-green-500 to-green-400' : 'from-red-500 to-red-400';
      if (healthPercentage > 50) return isMe ? 'from-yellow-500 to-yellow-400' : 'from-purple-500 to-purple-400';
      if (healthPercentage > 25) return isMe ? 'from-orange-500 to-orange-400' : 'from-pink-500 to-pink-400';
      return 'from-red-500 to-red-400';
    };

    const getBorderColor = () => {
      return isMe ? 'border-green-400' : 'border-red-400';
    };

    return (
      <div className="relative w-full">
        <div className="mb-2 text-center">
          <span className={`text-xs sm:text-sm font-bold ${isMe ? 'text-green-400' : 'text-red-400'}`}>
            {playerName} {isMe && '(You)'}
          </span>
        </div>
        <div className={`relative w-full h-10 sm:h-12 bg-gray-800 rounded-lg border-2 ${getBorderColor()} overflow-hidden shadow-lg`}>
          <div
            className={`h-full transition-all duration-500 ease-out bg-gradient-to-r ${getHealthColor()}`}
            style={{ width: `${healthPercentage}%` }}
          >
            <div className="absolute inset-0 bg-white bg-opacity-20 rounded-lg"></div>
            {healthPercentage <= 25 && healthPercentage > 0 && (
              <div className="absolute inset-0 bg-white bg-opacity-30 rounded-lg animate-pulse"></div>
            )}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm sm:text-lg font-bold text-white drop-shadow-lg tracking-wider">
              {Math.max(0, currentHealth)} HP
            </span>
          </div>
        </div>
      </div>
    );
  };

  const initializeSocket = async () => {
    if (socketRef.current || initializedRef.current) {
      return;
    }
    setServerUrl(backendUrl);
    setServerStatus('online');
    initializedRef.current = true;

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
      setConnectionError(false);
      setServerStatus('online');
      setGameState('matchmaking');
    });

    socket.on('disconnect', (reason) => {
      if (!mountedRef.current) return;
      if (reason !== 'io client disconnect' && mountedRef.current) {
        setConnectionError(true);
        setServerStatus('offline');
        setGameState('connecting');
      }
    });

    socket.on('connect_error', () => {
      if (!mountedRef.current) return;
      setConnectionError(true);
      setServerStatus('offline');
      setGameState('connecting');
    });

    socket.on('reconnect', () => {
      if (!mountedRef.current) return;
      setConnectionError(false);
      setServerStatus('online');
      setGameState('matchmaking');
    });

    socket.on('reconnect_error', () => {
      if (!mountedRef.current) return;
      setConnectionError(true);
      setServerStatus('offline');
    });

    socket.on('reconnect_failed', () => {
      if (!mountedRef.current) return;
      setConnectionError(true);
      setServerStatus('offline');
    });

    socket.on('waitingForMatch', () => {
      if (!mountedRef.current) return;
      setGameState('waiting');
    });

    socket.on('matchFound', ({ players: matchedPlayers, categoryInfo }) => {
      if (!mountedRef.current) return;

      setPlayers(matchedPlayers);
      setGameState('playing');
      setHealth(matchedPlayers.reduce((acc, p) => ({ ...acc, [p.id]: 5000 }), {}));
      if (categoryInfo) {
        setCurrentTarget(prev => ({ ...prev, categoryInfo }));
      }
      initializePlayerStats(matchedPlayers);
    });

    socket.on('questionStart', ({ targetIndex, totalTargets, category, difficulty, health: newHealth }) => {
      if (!mountedRef.current) return;
      setCurrentTarget({ targetIndex, totalTargets, category, difficulty });
      setHints([]);
      setGameResult(null);
      if (newHealth) setHealth(newHealth);
    });

    socket.on('hintRevealed', ({ index, text, health: newHealth }) => {
      if (!mountedRef.current) return;
      setHints(prev => [{ index, text }, ...prev]);
      if (newHealth) setHealth(newHealth);
    });

    socket.on('healthUpdate', ({ health: newHealth }) => {
      if (!mountedRef.current) return;
      setHealth(newHealth);
    });

    socket.on('questionResult', ({ winner, winnerName, correctAnswer, timeElapsed, health: newHealth, hintCount, healthLoss }) => {
      if (!mountedRef.current) return;
      if (newHealth) setHealth(newHealth);
      if (winner) {
        updatePlayerStats(winner, true);
      }
      const actualHealthLoss = healthLoss || damageByHint(hintCount || hints.length || 1);
      setGameResult({
        winner,
        winnerName,
        correctAnswer,
        timeElapsed,
        healthLoss: actualHealthLoss,
        hintCount: hintCount || hints.length || 1
      });
    });

    socket.on('wrongAnswer', ({ playerId, playerName, guess }) => {
      if (!mountedRef.current) return;
      if (playerId) {
        updatePlayerStats(playerId, false);
      }
      setGameResult({
        winner: null,
        incorrectGuess: guess,
        incorrectPlayer: playerName,
        correctAnswer: null,
        isWrongAnswer: true
      });
      setTimeout(() => {
        if (mountedRef.current) {
          setGameResult(null);
        }
      }, 3000);
    });

    socket.on('playerEliminated', ({ eliminatedPlayer, eliminatedPlayerName, health: newHealth }) => {
      if (!mountedRef.current) return;
      if (newHealth) setHealth(newHealth);
      setGameResult({
        winner: 'elimination',
        message: `${eliminatedPlayerName} has been eliminated!`,
        eliminatedPlayer
      });
    });

    socket.on('gameEnd', ({ results }) => {
      if (!mountedRef.current) return;
      setFinalHealth({...health});
      setGameState('finished');
      setGameData({ results });
    });

    socket.on('playerDisconnected', () => {
      if (!mountedRef.current) return;
      setGameResult({
        winner: 'disconnect',
        message: 'Your opponent disconnected. You win by default!'
      });
      setTimeout(() => {
        if (mountedRef.current) {
          setGameState('finished');
          setGameData({
            results: [
              { id: myPlayerId, name: playerName, health: health[myPlayerId] || 0, isAlive: true },
              { id: 'opponent', name: 'Opponent', health: 0, isAlive: false }
            ].sort((a, b) => b.health - a.health)
          });
        }
      }, 3000);
    });
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.close();
        socketRef.current = null;
      }
      initializedRef.current = false;
    };
  }, []);

  const handleModeSelect = (mode) => {
    setSelectedMode(mode);
    if (mode === 'general') {
      const generalCategory = CategoryService.getGeneralCategory();
      setSelectedCategory(generalCategory);
      setGameState('connecting');
      initializeSocket();
    } else if (mode === 'category') {
      setGameState('category-selection');
    }
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setGameState('connecting');
    initializeSocket();
  };

  const handleBackToModeSelection = () => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.close();
      socketRef.current = null;
    }
    initializedRef.current = false;
    setSelectedMode(null);
    setSelectedCategory(null);
    setConnectionError(false);
    setServerStatus('checking');
    setPlayerStats({});
    setServerUrl(backendUrl);
    setFinalHealth({});
    setGameState('mode-selection');
  };

  const findMatch = () => {
    if (!socketRef.current?.connected) {
      setConnectionError(true);
      return;
    }
    socketRef.current.emit('findMatch', {
      playerName,
      gameMode: selectedMode,
      personalCategory: selectedCategory?.id || 'general',
      personalCategoryName: selectedCategory?.name || 'General Knowledge'
    });
    setGameState('waiting');
  };

  const submitGuess = (guess) => {
    if (!socketRef.current?.connected || gameState !== 'playing') {
      return;
    }
    const myHealth = health[myPlayerId] || 0;
    if (myHealth <= 0) {
      return;
    }
    socketRef.current.emit('submitGuess', { guess });
  };

  const handleCancel = () => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.close();
      socketRef.current = null;
    }
    initializedRef.current = false;
    onBackToMenu();
  };

  const retryConnection = async () => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.close();
      socketRef.current = null;
    }
    initializedRef.current = false;
    setConnectionError(false);
    setServerStatus('checking');
    setServerUrl(backendUrl);
    setGameState('connecting');
    setTimeout(() => {
      initializeSocket();
    }, 1000);
  };

  const getModeDisplayName = () => {
    if (!selectedMode) return 'Unknown';
    switch (selectedMode) {
      case 'general':
        return 'Quick Mission';
      case 'category':
        return 'Under Cover Mission';
      default:
        return selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1);
    }
  };

  const getServerDisplayName = () => {
    if (!serverUrl) return 'Unknown';
    if (serverUrl.includes('localhost')) return 'Local Development';
    return 'Production';
  };

  const getPlayerNameById = (playerId) => {
    if (playerId === myPlayerId) return playerName;
    const player = players.find(p => p.id === playerId);
    if (player) return player.name;
    const playerFromStats = Object.values(playerStats).find(stats => stats.id === playerId);
    if (playerFromStats) return playerFromStats.name;
    return 'Opponent';
  };

  const getFinalHealthForPlayer = (playerId) => {
    return finalHealth[playerId] || health[playerId] || 0;
  };

  if (gameState === 'mode-selection') {
    return (
      <ModeSelector
        onModeSelect={handleModeSelect}
        onBack={onBackToMenu}
        playerName={playerName}
      />
    );
  }

  if (gameState === 'category-selection') {
    return (
      <CategorySelector
        onCategorySelect={handleCategorySelect}
        onBack={handleBackToModeSelection}
        selectedCategory={selectedCategory}
      />
    );
  }

  if (connectionError || serverStatus === 'offline') {
    return (
      <div className="relative z-20 flex min-h-screen items-center justify-center p-3 sm:p-4">
        <div className="bg-white p-4 sm:p-8 rounded-lg shadow-2xl max-w-xs sm:max-w-md w-full text-black text-center border border-gray-200">
          <h2 className="text-lg sm:text-2xl font-bold text-red-600 mb-3 sm:mb-4 font-spy">SERVER UNAVAILABLE</h2>
          <p className="mb-3 sm:mb-4 text-sm sm:text-base">No multiplayer servers are currently available.</p>
          <div className="bg-yellow-100 border border-yellow-300 rounded p-2 sm:p-3 mb-4 sm:mb-6">
            <p className="text-xs sm:text-sm text-yellow-800">
              <strong>🚨 Servers Checked:</strong><br />
              • Local Development (localhost:10000)<br />
              • Production (hintman-backend.onrender.com)<br /><br />
              <strong>Solutions:</strong><br />
              • Start your local backend server<br />
              • Wait for production server to wake up<br />
              • Try the Single Player mode instead
            </p>
          </div>
          {selectedMode && (
            <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-gray-100 rounded-lg">
              <p className="text-xs sm:text-sm text-gray-700">
                Selected Mode: <strong>{getModeDisplayName()}</strong>
                {selectedCategory && selectedMode === 'category' && (
                  <>
                    <br />
                    Personal Preference: <strong>{selectedCategory.name}</strong>
                  </>
                )}
              </p>
            </div>
          )}
          <div className="space-y-2 sm:space-y-3">
            <Button onClick={retryConnection} variant="primary" className="w-full text-sm sm:text-base py-2 sm:py-3">
              Retry Connection
            </Button>
            <Button onClick={handleBackToModeSelection} variant="secondary" className="w-full text-sm sm:text-base py-2 sm:py-3">
              Back to Mode Selection
            </Button>
            <Button onClick={onBackToMenu} variant="secondary" className="w-full text-sm sm:text-base py-2 sm:py-3">
              Try Single Player
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'connecting' || serverStatus === 'checking') {
    return (
      <div className="relative z-20 flex min-h-screen items-center justify-center p-3 sm:p-4">
        <div className="bg-white p-4 sm:p-8 rounded-lg shadow-2xl max-w-xs sm:max-w-md w-full text-black text-center border border-gray-200">
          <LoadingSpinner size="lg" message={serverStatus === 'checking' ? 'Finding best server...' : `Connecting to ${getServerDisplayName()}...`} />
          <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base">
            {serverStatus === 'checking' ? 'Testing localhost and production servers...' : 'Establishing secure connection...'}
          </p>
          {selectedMode && (
            <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-gray-100 rounded-lg">
              <p className="text-xs sm:text-sm text-gray-700">
                <strong>{getModeDisplayName()}</strong>
                {selectedCategory && selectedMode === 'category' && (
                  <>
                    <br />
                    <span className="mr-2">{selectedCategory.icon}</span>
                    Personal preference: {selectedCategory.name}
                  </>
                )}
              </p>
            </div>
          )}
          {serverUrl && (
            <div className="mt-2 p-2 bg-blue-100 rounded text-xs text-blue-800">
              🔗 Using: {getServerDisplayName()}
            </div>
          )}
          <Button onClick={handleBackToModeSelection} variant="secondary" className="mt-3 sm:mt-4 w-full text-sm sm:text-base py-2 sm:py-3">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === 'matchmaking') {
    return (
      <div className="relative z-20 flex min-h-screen items-center justify-center p-3 sm:p-4">
        <div className="max-w-xl sm:max-w-2xl w-full mx-2 sm:mx-4">
          {/* Title Section */}
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6 font-spy tracking-wider drop-shadow-2xl">
              {getModeDisplayName().toUpperCase()}
            </h2>
            <p className="text-gray-200 text-lg sm:text-xl drop-shadow-lg mb-6 sm:mb-8 px-2">
              Agent {playerName}, ready for combat?
            </p>
          </div>

          {/* Mission Rules - Pure Floating Text Elements */}
          <div className="space-y-4 sm:space-y-6 mb-8 sm:mb-12 px-2">
            <div className="flex items-start space-x-3 sm:space-x-4">
              <span className="text-red-400 text-xl sm:text-2xl drop-shadow-lg flex-shrink-0">🎯</span>
              <div className="min-w-0">
                <span className="font-semibold text-red-400 text-base sm:text-lg drop-shadow-lg">Mission Type:</span>
                <span className="text-white text-base sm:text-lg ml-2 sm:ml-3 drop-shadow-lg break-words">{getModeDisplayName()}</span>
              </div>
            </div>

            {selectedMode === 'category' && selectedCategory && (
              <div className="flex items-start space-x-3 sm:space-x-4">
                <span className="text-red-400 text-xl sm:text-2xl drop-shadow-lg flex-shrink-0">🎭</span>
                <div className="min-w-0">
                  <span className="font-semibold text-red-400 text-base sm:text-lg drop-shadow-lg">Your Specialty:</span>
                  <span className="text-white text-base sm:text-lg ml-2 sm:ml-3 drop-shadow-lg break-words">{selectedCategory.name}</span>
                </div>
              </div>
            )}

            <div className="flex items-start space-x-3 sm:space-x-4">
              <span className="text-red-400 text-xl sm:text-2xl drop-shadow-lg flex-shrink-0">💡</span>
              <div className="min-w-0">
                <span className="font-semibold text-red-400 text-base sm:text-lg drop-shadow-lg">Intelligence:</span>
                <span className="text-white text-base sm:text-lg ml-2 sm:ml-3 drop-shadow-lg break-words">Hints are FREE! Wait for clues or answer fast</span>
              </div>
            </div>

            <div className="flex items-start space-x-3 sm:space-x-4">
              <span className="text-red-400 text-xl sm:text-2xl drop-shadow-lg flex-shrink-0">⚡</span>
              <div className="min-w-0">
                <span className="font-semibold text-red-400 text-base sm:text-lg drop-shadow-lg">Speed matters:</span>
                <span className="text-white text-base sm:text-lg ml-2 sm:ml-3 drop-shadow-lg break-words">Earlier answers deal more damage</span>
              </div>
            </div>

            <div className="flex items-start space-x-3 sm:space-x-4">
              <span className="text-red-400 text-xl sm:text-2xl drop-shadow-lg flex-shrink-0">❌</span>
              <div className="min-w-0">
                <span className="font-semibold text-red-400 text-base sm:text-lg drop-shadow-lg">No penalties</span>
                <span className="text-white text-base sm:text-lg ml-2 sm:ml-3 drop-shadow-lg break-words">for wrong answers</span>
              </div>
            </div>

            <div className="flex items-start space-x-3 sm:space-x-4">
              <span className="text-red-400 text-xl sm:text-2xl drop-shadow-lg flex-shrink-0">🏆</span>
              <div className="min-w-0">
                <span className="font-semibold text-red-400 text-base sm:text-lg drop-shadow-lg">Victory:</span>
                <span className="text-white text-base sm:text-lg ml-2 sm:ml-3 drop-shadow-lg break-words">Survive with the most health (or last agent standing)</span>
              </div>
            </div>
          </div>

          {/* Connection Status and Buttons */}
          <div className="text-center px-2">
            <div className="flex items-center justify-center mb-6 sm:mb-8">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2 drop-shadow-lg"></div>
              <span className="text-sm text-green-400 drop-shadow-lg">Connected to {getServerDisplayName()}</span>
            </div>

            <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6">
              <Button
                onClick={findMatch}
                size="lg"
                className="w-full sm:w-auto px-8 sm:px-16 py-3 sm:py-4 bg-red-800/90 hover:bg-red-700/90 backdrop-blur-sm border border-red-700/60 hover:border-red-600/80 text-white text-base sm:text-lg font-semibold rounded-xl transition-all duration-300 shadow-2xl hover:shadow-red-900/30"
              >
                🎯 FIND OPPONENT
              </Button>

              <Button
                onClick={handleBackToModeSelection}
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto px-8 sm:px-16 py-3 sm:py-4 bg-gray-800/90 hover:bg-gray-700/90 backdrop-blur-sm border border-gray-700/60 hover:border-gray-600/80 text-white text-base sm:text-lg font-semibold rounded-xl transition-all duration-300 shadow-2xl hover:shadow-gray-900/30"
              >
                🏠 Change Mission Type
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'waiting') {
    return (
      <div className="relative z-20 flex min-h-screen items-center justify-center p-3 sm:p-4">
        <div className="bg-white p-4 sm:p-8 rounded-lg shadow-2xl max-w-xs sm:max-w-md w-full text-black text-center border border-gray-200">
          <LoadingSpinner size="lg" message="Searching for opponent..." />
          <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base">Finding another {getModeDisplayName()} player...</p>
          {selectedMode && (
            <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-gray-100 rounded-lg">
              <p className="text-xs sm:text-sm text-gray-700">
                <strong>{getModeDisplayName()}</strong>
                {selectedCategory && selectedMode === 'category' && (
                  <>
                    <br />
                    <span className="mr-2">{selectedCategory.icon}</span>
                    Your specialty: {selectedCategory.name}
                  </>
                )}
              </p>
            </div>
          )}
          <Button onClick={() => setGameState('matchmaking')} variant="secondary" className="mt-4 sm:mt-6 w-full text-sm sm:text-base py-2 sm:py-3">
            Cancel Search
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    const results = gameData?.results || [];
    const winner = results[0];
    const loser = results[1] || results.find(p => !p.isAlive);
    const isWinner = winner?.name === playerName;
    const totalRoundsCompleted = Math.min(10, Math.max(1, currentTarget?.targetIndex || 1));

    const myStats = playerStats[myPlayerId] || { correctAnswers: 0, mistakes: 0 };
    const opponentStats = Object.values(playerStats).find(stats => stats.name !== playerName) || { correctAnswers: 0, mistakes: 0 };

    // Get actual final health values
    const winnerFinalHealth = getFinalHealthForPlayer(winner?.id) || winner?.health || 0;
    const loserFinalHealth = loser ? (getFinalHealthForPlayer(loser.id) || loser.health || 0) : 0;

    return (
      <div className="relative z-20 flex min-h-screen items-center justify-center p-3 sm:p-4">
        <div className="bg-white p-4 sm:p-8 rounded-lg shadow-2xl max-w-sm sm:max-w-4xl w-full text-black border border-gray-200">
          {/* Header Section */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">
              {isWinner ? '🏆' : '☠️'}
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-red-600 mb-2 font-spy">
              {isWinner ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED'}
            </h1>
            <p className="text-lg sm:text-xl mb-2 text-gray-800">
              {isWinner ? `Congratulations Agent ${playerName}!` : `Agent ${winner?.name} completed the mission.`}
            </p>
            <p className="text-xs sm:text-sm text-gray-600">
              <strong>{getModeDisplayName()}</strong>
              {selectedCategory && selectedMode === 'category' && (
                <>
                  {' '}• Your specialty: {selectedCategory.icon} {selectedCategory.name}
                </>
              )}
              {' '}• Completed {totalRoundsCompleted} out of {selectedMode === 'category' ? 10 : 5} targets
            </p>
          </div>

          {/* Results Section - OneVsOne Style with Green Victor Card */}
          <div className="bg-gray-900 rounded-lg p-3 sm:p-6 mb-6 sm:mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Winner - Green Card */}
              <div className="text-center">
                <div className="text-3xl sm:text-4xl mb-2">🏆</div>
                <h3 className="text-xl sm:text-2xl font-bold text-green-400 mb-2 font-spy">VICTOR</h3>
                <div className="bg-green-500 text-white rounded-lg p-3 sm:p-4">
                  <h4 className="text-lg sm:text-xl font-bold">{winner?.name || getPlayerNameById(winner?.id) || 'Unknown'}</h4>
                  <div className="text-2xl sm:text-3xl font-bold mt-2">{winnerFinalHealth} HP</div>
                  <div className="text-xs sm:text-sm mt-2">
                    ✅ {winner?.name === playerName ? myStats.correctAnswers : opponentStats.correctAnswers} correct
                    • ❌ {winner?.name === playerName ? myStats.mistakes : opponentStats.mistakes} mistakes
                  </div>
                </div>
              </div>

              {/* Loser - Red Card */}
              <div className="text-center">
                <div className="text-3xl sm:text-4xl mb-2">☠️</div>
                <h3 className="text-xl sm:text-2xl font-bold text-red-400 mb-2 font-spy">ELIMINATED</h3>
                <div className="bg-red-600 text-white rounded-lg p-3 sm:p-4">
                  <h4 className="text-lg sm:text-xl font-bold">{loser?.name || getPlayerNameById(loser?.id) || 'Opponent'}</h4>
                  <div className="text-2xl sm:text-3xl font-bold mt-2">{loserFinalHealth} HP</div>
                  <div className="text-xs sm:text-sm mt-2">
                    ✅ {loser?.name === playerName ? myStats.correctAnswers : opponentStats.correctAnswers} correct
                    • ❌ {loser?.name === playerName ? myStats.mistakes : opponentStats.mistakes} mistakes
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
            <Button onClick={() => {
              if (socketRef.current) {
                socketRef.current.removeAllListeners();
                socketRef.current.close();
                socketRef.current = null;
              }
              initializedRef.current = false;
              handleBackToModeSelection();
            }} variant="primary" className="flex-1 text-sm sm:text-base py-2 sm:py-3">
              NEW MATCH
            </Button>
            <Button onClick={handleCancel} variant="secondary" className="flex-1 text-sm sm:text-base py-2 sm:py-3">
              BACK TO HQ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'playing' && currentTarget) {
    const opponent = players.find(p => p.name !== playerName);
    const myHealth = health[players.find(p => p.name === playerName)?.id] || 5000;

    const myStats = playerStats[myPlayerId] || { correctAnswers: 0, mistakes: 0 };
    const opponentStats = playerStats[opponent?.id] || { correctAnswers: 0, mistakes: 0 };

    return (
      <div className="relative z-20 min-h-screen p-2 sm:p-4">
        <div className="max-w-6xl mx-auto">
          {/* Game Header */}
          <div className="bg-black bg-opacity-90 p-3 sm:p-6 rounded-lg mb-4 sm:mb-6 border border-red-600">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 space-y-3 sm:space-y-0">
              <div className="text-white text-sm sm:text-base">
                <h2 className="text-lg sm:text-xl font-spy">TARGET: {currentTarget.targetIndex} / {currentTarget.totalTargets}</h2>
                <p className="text-xs sm:text-sm text-gray-300">
                  {currentTarget.category} • {getModeDisplayName()}
                  {selectedCategory && selectedMode === 'category' && (
                    <> • Your specialty: {selectedCategory.icon} {selectedCategory.name}</>
                  )}
                  {opponent?.personalCategory && selectedMode === 'category' && (
                    <> • Opponent: {opponent.personalCategory}</>
                  )}
                </p>
                <p className="text-xs text-gray-400">
                  Hint {hints.length}/{5} • Damage: {damageByHint(hints.length || 1)} HP
                </p>
              </div>
              <div className="w-full sm:w-auto flex justify-center">
                <Timer
                  duration={120}
                  isActive={true}
                  key={`timer-${currentTarget.targetIndex}`}
                />
              </div>
            </div>

            {/* Health Panels */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
              <div className="bg-gray-900 p-3 sm:p-4 rounded-lg border-2 border-green-400">
                <HealthBar
                  playerId={players.find(p => p.name === playerName)?.id}
                  playerName={playerName}
                  isMe={true}
                />
              </div>
              <div className="bg-gray-900 p-3 sm:p-4 rounded-lg border-2 border-red-400">
                <HealthBar
                  playerId={opponent?.id}
                  playerName={opponent?.name || 'Opponent'}
                  isMe={false}
                />
              </div>
            </div>

            {/* Mission Trackers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <MissionTracker
                correctAnswers={myStats.correctAnswers}
                mistakes={myStats.mistakes}
                playerName={playerName}
                isMyTracker={true}
              />
              <MissionTracker
                correctAnswers={opponentStats.correctAnswers}
                mistakes={opponentStats.mistakes}
                playerName={opponent?.name}
                isMyTracker={false}
              />
            </div>
          </div>

          {/* Fixed Position Result Message */}
          <div className="relative mb-4 sm:mb-6">
            <div className="h-16 sm:h-20">
              {gameResult && (
                <div className={`absolute top-0 left-0 right-0 p-3 sm:p-4 rounded-lg border-2 transition-all duration-300 ease-in-out ${
                  gameResult.winner === players.find(p => p.name === playerName)?.id ? 'bg-green-900 border-green-500' :
                  gameResult.winner && gameResult.winner !== 'disconnect' && gameResult.winner !== 'elimination' ? 'bg-red-900 border-red-500' :
                  gameResult.winner === 'disconnect' ? 'bg-blue-900 border-blue-500' :
                  gameResult.winner === 'elimination' ? 'bg-purple-900 border-purple-500' :
                  gameResult.isWrongAnswer ? 'bg-yellow-900 border-yellow-500' :
                  'bg-yellow-900 border-yellow-500'
                }`}>
                  <div className="text-center text-white">
                    {gameResult.winner === players.find(p => p.name === playerName)?.id && (
                      <p className="text-sm sm:text-lg font-bold">🎯 PERFECT SHOT! Opponent loses {gameResult.healthLoss} HP (hint {gameResult.hintCount})</p>
                    )}
                    {gameResult.winner && gameResult.winner !== players.find(p => p.name === playerName)?.id && gameResult.winner !== 'disconnect' && gameResult.winner !== 'elimination' && (
                      <p className="text-sm sm:text-lg font-bold">🎯 {gameResult.winnerName} shot the target first! You lose {gameResult.healthLoss} HP (hint {gameResult.hintCount})</p>
                    )}
                    {gameResult.winner === 'disconnect' && (
                      <p className="text-sm sm:text-lg font-bold">🏆 {gameResult.message}</p>
                    )}
                    {gameResult.winner === 'elimination' && (
                      <p className="text-sm sm:text-lg font-bold">☠️ {gameResult.message}</p>
                    )}
                    {gameResult.isWrongAnswer && gameResult.incorrectGuess && (
                      <p className="text-sm sm:text-lg font-bold">❌ {gameResult.incorrectPlayer} missed shot: "{gameResult.incorrectGuess}" - No penalties!</p>
                    )}
                    {!gameResult.winner && gameResult.incorrectGuess && !gameResult.isWrongAnswer && (
                      <p className="text-sm sm:text-lg font-bold">❌ Missed shot: "{gameResult.incorrectGuess}" - No penalties, keep trying!</p>
                    )}
                    {gameResult.correctAnswer && (
                      <p className="text-xs sm:text-sm mt-2">The target was: <strong>{gameResult.correctAnswer}</strong></p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Game Content */}
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
                disabled={gameResult?.winner && gameResult.winner !== 'disconnect' || myHealth <= 0}
                placeholder={myHealth <= 0 ? "You have been eliminated..." : "Take your shot (be precise)..."}
                key={`input-${currentTarget.targetIndex}`}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-20 flex min-h-screen items-center justify-center">
      <LoadingSpinner size="lg" message="Initializing multiplayer..." />
    </div>
  );
};

export default OneVsOneMultiplayer;
