import React from 'react';

const HintDisplay = ({ hints, totalHints }) => {
  return (
    <div className="bg-hitman-darkGray bg-opacity-90 p-6 rounded-lg border border-hitman-red h-fit">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-spy text-hitman-red">INTELLIGENCE BRIEFING</h3>
        <span className="text-hitman-gray text-sm">
          {hints.length} / {Math.min(totalHints, 5)} clues revealed
        </span>
      </div>

      <div className="space-y-4">
        {hints.length === 0 ? (
          <div className="text-hitman-gray italic text-center py-8">
            <p className="mb-2">🕵️‍♂️</p>
            <p>Analyzing target...</p>
            <p className="text-sm mt-2">First clue incoming...</p>
          </div>
        ) : (
          hints.map((hint, index) => (
            <div
              key={hint.index || index}
              className="bg-hitman-black bg-opacity-50 p-4 rounded border border-hitman-gray animate-fadeIn"
            >
              <div className="flex items-start space-x-3">
                <div className="bg-hitman-red text-hitman-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {index + 1}
                </div>
                <p className="text-hitman-white leading-relaxed">{hint.text}</p>
              </div>
            </div>
          ))
        )}

        {hints.length > 0 && hints.length < Math.min(totalHints, 5) && (
          <div className="text-center text-hitman-gray text-sm italic pt-2 border-t border-hitman-gray border-opacity-30">
            Next clue in 15 seconds...
          </div>
        )}

        {hints.length >= Math.min(totalHints, 5) && (
          <div className="text-center text-hitman-red text-sm font-bold pt-2 border-t border-hitman-red border-opacity-50">
            All clues revealed! Make your move!
          </div>
        )}
      </div>
    </div>
  );
};

export default HintDisplay;
