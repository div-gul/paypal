/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefcf5',
          100: '#d7f7e7',
          200: '#b2edd3',
          300: '#7dddb9',
          400: '#43c59a',
          500: '#1faa80',
          600: '#138966',
          700: '#116d53',
          800: '#115743',
          900: '#104738',
        },
        paypal: {
          blue: '#003087',
          lightBlue: '#0079C1',
          darkBlue: '#001C64',
          yellow: '#FFC439',
        }
      }
    },
  },
  plugins: [],
}
