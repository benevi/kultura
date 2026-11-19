import type { StorybookConfig } from "@storybook/nextjs-vite";

/**
 * Storybook: guía interna de componentes (fase 8.4). Solo desarrollo: no se
 * publica en ningún sitio y nada de esto entra en el build de Next. El CI lo
 * construye, pasa axe a cada historia (`npm run test:storybook`) y lo sube
 * como artefacto del workflow.
 */
// El Tailwind de la app no mira las historias (`tailwind.config.ts`); aquí sí.
process.env.KULTURA_STORYBOOK = "1";

const config: StorybookConfig = {
  // Las historias viven junto a su componente. Next no las empaqueta: nadie
  // las importa y no están en una ruta de `src/app`.
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-vitest"],
  framework: { name: "@storybook/nextjs-vite", options: {} },
  core: {
    // Sin telemetría ni aviso de versiones: no sale nada del repo a terceros.
    disableTelemetry: true,
    disableWhatsNewNotifications: true,
  },
};

export default config;
