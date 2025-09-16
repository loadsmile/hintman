import React, { useState, useEffect } from 'react';

const Timer = ({
  duration = 60,
  onComplete,
  isActive = true,
  className = '',
  showProgress = true
}) => {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    setTimeLeft(duration);
  }, [duration]);

  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onComplete && onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, timeLeft, onComplete]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = ((duration - timeLeft) / duration) * 100;
  const isWarning = timeLeft <= 10;

  return (
    <div className={`timer ${className}`}>
      <div className="flex items-center space-x-3">
        <div className={`text-lg font-spy ${isWarning ? 'text-hitman-red animate-pulse' : 'text-hitman-white'}`}>
          ⏱️ {formatTime(timeLeft)}
        </div>
        {showProgress && (
          <div className="flex-1 bg-hitman-darkGray rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-1000 ${
                isWarning ? 'bg-hitman-red' : 'bg-green-500'
              }`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Timer;
