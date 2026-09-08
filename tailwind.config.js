/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Jackson Local Schools official palette:
        // Primary Purple #501b99 with rich supporting shades
        // Secondary Athletic Gold #fbbb04 with crisp contrasting shades
        plum: {
          50: '#f5f0fb',
          100: '#e8dbf7',
          200: '#d4bcf0',
          300: '#b892e6',
          400: '#9b64dc',
          500: '#7e3ad0',
          600: '#6825ba',
          700: '#501b99', // Jackson primary purple
          800: '#3e1378',
          900: '#2c0c57', // Deep header & background purple
        },
        gold: {
          50: '#fffcf0',
          100: '#fef7d6',
          200: '#fdeda8',
          300: '#fce075',
          400: '#fbbb04', // Jackson official secondary gold
          500: '#dfa202',
          600: '#b88300',
        },
        paper: '#fbfaf7',
      },
      fontFamily: {
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        body: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(34, 16, 51, 0.06), 0 4px 16px rgba(34, 16, 51, 0.06)',
      },
    },
  },
  plugins: [],
};
