import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          DEFAULT: "#FF6A35",
          50:  "#FFF1EC",
          100: "#FFE0D2",
          200: "#FFBFA6",
          300: "#FF9D79",
          400: "#FF824F",
          500: "#FF6A35",
          600: "#E1521E",
          700: "#B23E15",
          800: "#7D2B0E",
          900: "#4A1808",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
