/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        purple: {
          900: '#1a1a2e',
          800: '#2a2a3a',
          700: '#3a3a4a',
          600: '#4a4a5a',
          500: '#5a5a6a',
          400: '#6a6a7a',
          300: '#7a7a8a',
          200: '#8a8a9a',
          100: '#9a9aaa',
        },
        indigo: {
          800: '#2a2a4a',
          700: '#3a3a5a',
          600: '#4a4a6a',
          500: '#5a5a7a',
          400: '#6a6a8a',
          300: '#7a7a9a',
          200: '#8a8aaa',
          100: '#9a9aba',
        },
      },
    },
  },
  plugins: [],
} 