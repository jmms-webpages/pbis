/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Core school palette — deliberately deeper/more saturated than
        // generic "school purple" so it reads intentional, not a template.
        plum: {
          50: '#f5f1fa',
          100: '#e8dcf5',
          200: '#d2b9eb',
          300: '#b088d9',
          400: '#8f5cc4',
          500: '#6f3aa8',
          600: '#582c88',
          700: '#452368',
          800: '#33194d',
          900: '#221033',
        },
        gold: {
          50: '#fdf9ec',
          100: '#faf0c9',
          200: '#f3dd8a',
          300: '#ecc94f',
          400: '#e0af1f',
          500: '#c2930f',
          600: '#9c740c',
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
