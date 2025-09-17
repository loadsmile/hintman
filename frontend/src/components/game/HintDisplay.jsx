import React from 'react';

const HintDisplay = ({ hints = [], totalHints = 5 }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-spy text-red-600">🎯 INTELLIGENCE BRIEFING</h3>
        <span className="text-sm text-gray-500">{hints.length}/5 clues revealed</span>
      </div>

      <div className="space-y-3">
        {hints.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">Awaiting intelligence...</p>
          </div>
        )}

        {hints.map((hint, index) => (
          <div
            key={index}
            className="flex items-start space-x-3 p-3 bg-gray-50 rounded border border-gray-200"
          >
            <div className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              {index + 1}
            </div>
            <p className="text-gray-800 text-sm leading-relaxed flex-1">
              {hint.text}
            </p>
          </div>
        ))}

        {hints.length < totalHints && hints.length > 0 && (
          <div className="text-center py-2">
            <p className="text-gray-500 text-xs">
              Next clue in 15 seconds...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HintDisplay;
