import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecf8f3',
          100: '#d1eee2',
          500: '#0d7a5f',
          600: '#0b6750',
          700: '#095442',
        },
        cta: {
          500: '#f2740d',
          600: '#dd6605',
        },
        ink: '#101b17',
        paper: '#fafaf8',
        night: '#0c1210',
        'night-card': '#141d19',
      },
      fontFamily: {
        display: ['var(--font-sora)', 'sans-serif'],
        sans: ['var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
