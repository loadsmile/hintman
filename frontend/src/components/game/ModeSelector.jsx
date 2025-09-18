import React from 'react';
import Button from '../common/Button';

const ModeSelector = ({ onModeSelect, onBack, playerName }) => {
  const modes = [
    {
      id: 'general',
      name: 'Quick Mission',
      icon: '⚡',
      description: 'Jump straight into action with mixed intelligence from all categories',
      color: 'bg-red-600 hover:bg-red-700',
      features: ['All Categories Mixed', 'Fastest Matchmaking', 'Recommended for New Agents']
    },
    {
      id: 'category',
      name: 'Under Cover Mission',
      icon: '🎭',
      description: 'Choose your cover and area of expertise for a specialized mission',
      color: 'bg-blue-600 hover:bg-blue-700',
      features: ['Choose Your Category', 'Specialized Questions', 'Expert-Level Challenge']
    }
  ];

  return (
    <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-2xl max-w-3xl w-full text-black border border-gray-200">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-red-600 mb-4 font-spy">🎯 MISSION TYPE</h2>
          <p className="text-lg mb-2 text-gray-800">Agent {playerName}, select your mission parameters</p>
          <p className="text-sm text-gray-600">Choose how you want to engage the enemy</p>
        </div>

        <div className="space-y-6 mb-8">
          {modes.map((mode) => (
            <div
              key={mode.id}
              className="border-2 border-gray-200 rounded-lg p-6 cursor-pointer hover:shadow-lg transition-all duration-300 hover:border-gray-300 hover:scale-[1.02]"
              onClick={() => onModeSelect(mode.id)}
            >
              <div className="flex items-start space-x-4">
                <div className="text-4xl">{mode.icon}</div>

                <div className="flex-1">
                  <h3 className="text-xl font-spy font-bold text-gray-800 mb-2">
                    {mode.name}
                  </h3>
                  <p className="text-gray-600 mb-4 leading-relaxed">
                    {mode.description}
                  </p>

                  <div className="space-y-2">
                    {mode.features.map((feature, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <span className="text-green-500 text-sm">✓</span>
                        <span className="text-sm text-gray-600">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onModeSelect(mode.id);
                  }}
                  className={`${mode.color} text-white px-6 py-3 font-spy`}
                >
                  SELECT
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button onClick={onBack} variant="secondary" size="lg" className="px-12">
            🏠 BACK TO MENU
          </Button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            💡 Quick Mission is recommended for fastest matchmaking
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModeSelector;
