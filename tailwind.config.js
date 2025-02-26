/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      animation: {
        'slide-in': 'slideIn 0.3s ease-out forwards',
        'slide-out': 'slideOut 0.3s ease-in forwards',
        'pulse-ring': 'pulseRing 1.25s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateY(100%)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        slideOut: {
          '0%': { transform: 'translateY(0)', opacity: 1 },
          '100%': { transform: 'translateY(100%)', opacity: 0 },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.33)' },
          '80%, 100%': { opacity: 0 },
        },
      }
    },
  },
  plugins: [],
}