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
      colors: {
        // Palet tenang untuk pemakaian lama di layar: latar abu kehijauan lembut (bukan putih murni),
        // teks tinta (bukan hitam murni), aksen teal tua yang tidak menyilaukan.
        canvas: '#f3f5f4',
        ink: {
          DEFAULT: '#1f2a30',
          muted: '#55636b',
          soft: '#7a878e',
        },
        line: '#dfe5e3',
        brand: {
          50: '#eef6f6',
          100: '#d6e9ea',
          200: '#b0d3d6',
          300: '#82b6bb',
          400: '#56959c',
          500: '#3b7b83',
          600: '#2f646b',
          700: '#285158',
          800: '#234449',
          900: '#1f393d',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(31, 42, 48, 0.04), 0 1px 3px rgba(31, 42, 48, 0.06)',
      },
    },
  },
  plugins: [],
};
