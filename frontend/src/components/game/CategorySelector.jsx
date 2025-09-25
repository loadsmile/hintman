import React from 'react';
import CategoryService from '../../services/CategoryService';
import Button from '../common/Button';

const CategorySelector = ({ onCategorySelect, onBack, selectedCategory = null }) => {
  const specializedCategories = CategoryService.getSpecializedCategories();

  const handleCategorySelect = (category) => {
    onCategorySelect(category);
  };

  const getCategoryCardClasses = (category, isSelected) => {
    const baseClasses = 'p-6 rounded-xl cursor-pointer transition-all duration-300 transform hover:scale-105 backdrop-blur-sm shadow-xl';

    if (isSelected) {
      return `${baseClasses} bg-red-800/90 border-2 border-red-600/80 text-white shadow-red-900/50`;
    }

    return `${baseClasses} bg-gray-40 border border-gray-600/60 hover:border-red-600/60 text-white hover:shadow-red-900/20`;
  };

  const getCategoryTextColor = (category, isSelected) => {
    if (isSelected) return 'text-white';
    return 'text-gray-200';
  };

  return (
    <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
      <div className="max-w-5xl w-full mx-4">
        {/* Title Section */}
        <div className="text-center mb-12">
          <h2 className="text-6xl font-bold text-white mb-6 font-spy tracking-wider drop-shadow-2xl">
            CHOOSE YOUR COVER
          </h2>
          <p className="text-gray-200 text-xl drop-shadow-lg mb-6">
            Select your preferred area of expertise
          </p>

          {/* Info Note - Floating */}
          <div className="backdrop-blur-sm bg-gray-40 border gray-600/60 rounded-lg p-4 mb-8 max-w-3xl mx-auto shadow-xl">
            <p className="text-blue-200 text-sm drop-shadow-lg">
              <span className="font-semibold text-blue-300">Note:</span> This is your personal preference for display purposes.<br />
              <span className="font-semibold text-blue-300">Questions will be mixed from all categories</span> for fair gameplay.<br />
              You'll be matched with other "Under Cover Mission" players regardless of their choice.
            </p>
          </div>
        </div>

        {/* Category Grid - Floating Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {specializedCategories.map((category) => {
            const isSelected = selectedCategory?.id === category.id;

            return (
              <div
                key={category.id}
                className={getCategoryCardClasses(category, isSelected)}
                onClick={() => handleCategorySelect(category)}
              >
                <div className="text-center">
                  <div className="text-4xl mb-4 drop-shadow-lg">{category.icon}</div>
                  <h3 className={`text-lg font-spy font-bold mb-3 drop-shadow-lg ${getCategoryTextColor(category, isSelected)}`}>
                    {category.name}
                  </h3>
                  <p className={`text-sm leading-relaxed drop-shadow-lg ${isSelected ? 'text-gray-100' : 'text-gray-300'}`}>
                    {category.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Category Display - Floating */}
        {selectedCategory && (
          <div className="backdrop-blur-sm bg-gray-40 border-l-4 border-red-600 rounded-lg p-6 mb-8 shadow-xl">
            <div className="flex items-center space-x-4">
              <span className="text-3xl drop-shadow-lg">{selectedCategory.icon}</span>
              <div>
                <h4 className="font-spy font-bold text-white text-lg drop-shadow-lg">
                  Your Cover: {selectedCategory.name}
                </h4>
                <p className="text-gray-300 text-sm drop-shadow-lg">
                  This will be shown as your specialty during the game
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 mb-8">
          <Button
            onClick={onBack}
            variant="secondary"
            className="flex-1 px-8 py-4 bg-gray-40 hover:bg-gray-700/90 backdrop-blur-sm border border-gray-700/60 hover:border-gray-600/80 text-white text-lg font-semibold rounded-xl transition-all duration-300 shadow-2xl hover:shadow-gray-900/30"
          >
            🏠 BACK TO MISSION SELECT
          </Button>

          <Button
            onClick={() => selectedCategory && onCategorySelect(selectedCategory)}
            disabled={!selectedCategory}
            variant="primary"
            className={`flex-1 px-8 py-4 text-lg font-semibold rounded-xl transition-all duration-300 shadow-2xl ${
              selectedCategory
                ? 'bg-red-800/90 hover:bg-red-700/90 backdrop-blur-sm border border-red-700/60 hover:border-red-600/80 text-white hover:shadow-red-900/30'
                : 'bg-gray-40 border border-gray-500/50 text-gray-400 cursor-not-allowed'
            }`}
          >
            {selectedCategory ? `🎯 CONFIRM ${selectedCategory.name.toUpperCase()}` : '⚠️ SELECT YOUR COVER'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CategorySelector;
