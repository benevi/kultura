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
 * Firefox 113. Es algo MÁS exigente que `oklch()` (Safari 15.4): en iOS
 * 15.4-16.1 las clases de color del tema no se pintan. Asumido a propósito
 * (cuota residual en 2026); si hiciera falta, la salida es un `@supports`.
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
    /* ─── Sets cerrados (F-30, DIS-7 y DIS-12) ──────────────────────────
       Van FUERA de `extend`: sustituyen la escala de Tailwind, así que una
       clase que no esté aquí (`rounded-md`, `shadow-xl`…) no genera CSS y
       `tests/unit/visual/classes-compile.test.ts` la detecta. DISENO.md
       documenta estos mismos valores (`tests/unit/visual/diseno-scales`). */

    /* 4 radios + píldora. Pequeño (8): controles chicos, miniaturas y el
       contorno de foco de los enlaces. Póster (16): pósteres, tarjetas,
       campos y filas. Contenedor (20): bloques y secciones. Héroe (32):
       héroe, modales, tarjeta de acceso y CTA. */
    borderRadius: {
      none: "0px",
      lg: "8px",
      "2xl": "16px",
      bento: "20px",
      "bento-xl": "32px",
      full: "9999px",
      pill: "9999px",
      button: "9999px",
      /* Alias en retirada: solo los usan archivos de otros frentes
         (Descubrir y Ajustes). Apuntan a un radio del set y
         `tests/unit/visual/scales.test.ts` impide que se usen en ningún
         otro archivo. */
      DEFAULT: "8px",
      xl: "16px",
      card: "16px",
      "20": "20px",
    },

    /* Escala tipográfica cerrada (tamaño / interlineado). Se conservan los
       nombres de Tailwind donde el valor coincide; `meta` (13) y `body` (15)
       son los dos tamaños propios de la UI y `display`, el h1 de la portada.
       Nada de `text-[Npx]`: lo prohíbe ESLint (.eslintrc.json). */
    fontSize: {
      xs: ["12px", { lineHeight: "16px" }],
      meta: ["13px", { lineHeight: "18px" }],
      sm: ["14px", { lineHeight: "20px" }],
      body: ["15px", { lineHeight: "22px" }],
      base: ["16px", { lineHeight: "24px" }],
      lg: ["18px", { lineHeight: "26px" }],
      xl: ["20px", { lineHeight: "28px" }],
      "2xl": ["24px", { lineHeight: "30px" }],
      "3xl": ["32px", { lineHeight: "1.15" }],
      "4xl": ["40px", { lineHeight: "1.1" }],
      "5xl": ["48px", { lineHeight: "1" }],
      "6xl": ["60px", { lineHeight: "1" }],
      "7xl": ["72px", { lineHeight: "1" }],
      "8xl": ["96px", { lineHeight: "1" }],
      display: ["clamp(3.25rem, 5.4vw, 5.75rem)", { lineHeight: "1" }],
    },

    /* Sombras: las del set cerrado de DISENO.md y ninguna más. */
    boxShadow: {
      none: "none",
      /* Sombra dura de las piezas protagonistas (héroe, tarjeta de acceso,
         CTA del perfil). En móvil, `hard-sm`: con 16 px de margen lateral,
         los 10 px se comían el margen derecho (DIS-13). */
      hard: "10px 10px 0 var(--surface-elevated)",
      "hard-sm": "6px 6px 0 var(--surface-elevated)",
      /* Pegatinas y badges colgantes. */
      sticker: "4px 4px 0 oklch(0% 0 0 / 0.4)",
      /* Menús, popovers y avisos flotantes. */
      soft: "0 2px 8px oklch(0% 0 0 / 0.15)",
    },

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
      /* Color de un `border` sin color explícito. El de Tailwind es gris
         claro (#e5e7eb), ajeno a la paleta oscura: cualquier borde que se
         quedara sin clase de color (o con una que no existía) salía así. */
      borderColor: {
        DEFAULT: token("--surface-border"),
      },
      fontFamily: {
        /* Design system fonts (F1 — Bricolage Grotesque + Figtree) */
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        /* Legacy aliases */
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
    plugin(function ({ addComponents, addUtilities, theme }) {
      /* Retícula única (DIS-8): el mismo borde izquierdo para el logo, el h1
         y el contenido en todas las páginas. Ancho 72rem (`max-w-6xl`) con
         16 px de margen en móvil y 32 px desde `md`. Las columnas más
         estrechas (lectura larga, chat, ajustes) van DENTRO, alineadas a la
         izquierda, nunca centradas aparte. */
      addComponents({
        ".page-grid": {
          width: "100%",
          maxWidth: theme("maxWidth.6xl"),
          marginInline: "auto",
          paddingInline: theme("spacing.4"),
          [`@media (min-width: ${theme("screens.md")})`]: {
            paddingInline: theme("spacing.8"),
          },
        },
      });
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
