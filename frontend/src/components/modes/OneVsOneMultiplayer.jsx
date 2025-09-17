import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import HintDisplay from '../game/HintDisplay';
import GuessInput from '../game/GuessInput';
import Timer from '../common/Timer';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';

const OneVsOneMultiplayer = ({ playerName, onBackToMenu }) => {
  const [gameState, setGameState] = useState('connecting');
  const [gameData, setGameData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [currentTarget, setCurrentTarget] = useState(null);
  const [hints, setHints] = useState([]);
  const [gameResult, setGameResult] = useState(null);
  const [health, setHealth] = useState({});
  const [connectionError, setConnectionError] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState(null);

  const socketRef = useRef(null);
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);

  // Health Bar Component
  const HealthBar = ({ playerId }) => {
    const currentHealth = health[playerId] || 5000;
    const maxHealth = 5000;
    const healthPercentage = (currentHealth / maxHealth) * 100;

    const getHealthColor = () => {
      if (healthPercentage > 75) return 'bg-green-500';
      if (healthPercentage > 50) return 'bg-yellow-500';
      if (healthPercentage > 25) return 'bg-orange-500';
      return 'bg-red-500';
    };

    const getHealthStatus = () => {
      if (healthPercentage > 75) return 'Excellent';
      if (healthPercentage > 50) return 'Good';
      if (healthPercentage > 25) return 'Warning';
      return 'Critical';
    };

    return (
      <div className="w-full">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-400">Health ({getHealthStatus()})</span>
          <span className="text-xs text-gray-400">{currentHealth}/{maxHealth}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getHealthColor()}`}
            style={{ width: `${healthPercentage}%` }}
          />
        </div>
        {currentHealth <= 0 && (
          <p className="text-xs text-red-400 mt-1">💀 ELIMINATED</p>
        )}
      </div>
    );
  };

  const initializeSocket = () => {
    if (socketRef.current || initializedRef.current) {
      console.log('Socket already exists or already initialized, skipping...');
      return;
    }

    initializedRef.current = true;
    console.log('🔌 Initializing socket connection...');

    const socket = io('https://hintman-backend.onrender.com', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      reconnection: false,
      autoConnect: true
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      if (!mountedRef.current) return;

      console.log('✅ Connected to server:', socket.id);
      setMyPlayerId(socket.id);
      setConnectionError(false);
      setGameState('matchmaking');
    });

    socket.on('disconnect', (reason) => {
      if (!mountedRef.current) return;

      console.log('❌ Disconnected from server. Reason:', reason);

      if (reason !== 'io client disconnect' && mountedRef.current) {
        setConnectionError(true);
        setGameState('connecting');
      }
    });

    socket.on('connect_error', (error) => {
      if (!mountedRef.current) return;

      console.error('🔥 Connection error:', error);
      setConnectionError(true);
      setGameState('connecting');
    });

    socket.on('waitingForMatch', () => {
      if (!mountedRef.current) return;
      console.log('⏳ Waiting for match...');
      setGameState('waiting');
    });

    socket.on('matchFound', ({ players: matchedPlayers }) => {
      if (!mountedRef.current) return;

      console.log('🎯 Match found!', matchedPlayers);
      setPlayers(matchedPlayers);
      setGameState('playing');
      setHealth(matchedPlayers.reduce((acc, p) => ({ ...acc, [p.id]: 5000 }), {}));
    });

    // Handle target start (updated from questionStart)
    socket.on('questionStart', ({ targetIndex, totalTargets, category, difficulty, health: newHealth }) => {
      if (!mountedRef.current) return;

      console.log('🎯 Target started:', { targetIndex, totalTargets, category });
      setCurrentTarget({ targetIndex, totalTargets, category, difficulty });
      setHints([]);
      setGameResult(null);
      if (newHealth) setHealth(newHealth);
    });

    socket.on('hintRevealed', ({ index, text, health: newHealth }) => {
      if (!mountedRef.current) return;

      console.log('💡 Hint revealed:', text);
      setHints(prev => [...prev, { index, text }]);
      if (newHealth) setHealth(newHealth);
    });

    // Real-time health updates
    socket.on('healthUpdate', ({ health: newHealth }) => {
      if (!mountedRef.current) return;

      console.log('💊 Health updated:', newHealth);
      setHealth(newHealth);
    });

    socket.on('questionResult', ({ winner, winnerName, correctAnswer, timeElapsed, health: newHealth, healthGained }) => {
      if (!mountedRef.current) return;

      console.log('📊 Target result:', { winner, winnerName, healthGained });

      if (newHealth) setHealth(newHealth);

      setGameResult({
        winner,
        winnerName,
        correctAnswer,
        timeElapsed,
        healthGained
      });
    });

    socket.on('wrongAnswer', ({ guess, healthLost }) => {
      if (!mountedRef.current) return;

      console.log('❌ Wrong answer:', guess);
      setGameResult({
        winner: null,
        incorrectGuess: guess,
        correctAnswer: null,
        healthLost
      });

      setTimeout(() => {
        if (mountedRef.current) {
          setGameResult(null);
        }
      }, 2000);
    });

    socket.on('playerEliminated', ({ eliminatedPlayer, eliminatedPlayerName, health: newHealth }) => {
      if (!mountedRef.current) return;

      console.log('💀 Player eliminated:', eliminatedPlayerName);
      if (newHealth) setHealth(newHealth);

      setGameResult({
        winner: 'elimination',
        message: `${eliminatedPlayerName} has been eliminated!`,
        eliminatedPlayer
      });
    });

    socket.on('gameEnd', ({ results }) => {
      if (!mountedRef.current) return;

      console.log('🏁 Game ended:', results);
      setGameState('finished');
      setGameData({ results });
    });

    socket.on('playerDisconnected', () => {
      if (!mountedRef.current) return;

      console.log('👋 Opponent disconnected');
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

    if (!initializedRef.current) {
      initializeSocket();
    }

    return () => {
      console.log('🧹 Component unmounting, cleaning up...');
      mountedRef.current = false;

      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.close();
        socketRef.current = null;
      }

      initializedRef.current = false;
    };
  }, []);

  const findMatch = () => {
    if (!socketRef.current?.connected) {
      console.log('❌ No socket connection available');
      setConnectionError(true);
      return;
    }

    console.log('🔍 Finding match for:', playerName);
    socketRef.current.emit('findMatch', { playerName });
    setGameState('waiting');
  };

  const submitGuess = (guess) => {
    if (!socketRef.current?.connected || gameState !== 'playing') {
      console.log('❌ Cannot submit guess - invalid state');
      return;
    }

    const myHealth = health[myPlayerId] || 0;
    if (myHealth <= 0) {
      console.log('❌ Cannot submit guess - player eliminated');
      return;
    }

    console.log('📝 Submitting guess:', guess);
    socketRef.current.emit('submitGuess', { guess });
  };

  const handleCancel = () => {
    console.log('🚫 User cancelled connection/search');

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.close();
      socketRef.current = null;
    }

    initializedRef.current = false;
    onBackToMenu();
  };

  const retryConnection = () => {
    console.log('🔄 Retrying connection...');

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.close();
      socketRef.current = null;
    }

    initializedRef.current = false;
    setConnectionError(false);
    setGameState('connecting');

    setTimeout(() => {
      initializeSocket();
    }, 100);
  };

  if (connectionError) {
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full text-black text-center border border-gray-200">
          <h2 className="text-2xl font-bold text-red-600 mb-4 font-spy">CONNECTION ERROR</h2>
          <p className="mb-4">Unable to connect to game server.</p>
          <p className="text-sm text-gray-600 mb-6">The server might be starting up or experiencing issues.</p>
          <div className="space-y-3">
            <Button onClick={retryConnection} variant="primary">
              🔄 Retry Connection
            </Button>
            <Button onClick={handleCancel} variant="secondary">
              🏠 Back to Menu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'connecting') {
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full text-black text-center border border-gray-200">
          <LoadingSpinner size="lg" message="Connecting to server..." />
          <p className="mt-4 text-gray-600">Establishing secure connection...</p>
          <Button onClick={handleCancel} variant="secondary" className="mt-4">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === 'matchmaking') {
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-2xl w-full text-black border border-gray-200">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-red-600 mb-4 font-spy">MULTIPLAYER MISSION</h2>
            <p className="text-lg mb-4 text-gray-800">Agent {playerName}, ready for real competition?</p>
            <div className="bg-gray-800 p-4 rounded text-white text-sm">
              <p className="mb-2">🎯 <strong>Objective:</strong> Survive exactly 5 targets with the most health</p>
              <p className="mb-2">📋 <strong>Intel:</strong> Real-time hint reveals</p>
              <p className="mb-2">❤️ <strong>Health:</strong> Start with 5000 health, lose health over time and for mistakes</p>
              <p className="mb-2">💡 <strong>Hints:</strong> Each hint costs 100 health for both players</p>
              <p className="mb-2">❌ <strong>Mistakes:</strong> Wrong answers cost 500 health</p>
              <p className="mb-2">✅ <strong>Rewards:</strong> Correct answers restore 1000 health</p>
              <p className="mb-2">🔤 <strong>Answers:</strong> Use exact spelling (e.g., "Pacific Ocean", "Mount Everest")</p>
              <p>🏆 <strong>Victory:</strong> Survive with the most health (or last agent standing)</p>
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span className="text-sm text-green-600">Connected to server</span>
            </div>
            <Button onClick={findMatch} size="lg" className="px-12 mr-4">
              🎯 FIND OPPONENT
            </Button>
            <Button onClick={handleCancel} variant="secondary" size="lg" className="px-12">
              🏠 Back to Menu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'waiting') {
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full text-black text-center border border-gray-200">
          <LoadingSpinner size="lg" message="Searching for opponent..." />
          <p className="mt-4 text-gray-600">Finding another agent...</p>
          <p className="mt-2 text-xs text-gray-500">This may take a few moments</p>
          <Button onClick={() => setGameState('matchmaking')} variant="secondary" className="mt-6">
            Cancel Search
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    const results = gameData?.results || [];
    const winner = results[0];
    const isWinner = winner?.name === playerName;

    // Calculate total rounds completed
    const totalRoundsCompleted = Math.min(5, Math.max(1, currentTarget?.targetIndex || 1));

    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-2xl w-full text-black border border-gray-200">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-red-600 mb-4 font-spy">
              {isWinner ? '🏆 MISSION ACCOMPLISHED' : '💀 MISSION FAILED'}
            </h2>
            <p className="text-xl mb-6 text-gray-800">
              {isWinner ? `Congratulations Agent ${playerName}!` : `Agent ${winner?.name} survived with more health.`}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Completed {totalRoundsCompleted} out of 5 targets
            </p>
          </div>

          <div className="space-y-4 mb-6">
            {results.map((player, index) => (
              <div key={player.id} className={`p-4 rounded flex justify-between items-center ${
                index === 0 ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-100'
              }`}>
                <div className="flex-1">
                  <h3 className="font-spy text-lg">#{index + 1} {player.name}</h3>
                  {index === 0 && <span className="text-sm text-green-600">🏆 Winner</span>}
                  {!player.isAlive && <span className="text-sm text-red-600">💀 Eliminated</span>}
                </div>
                <div className="flex-1 mx-4">
                  <HealthBar playerId={player.id} />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-red-600">{player.health} health</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex space-x-4">
            <Button onClick={() => {
              if (socketRef.current) {
                socketRef.current.removeAllListeners();
                socketRef.current.close();
                socketRef.current = null;
              }
              initializedRef.current = false;
              setGameState('connecting');
              setTimeout(() => initializeSocket(), 100);
            }} variant="primary" className="flex-1">
              🔄 NEW MATCH
            </Button>
            <Button onClick={handleCancel} variant="secondary" className="flex-1">
              🏠 BACK TO HQ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'playing' && currentTarget) {
    const opponent = players.find(p => p.name !== playerName);
    const myHealth = health[players.find(p => p.name === playerName)?.id] || 5000;
    const opponentHealth = health[opponent?.id] || 5000;

    return (
      <div className="relative z-20 min-h-[calc(100vh-120px)] p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-black bg-opacity-90 p-4 rounded-lg mb-6 border border-red-600">
            <div className="flex justify-between items-center mb-4">
              <div className="text-white">
                <h2 className="text-xl font-spy">TARGET: {currentTarget.targetIndex} / {currentTarget.totalTargets}</h2>
                <p className="text-sm text-gray-300">Category: {currentTarget.category}</p>
              </div>
              <Timer
                duration={120}
                isActive={true}
                key={`timer-${currentTarget.targetIndex}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={`bg-gray-800 p-3 rounded ${myHealth > opponentHealth ? 'ring-2 ring-green-400' : ''}`}>
                <h3 className="font-spy text-red-500 mb-1">👤 {playerName} (You)</h3>
                <p className="text-white font-bold">{myHealth} health</p>
                <div className="mt-2">
                  <HealthBar playerId={players.find(p => p.name === playerName)?.id} />
                </div>
              </div>
              <div className={`bg-gray-800 p-3 rounded ${opponentHealth > myHealth ? 'ring-2 ring-green-400' : ''}`}>
                <h3 className="font-spy text-red-500 mb-1">👤 {opponent?.name || 'Opponent'}</h3>
                <p className="text-white font-bold">{opponentHealth} health</p>
                <div className="mt-2">
                  <HealthBar playerId={opponent?.id} />
                </div>
              </div>
            </div>
          </div>

          {gameResult && (
            <div className={`mb-6 p-4 rounded-lg border-2 ${
              gameResult.winner === players.find(p => p.name === playerName)?.id ? 'bg-green-900 border-green-500' :
              gameResult.winner && gameResult.winner !== 'disconnect' && gameResult.winner !== 'elimination' ? 'bg-red-900 border-red-500' :
              gameResult.winner === 'disconnect' ? 'bg-blue-900 border-blue-500' :
              gameResult.winner === 'elimination' ? 'bg-purple-900 border-purple-500' :
              'bg-yellow-900 border-yellow-500'
            }`}>
              <div className="text-center text-white">
                {gameResult.winner === players.find(p => p.name === playerName)?.id && (
                  <p className="text-lg font-bold">🎯 EXCELLENT SHOT! +{gameResult.healthGained || 1000} Health</p>
                )}
                {gameResult.winner && gameResult.winner !== players.find(p => p.name === playerName)?.id && gameResult.winner !== 'disconnect' && gameResult.winner !== 'elimination' && (
                  <p className="text-lg font-bold">💀 {gameResult.winnerName} eliminated the target first! +{gameResult.healthGained || 1000} Health</p>
                )}
                {gameResult.winner === 'disconnect' && (
                  <p className="text-lg font-bold">🏆 {gameResult.message}</p>
                )}
                {gameResult.winner === 'elimination' && (
                  <p className="text-lg font-bold">💀 {gameResult.message}</p>
                )}
                {!gameResult.winner && gameResult.incorrectGuess && (
                  <p className="text-lg font-bold">❌ Incorrect guess: "{gameResult.incorrectGuess}" • -{gameResult.healthLost || 500} Health</p>
                )}
                {gameResult.correctAnswer && (
                  <p className="text-sm mt-2">The answer was: <strong>{gameResult.correctAnswer}</strong></p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HintDisplay
              hints={hints}
              totalHints={5}
              key={`hints-${currentTarget.targetIndex}-${hints.length}`}
            />

            <GuessInput
              onSubmit={submitGuess}
              disabled={gameResult?.winner && gameResult.winner !== 'disconnect' || myHealth <= 0}
              placeholder={myHealth <= 0 ? "You have been eliminated..." : "Enter your target identification (be precise)..."}
              key={`input-${currentTarget.targetIndex}`}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center">
      <LoadingSpinner size="lg" message="Initializing multiplayer..." />
    </div>
  );
};

export default OneVsOneMultiplayer;
