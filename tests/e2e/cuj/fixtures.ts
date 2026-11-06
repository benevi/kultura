/**
 * `test` de la red CUJ: como el de Playwright, pero cada contexto del navegador
 * sirve las portadas de TMDB (`image.tmdb.org`) con un PNG de 1×1 px.
 *
 * Las portadas no pasan por el optimizador: las pide el navegador, con la red
 * real del runner. Si fallan, el grid oculta la tarjeta (portada rota) y
 * «buscar y añadir» dependía de esa carrera.
 */
import { test as base, expect, type BrowserContext } from "@playwright/test";

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/** Portadas de TMDB servidas en local (también para contextos creados a mano). */
export async function servePosters(context: BrowserContext): Promise<void> {
  await context.route("https://image.tmdb.org/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PNG_1PX }),
  );
}

export const test = base.extend({
  // `provide`, no `use`: la regla de hooks de React confunde el nombre.
  context: async ({ context }, provide) => {
    await servePosters(context);
    await provide(context);
  },
});

export { expect };
