import type { Metadata, Viewport } from "next";
import { getTranslations } from "next-intl/server";
import { fontVariables } from "@/app/fonts";
import { KButton } from "@/components/ui/KButton";
import { SHELL_VIEWPORT, SITE_NAME } from "@/i18n/metadata";

/**
 * 404 de fuera de `/[locale]` (rutas que no pasan por el middleware, p. ej.
 * `/algo.php`). El layout raíz no pinta documento, así que este sí, con las
 * mismas fuentes que la app.
 *
 * Bilingüe y sin leer cabeceras (F-22, D-02): Next pinta este componente
 * dentro del árbol de TODAS las páginas (es la 404 del segmento raíz), y una
 * llamada a `headers()` para mirar `Accept-Language` volvía dinámicas, sin
 * caché de CDN, también la portada, los rankings y los legales. El documento
 * va en español (idioma por defecto) y la parte inglesa lleva `lang="en"`
 * (WCAG 3.1.2), con su propio enlace a la portada en inglés.
 */

export const viewport: Viewport = SHELL_VIEWPORT;

/** Portada de cada idioma (`<a>`: esta página no tiene router de la app). */
const HOME = { es: "/es", en: "/en" } as const;

export async function generateMetadata(): Promise<Metadata> {
  const [es, en] = await Promise.all([
    getTranslations({ locale: "es", namespace: "errors" }),
    getTranslations({ locale: "en", namespace: "errors" }),
  ]);
  return { title: `${es("notFoundTitle")} · ${en("notFoundTitle")} · ${SITE_NAME}`, robots: { index: false } };
}

export default async function RootNotFound() {
  const [es, en] = await Promise.all([
    getTranslations({ locale: "es", namespace: "errors" }),
    getTranslations({ locale: "en", namespace: "errors" }),
  ]);

  return (
    <html lang="es">
      <body className={`${fontVariables} theme-paper font-body antialiased`}>
        {/* Página impresa del álbum: el hueco 404 está vacío, con su número
            impreso, y el cromo que buscabas no está. Las dos lenguas. */}
        <main id="main" tabIndex={-1} className="flex min-h-screen flex-col justify-center bg-surface-base py-12">
          <div className="page-grid flex flex-col gap-8 sm:flex-row sm:items-center">
            <div
              aria-hidden="true"
              className="relative aspect-[2/3] w-32 shrink-0 rounded-cromo border-2 border-dashed border-slot-line"
            >
              <span className="absolute left-3 top-2 font-display text-4xl leading-none tabular-nums text-text-secondary">404</span>
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <h1 className="text-balance font-display text-3xl text-text-primary md:text-4xl">{es("notFoundTitle")}</h1>
              <p className="max-w-[46ch] text-base text-text-secondary">{es("notFoundDescription")}</p>
              <div>
                <KButton asChild variant="primary" size="lg">
                  <a href={HOME.es}>{es("goHome")}</a>
                </KButton>
              </div>
              <div lang="en" className="mt-4 flex flex-col gap-2 border-t-2 border-surface-border pt-5">
                <h2 className="font-display text-2xl text-text-primary">{en("notFoundTitle")}</h2>
                <p className="max-w-[46ch] text-base text-text-secondary">{en("notFoundDescription")}</p>
                <a
                  href={HOME.en}
                  className="inline-flex min-h-11 w-fit items-center rounded-lg font-semibold text-text-primary underline underline-offset-4 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  {en("goHome")}
                </a>
              </div>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
