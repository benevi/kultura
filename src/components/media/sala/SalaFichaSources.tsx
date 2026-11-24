import { useTranslations } from "next-intl";
import { SalaLink } from "@/components/sala/SalaLink";
import { GOOGLE_BOOKS_LOGO } from "@/lib/media/google-books";
import type { SourceLink } from "@/lib/media/source-link";

/**
 * De dónde salen los datos, al pie de la ficha con «Sala» (F2c). Los
 * proveedores lo exigen y no se oculta ni se encoge:
 *
 * - **La fuente del título** (RAWG lo pide en cada página con sus datos, y
 *   TMDB, AniList y el resto igual): «Datos del título:» y el enlace a su
 *   ficha en el proveedor.
 * - **Google Books** (sus normas de marca): el logo «Powered by Google» tal
 *   cual, sobre su pastilla blanca (su texto es oscuro), y el enlace a la
 *   página del libro en Google Libros.
 *
 * - **Lo que la sala añade de TMDB** (F5c, anime de AniList cruzado por
 *   Wikidata): «Imagen, tráiler y disponibilidad: TMDB», con el enlace a la
 *   ficha de esa obra en TMDB. Solo texto: ni logo sobre la imagen ni más
 *   grande que la marca de KULTURA (revisión de términos de F5).
 *
 * Los enlaces abren otra pestaña y lo dicen (`SalaLink`). Miden 48 px de alto.
 * Server Component.
 */
export function SalaFichaSources({
  source,
  googleBooksHref,
  extraSource,
}: {
  source?: SourceLink | null;
  /** Página del libro en Google Libros, si la ficha lleva datos suyos. */
  googleBooksHref?: string | null;
  /** Segunda fuente (F5c): lo que la sala trae de TMDB cuando el título es de otro proveedor. */
  extraSource?: { name: string; url: string } | null;
}) {
  const t = useTranslations("media_detail");
  const showSource = source && source.name !== "Google Books";
  if (!showSource && !googleBooksHref && !extraSource) return null;

  return (
    <div data-sala-ficha-sources="" className="flex flex-col items-start gap-2 sala-type-small text-sala-ink-secondary">
      {showSource && (
        <p className="flex flex-wrap items-center gap-x-2">
          <span>{t("sourceLabel")}</span>
          <SalaLink href={source.url} variant="standalone">
            {source.name}
          </SalaLink>
        </p>
      )}
      {extraSource && (
        <p data-sala-ficha-extra-source="" className="flex flex-wrap items-center gap-x-2">
          <span>{t("extraSourceLabel")}</span>
          <SalaLink href={extraSource.url} variant="standalone">
            {extraSource.name}
          </SalaLink>
        </p>
      )}
      {googleBooksHref && (
        <p data-testid="google-books-attribution" className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex shrink-0 items-center bg-white px-1.5 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- PNG estático de 3 KB */}
            <img
              src={GOOGLE_BOOKS_LOGO.src}
              alt={GOOGLE_BOOKS_LOGO.alt}
              width={GOOGLE_BOOKS_LOGO.width}
              height={GOOGLE_BOOKS_LOGO.height}
              loading="lazy"
            />
          </span>
          <SalaLink href={googleBooksHref} variant="standalone">
            {t("googleBooksLink")}
          </SalaLink>
        </p>
      )}
    </div>
  );
}
