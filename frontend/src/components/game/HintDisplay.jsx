import React from 'react';

const HintDisplay = ({ hints = [], totalHints = 5, className = '' }) => {
  return (
    <div className={`hint-display ${className}`}>
      <div className="dossier-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-hitman-red font-spy">📋 INTELLIGENCE BRIEFING</h3>
          <div className="text-sm text-hitman-gray font-spy">
            {hints.length}/5 clues revealed
          </div>
        </div>

        <div className="space-y-3">
          {hints.length === 0 && (
            <div className="text-center py-8">
              <p className="text-hitman-gray text-sm font-spy">Awaiting intelligence...</p>
            </div>
          )}

          {hints.map((hint, index) => (
            <div
              key={index}
              className="flex items-start space-x-3 p-3 bg-hitman-lightGray rounded border-l-4 border-hitman-red"
            >
              <div className="flex-shrink-0 w-6 h-6 bg-hitman-red text-white rounded-full flex items-center justify-center text-sm font-bold">
                {index + 1}
              </div>
              <p className="text-hitman-black text-sm leading-relaxed flex-1 font-spy">
                {hint.text}
              </p>
            </div>
          ))}

          {hints.length < totalHints && hints.length > 0 && (
            <div className="text-center py-2">
              <p className="text-hitman-gray text-xs font-spy">
                Next clue in 15 seconds...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HintDisplay;
