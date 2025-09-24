import React, { useState } from 'react';
import Layout from './components/layout/Layout';
import OneVsOne from './components/modes/OneVsOne';
import OneVsOneMultiplayer from './components/modes/OneVsOneMultiplayer';
import CodenameSurvival from './components/modes/CodenameSurvival';
import './index.css';

function App() {
  const [gameMode, setGameMode] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [isNameSet, setIsNameSet] = useState(false);

  const handleNameSubmit = (name) => {
    setPlayerName(name);
    setIsNameSet(true);
  };

  const startGame = (mode) => {
    console.log('Starting game mode:', mode);
    setGameMode(mode);
  };

  const backToMenu = () => setGameMode(null);

  // LOGIN SCREEN
  if (!isNameSet) {
    return (
      <Layout>
        <div className="background-image" />
        <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
          <div className="bg-hitman-white p-8 rounded-lg shadow-2xl max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <h1 className="text-4xl font-bold text-hitman-red mb-2 font-spy">HINTMAN</h1>
              <p className="text-hitman-gray">The Ultimate Deduction Game</p>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const name = e.target.playerName.value.trim();
              if (name) handleNameSubmit(name);
            }}>
              <input
                type="text"
                name="playerName"
                placeholder="Enter your codename..."
                className="w-full p-3 border border-hitman-gray rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-hitman-red text-hitman-black"
                maxLength={20}
                required
              />
              <button
                type="submit"
                className="w-full bg-hitman-red text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition duration-200"
              >
                Join Mission
              </button>
            </form>
          </div>
        </div>
      </Layout>
    );
  }

  // GAME MODE SELECTION SCREEN
  if (!gameMode) {
    return (
      <Layout>
        <div className="background-image" />
        <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
          <div className="bg-hitman-white p-8 rounded-lg shadow-2xl max-w-lg w-full mx-4">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-hitman-red mb-2 font-spy">HINTMAN</h1>
              <p className="text-hitman-gray mb-2">Welcome, Agent {playerName}</p>
              <p className="text-sm text-hitman-gray">Select your mission type:</p>
            </div>
            <div className="space-y-4">
              <button
                onClick={() => startGame('1v1')}
                className="w-full bg-hitman-red text-white py-4 rounded-lg font-semibold hover:bg-red-700 transition duration-200 flex items-center justify-between px-6"
              >
                <span>🎯 Training Mission</span>
                <span className="text-sm opacity-75">vs AI Agent</span>
              </button>

              <button
                onClick={() => startGame('1v1-multiplayer')}
                className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 flex items-center justify-between px-6"
              >
                <span>👥 1 vs 1 Duel</span>
                <span className="text-sm opacity-75">2 Players Online</span>
              </button>

              <button
                onClick={() => startGame('survival')}
                className="w-full bg-purple-600 text-white py-4 rounded-lg font-semibold hover:bg-purple-700 transition duration-200 flex items-center justify-between px-6 border-2 border-yellow-400"
              >
                <span>☠️ Codename: Survival</span>
                <span className="text-sm opacity-75">Up to 6 Players</span>
              </button>
            </div>

            <div className="mt-6 space-y-2 text-xs text-hitman-gray">
              <div className="flex items-start space-x-2">
                <span className="font-semibold">Training:</span>
                <span>Practice against AI to hone your skills</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="font-semibold">1v1 Duel:</span>
                <span>Quick duels against other agents</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="font-semibold text-purple-600">Survival:</span>
                <span>Battle royale - last agent standing wins!</span>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // GAME SCREENS
  return (
    <Layout>
      <div className="background-city" />
      {gameMode === '1v1' && (
        <OneVsOne
          playerName={playerName}
          onBackToMenu={backToMenu}
        />
      )}
      {gameMode === '1v1-multiplayer' && (
        <OneVsOneMultiplayer
          playerName={playerName}
          onBackToMenu={backToMenu}
        />
      )}
      {gameMode === 'survival' && (
        <CodenameSurvival
          playerName={playerName}
          onBackToMenu={backToMenu}
        />
      )}
    </Layout>
  );
}

export default App;
