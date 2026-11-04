/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0F4C5C',
          dark: '#0A3540',
          tint: '#E3F0F1',
        },
        'brand-dark': '#0A3540',
        'brand-tint': '#E3F0F1',
        secondary: {
          DEFAULT: '#475C7A',
          tint: '#E8ECF2',
        },
        'secondary-tint': '#E8ECF2',
        accent: {
          DEFAULT: '#C2561A',
          dark: '#A8450F',
          tint: '#FBEBDD',
        },
        'accent-dark': '#A8450F',
        'accent-tint': '#FBEBDD',
        ink: {
          DEFAULT: '#14232B',
          muted: '#5C6B75',
        },
        'ink-muted': '#5C6B75',
        paper: '#F6F8F9',
        surface: '#FFFFFF',
        good: {
          DEFAULT: '#2A9D8F',
          tint: '#E6F6F4',
        },
        'good-tint': '#E6F6F4',
        danger: {
          DEFAULT: '#B3261E',
          tint: '#FDECEB',
        },
        'danger-tint': '#FDECEB',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        xl: '12px',
        card: '12px',
      },
      boxShadow: {
        soft: '0 2px 10px -2px rgba(20, 35, 43, 0.05), 0 1px 3px -1px rgba(20, 35, 43, 0.03)',
        card: '0 4px 16px -2px rgba(20, 35, 43, 0.06)',
      },
    },
  },
  plugins: [],
};
