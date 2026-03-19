/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        wise: {
          light: '#37517e',
          DEFAULT: '#00a3ff',
          dark: '#1a2b49',
          green: '#2ed06e'
        }
      }
    },
  },
  plugins: [],
}
