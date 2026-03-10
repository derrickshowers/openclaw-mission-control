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
      themes: {
        light: {
          colors: {
            background: "#F7F8FA",
            foreground: "#111827",
            primary: {
              DEFAULT: "#8b5cf6",
              foreground: "#FFFFFF",
            },
            content1: "#FFFFFF",
            divider: "rgba(0, 0, 0, 0.08)",
          },
        },
        dark: {
          colors: {
            background: "#080808",
            foreground: "#EDEDED",
            primary: {
              DEFAULT: "#8b5cf6",
              foreground: "#FFFFFF",
            },
            content1: "#121212",
            divider: "rgba(255, 255, 255, 0.08)",
          },
        },
      },
    }),
  ],
};

export default config;
