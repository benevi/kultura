import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Entorno por tipo de archivo (COD-10): los tests `.ts` (lógica, rutas,
// proveedores) corren en `node`, y solo los `.tsx` (componentes) pagan el
// arranque de jsdom en cada archivo, que era más de la mitad del tiempo de la
// suite. Un `.ts` que necesite DOM lo declara con `// @vitest-environment jsdom`
// en su primera línea (`tests/unit/lib/vitest-env.test.ts` lo vigila).
const unit = "tests/unit/**/*.{test,spec}";

// Con la suite entera (cientos de archivos en paralelo) un render de jsdom
// con consultas por rol puede pasar de los 5 s por defecto sin que nada vaya
// mal: el tope sube a 15 s en los tests de componentes. Es un tope de tiempo,
// no una aserción: lo que se comprueba es lo mismo.
const DOM_TEST_TIMEOUT_MS = 15_000;

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
        test: { name: "node", environment: "node", include: [`${unit}.ts`] },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: [`${unit}.tsx`],
          testTimeout: DOM_TEST_TIMEOUT_MS,
          hookTimeout: DOM_TEST_TIMEOUT_MS,
        },
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
