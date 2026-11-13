import { getTranslations } from "next-intl/server";

/** Portada de JustWatch (redirige al país del visitante). */
const JUSTWATCH_HOME = "https://www.justwatch.com";
/** Tienda de Steam: de ahí salen carátulas y descripciones de juegos. */
const STEAM_HOME = "https://store.steampowered.com";

/**
 * Enlace de la atribución. Va dentro de una frase, así que es un enlace en
 * línea (exento de 2.5.8), pero en móvil se toca con el dedo: el relleno
 * vertical amplía la zona táctil a ≥ 44 px sin mover el texto (en un elemento
 * en línea no cambia la altura de la línea) y el horizontal se compensa con
 * margen negativo (MOV-4, ACC-12). El contorno de foco se mete hacia dentro
 * para que rodee la palabra y no la zona táctil entera.
 */
export const SOURCE_LINK_CLASS =
  "py-4 px-2 -mx-2 rounded-lg underline underline-offset-2 hover:text-accent-pink transition-colors " +
  "focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-[-12px] focus-visible:outline-focus-ring";

/**
 * Atribución que exigen los proveedores del catálogo: TMDB pide su aviso de
 * "no respaldado", RAWG un enlace visible en las páginas que usan sus datos y
 * los datos de "dónde ver" (que TMDB sirve) son de JustWatch, que hay que
 * citar (PRO-2; además de la cita con logo en la propia sección de la ficha).
 * Steam: la landing pinta sus carátulas (F-09) y los rankings y la ficha de
 * juegos usan sus descripciones; las condiciones de su API piden que el
 * enlace a Valve no lleve `nofollow` y que no parezca que Valve nos respalda,
 * de ahí el aviso de marca.
 * TMDB además exige su logo, menos destacado que la marca propia: el oficial
 * (themoviedb.org/about/logos-attribution, "alt short"), a 10 px de alto,
 * junto a su aviso. Sin enlace propio: "TMDB" ya enlaza en el texto, y otra
 * zona táctil pequeña con el mismo nombre solo estorba. `alt=""`: el aviso de
 * al lado ya dice "TMDB" (el lector de pantalla lo repetiría). `<img>` y no
 * `next/image`: este no añade JS al navegador (presupuesto de Lighthouse).
 * Es una función async y no un componente: los pies que la usan ya son
 * Server Components async y la renderizan con `await`.
 */
export async function renderDataAttribution(className = "") {
  const t = await getTranslations("legal");
  // Los textos de Steam viven en `best` (namespace de F-16 en esta oleada).
  const tb = await getTranslations("best");
  const link = (href: string) =>
    function SourceLink(chunks: React.ReactNode) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={SOURCE_LINK_CLASS}>
          {chunks}
        </a>
      );
    };

  return (
    <p className={`text-xs leading-relaxed text-muted ${className}`}>
      {t.rich("dataSources", {
        tmdb: link("https://www.themoviedb.org"),
        rawg: link("https://rawg.io"),
      })}{" "}
      {/* Un solo `t.rich` por párrafo: la marca no se traduce, así que el
          enlace va fuera del texto. */}
      {t("justwatchSource")} {link(JUSTWATCH_HOME)("JustWatch")}.{" "}
      {tb("attribution.steam")} {link(STEAM_HOME)("Steam")}.{" "}
      {t("tmdbNotice")}{" "}
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático de 2 KB; next/image solo sumaría JS */}
      <img src="/tmdb-logo.svg" alt="" width={77} height={10} className="inline-block align-middle" />{" "}
      {tb("attribution.steamTrademark")}
    </p>
  );
}
