/**
 * `next build` con el entorno de la red de seguridad de accesibilidad
 * (`env.cjs`). Las variables NEXT_PUBLIC_* se incrustan al construir, así que
 * este build es solo para `npm run test:a11y`, no para desplegar.
 */
const { spawnSync } = require("node:child_process");
const { ROOT, A11Y_ENV } = require("./env.cjs");

const result = spawnSync("npx", ["next", "build"], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, ...A11Y_ENV },
});
process.exit(result.status ?? 1);
