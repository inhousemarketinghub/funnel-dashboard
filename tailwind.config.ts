import type { Config } from "tailwindcss";

// NOTE: This project uses Tailwind CSS v4, which uses CSS-based configuration
// via @theme in app/globals.css. This file documents the Warm Light theme
// color palette and font families for reference.
//
// In Tailwind v4, theme customization is done via @theme inline in globals.css.

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#7C6954",
          dark: "#63513C",
          bg: "#FBF8F4",
          bd: "#D6CBBE",
        },
        accent: {
          DEFAULT: "#B8860B",
          dark: "#9A7209",
        },
        surface: {
          DEFAULT: "#F5F1EB",
          card: "#FEFCF8",
          inset: "#F0EBE3",
        },
        status: {
          green: "#2D8A4E",
          yellow: "#B8860B",
          red: "#C53030",
        },
      },
      fontFamily: {
        sans: ["Open Sans", "sans-serif"],
        heading: ["Poppins", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
