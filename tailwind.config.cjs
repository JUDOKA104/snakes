/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#666966",
          accent: "#005A1E"
        }
      }
    },
  },
  plugins: [],
};
