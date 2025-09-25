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

  // LOGIN SCREEN - Revamped to Match Immersive Style
  if (!isNameSet) {
    return (
      <Layout>
        <div className="background-image" />
        <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
          <div className="max-w-md w-full mx-4">
            {/* Title Section */}
            <div className="text-center mb-12">
              <h1 className="text-6xl font-bold text-white mb-6 font-spy tracking-wider drop-shadow-2xl">
                HINTMAN
              </h1>
              <p className="text-gray-200 text-lg drop-shadow-lg mb-2">
                The Ultimate Deduction Game
              </p>
              <p className="text-gray-300 drop-shadow-lg">
                Enter your agent credentials
              </p>
            </div>

            {/* Login Form - Floating */}
            <form onSubmit={(e) => {
              e.preventDefault();
              const name = e.target.playerName.value.trim();
              if (name) handleNameSubmit(name);
            }} className="space-y-6">
              <div>
                <input
                  type="text"
                  name="playerName"
                  placeholder="Enter your codename..."
                  className="w-full p-4 bg-gray-900/80 backdrop-blur-sm border border-gray-600/60 hover:border-gray-500/80 focus:border-red-600/80 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600/50 transition-all duration-300 text-lg shadow-xl"
                  maxLength={20}
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-red-800/90 hover:bg-red-700/90 backdrop-blur-sm border border-red-700/60 hover:border-red-600/80 text-white py-4 rounded-xl font-semibold text-lg transition-all duration-300 shadow-2xl hover:shadow-red-900/30"
              >
                Join Mission
              </button>
            </form>
          </div>
        </div>
      </Layout>
    );
  }

  // GAME MODE SELECTION SCREEN - Unified Red Theme
  if (!gameMode) {
    return (
      <Layout>
        <div className="background-image" />
        <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
          <div className="max-w-lg w-full mx-4">
            {/* Title Section */}
            <div className="text-center mb-12">
              <h1 className="text-6xl font-bold text-white mb-4 font-spy tracking-wider drop-shadow-2xl">
                HINTMAN
              </h1>
              <p className="text-gray-200 mb-3 text-xl drop-shadow-lg">
                Welcome, Agent {playerName}
              </p>
              <p className="text-gray-300 drop-shadow-lg">
                Select your mission type:
              </p>
            </div>

            {/* Mission Buttons - All Red Theme */}
            <div className="space-y-6 mb-10">
              {/* Training Mission */}
              <button
                onClick={() => startGame('1v1')}
                className="w-full bg-black/40 hover:bg-gray-800/90 backdrop-blur-sm border border-red-800/60 hover:border-red-600/80 text-white py-5 rounded-xl font-semibold transition-all duration-300 flex items-center justify-between px-8 group shadow-2xl hover:shadow-red-900/20"
              >
                <span className="flex items-center">
                  <span className="text-red-400 mr-4 text-xl">🎯</span>
                  <span className="text-lg">1 vs 1 Duel vs Agent 47</span>
                </span>
                <span className="text-sm text-gray-400 group-hover:text-gray-300">vs AI Agent</span>
              </button>

              {/* Multiplayer */}
              <button
                onClick={() => startGame('1v1-multiplayer')}
                className="w-full bg-black/40 hover:bg-gray-800/90 backdrop-blur-sm border border-red-800/60 hover:border-red-600/80 text-white py-5 rounded-xl font-semibold transition-all duration-300 flex items-center justify-between px-8 group shadow-2xl hover:shadow-red-900/20"
              >
                <span className="flex items-center">
                  <span className="text-red-400 mr-4 text-xl">👥</span>
                  <span className="text-lg">1 vs 1 Multiplayer: 2 modes</span>
                </span>
                <span className="text-sm text-gray-400 group-hover:text-gray-300">2 Players Online</span>
              </button>

              {/* Survival - Emphasized with Double Border */}
              <button
                onClick={() => startGame('survival')}
                className="w-full bg-black/40 hover:bg-gray-800/90 backdrop-blur-sm border-2 border-red-800/70 hover:border-red-600/90 text-white py-5 rounded-xl font-semibold transition-all duration-300 flex items-center justify-between px-8 group shadow-2xl hover:shadow-red-900/30 relative overflow-hidden"
              >
                {/* Subtle glow effect */}
                <div className="absolute inset-0 bg-red-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <span className="flex items-center relative z-10">
                  <span className="text-red-400 mr-4 text-xl">☠️</span>
                  <span className="text-lg">Codename: Survival</span>
                </span>
                <span className="text-sm text-gray-400 group-hover:text-gray-300 relative z-10">Up to 6 Players</span>
              </button>
            </div>

            {/* Mode Descriptions - All Red Theme */}
            <div className="space-y-4">
              <div className="flex items-start space-x-4 backdrop-blur-sm bg-black/40 p-4 rounded-lg border-l-4 border-red-600/60">
                <span className="font-semibold text-red-400 min-w-fit text-sm">1vs1 Duel:</span>
                <span className="text-gray-200 text-sm">Practice against AI to hone your skills</span>
              </div>
              <div className="flex items-start space-x-4 backdrop-blur-sm bg-black/40 p-4 rounded-lg border-l-4 border-red-600/60">
                <span className="font-semibold text-red-400 min-w-fit text-sm">1v1 Multiplayer:</span>
                <span className="text-gray-200 text-sm">Quick duels against other agents</span>
              </div>
              <div className="flex items-start space-x-4 backdrop-blur-sm bg-black/40 p-4 rounded-lg border-l-4 border-red-600/60">
                <span className="font-semibold text-red-400 min-w-fit text-sm">Survival:</span>
                <span className="text-gray-200 text-sm">Battle royale - last agent standing wins!</span>
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
