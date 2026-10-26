import type { Metadata, Viewport } from "next";
import { getTranslations } from "next-intl/server";
import { bricolageGrotesque, figtree } from "@/app/fonts";
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
      <body
        className={`${bricolageGrotesque.variable} ${figtree.variable} font-body bg-surface-base text-text-primary antialiased`}
      >
        {/* Misma composición que `NotFoundContent`, con las dos lenguas. */}
        <main
          id="main"
          tabIndex={-1}
          className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 text-center bg-surface-base"
        >
          <p aria-hidden="true" className="text-7xl font-display font-bold text-text-secondary">404</p>
          <h1 className="text-2xl font-display font-bold text-text-primary">{es("notFoundTitle")}</h1>
          <p className="text-text-secondary max-w-sm">{es("notFoundDescription")}</p>
          <KButton asChild variant="primary">
            <a href={HOME.es}>{es("goHome")}</a>
          </KButton>
          <div lang="en" className="flex flex-col items-center gap-3 pt-4 border-t border-surface-border">
            <h2 className="text-lg font-display font-bold text-text-primary">{en("notFoundTitle")}</h2>
            <p className="text-text-secondary max-w-sm">{en("notFoundDescription")}</p>
            <a
              href={HOME.en}
              className="inline-flex min-h-11 items-center font-bold text-accent-pink underline underline-offset-4 rounded-lg focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              {en("goHome")}
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
