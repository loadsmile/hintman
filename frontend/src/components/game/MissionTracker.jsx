import React from 'react';

const MissionTracker = ({ correctAnswers = 0, mistakes = 0, playerName, isMyTracker = false }) => {
  const maxTrackers = 10; // Show up to 10 results
  const totalAttempts = correctAnswers + mistakes;

  // Create array of results (true = correct, false = mistake)
  const results = [];
  for (let i = 0; i < correctAnswers; i++) {
    results.push(true);
  }
  for (let i = 0; i < mistakes; i++) {
    results.push(false);
  }

  // Create empty slots for remaining attempts
  const emptySlots = Math.max(0, maxTrackers - totalAttempts);

  return (
    <div className={`mission-tracker ${isMyTracker ? 'my-tracker' : 'opponent-tracker'}`}>
      <div className="tracker-header mb-2">
        <h3 className="text-sm font-spy font-bold text-black">
          {isMyTracker ? '👤 YOUR RECORD' : `🎯 ${playerName?.toUpperCase()} RECORD`}
        </h3>
        <div className="text-xs text-gray-300">
          <span className="text-green-400">✓ {correctAnswers}</span>
          <span className="mx-2">•</span>
          <span className="text-red-400">✗ {mistakes}</span>
        </div>
      </div>

      <div className="tracker-grid flex flex-wrap gap-1">
        {/* Correct answers - green squares */}
        {results.map((isCorrect, index) => (
          <div
            key={`result-${index}`}
            className={`tracker-square ${
              isCorrect
                ? 'bg-green-500 border-green-400 correct-square'
                : 'bg-red-500 border-red-400 mistake-square'
            }`}
            title={isCorrect ? 'Target Eliminated ✓' : 'Missed Shot ✗'}
          >
            <div className="square-inner">
              {isCorrect ? (
                <span className="text-white text-xs font-bold">✓</span>
              ) : (
                <span className="text-white text-xs font-bold">✗</span>
              )}
            </div>
          </div>
        ))}

        {/* Empty slots */}
        {Array.from({ length: emptySlots }, (_, index) => (
          <div
            key={`empty-${index}`}
            className="tracker-square bg-gray-600 border-gray-500 empty-square"
            title="Awaiting Result..."
          >
            <div className="square-inner">
              <span className="text-gray-400 text-xs">—</span>
            </div>
          </div>
        ))}
      </div>

      <div className="tracker-stats mt-2 text-xs text-gray-400">
        <div className="flex justify-between">
          <span>Accuracy:</span>
          <span className="text-gray-200">
            {totalAttempts > 0 ? Math.round((correctAnswers / totalAttempts) * 100) : 0}%
          </span>
        </div>
      </div>

      <style jsx>{`
        .tracker-square {
          width: 24px;
          height: 24px;
          border: 1px solid;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .tracker-square:hover {
          transform: scale(1.1);
          z-index: 10;
        }

        .correct-square {
          box-shadow: 0 0 8px rgba(34, 197, 94, 0.3);
        }

        .correct-square:hover {
          box-shadow: 0 0 12px rgba(34, 197, 94, 0.5);
        }

        .mistake-square {
          box-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
        }

        .mistake-square:hover {
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.5);
        }

        .empty-square {
          opacity: 0.6;
        }

        .square-inner {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .my-tracker {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(59, 130, 246, 0.1));
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .opponent-tracker {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(168, 85, 247, 0.1));
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .mission-tracker {
          padding: 12px;
          border-radius: 8px;
          backdrop-filter: blur(10px);
        }

        .tracker-header {
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 8px;
        }
      `}</style>
    </div>
  );
};

export default MissionTracker;
