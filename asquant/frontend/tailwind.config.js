/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        coral: { DEFAULT: "#ff6b6b", light: "#ff8e8e", dark: "#ee5a5a" },
        mint: { DEFAULT: "#4ecdc4", light: "#7eddd6", dark: "#3dbdb5" },
        honey: { DEFAULT: "#ffd93d", light: "#ffe880", dark: "#f0c800" },
        cream: { DEFAULT: "#f5f0eb", dark: "#e8e0d5" },
        navy: { DEFAULT: "#1a1a2e", light: "#16213e", dark: "#0f0f23" },
      },
      fontFamily: {
        rounded: ['"Nunito"', "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
