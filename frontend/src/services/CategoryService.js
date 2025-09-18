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
        name: 'History',
        icon: '🏛️',
        description: 'Historical events, figures, and civilizations',
        color: 'amber',
        isGeneral: false
      },
      {
        id: 'science',
        name: 'Science',
        icon: '🧬',
        description: 'Biology, chemistry, physics, and technology',
        color: 'blue',
        isGeneral: false
      },
      {
        id: 'literature',
        name: 'Literature',
        icon: '📚',
        description: 'Books, authors, and literary works',
        color: 'purple',
        isGeneral: false
      },
      {
        id: 'geography',
        name: 'Geography',
        icon: '🌍',
        description: 'Countries, capitals, landmarks, and nature',
        color: 'green',
        isGeneral: false
      },
      {
        id: 'art',
        name: 'Art & Culture',
        icon: '🎨',
        description: 'Paintings, sculptures, music, and cultural heritage',
        color: 'pink',
        isGeneral: false
      },
      {
        id: 'sports',
        name: 'Sports',
        icon: '⚽',
        description: 'Athletes, competitions, and sporting events',
        color: 'orange',
        isGeneral: false
      },
      {
        id: 'entertainment',
        name: 'Entertainment',
        icon: '🎬',
        description: 'Movies, TV shows, celebrities, and pop culture',
        color: 'indigo',
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
        text: 'text-red-600'
      },
      amber: {
        bg: 'bg-amber-600',
        hover: 'hover:bg-amber-700',
        border: 'border-amber-500',
        text: 'text-amber-600'
      },
      blue: {
        bg: 'bg-blue-600',
        hover: 'hover:bg-blue-700',
        border: 'border-blue-500',
        text: 'text-blue-600'
      },
      purple: {
        bg: 'bg-purple-600',
        hover: 'hover:bg-purple-700',
        border: 'border-purple-500',
        text: 'text-purple-600'
      },
      green: {
        bg: 'bg-green-600',
        hover: 'hover:bg-green-700',
        border: 'border-green-500',
        text: 'text-green-600'
      },
      pink: {
        bg: 'bg-pink-600',
        hover: 'hover:bg-pink-700',
        border: 'border-pink-500',
        text: 'text-pink-600'
      },
      orange: {
        bg: 'bg-orange-600',
        hover: 'hover:bg-orange-700',
        border: 'border-orange-500',
        text: 'text-orange-600'
      },
      indigo: {
        bg: 'bg-indigo-600',
        hover: 'hover:bg-indigo-700',
        border: 'border-indigo-500',
        text: 'text-indigo-600'
      }
    };
  }
}

export default new CategoryService();
