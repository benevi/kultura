import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    test: {
      environment: "node",
      globals: true,
      passWithNoTests: true,
      include: ["tests/integration/**/*.{test,spec}.{ts,tsx}"],
      setupFiles: ["./tests/setup.ts"],
      env,
    },
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
  };
});
