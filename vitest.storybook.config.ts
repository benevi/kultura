import path from "path";
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

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
  test: {
    name: "storybook",
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
