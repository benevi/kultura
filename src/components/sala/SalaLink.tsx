import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/index";

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
export type SalaLinkVariant = "inline" | "standalone";

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

/** El subrayado y la marca al pasar el puntero: el texto, no la caja. */
const TEXTO = "underline decoration-2 underline-offset-4 [overflow-wrap:anywhere]";
const TRANSICION = "transition-colors duration-sala-fast ease-sala motion-reduce:transition-none";

const CLASES: Record<SalaLinkVariant, string> = {
  inline: cn(
    // El relleno hace que la marca ocupe la línea entera y que la zona que se
    // pulsa llegue a 24 px con el texto de interfaz (17 px) y el de lectura; no
    // mueve el texto. En una nota de 14 px se queda en 22 px: WCAG 2.5.8 exime
    // al enlace dentro de una frase, y más relleno pisaría la línea de al lado.
    "-mx-0.5 px-0.5 py-0.5 font-semibold text-sala-accent [box-decoration-break:clone] [-webkit-box-decoration-break:clone]",
    TEXTO,
    TRANSICION,
    "sala-hover:bg-sala-ink sala-hover:text-sala-background sala-hover:decoration-transparent",
    "sala-pressed:bg-sala-ink-secondary sala-pressed:text-sala-background sala-pressed:decoration-transparent",
    // Dentro de una frase el anillo va pegado: separado pisaría la palabra de al lado.
    "sala-focused:sala-focus sala-focused:!outline-offset-0",
    // Con el puntero encima, el bloque de tinta se comería el anillo, que es
    // de tinta también: ahí se separa 2 px y entre los dos se ve el fondo.
    "sala-hover:sala-focused:!outline-offset-2"
  ),
  // La caja de 48 px es la zona que se pulsa; lo que se marca es el texto de dentro.
  standalone: cn(
    "inline-flex min-h-sala-target max-w-full items-center text-sala-accent sala-type-label",
    "[&>span]:sala-hover:bg-sala-ink [&>span]:sala-hover:text-sala-background [&>span]:sala-hover:decoration-transparent",
    "[&>span]:sala-pressed:bg-sala-ink-secondary [&>span]:sala-pressed:text-sala-background [&>span]:sala-pressed:decoration-transparent",
    "sala-focused:sala-focus"
  ),
};

const TEXTO_SUELTO = cn("-mx-0.5 min-w-0 px-0.5 py-1", TEXTO, TRANSICION);

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
