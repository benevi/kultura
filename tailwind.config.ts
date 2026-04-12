import type { Config } from "tailwindcss";

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
        border: "#1e2730",
        accent: "#E82020",
        "accent-hover": "#c91a1a",
        text: "#d4dce8",
        muted: "#5a6878",
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
  plugins: [],
};
export default config;
