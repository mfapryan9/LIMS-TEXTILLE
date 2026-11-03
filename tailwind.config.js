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
        // Palet brand marun + krem hangat (lihat README): lembut di mata untuk pemakaian lama.
        white: '#FFFDF9', // kartu: putih hangat di atas latar krem
        canvas: '#FAF5EF', // Background: krem putih
        surface: '#EFE6DA', // Surface: pasir hangat (header tabel, section selang-seling)
        ink: {
          DEFAULT: '#2A1C1A', // Text: cokelat hampir hitam
          muted: '#7A6A66', // Text muted: cokelat abu
          soft: '#9C8C87',
        },
        line: '#E6DACB',
        brand: {
          50: '#FBF2F0',
          100: '#F5E0DC',
          200: '#EAC0B9',
          300: '#DA9489',
          400: '#B8453B', // Primary light: bata terang (link, highlight, ikon)
          500: '#A03830',
          600: '#8A2B25', // Primary: marun brand (navbar, tombol utama, footer)
          700: '#5C1A16', // Primary dark: marun gelap (hover tombol, heading section gelap)
          800: '#4C1512',
          900: '#3B100E',
          950: '#250907',
        },
        accent: {
          50: '#FBF6E9',
          100: '#F4E9C8',
          200: '#E8D49A',
          DEFAULT: '#C9A24B', // Accent: emas lembut (badge, garis dekoratif, CTA sekunder)
          600: '#A9843A',
          700: '#7E6229',
        },
      },      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(42, 28, 26, 0.04), 0 1px 3px rgba(42, 28, 26, 0.06)',
        soft: '0 12px 32px -12px rgba(42, 28, 26, 0.18)',
        glow: '0 8px 24px -8px rgba(138, 43, 37, 0.45)',
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
