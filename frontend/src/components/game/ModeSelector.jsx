import React from 'react';
import Button from '../common/Button';

const ModeSelector = ({ onModeSelect, onBack, playerName }) => {
  const handleGeneralMode = () => {
    onModeSelect('general');
  };

  return (
    <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-2xl max-w-3xl w-full text-black border border-gray-200">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-red-600 mb-4 font-spy">🎯 MISSION TYPE</h2>
          <p className="text-lg mb-2 text-gray-800">Agent {playerName}, select your mission parameters</p>
          <p className="text-sm text-gray-600">Choose how you want to engage the enemy</p>
        </div>

        <div className="space-y-6 mb-8">
          <div className="border-2 border-gray-200 rounded-lg p-6 cursor-pointer hover:shadow-lg transition-all duration-300 hover:border-gray-300">
            <div className="flex items-start space-x-4">
              <div className="text-4xl">⚡</div>

              <div className="flex-1">
                <h3 className="text-xl font-spy font-bold text-gray-800 mb-2">
                  Quick Mission
                </h3>
                <p className="text-gray-600 mb-4 leading-relaxed">
                  Jump straight into action with mixed intelligence from all categories
                </p>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-green-500 text-sm">✓</span>
                    <span className="text-sm text-gray-600">All Categories Mixed</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-green-500 text-sm">✓</span>
                    <span className="text-sm text-gray-600">Fastest Matchmaking</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-green-500 text-sm">✓</span>
                    <span className="text-sm text-gray-600">Recommended for All Agents</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleGeneralMode}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3"
              >
                SELECT
              </Button>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Button onClick={onBack} variant="secondary" size="lg" className="px-12">
            🏠 BACK TO MENU
          </Button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            💡 More specialized missions coming soon
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModeSelector;
