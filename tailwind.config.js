export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hitman: {
          black: '#1a1a1a',
          red: '#dc2626',
          white: '#f8fafc',
          gray: '#4a5568',
          darkGray: '#2d3748'
        }
      },
      fontFamily: {
        'spy': ['Courier New', 'monospace'],
        'elegant': ['Georgia', 'serif']
      }
    },
  },
  plugins: [],
}
