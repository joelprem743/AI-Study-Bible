/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        telugu: ['"Noto Sans Telugu"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
