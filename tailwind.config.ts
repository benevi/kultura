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
        /* ─── Design System tokens — modo oscuro ─── */
        "surface-base": "var(--surface-base)",
        "surface-default": "var(--surface-default)",
        "surface-elevated": "var(--surface-elevated)",
        "surface-border": "var(--surface-border)",

        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",

        "accent-positive": "var(--accent-positive)",
        "accent-highlight": "var(--accent-highlight)",
        "accent-info": "var(--accent-info)",
        "accent-danger": "var(--accent-danger)",

        "on-accent-positive": "var(--on-accent-positive)",
        "on-accent-highlight": "var(--on-accent-highlight)",
        "on-accent-info": "var(--on-accent-info)",

        /* ─── Legacy aliases (compatibilidad componentes existentes) ─── */
        bg: "var(--surface-base)",
        surface: "var(--surface-default)",
        surface2: "var(--surface-elevated)",
        surface3: "#1c2430",
        border: "var(--surface-border)",
        accent: "#E82020",
        "accent-hover": "#c91a1a",
        "accent-subtle": "rgba(232,32,32,0.12)",
        text: "var(--text-primary)",
        muted: "var(--text-tertiary)",
        "muted-light": "var(--text-secondary)",
        success: "var(--accent-positive)",
        warning: "var(--accent-highlight)",
        info: "var(--accent-info)",
        danger: "var(--accent-danger)",
      },
      fontFamily: {
        /* New design system fonts */
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
        /* Legacy aliases */
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        card: "12px",
        button: "10px",
        pill: "20px",
        modal: "8px",
        nav: "4px",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",   /* 100ms */
        base: "var(--duration-base)",   /* 150ms */
        slow: "var(--duration-slow)",   /* 250ms */
      },
      transitionTimingFunction: {
        standard: "var(--ease-standard)", /* cubic-bezier(0,0,0.2,1) */
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
