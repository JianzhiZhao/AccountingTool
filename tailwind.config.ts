import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        white: "#1c120e",
        ink: "#fff2e4",
        cream: "#120b08",
        coral: "#ff7657",
        moss: { 50: "#2a1810", 100: "#402317", 500: "#c76d37", 600: "#dd8a4c", 700: "#f2b36f" },
        stone: { 50: "#211612", 100: "#2d1d18", 200: "#412c24", 300: "#64483b", 400: "#907061", 500: "#b59b8d", 600: "#d0bbae", 700: "#e4d4c9", 800: "#f0e5dc", 900: "#fbf5ef" },
        red: { 50: "#301514", 100: "#4b211d", 200: "#733029", 500: "#ee6b5b", 600: "#f27f70", 700: "#ffa396" },
        amber: { 50: "#2b1c0d", 100: "#412a10", 200: "#654019", 700: "#e7ad5c", 800: "#f3c77e" }
      },
      boxShadow: { card: "0 18px 48px rgba(0, 0, 0, .28), inset 0 1px rgba(255,255,255,.025)" },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] }
    },
  },
  plugins: [],
} satisfies Config;
