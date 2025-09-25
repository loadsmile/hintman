import React from 'react';
import Button from '../common/Button';

const ModeSelector = ({ onModeSelect, onBack, playerName }) => {
  const modes = [
    {
      id: 'general',
      name: 'Quick Mission',
      icon: '⚡',
      description: 'Jump straight into action with mixed intelligence from all categories',
      features: ['All Categories Mixed', 'Fastest Matchmaking', 'Recommended for New Agents']
    },
    {
      id: 'category',
      name: 'Under Cover Mission',
      icon: '🎭',
      description: 'Choose your cover and area of expertise for a specialized mission',
      features: ['Choose Your Category', 'Specialized Questions', 'Expert-Level Challenge']
    }
  ];

  return (
    <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
      <div className="max-w-3xl w-full mx-4">
        {/* Title Section */}
        <div className="text-center mb-12">
          <h2 className="text-6xl font-bold text-white mb-6 font-spy tracking-wider drop-shadow-2xl">
            MISSION TYPE
          </h2>
          <p className="text-gray-200 text-xl drop-shadow-lg mb-3">
            Agent {playerName}, select your mission parameters
          </p>
          <p className="text-gray-300 drop-shadow-lg">
            Choose how you want to engage the enemy
          </p>
        </div>

        {/* Mission Types - Pure Floating Elements */}
        <div className="space-y-8 mb-12">
          {modes.map((mode) => (
            <div
              key={mode.id}
              className="cursor-pointer group transition-all duration-300 hover:scale-105"
              onClick={() => onModeSelect(mode.id)}
            >
              {/* Mission Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <span className="text-red-400 text-4xl drop-shadow-lg group-hover:scale-110 transition-transform duration-300">
                    {mode.icon}
                  </span>
                  <h3 className="text-3xl font-spy font-bold text-white drop-shadow-lg">
                    {mode.name}
                  </h3>
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onModeSelect(mode.id);
                  }}
                  className="px-8 py-3 bg-red-800/90 hover:bg-red-700/90 backdrop-blur-sm border border-red-700/60 hover:border-red-600/80 text-white font-spy rounded-xl transition-all duration-300 shadow-2xl hover:shadow-red-900/30"
                >
                  SELECT
                </Button>
              </div>

              {/* Mission Description */}
              <div className="ml-16 space-y-3">
                <p className="text-gray-200 text-lg drop-shadow-lg leading-relaxed">
                  {mode.description}
                </p>

                {/* Features List */}
                <div className="space-y-2">
                  {mode.features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <span className="text-green-400 text-lg drop-shadow-lg">✓</span>
                      <span className="text-gray-300 drop-shadow-lg">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Back Button and Note */}
        <div className="text-center space-y-4">
          <Button
            onClick={onBack}
            variant="secondary"
            size="lg"
            className="px-16 py-4 bg-gray-800/90 hover:bg-gray-700/90 backdrop-blur-sm border border-gray-700/60 hover:border-gray-600/80 text-white text-lg font-semibold rounded-xl transition-all duration-300 shadow-2xl hover:shadow-gray-900/30"
          >
            🏠 BACK TO HQ
          </Button>

          <p className="text-gray-400 text-sm drop-shadow-lg">
            💡 Quick Mission is recommended for fastest matchmaking
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModeSelector;
