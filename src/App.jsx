import React, { useState } from 'react';
import Layout from './components/layout/Layout';
import OneVsOne from './components/modes/OneVsOne';
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
    setGameMode(mode);
  };

  const backToMenu = () => {
    setGameMode(null);
  };

if (!isNameSet) {
  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-hitman-black to-hitman-darkGray flex items-center justify-center">
          <div className="bg-hitman-white p-8 rounded-lg shadow-2xl max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <h1 className="text-4xl font-bold text-hitman-red mb-2 font-spy">HINTMAN</h1>
              <p className="text-hitman-gray">The Ultimate Guessing Game</p>
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

  if (!gameMode) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-hitman-black to-hitman-darkGray flex items-center justify-center">
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
                <span>🎯 1 vs 1 Duel</span>
                <span className="text-sm opacity-75">Quick Match</span>
              </button>

              <button
                disabled
                className="w-full bg-hitman-gray text-white py-4 rounded-lg font-semibold opacity-50 cursor-not-allowed flex items-center justify-between px-6"
              >
                <span>🎲 Party Mode</span>
                <span className="text-sm opacity-75">Coming Soon</span>
              </button>

              <button
                disabled
                className="w-full bg-hitman-gray text-white py-4 rounded-lg font-semibold opacity-50 cursor-not-allowed flex items-center justify-between px-6"
              >
                <span>⚡ Blitz Mode</span>
                <span className="text-sm opacity-75">Coming Soon</span>
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {gameMode === '1v1' && (
        <OneVsOne
          playerName={playerName}
          onBackToMenu={backToMenu}
        />
      )}
    </Layout>
  );
}

export default App;
