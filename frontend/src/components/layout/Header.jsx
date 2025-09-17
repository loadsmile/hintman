import React from 'react';

const Header = () => {
  return (
    <header className="bg-hitman-black border-b border-hitman-red p-4">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="text-2xl">🎯</div>
          <h1 className="text-2xl font-bold text-hitman-red font-spy">HINTMAN</h1>
        </div>
        <div className="text-sm text-hitman-gray font-spy">
          Classified Intelligence Game
        </div>
      </div>
    </header>
  );
};

export default Header;
