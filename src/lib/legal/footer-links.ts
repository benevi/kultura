// ============================================================
// KULTURA — Enlaces legales de los pies
//
// Una sola lista, en su orden, para los pies que enlazan los documentos
// legales: el público (`layout/Footer`), el de la app (`layout/AppFooter`) y el
// de la landing y las cuñas (`landing/LandingFooter`). Cada pie decide cómo los
// pinta: `<a>` en lo público (REN-9) y `Link` de next-intl en la app.
// ============================================================

/** Documento legal enlazado desde el pie. */
export type LegalFooterKey = "privacy" | "terms" | "notice" | "accessibility";

export interface LegalFooterLink {
  key: LegalFooterKey;
  /** Ruta sin idioma («/privacy»); cada pie le pone el prefijo a su manera. */
  href: string;
  text: string;
}

/** Traductor del namespace `legal`, el de `getTranslations("legal")`. */
type LegalT = (key: "nav.privacy" | "nav.terms" | "nav.notice" | "nav.accessibility") => string;

/**
 * Los enlaces legales en el orden de los pies. Con `only`, solo esos, sin
 * cambiar el orden. Claves literales para que los tests de i18n las vean.
 */
export function legalFooterLinks(t: LegalT, only?: readonly LegalFooterKey[]): LegalFooterLink[] {
  const all: LegalFooterLink[] = [
    { key: "privacy", href: "/privacy", text: t("nav.privacy") },
    { key: "terms", href: "/terms", text: t("nav.terms") },
    { key: "notice", href: "/legal", text: t("nav.notice") },
    { key: "accessibility", href: "/accessibility", text: t("nav.accessibility") },
  ];
  return only ? all.filter((l) => only.includes(l.key)) : all;
}
