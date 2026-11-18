import type { Preview } from "@storybook/nextjs-vite";
import { bricolageGrotesque, figtree } from "@/app/fonts";
import "../src/app/globals.css";
// «Sala» (fase 8.4): tokens y fuentes nuevas. Solo se cargan aquí; la app no
// las importa todavía, así que sus pantallas no descargan nada de esto.
import "../src/styles/sala/tokens.css";
import "../src/styles/sala/fonts.css";
import "../src/styles/sala/fonts-jp.css";
import "../src/styles/sala/fonts-kr.css";

/**
 * Mismas etiquetas de axe que el job de accesibilidad de la app
 * (`AXE_TAGS` en tests/e2e/a11y/helpers.ts): WCAG 2.2 A y AA. Aquí falla
 * cualquier violación, no solo las `serious` y `critical`: un componente
 * aislado no tiene excusa de contexto.
 */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

type Tema = "oscuro" | "claro";

// El mismo `<body>` que pinta `src/app/[locale]/layout.tsx`: variables de las
// fuentes, fuente de texto y fondo oscuro de la app.
document.body.classList.add(
  bricolageGrotesque.variable,
  figtree.variable,
  "font-body",
  "bg-surface-base",
  "text-text-primary",
  "antialiased"
);

const preview: Preview = {
  parameters: {
    layout: "centered",
    // El fondo lo pone el `<body>` con los tokens de la app, no el selector
    // de fondos de Storybook (pintaría colores que no son del sistema).
    backgrounds: { disable: true },
    a11y: {
      // Una violación de axe hace fallar la historia (en el panel y en el CI).
      test: "error",
      options: { runOnly: AXE_TAGS },
    },
  },
  globalTypes: {
    tema: {
      description: "Tema de la app",
      toolbar: {
        title: "Tema",
        icon: "contrast",
        items: [
          { value: "oscuro", title: "Oscuro" },
          { value: "claro", title: "Claro (solo «Sala»)" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { tema: "oscuro" satisfies Tema },
  decorators: [
    (Story, context) => {
      // Mecanismo del tema: `data-theme` en `<html>`. Los tokens de «Sala»
      // (`src/styles/sala/tokens.css`) tienen claro y oscuro; los de la app de
      // hoy solo oscuro, así que sus componentes no cambian con el selector.
      const tema: Tema = context.globals.tema === "claro" ? "claro" : "oscuro";
      document.documentElement.dataset.theme = tema === "claro" ? "light" : "dark";
      return <Story />;
    },
  ],
};

export default preview;
