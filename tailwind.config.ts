import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        white: "#181c10",
        ink: "#f7f8e9",
        cream: "#10130b",
        coral: "#7ec151",
        moss: { 50: "#1d2511", 100: "#2c3818", 500: "#b2d959", 600: "#fff449", 700: "#fed24f" },
        stone: { 50: "#1b1f14", 100: "#252b1a", 200: "#343d25", 300: "#4e5a3b", 400: "#7c876a", 500: "#a0aa90", 600: "#c2c9b3", 700: "#dce1d0", 800: "#ebeee3", 900: "#f7f8f2" },
        red: { 50: "#301514", 100: "#4b211d", 200: "#733029", 500: "#ee6b5b", 600: "#f27f70", 700: "#ffa396" },
        amber: { 50: "#29250c", 100: "#403a0f", 200: "#625817", 700: "#fed24f", 800: "#fff449" }
      },
      boxShadow: { card: "0 18px 48px rgba(0, 0, 0, .28), inset 0 1px rgba(255,255,255,.025)" },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] }
    },
  },
  plugins: [],
} satisfies Config;
