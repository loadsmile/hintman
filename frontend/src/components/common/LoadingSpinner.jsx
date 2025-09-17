import React from 'react';

const LoadingSpinner = ({ size = 'md', className = '', message = 'Loading...' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className={`flex flex-col items-center justify-center space-y-3 ${className}`}>
      <div className={`${sizes[size]} border-2 border-hitman-red border-t-transparent rounded-full animate-spin`} />
      {message && (
        <p className="text-hitman-gray text-sm font-spy">{message}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;
