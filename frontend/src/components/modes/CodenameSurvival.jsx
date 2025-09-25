import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import HintDisplay from '../game/HintDisplay';
import GuessInput from '../game/GuessInput';
import Timer from '../common/Timer';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import CategoryService from '../../services/CategoryService';

const CodenameSurvival = ({ playerName, onBackToMenu }) => {
  console.log('🎯 CodenameSurvival component loaded for player:', playerName);

  // Start directly at connecting state for survival mode
  const [gameState, setGameState] = useState('connecting');
  const [gameData, setGameData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [currentTarget, setCurrentTarget] = useState(null);
  const [hints, setHints] = useState([]);
  const [gameResult, setGameResult] = useState(null);
  const [health, setHealth] = useState({});
  const [connectionError, setConnectionError] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking');
  const [survivalRound, setSurvivalRound] = useState(1);
  const [serverUrl, setServerUrl] = useState(null);

  const socketRef = useRef(null);
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);

  // Survival mode damage system - escalates with fewer players
  const getSurvivalDamage = (playersRemaining, isWrongAnswer = false) => {
    if (isWrongAnswer) {
      switch (playersRemaining) {
        case 6:
        case 5: return 800;
        case 4: return 1000;
        case 3: return 1200;
        case 2: return 1500;
        default: return 2000;
      }
    }

    switch (playersRemaining) {
      case 6:
      case 5: return 50;
      case 4: return 75;
      case 3: return 100;
      case 2: return 150;
      default: return 200;
    }
  };

  // Generate agent codenames
  const generateCodename = (name, index) => {
    const prefixes = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
    return `${prefixes[index % prefixes.length]}-${name}`;
  };

  const getHealthStatus = (currentHealth) => {
    const percentage = (currentHealth / 5000) * 100;
    if (percentage <= 0) return { status: 'eliminated', color: 'text-red-500', icon: '☠️' };
    if (percentage <= 20) return { status: 'critical', color: 'text-red-400', icon: '⚠️' };
    if (percentage <= 40) return { status: 'wounded', color: 'text-orange-400', icon: '🩸' };
    if (percentage <= 60) return { status: 'injured', color: 'text-yellow-400', icon: '⚡' };
    return { status: 'healthy', color: 'text-green-400', icon: '💚' };
  };

  const AgentsList = () => {
    const alivePlayers = players.filter(p => (health[p.id] || 0) > 0);
    const deadPlayers = players.filter(p => (health[p.id] || 0) <= 0);

    return (
      <div className="bg-gray-900 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white font-spy">AGENT STATUS</h3>
          <div className="text-green-400 font-bold">
            {alivePlayers.length} AGENTS REMAINING
          </div>
        </div>

        {/* Alive Players */}
        <div className="space-y-2">
          {alivePlayers.map((player, index) => {
            const playerHealth = health[player.id] || 5000;
            const healthStatus = getHealthStatus(playerHealth);
            const isMe = player.id === myPlayerId;

            return (
              <div
                key={player.id}
                className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                  isMe ? 'bg-blue-900 border-blue-400' : 'bg-gray-800 border-gray-600'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{healthStatus.icon}</span>
                  <div>
                    <div className="font-bold text-white">
                      {generateCodename(player.name, index)}
                      {isMe && <span className="text-blue-400 ml-2">(YOU)</span>}
                    </div>
                    <div className={`text-sm ${healthStatus.color}`}>
                      {playerHealth} HP • {healthStatus.status.toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* Health Bar */}
                <div className="w-24">
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        healthStatus.status === 'healthy' ? 'bg-green-500' :
                        healthStatus.status === 'injured' ? 'bg-yellow-500' :
                        healthStatus.status === 'wounded' ? 'bg-orange-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${(playerHealth / 5000) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Eliminated Players */}
        {deadPlayers.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <h4 className="text-sm font-bold text-red-400 mb-2">ELIMINATED AGENTS</h4>
            <div className="space-y-1">
              {deadPlayers.map((player) => (
                <div key={player.id} className="flex items-center space-x-3 p-2 bg-red-900 rounded">
                  <span className="text-lg">☠️</span>
                  <span className="text-red-300 line-through">
                    {generateCodename(player.name, players.indexOf(player))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const detectBestServer = async () => {
    const servers = [
      'http://localhost:10000',
      'https://hintman-backend.onrender.com'
    ];

    for (const server of servers) {
      try {
        const response = await fetch(`${server}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(3000),
        });

        if (response.ok) {
          console.log('🎯 Found working server:', server);
          return server;
        }
      } catch (error) {
        console.log('🎯 Server failed:', server, error.message);
        continue;
      }
    }

    return null;
  };

  const initializeSocket = async () => {
    if (socketRef.current || initializedRef.current) {
      console.log('🎯 Socket already initialized, skipping');
      return;
    }

    console.log('🎯 Starting socket initialization...');

    try {
      const availableServer = await detectBestServer();

      if (!availableServer) {
        console.log('🎯 No servers available');
        setConnectionError(true);
        setServerStatus('offline');
        return;
      }

      setServerUrl(availableServer);
      setServerStatus('online');
      initializedRef.current = true;

      console.log('🎯 Creating socket connection to:', availableServer);

      const socket = io(availableServer, {
        transports: ['polling', 'websocket'],
        timeout: 30000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
        autoConnect: true
      });

      socketRef.current = socket;

      // Socket event handlers
      socket.on('connect', () => {
        if (!mountedRef.current) return;
        console.log('🎯 Socket connected successfully');
        setMyPlayerId(socket.id);
        setConnectionError(false);
        setServerStatus('online');
        setGameState('matchmaking');
      });

      socket.on('disconnect', (reason) => {
        if (!mountedRef.current) return;
        console.log('🎯 Socket disconnected:', reason);
        if (reason !== 'io client disconnect' && mountedRef.current) {
          setConnectionError(true);
          setServerStatus('offline');
          setGameState('connecting');
        }
      });

      socket.on('connect_error', (error) => {
        if (!mountedRef.current) return;
        console.log('🎯 Socket connection error:', error);
        setConnectionError(true);
        setServerStatus('offline');
        setGameState('connecting');
      });

      // Survival-specific events (fallback to regular events if not supported)
      socket.on('waitingForMatch', ({ playersInRoom }) => {
        if (!mountedRef.current) return;
        console.log('🎯 Waiting for match, players in room:', playersInRoom);
        setGameState('waiting');
        setGameData({ playersInRoom });
      });

      socket.on('matchFound', ({ players: matchedPlayers }) => {
        if (!mountedRef.current) return;
        console.log('🎯 Match found with players:', matchedPlayers);
        setPlayers(matchedPlayers);
        setGameState('briefing');
        setHealth(matchedPlayers.reduce((acc, p) => ({ ...acc, [p.id]: 5000 }), {}));
      });

      socket.on('gameStart', ({ round }) => {
        if (!mountedRef.current) return;
        console.log('🎯 Game started, round:', round);
        setSurvivalRound(round);
        setGameState('playing');
      });

      socket.on('questionStart', ({ targetIndex, totalTargets, category, difficulty, health: newHealth, round }) => {
        if (!mountedRef.current) return;
        console.log('🎯 Question started:', { targetIndex, category, round });
        setCurrentTarget({ targetIndex, totalTargets, category, difficulty });
        setHints([]);
        setGameResult(null);
        setSurvivalRound(round);
        if (newHealth) setHealth(newHealth);
      });

      socket.on('hintRevealed', ({ index, text, health: newHealth }) => {
        if (!mountedRef.current) return;
        console.log('🎯 Hint revealed:', index, text);
        setHints(prev => [{ index, text }, ...prev]);
        if (newHealth) setHealth(newHealth);
      });

      socket.on('questionResult', ({ winner, winnerName, correctAnswer, health: newHealth }) => {
        if (!mountedRef.current) return;
        console.log('🎯 Question result:', { winner, winnerName, correctAnswer });
        if (newHealth) setHealth(newHealth);

        setGameResult({
          winner,
          winnerName,
          correctAnswer,
          type: 'correct'
        });
      });

      socket.on('wrongAnswer', ({ playerId, playerName, guess, damage, health: newHealth }) => {
        if (!mountedRef.current) return;
        console.log('🎯 Wrong answer:', { playerId, playerName, guess, damage });
        if (newHealth) setHealth(newHealth);

        setGameResult({
          type: 'wrong',
          playerId,
          playerName,
          guess,
          damage
        });

        setTimeout(() => {
          if (mountedRef.current) {
            setGameResult(null);
          }
        }, 3000);
      });

      socket.on('playerEliminated', ({ eliminatedPlayerName, health: newHealth, playersRemaining }) => {
        if (!mountedRef.current) return;
        console.log('🎯 Player eliminated:', { eliminatedPlayerName, playersRemaining });
        if (newHealth) setHealth(newHealth);

        setGameResult({
          type: 'elimination',
          eliminatedPlayerName,
          playersRemaining
        });

        setTimeout(() => {
          if (mountedRef.current) {
            setGameResult(null);
          }
        }, 3000);
      });

      socket.on('gameEnd', ({ winner, results }) => {
        if (!mountedRef.current) return;
        console.log('🎯 Game ended:', { winner, results });
        setGameState('finished');
        setGameData({ winner, results });
      });

      socket.on('playerDisconnected', ({ disconnectedPlayer, playersRemaining }) => {
        if (!mountedRef.current) return;
        console.log('🎯 Player disconnected:', { disconnectedPlayer, playersRemaining });
        setGameResult({
          type: 'disconnect',
          message: `Agent ${disconnectedPlayer} disconnected`,
          playersRemaining
        });
      });

    } catch (error) {
      console.error('🎯 Socket initialization failed:', error);
      setConnectionError(true);
      setServerStatus('offline');
    }
  };

  // Auto-initialize on mount - fixed dependencies
  useEffect(() => {
    mountedRef.current = true;
    console.log('🎯 CodenameSurvival useEffect - starting auto-initialization');

    // Start connecting immediately for survival mode
    initializeSocket();

    return () => {
      console.log('🎯 Cleaning up socket connection');
      mountedRef.current = false;
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.close();
        socketRef.current = null;
      }
      initializedRef.current = false;
    };
  }, []); // Empty dependency array - only run once on mount

  const findMatch = () => {
    console.log('🎯 Finding survival match...');
    if (!socketRef.current?.connected) {
      console.log('🎯 Socket not connected, setting connection error');
      setConnectionError(true);
      return;
    }

    // Use general category for survival mode
    const generalCategory = CategoryService.getGeneralCategory();

    console.log('🎯 Emitting findSurvivalMatch event');

    // Try survival-specific event first, fallback to regular findMatch
    if (socketRef.current.listeners('waitingForMatch').length > 0) {
      socketRef.current.emit('findSurvivalMatch', {
        playerName,
        gameMode: 'survival',
        personalCategory: generalCategory?.id || 'general',
        personalCategoryName: generalCategory?.name || 'General Knowledge'
      });
    } else {
      // Fallback to regular findMatch if survival not supported
      console.log('🎯 Fallback to regular findMatch');
      socketRef.current.emit('findMatch', {
        playerName,
        gameMode: 'general', // Use general mode as fallback
        personalCategory: generalCategory?.id || 'general',
        personalCategoryName: generalCategory?.name || 'General Knowledge'
      });
    }

    setGameState('waiting');
  };

  const submitGuess = (guess) => {
    if (!socketRef.current?.connected || gameState !== 'playing') return;

    const myHealth = health[myPlayerId] || 0;
    if (myHealth <= 0) return;

    socketRef.current.emit('submitGuess', { guess });
  };

  const handleCancel = () => {
    console.log('🎯 Cancelling and going BACK TO HQ');
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.close();
      socketRef.current = null;
    }
    initializedRef.current = false;
    onBackToMenu();
  };

  const getServerDisplayName = () => {
    if (!serverUrl) return 'Unknown';
    if (serverUrl.includes('localhost')) return 'Local Development';
    return 'Production';
  };

  console.log('🎯 CodenameSurvival current gameState:', gameState);

  if (connectionError || serverStatus === 'offline') {
    console.log('🎯 Rendering connection error screen');
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full text-black text-center border border-gray-200">
          <h2 className="text-2xl font-bold text-red-600 mb-4 font-spy">SURVIVAL HQ OFFLINE</h2>
          <p className="mb-4">Unable to establish connection to survival headquarters.</p>

          <div className="space-y-3">
            <Button onClick={() => window.location.reload()} variant="primary">
              🔄 RETRY CONNECTION
            </Button>
            <Button onClick={onBackToMenu} variant="secondary">
              🏠 BACK TO HQ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'connecting' || serverStatus === 'checking') {
    console.log('🎯 Rendering connecting screen');
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full text-black text-center border border-gray-200">
          <LoadingSpinner size="lg" message="Connecting to Survival HQ..." />
          <p className="mt-4 text-gray-600">Establishing secure channel...</p>
          <p className="mt-2 text-xs text-gray-500">Preparing for battle royale elimination protocol</p>
          <Button onClick={onBackToMenu} variant="secondary" className="mt-6">
            🏠 BACK TO HQ
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === 'matchmaking') {
    console.log('🎯 Rendering matchmaking screen');
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-2xl w-full text-black border border-gray-200">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-red-600 mb-4 font-spy">CODENAME: SURVIVAL</h2>
            <p className="text-lg mb-4 text-gray-800">Agent {playerName}, prepare for elimination protocol</p>

            <div className="bg-gray-900 p-4 rounded text-white text-sm">
              <h3 className="text-red-400 font-bold mb-3">⚠️ MISSION BRIEFING ⚠️</h3>
              <div className="text-left space-y-2">
                <p>🎯 <strong>Objective:</strong> Be the last agent standing</p>
                <p>👥 <strong>Agents:</strong> Up to 6 players maximum</p>
                <p>💀 <strong>Elimination:</strong> Wrong answers cause severe damage</p>
                <p>📈 <strong>Escalation:</strong> Penalties increase as agents fall</p>
                <p>💡 <strong>Strategy:</strong> Hints are free, but time is deadly</p>
                <p>🏆 <strong>Victory:</strong> Survive until the end</p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span className="text-sm text-green-600">Connected to {getServerDisplayName()}</span>
            </div>
            <Button onClick={findMatch} size="lg" className="px-12 mr-4">
              🎯 ENTER SURVIVAL MODE
            </Button>
            <Button onClick={onBackToMenu} variant="secondary" size="lg" className="px-12">
              🏠 BACK TO HQ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'waiting') {
    const playersInRoom = gameData?.playersInRoom || 1;

    console.log('🎯 Rendering waiting screen');
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full text-black text-center border border-gray-200">
          <LoadingSpinner size="lg" message="Recruiting agents..." />
          <p className="mt-4 text-gray-600">Waiting for more agents to join</p>

          <div className="mt-4 p-3 bg-gray-100 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{playersInRoom}/6</div>
            <div className="text-sm text-gray-700">Agents Ready</div>
          </div>

          <div className="mt-4 p-3 bg-blue-100 rounded-lg text-xs text-blue-800">
            <p><strong>Mode:</strong> Battle Royale Survival</p>
            <p><strong>Server:</strong> {getServerDisplayName()}</p>
          </div>

          <p className="mt-2 text-xs text-gray-500">Game starts with 2+ agents (max 6)</p>
          <Button onClick={onBackToMenu} variant="secondary" className="mt-6">
            ABORT MISSION
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === 'briefing') {
    console.log('🎯 Rendering briefing screen');
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-black p-8 rounded-lg shadow-2xl max-w-4xl w-full text-white border-2 border-red-600">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">☠️</div>
            <h1 className="text-4xl font-bold text-red-500 mb-2 font-spy">MISSION: SURVIVAL</h1>
            <p className="text-xl text-gray-300">Elimination Protocol Activated</p>
          </div>

          <AgentsList />

          <div className="bg-red-900 p-4 rounded-lg mb-6">
            <h3 className="text-lg font-bold text-red-300 mb-3">⚠️ SURVIVAL RULES ⚠️</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="mb-2">💀 <strong>Wrong Answer:</strong> Heavy damage</p>
                <p className="mb-2">⏱️ <strong>Time Penalty:</strong> Gradual health loss</p>
                <p className="mb-2">💡 <strong>Hints:</strong> Free, but time costs health</p>
              </div>
              <div>
                <p className="mb-2">📈 <strong>Escalation:</strong> Damage increases as agents fall</p>
                <p className="mb-2">🎯 <strong>Victory:</strong> Last agent standing</p>
                <p className="mb-2">🏆 <strong>Strategy:</strong> Speed and accuracy are key</p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-lg text-gray-300 mb-4">Game starting soon...</p>
            <div className="animate-pulse text-red-500 font-bold">PREPARE FOR ELIMINATION</div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'playing' && currentTarget) {
    const alivePlayers = players.filter(p => (health[p.id] || 0) > 0);
    const myHealth = health[myPlayerId] || 5000;
    const isEliminated = myHealth <= 0;

    console.log('🎯 Rendering playing screen');
    return (
      <div className="relative z-20 min-h-[calc(100vh-120px)] p-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-black bg-opacity-90 p-6 rounded-lg mb-6 border border-red-600">
            <div className="flex justify-between items-center mb-4">
              <div className="text-white">
                <h2 className="text-xl font-spy">SURVIVAL ROUND: {survivalRound}</h2>
                <p className="text-sm text-gray-300">
                  Question {currentTarget.targetIndex} • {currentTarget.category}
                </p>
                <p className="text-xs text-red-400">
                  Damage: {getSurvivalDamage(alivePlayers.length, true)} HP (wrong) • {getSurvivalDamage(alivePlayers.length)} HP/sec
                </p>
              </div>
              <Timer
                duration={120}
                isActive={!isEliminated}
                key={`timer-${currentTarget.targetIndex}`}
              />
            </div>

            <AgentsList />
          </div>

          {/* Fixed Position Game Results - No Layout Shift */}
          <div className="relative mb-6">
            <div className="h-20"> {/* Fixed height container */}
              {gameResult && (
                <div className={`absolute top-0 left-0 right-0 p-4 rounded-lg border-2 transition-all duration-300 ease-in-out ${
                  gameResult.type === 'correct' ? 'bg-green-900 border-green-500' :
                  gameResult.type === 'wrong' ? 'bg-red-900 border-red-500' :
                  gameResult.type === 'elimination' ? 'bg-purple-900 border-purple-500' :
                  'bg-blue-900 border-blue-500'
                }`}>
                  <div className="text-center text-white">
                    {gameResult.type === 'correct' && (
                      <p className="text-lg font-bold">🎯 Agent {gameResult.winnerName} secured the intel!</p>
                    )}
                    {gameResult.type === 'wrong' && (
                      <p className="text-lg font-bold">💥 Agent {gameResult.playerName} missed: "{gameResult.guess}" (-{gameResult.damage} HP)</p>
                    )}
                    {gameResult.type === 'elimination' && (
                      <div>
                        <p className="text-lg font-bold">☠️ AGENT {gameResult.eliminatedPlayerName} HAS BEEN ELIMINATED</p>
                        <p className="text-sm mt-2">{gameResult.playersRemaining} agents remaining</p>
                      </div>
                    )}
                    {gameResult.type === 'disconnect' && (
                      <p className="text-lg font-bold">📡 {gameResult.message} ({gameResult.playersRemaining} remaining)</p>
                    )}
                    {gameResult.correctAnswer && (
                      <p className="text-sm mt-2">The intel was: <strong>{gameResult.correctAnswer}</strong></p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Game Interface */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HintDisplay
              hints={hints}
              totalHints={5}
              key={`hints-${currentTarget.targetIndex}-${hints.length}`}
            />

            <GuessInput
              onSubmit={submitGuess}
              disabled={isEliminated}
              placeholder={isEliminated ? "You have been eliminated..." : "Submit your intel..."}
              key={`input-${currentTarget.targetIndex}`}
            />
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    const winner = gameData?.winner;
    const results = gameData?.results || [];
    const isWinner = winner?.name === playerName;

    console.log('🎯 Rendering finished screen');
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-4xl w-full text-black border border-gray-200">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">
              {isWinner ? '🏆' : '☠️'}
            </div>
            <h1 className="text-4xl font-bold text-red-600 mb-2 font-spy">
              {isWinner ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED'}
            </h1>
            <p className="text-xl text-gray-800">
              {isWinner ? `Agent ${playerName} survived the elimination!` : `Agent ${winner?.name} is the sole survivor!`}
            </p>
          </div>

          <div className="bg-gray-900 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-bold text-white mb-4 text-center">FINAL AGENT STATUS</h3>
            <div className="space-y-3">
              {results.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    index === 0 ? 'bg-green-600' : player.isAlive ? 'bg-gray-700' : 'bg-red-900'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">
                      {index === 0 ? '🏆' : player.isAlive ? '💚' : '☠️'}
                    </span>
                    <div>
                      <div className="font-bold text-white">
                        #{index + 1} {generateCodename(player.name, index)}
                      </div>
                      <div className="text-sm text-gray-300">
                        {player.health} HP • {player.isAlive ? 'SURVIVOR' : 'ELIMINATED'}
                      </div>
                    </div>
                  </div>
                  {index === 0 && (
                    <div className="text-yellow-400 font-bold">WINNER</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex space-x-4">
            <Button onClick={() => window.location.reload()} variant="primary" className="flex-1">
              🔄 NEW SURVIVAL MISSION
            </Button>
            <Button onClick={handleCancel} variant="secondary" className="flex-1">
              🏠 BACK TO HQ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  console.log('🎯 Rendering default loading screen');
  return (
    <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center">
      <LoadingSpinner size="lg" message="Initializing survival mode..." />
    </div>
  );
};

export default CodenameSurvival;
