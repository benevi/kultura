import { GOOGLE_BOOKS_LOGO } from "@/lib/media/google-books";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink";

interface GoogleBooksAttributionProps {
  /** Texto junto al logo: el del enlace si hay `href`, o una frase suelta. */
  label: string;
  /** Página del libro en Google Libros. Sin ella, solo logo y texto. */
  href?: string;
  /** Nombre accesible del enlace (avisa de que abre otra pestaña). */
  linkLabel?: string;
  className?: string;
}

/**
 * Atribución que piden las normas de marca de Google Books: el logo «Powered
 * by Google» junto a los datos que vienen de su API y, en la ficha, el enlace a
 * la página del libro en Google Libros.
 *
 * El logo es el oficial y no se retoca. Va sobre una pastilla blanca porque su
 * texto es oscuro y en el tema de noche no se leería. `<img>` y no
 * `next/image`: es un PNG de 3 KB y así no suma JS (igual que el de TMDB).
 * Sin hooks: sirve en la ficha (servidor) y en los resultados (cliente); los
 * textos llegan ya traducidos.
 */
export function GoogleBooksAttribution({ label, href, linkLabel, className = "" }: GoogleBooksAttributionProps) {
  const logo = (
    <span className="inline-flex shrink-0 items-center rounded-lg bg-white px-1.5 py-1">
      {/* eslint-disable-next-line @next/next/no-img-element -- PNG estático de 3 KB */}
      <img
        src={GOOGLE_BOOKS_LOGO.src}
        alt={GOOGLE_BOOKS_LOGO.alt}
        width={GOOGLE_BOOKS_LOGO.width}
        height={GOOGLE_BOOKS_LOGO.height}
        loading="lazy"
      />
    </span>
  );

  return (
    <p
      data-testid="google-books-attribution"
      className={`flex flex-wrap items-center gap-2.5 text-xs text-text-tertiary ${className}`}
    >
      {logo}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={linkLabel}
          className={`inline-flex items-center min-h-11 rounded-lg text-sm font-medium text-text-primary underline underline-offset-2 hover:text-accent-pink transition-colors ${focusRing}`}
        >
          {label}
        </a>
      ) : (
        <span>{label}</span>
      )}
    </p>
  );
}
