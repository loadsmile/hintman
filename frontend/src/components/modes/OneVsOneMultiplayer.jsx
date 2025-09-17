import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import HintDisplay from '../game/HintDisplay';
import GuessInput from '../game/GuessInput';
import Timer from '../common/Timer';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';

const OneVsOneMultiplayer = ({ playerName, onBackToMenu }) => {
  const [gameState, setGameState] = useState('matchmaking');
  const [gameData, setGameData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [hints, setHints] = useState([]);
  const [gameResult, setGameResult] = useState(null);
  const [scores, setScores] = useState({});
  const [health, setHealth] = useState({}); // Track health
  const [connectionError, setConnectionError] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const socketRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
          <span className="text-xs text-hitman-gray">Health ({getHealthStatus()})</span>
          <span className="text-xs text-hitman-gray">{currentHealth}/{maxHealth}</span>
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

  const connectToServer = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    setIsConnecting(true);

    const newSocket = io('https://hintman-backend.onrender.com', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      maxReconnectionAttempts: 5
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      if (!mountedRef.current) return;

      console.log('✅ Connected to server:', newSocket.id);
      setMyPlayerId(newSocket.id);
      setConnectionError(false);
      setIsConnecting(false);
    });

    newSocket.on('disconnect', (reason) => {
      if (!mountedRef.current) return;

      console.log('❌ Disconnected from server. Reason:', reason);
      if (reason !== 'io client disconnect') {
        setConnectionError(true);
      }
      setIsConnecting(false);
    });

    newSocket.on('connect_error', (error) => {
      if (!mountedRef.current) return;

      console.error('🔥 Connection error:', error);
      setConnectionError(true);
      setIsConnecting(false);
    });

    newSocket.on('waitingForMatch', () => {
      if (!mountedRef.current) return;
      setGameState('waiting');
    });

    newSocket.on('matchFound', ({ players: matchedPlayers }) => {
      if (!mountedRef.current) return;

      console.log('🎯 Match found!', matchedPlayers);
      setPlayers(matchedPlayers);
      setGameState('playing');
      setScores(matchedPlayers.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {}));
      setHealth(matchedPlayers.reduce((acc, p) => ({ ...acc, [p.id]: 5000 }), {})); // Initialize health
    });

    newSocket.on('questionStart', ({ questionIndex, totalQuestions, category, difficulty, health: newHealth }) => {
      if (!mountedRef.current) return;

      console.log('❓ Question started:', { questionIndex, category });
      setCurrentQuestion({ questionIndex, totalQuestions, category, difficulty });
      setHints([]);
      setGameResult(null);
      if (newHealth) setHealth(newHealth); // Update health from server
    });

    newSocket.on('hintRevealed', ({ index, text, health: newHealth }) => {
      if (!mountedRef.current) return;

      console.log('💡 Hint revealed:', text, 'Health update:', newHealth);
      setHints(prev => [...prev, { index, text }]);
      if (newHealth) setHealth(newHealth); // Update health after hint penalty
    });

    newSocket.on('questionResult', ({ winner, winnerName, correctAnswer, points, timeElapsed, scores: newScores, health: newHealth }) => {
      if (!mountedRef.current) return;

      console.log('📊 Question result:', { winner, winnerName, points });

      if (newScores) setScores(newScores);
      if (newHealth) setHealth(newHealth); // Update health

      setGameResult({
        winner,
        winnerName,
        correctAnswer,
        points,
        timeElapsed
      });
    });

    newSocket.on('wrongAnswer', ({ guess, healthLost }) => {
      if (!mountedRef.current) return;

      console.log('❌ Wrong answer:', guess, 'Health lost:', healthLost);
      setGameResult({
        winner: null,
        incorrectGuess: guess,
        correctAnswer: null,
        points: 0,
        healthLost
      });

      setTimeout(() => {
        if (mountedRef.current) {
          setGameResult(null);
        }
      }, 2000);
    });

    newSocket.on('playerEliminated', ({ eliminatedPlayer, eliminatedPlayerName, health: newHealth }) => {
      if (!mountedRef.current) return;

      console.log('💀 Player eliminated:', eliminatedPlayerName);
      if (newHealth) setHealth(newHealth);

      setGameResult({
        winner: 'elimination',
        message: `${eliminatedPlayerName} has been eliminated!`,
        eliminatedPlayer
      });
    });

    newSocket.on('gameEnd', ({ results }) => {
      if (!mountedRef.current) return;

      console.log('🏁 Game ended:', results);
      setGameState('finished');
      setGameData({ results });
    });

    newSocket.on('playerDisconnected', () => {
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
              { id: myPlayerId, name: playerName, score: scores[myPlayerId] || 0, health: health[myPlayerId] || 0, isAlive: true },
              { id: 'opponent', name: 'Opponent', score: 0, health: 0, isAlive: false }
            ].sort((a, b) => b.score - a.score)
          });
        }
      }, 3000);
    });

    return newSocket;
  }, [myPlayerId, playerName, scores, health]);

  useEffect(() => {
    const socket = connectToServer();

    return () => {
      console.log('🧹 Cleaning up socket connection');
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connectToServer]);

  const findMatch = () => {
    if (socketRef.current && socketRef.current.connected) {
      console.log('🔍 Finding match for:', playerName);
      socketRef.current.emit('findMatch', { playerName });
      setGameState('waiting');
    } else {
      console.log('❌ Socket not connected, trying to reconnect...');
      setConnectionError(true);
    }
  };

  const submitGuess = (guess) => {
    if (socketRef.current && socketRef.current.connected && gameState === 'playing') {
      const myHealth = health[myPlayerId] || 0;
      if (myHealth <= 0) return; // Can't guess if dead

      console.log('📝 Submitting guess:', guess);
      socketRef.current.emit('submitGuess', { guess });
    }
  };

  const retryConnection = () => {
    setConnectionError(false);
    setGameState('matchmaking');
    connectToServer();
  };

  if (connectionError && !isConnecting) {
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-hitman-white p-8 rounded-lg shadow-2xl max-w-md w-full text-hitman-black text-center">
          <h2 className="text-2xl font-bold text-hitman-red mb-4 font-spy">CONNECTION ERROR</h2>
          <p className="mb-4">Unable to connect to game server.</p>
          <p className="text-sm text-hitman-gray mb-6">The server might be starting up or experiencing issues.</p>
          <div className="space-y-3">
            <Button onClick={retryConnection} variant="primary">
              🔄 Retry Connection
            </Button>
            <Button onClick={onBackToMenu} variant="secondary">
              🏠 Back to Menu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-hitman-white p-8 rounded-lg shadow-2xl max-w-md w-full text-hitman-black text-center">
          <LoadingSpinner size="lg" message="Connecting to server..." />
          <p className="mt-4 text-hitman-gray">Establishing secure connection...</p>
        </div>
      </div>
    );
  }

  if (gameState === 'matchmaking') {
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-hitman-white p-8 rounded-lg shadow-2xl max-w-2xl w-full text-hitman-black">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-hitman-red mb-4 font-spy">MULTIPLAYER MISSION</h2>
            <p className="text-lg mb-4">Agent {playerName}, ready for real competition?</p>
            <div className="bg-hitman-darkGray p-4 rounded text-hitman-white text-sm">
              <p className="mb-2">🎯 <strong>Objective:</strong> Defeat another human agent</p>
              <p className="mb-2">📋 <strong>Intel:</strong> Real-time hint reveals</p>
              <p className="mb-2">❤️ <strong>Health:</strong> Start with 5000 health, lose health over time and for mistakes</p>
              <p className="mb-2">⚡ <strong>Scoring:</strong> Speed and accuracy matter</p>
              <p>🏆 <strong>Victory:</strong> Best score wins (or last agent standing)</p>
            </div>
          </div>

          <div className="text-center">
            <Button onClick={findMatch} size="lg" className="px-12 mr-4">
              🎯 FIND OPPONENT
            </Button>
            <Button onClick={onBackToMenu} variant="secondary" size="lg" className="px-12">
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
        <div className="bg-hitman-white p-8 rounded-lg shadow-2xl max-w-md w-full text-hitman-black text-center">
          <LoadingSpinner size="lg" message="Searching for opponent..." />
          <p className="mt-4 text-hitman-gray">Finding another agent...</p>
          <p className="mt-2 text-xs text-hitman-gray">This may take a few moments</p>
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

    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-hitman-white p-8 rounded-lg shadow-2xl max-w-2xl w-full text-hitman-black">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-hitman-red mb-4 font-spy">
              {isWinner ? '🏆 MISSION ACCOMPLISHED' : '💀 MISSION FAILED'}
            </h2>
            <p className="text-xl mb-6">
              {isWinner ? `Congratulations Agent ${playerName}!` : `Agent ${winner?.name} completed the mission first.`}
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
                  <p className="text-2xl font-bold text-hitman-red">{player.score} points</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex space-x-4">
            <Button onClick={() => setGameState('matchmaking')} variant="primary" className="flex-1">
              🔄 NEW MATCH
            </Button>
            <Button onClick={onBackToMenu} variant="secondary" className="flex-1">
              🏠 BACK TO HQ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'playing' && currentQuestion) {
    const opponent = players.find(p => p.name !== playerName);
    const myScore = scores[players.find(p => p.name === playerName)?.id] || 0;
    const opponentScore = scores[opponent?.id] || 0;
    const myHealth = health[players.find(p => p.name === playerName)?.id] || 5000;

    return (
      <div className="relative z-20 min-h-[calc(100vh-120px)] p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-hitman-black bg-opacity-90 p-4 rounded-lg mb-6 border border-hitman-red">
            <div className="flex justify-between items-center mb-4">
              <div className="text-hitman-white">
                <h2 className="text-xl font-spy">TARGET: {currentQuestion.questionIndex} / {currentQuestion.totalQuestions}</h2>
                <p className="text-sm text-hitman-gray">Category: {currentQuestion.category}</p>
              </div>
              <Timer
                duration={120}
                isActive={true}
                key={`timer-${currentQuestion.questionIndex}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={`bg-hitman-darkGray p-3 rounded ${myScore > opponentScore ? 'ring-2 ring-green-400' : ''}`}>
                <h3 className="font-spy text-hitman-red mb-1">👤 {playerName} (You)</h3>
                <p className="text-hitman-white font-bold">{myScore} points</p>
                <div className="mt-2">
                  <HealthBar playerId={players.find(p => p.name === playerName)?.id} />
                </div>
              </div>
              <div className={`bg-hitman-darkGray p-3 rounded ${opponentScore > myScore ? 'ring-2 ring-green-400' : ''}`}>
                <h3 className="font-spy text-hitman-red mb-1">👤 {opponent?.name || 'Opponent'}</h3>
                <p className="text-hitman-white font-bold">{opponentScore} points</p>
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
                  <p className="text-lg font-bold">🎯 EXCELLENT SHOT! +{gameResult.points} points • +200 Health</p>
                )}
                {gameResult.winner && gameResult.winner !== players.find(p => p.name === playerName)?.id && gameResult.winner !== 'disconnect' && gameResult.winner !== 'elimination' && (
                  <p className="text-lg font-bold">💀 {gameResult.winnerName} eliminated the target first!</p>
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
              key={`hints-${currentQuestion.questionIndex}-${hints.length}`}
            />

            <GuessInput
              onSubmit={submitGuess}
              disabled={gameResult?.winner && gameResult.winner !== 'disconnect' || myHealth <= 0}
              placeholder={myHealth <= 0 ? "You have been eliminated..." : "Enter your target identification..."}
              key={`input-${currentQuestion.questionIndex}`}
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
