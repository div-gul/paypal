/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'night-teal': '#0A3540',
        teal: {
          DEFAULT: '#0F4C5C',
          dark: '#0A3540',
          tint: '#E3F0F1',
        },
        mist: '#E3F0F1',
        slate: '#475C7A',
        sand: '#FBEBDD',
        orange: {
          DEFAULT: '#C2561A',
          hover: '#A8450F',
          dark: '#A8450F',
        },
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
        paper: '#F4F7F6',
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
        sans: ['Bricolage Grotesque', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
      },
      borderRadius: {
        xl: '12px',
        card: '12px',
        'card-lg': '28px',
        'card-sm': '20px',
      },
      boxShadow: {
        soft: '0 2px 10px -2px rgba(20, 35, 43, 0.05), 0 1px 3px -1px rgba(20, 35, 43, 0.03)',
        card: '0 4px 16px -2px rgba(20, 35, 43, 0.06)',
        'landing-soft': '0 12px 32px rgba(10, 53, 64, 0.10)',
      },
    },
  },
  plugins: [],
};
