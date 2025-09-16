import React from 'react';

const Button = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  ...props
}) => {
  const baseClasses = 'font-semibold rounded-lg transition duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-hitman-red focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none';

  const variants = {
    primary: 'bg-hitman-red text-white hover:bg-red-700',
    secondary: 'bg-hitman-gray text-white hover:bg-gray-600',
    outline: 'border-2 border-hitman-red text-hitman-red hover:bg-hitman-red hover:text-white',
    danger: 'bg-red-600 text-white hover:bg-red-800'
  };

  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-6 py-3',
    lg: 'px-8 py-4 text-lg'
  };

  const classes = `${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`;

  return (
    <button
      className={classes}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
