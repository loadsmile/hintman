class CategoryService {
  constructor() {
    this.categories = [
      {
        id: 'general',
        name: 'General Knowledge',
        icon: '🎯',
        description: 'Mixed questions from all categories',
        color: 'red',
        isGeneral: true
      },
      {
        id: 'history',
        name: 'History & Politics',
        icon: '🏛️',
        description: 'Historical events, figures, wars, and political systems',
        color: 'amber',
        isGeneral: false
      },
      {
        id: 'science',
        name: 'Science & Technology',
        icon: '🧬',
        description: 'Biology, chemistry, physics, medicine, and technology',
        color: 'blue',
        isGeneral: false
      },
      {
        id: 'literature',
        name: 'Literature & Arts',
        icon: '📚',
        description: 'Books, authors, poetry, and literary works',
        color: 'purple',
        isGeneral: false
      },
      {
        id: 'geography',
        name: 'Geography & Nature',
        icon: '🌍',
        description: 'Countries, capitals, landmarks, and natural wonders',
        color: 'green',
        isGeneral: false
      },
      {
        id: 'entertainment',
        name: 'Entertainment & Media',
        icon: '🎬',
        description: 'Movies, TV shows, music, and pop culture',
        color: 'indigo',
        isGeneral: false
      },
      {
        id: 'sports',
        name: 'Sports & Games',
        icon: '⚽',
        description: 'Athletes, competitions, Olympics, and sporting events',
        color: 'orange',
        isGeneral: false
      },
      {
        id: 'food',
        name: 'Food & Culture',
        icon: '🍕',
        description: 'Cuisine, cooking, cultural traditions, and recipes',
        color: 'yellow',
        isGeneral: false
      }
    ];
  }

  getAllCategories() {
    return [...this.categories];
  }

  getGeneralCategory() {
    return this.categories.find(cat => cat.isGeneral);
  }

  getSpecializedCategories() {
    return this.categories.filter(cat => !cat.isGeneral);
  }

  getCategoryById(id) {
    return this.categories.find(cat => cat.id === id);
  }

  getCategoryColors() {
    return {
      red: {
        bg: 'bg-red-600',
        hover: 'hover:bg-red-700',
        border: 'border-red-500',
        text: 'text-red-600',
        ring: 'ring-red-500'
      },
      amber: {
        bg: 'bg-amber-600',
        hover: 'hover:bg-amber-700',
        border: 'border-amber-500',
        text: 'text-amber-600',
        ring: 'ring-amber-500'
      },
      blue: {
        bg: 'bg-blue-600',
        hover: 'hover:bg-blue-700',
        border: 'border-blue-500',
        text: 'text-blue-600',
        ring: 'ring-blue-500'
      },
      purple: {
        bg: 'bg-purple-600',
        hover: 'hover:bg-purple-700',
        border: 'border-purple-500',
        text: 'text-purple-600',
        ring: 'ring-purple-500'
      },
      green: {
        bg: 'bg-green-600',
        hover: 'hover:bg-green-700',
        border: 'border-green-500',
        text: 'text-green-600',
        ring: 'ring-green-500'
      },
      indigo: {
        bg: 'bg-indigo-600',
        hover: 'hover:bg-indigo-700',
        border: 'border-indigo-500',
        text: 'text-indigo-600',
        ring: 'ring-indigo-500'
      },
      orange: {
        bg: 'bg-orange-600',
        hover: 'hover:bg-orange-700',
        border: 'border-orange-500',
        text: 'text-orange-600',
        ring: 'ring-orange-500'
      },
      yellow: {
        bg: 'bg-yellow-600',
        hover: 'hover:bg-yellow-700',
        border: 'border-yellow-500',
        text: 'text-yellow-600',
        ring: 'ring-yellow-500'
      }
    };
  }
}

export default new CategoryService();
