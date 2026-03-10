import type { Config } from "tailwindcss";
import { heroui } from "@heroui/theme";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-plus-jakarta)", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      spacing: {
        sidebar: "240px",
      },
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      defaultTheme: "dark",
      themes: {
        dark: {
          colors: {
            background: "#080808",
            foreground: "#FFFFFF",
            primary: {
              50: "#1a1a2e",
              100: "#16213e",
              200: "#0f3460",
              300: "#533483",
              400: "#7c3aed",
              500: "#8b5cf6",
              600: "#a78bfa",
              700: "#c4b5fd",
              800: "#ddd6fe",
              900: "#ede9fe",
              DEFAULT: "#8b5cf6",
              foreground: "#FFFFFF",
            },
            content1: "#121212",
            content2: "#1A1A1A",
            content3: "#222222",
            content4: "#2A2A2A",
            default: {
              50: "#080808",
              100: "#121212",
              200: "#1A1A1A",
              300: "#222222",
              400: "#888888",
              500: "#999999",
              600: "#AAAAAA",
              700: "#CCCCCC",
              800: "#EEEEEE",
              900: "#FFFFFF",
              DEFAULT: "#222222",
              foreground: "#FFFFFF",
            },
            divider: "#222222",
            focus: "#8b5cf6",
          },
        },
      },
    }),
  ],
};

export default config;
