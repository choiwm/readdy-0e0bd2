/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        keyframes: {
          slideDown: {
            '0%': { opacity: '0', transform: 'translateX(-50%) translateY(-20px)' },
            '100%': { opacity: '1', transform: 'translateX(-50%) translateY(0)' },
          },
        },
        animation: {
          slideDown: 'slideDown 0.4s ease-out',
        },
        colors: {
          brand: {
            50:  '#eef2ff',
            100: '#e0e7ff',
            200: '#c7d2fe',
            300: '#a5b4fc',
            400: '#818cf8',
            500: '#6366f1',
            600: '#4f46e5',
            700: '#4338ca',
            800: '#3730a3',
            900: '#312e81',
          },
          accent: {
            300: '#d8b4fe',
            400: '#c084fc',
            500: '#a855f7',
            600: '#9333ea',
          },
        },
      },
    },
    plugins: [],
  }