/** @type {import('tailwindcss').Config} */
const colors = require("tailwindcss/colors");

/*
 * Dark theme surface scale.
 *
 * The dark end of `slate` and `gray` (600–950) reads from CSS variables.
 * In light mode the variables are unset, so the stock Tailwind values are
 * used. Under `.dark` (see src/index.css) both scales point at one navy
 * palette, so every existing `dark:bg-slate-800`, `dark:border-gray-700`,
 * etc. lands on the same tuned surfaces without touching light mode.
 */
const themed = (name, fallback) =>
  `rgb(var(--${name}, ${fallback}) / <alpha-value>)`;

module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: {
          ...colors.slate,
          600: themed("slate-600", "71 85 105"),
          700: themed("slate-700", "51 65 85"),
          800: themed("slate-800", "30 41 59"),
          900: themed("slate-900", "15 23 42"),
          950: themed("slate-950", "2 6 23"),
        },
        gray: {
          ...colors.gray,
          600: themed("gray-600", "75 85 99"),
          700: themed("gray-700", "55 65 81"),
          800: themed("gray-800", "31 41 55"),
          900: themed("gray-900", "17 24 39"),
          950: themed("gray-950", "3 7 18"),
        },
      },
      fontFamily: {
        telugu: ['"Noto Sans Telugu"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
