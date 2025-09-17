import React, { useState, useEffect, useRef } from 'react';
import Button from '../common/Button';

const GuessInput = ({
  onSubmit,
  disabled = false,
  placeholder = "Enter your deduction...",
  className = ''
}) => {
  const [guess, setGuess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedGuess = guess.trim();

    if (!trimmedGuess || disabled || isSubmitting) return;

    setIsSubmitting(true);

    try {
      await onSubmit(trimmedGuess);
      setGuess('');
    } catch (error) {
      console.error('Error submitting guess:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className={`guess-input ${className}`}>
      <form onSubmit={handleSubmit} className="dossier-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-hitman-red font-spy">🎯 SUBMIT TARGET</h3>
          <div className="text-sm text-hitman-gray font-spy">
            {disabled ? 'MISSION COMPLETE' : 'AWAITING RESPONSE'}
          </div>
        </div>

        <div className="flex space-x-3">
          <input
            ref={inputRef}
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled || isSubmitting}
            className="flex-1 p-3 border border-hitman-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-hitman-red focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            maxLength={100}
            autoComplete="off"
          />

          <Button
            type="submit"
            disabled={disabled || isSubmitting || !guess.trim()}
            variant="primary"
            className="px-6"
          >
            {isSubmitting ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>PROCESSING...</span>
              </div>
            ) : (
              '🎯 ELIMINATE'
            )}
          </Button>
        </div>

        <div className="mt-2 text-xs text-hitman-gray font-spy">
          Press Enter to submit your guess
        </div>
      </form>
    </div>
  );
};

export default GuessInput;
