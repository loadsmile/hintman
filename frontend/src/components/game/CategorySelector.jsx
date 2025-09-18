import React from 'react';
import CategoryService from '../../services/CategoryService';
import Button from '../common/Button';

const CategorySelector = ({ onCategorySelect, onBack, selectedCategory = null }) => {
  const specializedCategories = CategoryService.getSpecializedCategories();
  const colors = CategoryService.getCategoryColors();

  const handleCategorySelect = (category) => {
    onCategorySelect(category);
  };

  const getCategoryCardClasses = (category, isSelected) => {
    const colorTheme = colors[category.color];
    const baseClasses = 'p-4 rounded-lg border-2 cursor-pointer transition-all duration-300 transform hover:scale-105';

    if (isSelected) {
      return `${baseClasses} ${colorTheme.bg} border-white text-white shadow-lg`;
    }

    return `${baseClasses} bg-white ${colorTheme.border} hover:shadow-lg hover:border-opacity-80`;
  };

  const getCategoryTextColor = (category, isSelected) => {
    if (isSelected) return 'text-white';
    const colorTheme = colors[category.color];
    return colorTheme.text;
  };

  return (
    <div className="relative z-20 flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-2xl max-w-5xl w-full text-black border border-gray-200">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-red-600 mb-4 font-spy">🎭 CHOOSE YOUR COVER</h2>
          <p className="text-lg mb-2 text-gray-800">Select your preferred area of expertise</p>
          <div className="bg-blue-100 border border-blue-300 rounded p-3 mb-4">
            <p className="text-sm text-blue-800">
              <strong>💡 Note:</strong> This is your personal preference for display purposes.<br />
              <strong>Questions will be mixed from all categories</strong> for fair gameplay.<br />
              You'll be matched with other "Under Cover Mission" players regardless of their choice.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {specializedCategories.map((category) => {
            const isSelected = selectedCategory?.id === category.id;

            return (
              <div
                key={category.id}
                className={getCategoryCardClasses(category, isSelected)}
                onClick={() => handleCategorySelect(category)}
              >
                <div className="text-center">
                  <div className="text-3xl mb-3">{category.icon}</div>
                  <h3 className={`text-sm font-spy font-bold mb-2 ${getCategoryTextColor(category, isSelected)}`}>
                    {category.name}
                  </h3>
                  <p className={`text-xs leading-relaxed ${isSelected ? 'text-gray-100' : 'text-gray-600'}`}>
                    {category.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {selectedCategory && (
          <div className="bg-gray-100 p-4 rounded-lg mb-6 border-l-4 border-red-600">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{selectedCategory.icon}</span>
              <div>
                <h4 className="font-spy font-bold text-gray-800">Your Cover: {selectedCategory.name}</h4>
                <p className="text-sm text-gray-600">This will be shown as your specialty during the game</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex space-x-4">
          <Button
            onClick={onBack}
            variant="secondary"
            className="flex-1"
          >
            🏠 BACK TO MISSION SELECT
          </Button>

          <Button
            onClick={() => selectedCategory && onCategorySelect(selectedCategory)}
            disabled={!selectedCategory}
            variant="primary"
            className="flex-1"
          >
            {selectedCategory ? `🎯 CONFIRM ${selectedCategory.name.toUpperCase()}` : '⚠️ SELECT YOUR COVER'}
          </Button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            💡 All players get the same mixed questions regardless of their chosen cover
          </p>
        </div>
      </div>
    </div>
  );
};

export default CategorySelector;
