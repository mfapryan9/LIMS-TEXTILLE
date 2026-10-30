/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Netral sejuk yang nyaman untuk pemakaian lama + aksen teal modern.
        canvas: '#f4f6f8',
        ink: {
          DEFAULT: '#141c24',
          muted: '#56626d',
          soft: '#8b96a0',
        },
        line: '#e5e9ee',
        brand: {
          50: '#effaf8',
          100: '#d6f1ec',
          200: '#ade2d8',
          300: '#7bcbbe',
          400: '#4aac9e',
          500: '#2e9183',
          600: '#22746a',
          700: '#1e5d56',
          800: '#1b4b46',
          900: '#193f3b',
          950: '#0b2522',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.05)',
        soft: '0 12px 32px -12px rgba(16, 24, 40, 0.18)',
        glow: '0 8px 24px -8px rgba(46, 145, 131, 0.45)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'fade-up': 'fade-up .25s ease-out both',
      },
    },
  },
  plugins: [],
};
