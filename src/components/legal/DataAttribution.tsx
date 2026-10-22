import { getTranslations } from "next-intl/server";

/** Portada de JustWatch (redirige al país del visitante). */
const JUSTWATCH_HOME = "https://www.justwatch.com";

/**
 * Atribución que exigen los proveedores del catálogo: TMDB pide su aviso de
 * "no respaldado", RAWG un enlace visible en las páginas que usan sus datos y
 * los datos de "dónde ver" (que TMDB sirve) son de JustWatch, que hay que
 * citar (PRO-2; además de la cita con logo en la propia sección de la ficha).
 * Es una función async y no un componente: los pies que la usan ya son
 * Server Components async y la renderizan con `await`.
 */
export async function renderDataAttribution(className = "") {
  const t = await getTranslations("legal");
  const link = (href: string) =>
    function SourceLink(chunks: React.ReactNode) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-accent-pink transition-colors"
        >
          {chunks}
        </a>
      );
    };

  return (
    <p className={`text-xs text-muted ${className}`}>
      {t.rich("dataSources", {
        tmdb: link("https://www.themoviedb.org"),
        rawg: link("https://rawg.io"),
      })}{" "}
      {/* Un solo `t.rich` por párrafo: la marca no se traduce, así que el
          enlace va fuera del texto. */}
      {t("justwatchSource")} {link(JUSTWATCH_HOME)("JustWatch")}.{" "}
      {t("tmdbNotice")}
    </p>
  );
}
