/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b0c0e',
        fg: '#e6e8ea',
        muted: '#9aa3ad',
        accent: '#14b86e',
        card: '#0f1115',
        border: '#21242c',
      },
      boxShadow: {
        glow: '0 0 20px rgba(20,184,110,0.35)',
      },
      borderRadius: {
        xl2: '1.25rem'
      }
    },
  },
  plugins: [],
};
