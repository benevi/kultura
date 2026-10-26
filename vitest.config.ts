import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Entorno por tipo de archivo (COD-10): los tests `.ts` (lógica, rutas,
// proveedores) corren en `node`, y solo los `.tsx` (componentes) pagan el
// arranque de jsdom en cada archivo, que era más de la mitad del tiempo de la
// suite. Un `.ts` que necesite DOM lo declara con `// @vitest-environment jsdom`
// en su primera línea.
const unit = "tests/unit/**/*.{test,spec}";

// `.ts` de otros frentes que aún usan `document`/`window` sin declararlo.
// Corren en jsdom hasta que cada uno lleve su cabecera; entonces se quitan de
// aquí (y un test nuevo no se añade: usa la cabecera).
const DOM_TS_PENDING = [
  "tests/unit/import/import-storage.test.ts",
  "tests/unit/landing/immersive-scene.test.ts",
  "tests/unit/perf/instrumentation-client.test.ts",
  "tests/unit/plataforma/sentry-client.test.ts",
  "tests/unit/pwa/share.test.ts",
];

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    passWithNoTests: true,
    // `npm run test` solo ejecuta tests unitarios.
    // `npm run test:integration` ejecuta tests/integration/ por separado.
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", ".next/", "tests/e2e/", "tests/integration/"],
    },
    projects: [
      {
        extends: true,
        test: { name: "node", environment: "node", include: [`${unit}.ts`], exclude: DOM_TS_PENDING },
      },
      {
        extends: true,
        test: { name: "dom", environment: "jsdom", include: [`${unit}.tsx`, ...DOM_TS_PENDING] },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `import "server-only"` (env.server.ts) solo es válido con la condición
      // `react-server` que pone Next; fuera de Next se resuelve al módulo vacío.
      "server-only": path.resolve(__dirname, "./node_modules/server-only/empty.js"),
    },
  },
});
