/**
 * @vitest-environment node
 *
 * Fase 8.4 — `src/styles/sala/tokens.css` es exactamente lo que genera
 * `salaTokensCss()` (`src/lib/design/sala-tokens.ts`). Los valores solo se
 * escriben en el TypeScript; si el CSS no coincide, este test falla.
 *
 * Para regenerarlo: `npm run tokens:sala` (este test con `-u`). Va en un
 * archivo aparte del resto de pruebas de los tokens, que leen el CSS ya escrito.
 */
import { expect, it } from "vitest";
import { resolve } from "path";
import { salaTokensCss } from "@/lib/design/sala-tokens";

it("tokens.css coincide con salaTokensCss()", async () => {
  await expect(salaTokensCss()).toMatchFileSnapshot(resolve(__dirname, "../../../src/styles/sala/tokens.css"));
});
