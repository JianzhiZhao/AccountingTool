import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        white: "#121815",
        ink: "#edf4ef",
        cream: "#090d0b",
        coral: "#ff8a68",
        moss: { 50: "#102018", 100: "#193625", 500: "#48a868", 600: "#5fbd7d", 700: "#82d39b" },
        stone: { 50: "#161c18", 100: "#202822", 200: "#2d3830", 300: "#465448", 400: "#829087", 500: "#a4aea7", 600: "#c4ccc6", 700: "#dde3df", 800: "#e8ede9", 900: "#f4f7f5" },
        red: { 50: "#2b1717", 100: "#422020", 200: "#653030", 500: "#ed6b6b", 600: "#f27c7c", 700: "#ff9a9a" },
        amber: { 50: "#282113", 100: "#3a2e17", 200: "#5a451e", 700: "#e8bd63", 800: "#f2ce80" }
      },
      boxShadow: { card: "0 18px 48px rgba(0, 0, 0, .28), inset 0 1px rgba(255,255,255,.025)" },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] }
    },
  },
  plugins: [],
} satisfies Config;
