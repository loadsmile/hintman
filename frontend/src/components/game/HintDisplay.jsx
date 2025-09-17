import React from 'react';

const HintDisplay = ({ hints, totalHints = 5, className = '' }) => {
  return (
    <div className={`hint-display ${className}`}>
      <div className="dossier-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-hitman-red font-spy">📋 INTELLIGENCE BRIEFING</h3>
          <div className="text-sm text-hitman-gray font-spy">
            {hints.length}/{totalHints} CLUES
          </div>
        </div>

        <div className="space-y-3">
          {hints.map((hint, index) => (
            <div
              key={index}
              className="hint-item bg-hitman-darkGray p-3 rounded border-l-2 border-hitman-red text-hitman-white animate-fade-in"
            >
              <div className="flex items-start space-x-2">
                <span className="text-hitman-red font-spy text-sm font-bold">#{index + 1}</span>
                <p className="text-sm leading-relaxed">{hint.text}</p>
              </div>
            </div>
          ))}

          {hints.length === 0 && (
            <div className="text-center py-8 text-hitman-gray">
              <div className="text-4xl mb-2">🔒</div>
              <p className="font-spy">Awaiting first intelligence drop...</p>
            </div>
          )}

          {hints.length < totalHints && hints.length > 0 && (
            <div className="text-center py-4">
              <div className="flex items-center justify-center space-x-2 text-hitman-gray">
                <div className="w-2 h-2 bg-hitman-red rounded-full animate-pulse"></div>
                <span className="font-spy text-sm">Next clue incoming...</span>
                <div className="w-2 h-2 bg-hitman-red rounded-full animate-pulse"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HintDisplay;
