/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#ffffff',
          dark: '#e0e0e0',
          light: '#ffffff',
        },
        accent: {
          DEFAULT: '#a0a0a0',
          dark: '#808080',
          light: '#c0c0c0',
        },
        'game-bg': '#000000',
        'game-card': '#0a0a0a',
        'game-border': '#1a1a1a',
        'game-text': '#e5e5e5',
        'game-muted': '#737373',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255, 255, 255, 0.15)' },
          '50%': { boxShadow: '0 0 40px rgba(255, 255, 255, 0.3)' },
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
