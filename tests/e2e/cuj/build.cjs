/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * `next build` con el entorno de la red CUJ (`env.cjs`). Las NEXT_PUBLIC_* se
 * incrustan al construir: este build es solo para `npm run test:cuj`.
 */
const { spawnSync } = require("node:child_process");
const { ROOT, CUJ_ENV, assertLocalSupabase } = require("./env.cjs");

assertLocalSupabase();
const result = spawnSync("npx", ["next", "build"], {
  cwd: ROOT,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, ...CUJ_ENV },
});
process.exit(result.status ?? 1);
