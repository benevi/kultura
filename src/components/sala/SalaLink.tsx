import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/index";
import { CLASES, TEXTO_SUELTO } from "./sala-link-classes";

/**
 * Enlace de «Sala» (fase 8.4).
 *
 * - `inline` (por defecto): dentro de un texto. Hereda su tamaño.
 * - `standalone`: suelto, como acción de navegación. Mide 48 px de alto.
 *
 * Siempre va subrayado: el acento solo no basta para distinguirlo del texto
 * (WCAG 1.4.1), y en los neutros el acento es un gris. Al pasar el puntero el
 * texto se marca en tinta, como los botones. Una palabra más larga que la
 * línea (una URL como texto) se parte antes que dar scroll horizontal.
 *
 * El destino decide el elemento:
 * - una ruta de la app (`/library`) usa el `Link` con idioma del repo;
 * - una web externa (`https://…`) es un `<a>` que se abre en otra pestaña, lo
 *   dice en su nombre accesible (en el idioma de la interfaz, aunque el enlace
 *   lleve otro `lang`) y lo marca con una flecha;
 * - `mailto:`, `tel:` y `#ancla` son un `<a>` a secas.
 *
 * No hay estilo de «visitado»: los enlaces de la app son navegación, no una
 * lista de lecturas, y el color de una obra no deja sitio a un tono más.
 */
import type { SalaLinkVariant } from "./sala-link-classes";
export type { SalaLinkVariant };

export interface SalaLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "target"> {
  href: string;
  variant?: SalaLinkVariant;
  /** Solo para webs externas: `false` la abre en la misma pestaña. Por defecto, en otra. */
  newTab?: boolean;
  children: React.ReactNode;
}

const ES_WEB = /^(https?:)?\/\//i;
const ES_RUTA = /^\/(?!\/)/;
const REL_EXTERNO = "noopener noreferrer";

/** Flecha de «sale de aquí»: trazo recto, del tamaño de la letra. */
function MarcaExterna() {
  const t = useTranslations("common");
  // El aviso va en el idioma de la interfaz: sin esto heredaría el `lang` del
  // enlace y un título en japonés haría leerlo con voz japonesa (WCAG 3.1.2).
  // `useLocale` vale en servidor y en cliente, como `useTranslations`.
  const locale = useLocale();
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="square"
        className="ml-[0.25em] inline-block h-[0.7em] w-[0.7em] align-baseline"
      >
        <path d="M3 9 9 3M4 3h5v5" />
      </svg>
      <span lang={locale} className="sr-only">
        {" "}
        {t("newTab")}
      </span>
    </>
  );
}

export const SalaLink = React.forwardRef<HTMLAnchorElement, SalaLinkProps>(function SalaLink(
  { href, variant = "inline", newTab, rel, className, children, ...props },
  ref
) {
  const web = ES_WEB.test(href);
  const otraPestana = web && newTab !== false;

  const contenido = (
    <>
      {children}
      {otraPestana ? <MarcaExterna /> : null}
    </>
  );
  const classes = cn(CLASES[variant], className);
  const hijos = variant === "standalone" ? <span className={TEXTO_SUELTO}>{contenido}</span> : contenido;

  if (ES_RUTA.test(href)) {
    return (
      <Link ref={ref} href={href} rel={rel} className={classes} {...props}>
        {hijos}
      </Link>
    );
  }

  return (
    <a
      ref={ref}
      href={href}
      target={otraPestana ? "_blank" : undefined}
      rel={web ? [rel, REL_EXTERNO].filter(Boolean).join(" ") : rel}
      className={classes}
      {...props}
    >
      {hijos}
    </a>
  );
});
