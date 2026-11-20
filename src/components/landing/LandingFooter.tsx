import type { ReactNode } from "react";

export interface LandingFooterCopy {
  /** Nombre de la `nav` del pie. */
  nav: string;
  links: { href: string; text: string }[];
  otherLocale: { href: string; text: string; lang: string };
  /** Pie de proveedores de datos (ya renderizado en el servidor). */
  attribution: ReactNode;
}

/**
 * Pie de la landing y de las cuñas (estilos en `landing.css`, `.kl-foot`).
 * Enlaces `<a>`: son páginas públicas sin el JS del `Link` (REN-9). La portada
 * añade la palabra gigante KULTURA (`bigWord`); las cuñas no.
 */
export function LandingFooter({ copy, base, bigWord = false }: { copy: LandingFooterCopy; base: string; bigWord?: boolean }) {
  return (
    <footer className="kl-foot">
      <nav aria-label={copy.nav}>
        <ul className="kl-flinks">
          {copy.links.map((l) => (
            <li key={l.href}>
              <a href={`${base}${l.href}`}>{l.text}</a>
            </li>
          ))}
          <li>
            <a href={copy.otherLocale.href} hrefLang={copy.otherLocale.lang} lang={copy.otherLocale.lang}>
              {copy.otherLocale.text}
            </a>
          </li>
        </ul>
      </nav>
      {bigWord && (
        <div className="kl-fword kl-display" aria-hidden="true" data-reveal="">
          KULTURA
        </div>
      )}
      <div className="kl-legal">
        <p>© {new Date().getFullYear()} KULTURA</p>
        {copy.attribution}
      </div>
    </footer>
  );
}
