import path from "path";
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import type { BrowserCommand } from "vitest/node";
import type { CDPSession, Page } from "@playwright/test";

// Pone la densidad de pantalla (`devicePixelRatio`) sin tocar el tamaño de la
// ventana, para las historias que miden en píxeles físicos (el tope de
// ampliación del póster a densidad 2 y 3). Lo llama `fijarDensidad`, de
// `.storybook/sala.tsx`. Es un comando propio y no el CDP de Vitest porque ese
// pide `browser.api.allowWrite` y `allowExec`, que el addon de Storybook deja
// apagados: así la página solo puede pedir esto.
const sesiones = new WeakMap<Page, Promise<CDPSession>>();
const salaDensidad: BrowserCommand<[dpr: number]> = async ({ page, context }, dpr) => {
  if (!(dpr >= 1 && dpr <= 4)) throw new Error(`Densidad fuera de rango: ${dpr}`);
  let sesion = sesiones.get(page);
  if (!sesion) sesiones.set(page, (sesion = context.newCDPSession(page)));
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  await (await sesion).send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dpr, mobile: false });
};

// Pruebas de las historias de Storybook (`npm run test:storybook`): cada
// historia se pinta en Chromium (el de Playwright, ya instalado) y pasa axe;
// con `a11y.test: "error"` (.storybook/preview.tsx) una violación la hace
// fallar, y también un contraste que axe no haya podido medir
// (.storybook/contraste.ts). El addon aplica solo las anotaciones de .storybook/preview.tsx y del
// addon de a11y (desde Storybook 10.3 no hace falta archivo de setup). Va en un
// archivo aparte para que `npm test` siga sin navegador.
export default defineConfig({
  plugins: [
    storybookTest({
      configDir: path.resolve(__dirname, ".storybook"),
      storybookScript: "npm run storybook -- --no-open",
    }),
  ],
  // Dependencias que Vite descubre tarde (al abrir la primera historia que las
  // usa) y que, sin esto, le hacen recargar a media prueba con la caché fría:
  // todas las historias fallaban con «Vitest failed to find the current suite».
  optimizeDeps: {
    include: ["next-intl", "next-intl/navigation", "next-intl/routing", "@radix-ui/react-slot", "clsx", "tailwind-merge"],
  },
  test: {
    name: "storybook",
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
      commands: { salaDensidad },
    },
  },
});
