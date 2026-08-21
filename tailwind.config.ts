import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        white: "#fffef7",
        ink: "#202519",
        cream: "#f7f8e6",
        coral: "#7ec151",
        moss: { 50: "#f4f8df", 100: "#e7f0bd", 500: "#b2d959", 600: "#7ec151", 700: "#527a31" },
        stone: { 50: "#fafbea", 100: "#f1f3d9", 200: "#dfe3c2", 300: "#cbd0aa", 400: "#949b77", 500: "#6f7659", 600: "#535944", 700: "#3b4033", 800: "#292e24", 900: "#1d211a" },
        red: { 50: "#fff1ef", 100: "#ffe1dd", 200: "#ffc4bc", 500: "#e45a4f", 600: "#c9463c", 700: "#a9362f" },
        amber: { 50: "#fff9dc", 100: "#fff1ad", 200: "#ffe275", 700: "#806400", 800: "#5f4b00" }
      },
      boxShadow: { card: "0 18px 48px rgba(66, 75, 35, .10), inset 0 1px rgba(255,255,255,.75)" },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] }
    },
  },
  plugins: [],
} satisfies Config;
