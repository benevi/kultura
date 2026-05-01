/**
 * Vitest config para tests de contrato de APIs externas.
 * Hacen llamadas HTTP reales — NO corren en CI normal.
 *
 * Uso: npm run test:contract
 * Requiere API keys en .env.local:
 *   NEXT_PUBLIC_TMDB_API_KEY
 *   NEXT_PUBLIC_RAWG_KEY
 *   NEXT_PUBLIC_GOOGLE_BOOKS_KEY
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
    // Timeout más alto — llamadas de red reales
    testTimeout: 15000,
    hookTimeout: 15000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
