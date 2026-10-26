/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#f4f1e8',
          dark: '#d9d3c5',
          light: '#fffdf7',
        },
        accent: {
          DEFAULT: '#a0a0a0',
          dark: '#808080',
          light: '#c0c0c0',
        },
        'game-bg': '#0b0d12',
        'game-card': '#151820',
        'game-border': '#303541',
        'game-text': '#f5f5f7',
        'game-muted': '#a6adbd',
        'game-coral': '#ff9b8a',
        'game-mint': '#8de0c2',
        'game-sun': '#edd5a2',
        'game-blue': '#a8c7ff',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 rgba(242, 201, 76, 0)' },
          '50%': { boxShadow: '0 0 28px rgba(242, 201, 76, 0.28)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
