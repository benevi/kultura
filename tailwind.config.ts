import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#080b10",
        surface: "#0e1218",
        surface2: "#151b24",
        surface3: "#1c2430",
        border: "#1e2730",
        accent: "#E82020",
        "accent-hover": "#c91a1a",
        "accent-subtle": "rgba(232,32,32,0.12)",
        text: "#d4dce8",
        muted: "#5a6878",
        "muted-light": "#8a9ab0",
        success: "#22c55e",
        warning: "#f59e0b",
        info: "#3b82f6",
        danger: "#ef4444",
      },
      fontFamily: {
        display: ["var(--font-bebas)", "Impact", "sans-serif"],
        body: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [
    plugin(function ({ addUtilities }) {
      addUtilities({
        ".scrollbar-hide": {
          "-ms-overflow-style": "none",
          "scrollbar-width": "none",
          "&::-webkit-scrollbar": { display: "none" },
        },
      });
    }),
  ],
};
export default config;
