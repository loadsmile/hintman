import React from 'react';
import CategoryService from '../../services/CategoryService';
import Button from '../common/Button';

const CategorySelector = ({ onCategorySelect, onBack, selectedCategory = null }) => {
  const categories = CategoryService.getAllCategories();
  const colors = CategoryService.getCategoryColors();

  const handleCategorySelect = (category) => {
    onCategorySelect(category);
  };

  const getCategoryCardClasses = (category, isSelected) => {
    const colorTheme = colors[category.color];
    const baseClasses = 'p-6 rounded-lg border-2 cursor-pointer transition-all duration-300 transform hover:scale-105';

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
      <div className="bg-white p-8 rounded-lg shadow-2xl max-w-4xl w-full text-black border border-gray-200">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-red-600 mb-4 font-spy">🎭 CHOOSE YOUR COVER</h2>
          <p className="text-lg mb-2 text-gray-800">Agent, select your area of expertise for this mission</p>
          <p className="text-sm text-gray-600">Each category provides specialized intelligence briefings</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {categories.map((category) => {
            const isSelected = selectedCategory?.id === category.id;

            return (
              <div
                key={category.id}
                className={getCategoryCardClasses(category, isSelected)}
                onClick={() => handleCategorySelect(category)}
              >
                <div className="text-center">
                  <div className="text-4xl mb-3">{category.icon}</div>
                  <h3 className={`text-lg font-spy font-bold mb-2 ${getCategoryTextColor(category, isSelected)}`}>
                    {category.name}
                  </h3>
                  <p className={`text-xs leading-relaxed ${isSelected ? 'text-gray-100' : 'text-gray-600'}`}>
                    {category.description}
                  </p>

                  {category.isGeneral && (
                    <div className="mt-3 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded font-bold">
                      RECOMMENDED
                    </div>
                  )}
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
                <h4 className="font-spy font-bold text-gray-800">Selected: {selectedCategory.name}</h4>
                <p className="text-sm text-gray-600">{selectedCategory.description}</p>
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
            🏠 BACK TO HQ
          </Button>

          <Button
            onClick={() => selectedCategory && onCategorySelect(selectedCategory)}
            disabled={!selectedCategory}
            variant="primary"
            className="flex-1"
          >
            {selectedCategory ? `🎯 CONFIRM ${selectedCategory.name.toUpperCase()}` : '⚠️ SELECT A CATEGORY'}
          </Button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            💡 Tip: General Knowledge provides the most diverse experience for new agents
          </p>
        </div>
      </div>
    </div>
  );
};

export default CategorySelector;
