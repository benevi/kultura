/**
 * Vitest config para tests de contrato de APIs externas (COD-7).
 * Hacen llamadas HTTP reales — NO corren en el CI de cada PR; los lanza cada
 * semana `.github/workflows/contract.yml` (y a mano: Actions → Run workflow).
 *
 * Uso local: npm run test:contract
 * Claves (las mismas que usa la app, en el entorno o en .env.local):
 *   TMDB_API_KEY, RAWG_API_KEY, COMICVINE_KEY, GOOGLE_BOOKS_KEY
 * Sin clave, los tests de ese proveedor se saltan; con
 * CONTRACT_REQUIRE_KEYS=1 (el workflow) fallan.
 *
 * `PROVIDER_CONTRACT_MODE=enforce`: los clientes reales lanzan
 * `ProviderContractError` si la respuesta no cumple el esquema de producción.
 */
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    passWithNoTests: true,
    include: ["tests/contract/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    env: { PROVIDER_CONTRACT_MODE: "enforce" },
    // De uno en uno: varios proveedores limitan por segundo (Jikan, ComicVine).
    fileParallelism: false,
    // Timeout más alto — llamadas de red reales (cada una con su plazo de 6 s)
    testTimeout: 30000,
    hookTimeout: 15000,
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
