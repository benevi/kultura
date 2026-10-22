import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

/**
 * Color del tema a partir de una custom property, con canal alfa.
 *
 * Con `"var(--x)"` a secas Tailwind 3 no sabe aplicar opacidad: `bg-surface/80`,
 * `border-accent-danger/30` o `ring-accent-pink/40` NO generaban regla, y el
 * preflight dejaba bordes gris claro y anillos azules (DIS-1). `color-mix` en
 * OKLCH sí admite el `<alpha-value>` de Tailwind y, sin modificador, devuelve
 * el color exacto (100 % del token). Soporte: Chrome/Edge 111, Safari 16.2,
 * Firefox 113 — el mismo nivel que ya exige `oklch()` en los tokens.
 * `tests/unit/design/tailwind-alpha.test.ts` compila el config y falla si una
 * clase con `/<alfa>` usada en `src` no genera regla.
 */
function token(name: string): string {
  return `color-mix(in oklch, var(${name}) calc(<alpha-value> * 100%), transparent)`;
}

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
        "surface-base": token("--surface-base"),
        "surface-default": token("--surface-default"),
        "surface-elevated": token("--surface-elevated"),
        "surface-border": token("--surface-border"),

        "text-primary": token("--text-primary"),
        "text-secondary": token("--text-secondary"),
        "text-tertiary": token("--text-tertiary"),

        "accent-positive": token("--accent-positive"),
        "accent-highlight": token("--accent-highlight"),
        "accent-info": token("--accent-info"),
        "accent-danger": token("--accent-danger"),

        "on-accent-positive": token("--on-accent-positive"),
        "on-accent-highlight": token("--on-accent-highlight"),
        "on-accent-info": token("--on-accent-info"),

        /* ─── Acentos decorativos (F7) — variedad visual, sin rol semántico ─── */
        "accent-pink": token("--accent-pink"),
        "accent-lime": token("--accent-lime"),
        "accent-orange": token("--accent-orange"),
        "accent-purple": token("--accent-purple"),

        "on-accent-pink": token("--on-accent-pink"),
        "on-accent-lime": token("--on-accent-lime"),
        "on-accent-orange": token("--on-accent-orange"),
        "on-accent-purple": token("--on-accent-purple"),

        "accent-blue": token("--accent-blue"),
        "accent-yellow": token("--accent-yellow"),
        "on-accent-blue": token("--on-accent-blue"),
        "on-accent-yellow": token("--on-accent-yellow"),

        /* ─── Rojo accesible, campos y foco (ACC-4) ─── */
        "accent-danger-solid": token("--accent-danger-solid"),
        "on-accent-danger": token("--on-accent-danger"),
        "field-border": token("--field-border"),
        "focus-ring": token("--focus-ring"),

        /* ─── Legacy aliases (compatibilidad componentes existentes) ─── */
        bg: token("--surface-base"),
        surface: token("--surface-default"),
        surface2: token("--surface-elevated"),
        surface3: token("--surface3"),
        border: token("--surface-border"),
        /* Nombre del canvas F0 para el borde; lo usa `best/[format]/[year]`.
           Solo se añade este alias: `pink`, `blue`… chocarían con las
           paletas por defecto de Tailwind. */
        stroke: token("--surface-border"),
        text: token("--text-primary"),
        muted: token("--text-tertiary"),
        "muted-light": token("--text-secondary"),
        success: token("--accent-positive"),
        warning: token("--accent-highlight"),
        info: token("--accent-info"),
        danger: token("--accent-danger"),
      },
      /* ACC-4: TODO texto rojo usa la variante accesible (6,16:1 sobre la
         tarjeta en vez de 4,05:1). Se hace aquí y no en cada pantalla, así que
         `text-accent-danger` / `text-danger` ya pasan en todo el sitio. Los
         fondos y bordes siguen con el rojo base (≥ 3:1 como no-texto). */
      textColor: {
        "accent-danger": token("--accent-danger-text"),
        danger: token("--accent-danger-text"),
      },
      fontFamily: {
        /* Design system fonts (F1 — Bricolage Grotesque + Figtree) */
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        /* Legacy aliases */
      },
      borderRadius: {
        card: "12px",
        /* F0: botones y chips son píldoras completas (999px), no rect. redondeado */
        button: "9999px",
        pill: "9999px",
        modal: "8px",
        nav: "4px",
        /* F3b — radios chunky del lenguaje visual F0 (Gen Z), más generosos que
           `card` (12px, heredado del DS anterior, aún en uso en pantallas no
           migradas). Nombre propio para no cambiar `card` a medio migrar. */
        bento: "22px",
        "bento-lg": "28px",
        /* La tarjeta de auth del canvas usa 32px literal, y es de los radios
           del set cerrado de DISENO.md. Aparece 4 veces en las 17 pantallas. */
        "bento-xl": "32px",
        /* Radios de los artboards que faltaban; están en el set de radios de
           DISENO.md ("Nunca, bajo ninguna circunstancia"). Nombre = valor,
           para que no haya que traducir "panel" o "tile" a píxeles. */
        "18": "18px",
        "20": "20px",
        "24": "24px",
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
