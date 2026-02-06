/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sage: {
          50: '#f6f8f7',
          100: '#e3e9e5',
          200: '#c7d3cb',
          300: '#a8c5b5',
          400: '#8fb5a0',
          500: '#72a089',
          600: '#5c8571',
          700: '#4a6a5c',
          800: '#3e584c',
          900: '#354a40',
        },
        'bakery-accent': '#5c8571',
        'bakery-muted': '#6b7280',
        'bakery-bg': '#f9fafb',
        'bakery-ink': '#111827',
      },
    },
  },
  plugins: [],
}