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
        'game-bg': '#101310',
        'game-card': '#1c1f1b',
        'game-border': '#3b4139',
        'game-text': '#f4f1e8',
        'game-muted': '#a7ada4',
        'game-coral': '#ff684d',
        'game-mint': '#63d5a4',
        'game-sun': '#f2c94c',
        'game-blue': '#65aaf6',
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
