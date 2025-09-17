import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import HintDisplay from '../game/HintDisplay';
import GuessInput from '../game/GuessInput';
import Timer from '../common/Timer';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';

const OneVsOneMultiplayer = ({ playerName, onBackToMenu }) => {
  const [gameState, setGameState] = useState('matchmaking'); // matchmaking, waiting, playing, finished
  const [socket, setSocket] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [hints, setHints] = useState([]);
  const [gameResult, setGameResult] = useState(null);
  const [scores, setScores] = useState({});
  const [connectionError, setConnectionError] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState(null);

  useEffect(() => {
    // Connect to production server
    const newSocket = io('https://hintman-backend.onrender.com', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    setSocket(newSocket);

    // Socket event listeners
    newSocket.on('connect', () => {
      console.log('Connected to server:', newSocket.id);
      setMyPlayerId(newSocket.id);
      setConnectionError(false);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnectionError(true);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionError(true);
    });

    newSocket.on('waitingForMatch', () => {
      console.log('Waiting for match...');
      setGameState('waiting');
    });

    newSocket.on('matchFound', ({ gameId, players }) => {
      console.log('Match found!', players);
      setPlayers(players);
      setGameState('playing');
      setScores(players.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {}));
    });

    newSocket.on('questionStart', ({ questionIndex, totalQuestions, category, difficulty }) => {
      console.log('Question started:', { questionIndex, category });
      setCurrentQuestion({ questionIndex, totalQuestions, category, difficulty });
      setHints([]);
      setGameResult(null);
    });

    newSocket.on('hintRevealed', (hint) => {
      console.log('Hint revealed:', hint);
      setHints(prev => [...prev, hint]);
    });

    newSocket.on('questionResult', ({ winner, winnerName, correctAnswer, points, timeElapsed, scores: newScores }) => {
      console.log('Question result:', { winner, winnerName, points });

      if (newScores) {
        setScores(newScores);
      }

      setGameResult({
        winner,
        winnerName,
        correctAnswer,
        points,
        timeElapsed
      });
    });

    newSocket.on('wrongAnswer', ({ guess }) => {
      console.log('Wrong answer:', guess);
      setGameResult({
        winner: null,
        incorrectGuess: guess,
        correctAnswer: null,
        points: 0
      });

      setTimeout(() => setGameResult(null), 2000);
    });

    newSocket.on('gameEnd', ({ results }) => {
      console.log('Game ended:', results);
      setGameState('finished');
      setGameData({ results });
    });

    newSocket.on('playerDisconnected', () => {
      console.log('Opponent disconnected');
      setGameResult({
        winner: 'disconnect',
        message: 'Your opponent disconnected. You win by default!'
      });

      setTimeout(() => {
        setGameState('finished');
        setGameData({
          results: [
            { id: myPlayerId, name: playerName, score: scores[myPlayerId] || 0 },
            { id: 'opponent', name: 'Opponent', score: 0 }
          ].sort((a, b) => b.score - a.score)
        });
      }, 3000);
    });

    // Cleanup
    return () => {
      console.log('Cleaning up socket connection');
      newSocket.close();
    };
  }, [playerName, scores, myPlayerId]);

  const findMatch = () => {
    if (socket && socket.connected) {
      console.log('Finding match for:', playerName);
      socket.emit('findMatch', { playerName });
      setGameState('waiting');
    } else {
      setConnectionError(true);
    }
  };

  const submitGuess = (guess) => {
    if (socket && socket.connected && gameState === 'playing') {
      console.log('Submitting guess:', guess);
      socket.emit('submitGuess', { guess });
    }
  };

  // Connection Error Screen
  if (connectionError) {
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-hitman-white p-8 rounded-lg shadow-2xl max-w-md w-full text-hitman-black text-center">
          <h2 className="text-2xl font-bold text-hitman-red mb-4 font-spy">CONNECTION ERROR</h2>
          <p className="mb-4">Unable to connect to game server.</p>
          <p className="text-sm text-hitman-gray mb-6">Please check your internet connection and try again.</p>
          <div className="space-y-3">
            <Button onClick={() => {
              setConnectionError(false);
              setGameState('matchmaking');
            }} variant="primary">
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

  // Matchmaking Screen
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
              <p className="mb-2">⚡ <strong>Scoring:</strong> Speed and accuracy matter</p>
              <p>🏆 <strong>Victory:</strong> Best total score wins</p>
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

  // Waiting for Opponent Screen
  if (gameState === 'waiting') {
    return (
      <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
        <div className="bg-hitman-white p-8 rounded-lg shadow-2xl max-w-md w-full text-hitman-black text-center">
          <LoadingSpinner size="lg" message="Searching for opponent..." />
          <p className="mt-4 text-hitman-gray">Finding another agent...</p>
          <p className="mt-2 text-xs text-hitman-gray">This may take a few moments</p>
          <Button onClick={onBackToMenu} variant="secondary" className="mt-6">
            Cancel Search
          </Button>
        </div>
      </div>
    );
  }

  // Game Finished Screen
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
                <div>
                  <h3 className="font-spy text-lg">#{index + 1} {player.name}</h3>
                  {index === 0 && <span className="text-sm text-green-600">🏆 Winner</span>}
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

  // Main Game Screen
  if (gameState === 'playing' && currentQuestion) {
    const opponent = players.find(p => p.name !== playerName);
    const myScore = scores[players.find(p => p.name === playerName)?.id] || 0;
    const opponentScore = scores[opponent?.id] || 0;

    return (
      <div className="relative z-20 min-h-[calc(100vh-120px)] p-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
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
              </div>
              <div className={`bg-hitman-darkGray p-3 rounded ${opponentScore > myScore ? 'ring-2 ring-green-400' : ''}`}>
                <h3 className="font-spy text-hitman-red mb-1">👤 {opponent?.name || 'Opponent'}</h3>
                <p className="text-hitman-white font-bold">{opponentScore} points</p>
              </div>
            </div>
          </div>

          {/* Game Result */}
          {gameResult && (
            <div className={`mb-6 p-4 rounded-lg border-2 ${
              gameResult.winner === players.find(p => p.name === playerName)?.id ? 'bg-green-900 border-green-500' :
              gameResult.winner && gameResult.winner !== 'disconnect' ? 'bg-red-900 border-red-500' :
              gameResult.winner === 'disconnect' ? 'bg-blue-900 border-blue-500' :
              'bg-yellow-900 border-yellow-500'
            }`}>
              <div className="text-center text-white">
                {gameResult.winner === players.find(p => p.name === playerName)?.id && (
                  <p className="text-lg font-bold">🎯 EXCELLENT SHOT! +{gameResult.points} points</p>
                )}
                {gameResult.winner && gameResult.winner !== players.find(p => p.name === playerName)?.id && gameResult.winner !== 'disconnect' && (
                  <p className="text-lg font-bold">💀 {gameResult.winnerName} eliminated the target first!</p>
                )}
                {gameResult.winner === 'disconnect' && (
                  <p className="text-lg font-bold">🏆 {gameResult.message}</p>
                )}
                {!gameResult.winner && gameResult.incorrectGuess && (
                  <p className="text-lg font-bold">❌ Incorrect guess: "{gameResult.incorrectGuess}"</p>
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
              hints={hints}
              totalHints={5}
              key={`hints-${currentQuestion.questionIndex}-${hints.length}`}
            />

            {/* Guess Input */}
            <GuessInput
              onSubmit={submitGuess}
              disabled={gameResult?.winner && gameResult.winner !== 'disconnect'}
              placeholder="Enter your target identification..."
              key={`input-${currentQuestion.questionIndex}`}
            />
          </div>
        </div>
      </div>
    );
  }

  // Loading Screen
  return (
    <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center">
      <LoadingSpinner size="lg" message="Connecting to game..." />
    </div>
  );
};

export default OneVsOneMultiplayer;
