import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        white: "#f4f3e6",
        ink: "#252a1f",
        cream: "#e7ead6",
        coral: "#7ec151",
        moss: { 50: "#eaf0d3", 100: "#dce7b4", 500: "#b2d959", 600: "#7ec151", 700: "#4f742f" },
        stone: { 50: "#ecebdc", 100: "#e2e3d0", 200: "#ced2b5", 300: "#b8be9c", 400: "#858d6e", 500: "#656c52", 600: "#4c533f", 700: "#383d31", 800: "#292e24", 900: "#1e221a" },
        red: { 50: "#f3e5e1", 100: "#ecd4cf", 200: "#dfb5ad", 500: "#d85c51", 600: "#bd473e", 700: "#94362f" },
        amber: { 50: "#f2edcf", 100: "#ebe1a8", 200: "#dfcc6f", 700: "#756000", 800: "#574800" }
      },
      boxShadow: { card: "0 18px 44px rgba(54, 62, 32, .10), inset 0 1px rgba(255,255,255,.45)" },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] }
    },
  },
  plugins: [],
} satisfies Config;
