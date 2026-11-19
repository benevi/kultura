import * as React from "react";
import { Link } from "@/i18n/navigation";
import type { ImagePalette } from "@/lib/design/image-palette";
import { cn } from "@/lib/utils/index";
import type { MediaType } from "@/types/media";
import { SALA_POSTER_RATIO, SalaPoster, type SalaPosterRatio } from "./SalaPoster";

/**
 * Tarjeta de obra de «Sala» (fase 8.4): póster, título y datos. Convive con
 * `MediaCard` y con las filas hechas a mano de las pantallas de hoy.
 *
 * - `grid` (por defecto): póster arriba y texto debajo. Rejillas y carruseles.
 * - `row`: póster a la izquierda y texto al lado. Listas con algo más que el
 *   título (un diario, un ranking).
 * - `compact`: una miniatura y una o dos líneas, 48 px de alto como poco.
 *   Sugerencias de búsqueda, listas que se reordenan, «también en…».
 *
 * **Un solo enlace, y es el título.** El enlace cubre la tarjeta entera con
 * un pseudoelemento, así que toda ella se pulsa, pero su nombre accesible es
 * solo el título: en una rejilla de 50, la lista de enlaces del lector de
 * pantalla son 50 títulos, no 50 párrafos. El formato, el año y `detail` se
 * leen después, al recorrer la tarjeta. El póster es adorno (`alt=""`).
 *
 * **La acción secundaria va fuera del enlace** (`action`), encima de él: un
 * botón dentro de un enlace no es HTML válido. Va después en el orden del
 * teclado.
 *
 * **El formato se dice con palabras** (`formatLabel`), nunca con un color.
 *
 * `ref` y las props nativas llegan al enlace, que es el control; `className`,
 * a la caja de la tarjeta, que es lo que se coloca en la rejilla. Ningún
 * texto sale del componente: llegan ya traducidos.
 *
 * Sin `"use client"`: vale en un componente de servidor. Lo único de cliente
 * es el póster.
 */
export type SalaWorkCardVariant = "grid" | "row" | "compact";

export interface SalaWorkCardProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "title" | "children" | "className"> {
  /** La ficha de la obra. Una ruta de la app (`/media/movie/496243`) usa el enlace con idioma. */
  href: string;
  /** El título, en el idioma que elige la persona. Es el nombre del enlace. */
  title: string;
  /** Idioma del título si no es el de la página. */
  titleLang?: string;
  /** Título original en su escritura, con su idioma (biblia §3). Va fuera del enlace. */
  originalTitle?: { text: string; lang: string };
  /** Formato de la obra: decide la proporción del póster. */
  format: MediaType;
  /** El formato con palabras, ya traducido («Película», «Manga»). */
  formatLabel: string;
  year?: number | string;
  /** Una línea más de datos: la nota, el progreso, el estado, la fecha. Sin controles dentro. */
  detail?: React.ReactNode;
  poster?: string | null;
  /** Paleta de la obra para el campo de color del póster. */
  palette?: ImagePalette;
  variant?: SalaWorkCardVariant;
  /** Proporción del póster a mano. Una rejilla que mezcla formatos pone `"2/3"`. */
  ratio?: SalaPosterRatio;
  /** Ancho del póster en pantalla. En `grid` depende de la rejilla: lo pone quien la monta. */
  sizes?: string;
  /** Para las tarjetas que se ven sin hacer scroll. */
  priority?: boolean;
  /**
   * Nivel del título: el que toca bajo el último encabezado de la página.
   * `"none"` lo deja en un párrafo (una fila de sugerencias no es un índice).
   */
  headingLevel?: 2 | 3 | 4 | "none";
  /**
   * Líneas del título antes de cortarlo. El corte es solo a la vista: el
   * nombre del enlace lleva el título entero, y también su `title`.
   * `"none"` no corta nunca.
   */
  clamp?: 2 | 3 | "none";
  /** Acción secundaria (un `SalaButton` de solo icono). Va fuera del enlace. */
  action?: React.ReactNode;
  /** La portada no ha cargado. Solo desde un componente de cliente. */
  onPosterError?: () => void;
  /** Clases de la caja de la tarjeta. */
  className?: string;
}

const ES_RUTA = /^\/(?!\/)/;

const CAJA: Record<SalaWorkCardVariant, string> = {
  grid: "flex flex-col gap-2",
  row: "flex items-start gap-4",
  compact: "flex min-h-sala-target items-center gap-3",
};

/** Ancho del póster cuando va al lado del texto, según su proporción. */
const POSTER: Record<SalaWorkCardVariant, Record<SalaPosterRatio, string>> = {
  grid: { "2/3": "w-full", "16/9": "w-full" },
  row: { "2/3": "w-16 shrink-0 sm:w-20", "16/9": "w-28 shrink-0 sm:w-36" },
  compact: { "2/3": "w-10 shrink-0", "16/9": "w-16 shrink-0" },
};

const SIZES: Record<SalaWorkCardVariant, Record<SalaPosterRatio, string>> = {
  grid: {
    "2/3": "(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 20vw",
    "16/9": "(max-width: 640px) 92vw, (max-width: 1024px) 45vw, 30vw",
  },
  row: { "2/3": "(min-width: 640px) 80px, 64px", "16/9": "(min-width: 640px) 144px, 112px" },
  compact: { "2/3": "40px", "16/9": "64px" },
};

const TITULO: Record<SalaWorkCardVariant, string> = {
  grid: "sala-type-label",
  row: "sala-type-text font-semibold",
  compact: "sala-type-label",
};

const CORTE: Record<2 | 3, string> = { 2: "line-clamp-2", 3: "line-clamp-3" };

/**
 * El enlace: no pinta nada suyo salvo el texto; `::after` cubre la tarjeta y
 * lleva el anillo de foco, alrededor de toda ella. Al pasar el puntero el
 * título se marca en tinta, como los enlaces y los botones; al pulsar, con el
 * gris de los enlaces. La caja no cambia de medida en ningún estado.
 */
const ENLACE = cn(
  "text-sala-ink no-underline [-webkit-tap-highlight-color:transparent]",
  "after:absolute after:inset-0 after:content-['']",
  "sala-focused:[outline:none] sala-focused:after:sala-focus",
  "[&>span]:sala-hover:bg-sala-ink [&>span]:sala-hover:text-sala-background",
  "[&>span]:sala-pressed:bg-sala-ink-secondary [&>span]:sala-pressed:text-sala-background"
);

/**
 * El texto del título: es lo que se marca. El relleno hace que la marca no
 * vaya pegada a la letra. Lleva la fuente él mismo: la pila se elige donde
 * está el `lang`, y heredada del encabezado un título en coreano saldría con
 * la japonesa delante.
 */
const MARCA = cn(
  "px-0.5 font-sala-text [box-decoration-break:clone] [-webkit-box-decoration-break:clone] [overflow-wrap:anywhere]",
  "transition-colors duration-sala-fast ease-sala motion-reduce:transition-none"
);

export const SalaWorkCard = React.forwardRef<HTMLAnchorElement, SalaWorkCardProps>(function SalaWorkCard(
  {
    href,
    title,
    titleLang,
    originalTitle,
    format,
    formatLabel,
    year,
    detail,
    poster,
    palette,
    variant = "grid",
    ratio,
    sizes,
    priority = false,
    headingLevel = 3,
    clamp = variant === "grid" ? 3 : 2,
    action,
    onPosterError,
    className,
    ...props
  },
  ref
) {
  const proporcion = ratio ?? SALA_POSTER_RATIO[format];
  const Titulo = headingLevel === "none" ? "p" : (`h${headingLevel}` as "h2" | "h3" | "h4");
  const cortado = clamp !== "none";

  const texto = (
    <span lang={titleLang} className={MARCA}>
      {title}
    </span>
  );
  const enlace = { ref, className: ENLACE, title: cortado ? title : undefined, ...props };

  return (
    <div data-sala-card={variant} className={cn("relative min-w-0", CAJA[variant], className)}>
      <div className={POSTER[variant][proporcion]}>
        <SalaPoster
          src={poster}
          alt=""
          title={title}
          titleLang={titleLang}
          ratio={proporcion}
          sizes={sizes ?? SIZES[variant][proporcion]}
          priority={priority}
          palette={palette}
          fallback={variant === "grid" ? "title" : "plain"}
          onLoadError={onPosterError}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* La marca del título sobresale 2 px por la izquierda, hacia fuera: el texto sigue en la línea del póster y por la derecha no desborda. */}
        <Titulo className={cn("-ml-0.5", TITULO[variant], cortado && CORTE[clamp])}>
          {ES_RUTA.test(href) ? (
            <Link href={href} {...enlace}>
              {texto}
            </Link>
          ) : (
            <a href={href} {...enlace}>
              {texto}
            </a>
          )}
        </Titulo>
        {originalTitle ? (
          <p lang={originalTitle.lang} className="text-sala-ink-secondary sala-type-small [overflow-wrap:anywhere]">
            {originalTitle.text}
          </p>
        ) : null}
        <p className="sala-type-small">
          <span className="mr-1 font-semibold text-sala-ink">{formatLabel}</span>
          {year !== undefined && year !== "" ? (
            <>
              {" "}
              <span className="text-sala-ink-secondary">{year}</span>
            </>
          ) : null}
        </p>
        {detail ? <div className="text-sala-ink-secondary sala-type-small">{detail}</div> : null}
      </div>
      {action ? (
        <div data-sala-card-action="" className={variant === "grid" ? "absolute right-0 top-0" : "relative shrink-0 self-center"}>
          {action}
        </div>
      ) : null}
    </div>
  );
});

/**
 * Esqueleto de una tarjeta que aún no tiene datos, con su misma forma: el
 * póster reserva el mismo sitio y las líneas ocupan lo que el título y los
 * datos. Late tres veces (3,6 s) y se queda quieto: nada se mueve solo más de
 * 5 s (biblia §6); con movimiento reducido está quieto desde el principio.
 *
 * Es adorno (`aria-hidden`): quien lo pinta marca la lista con `aria-busy` y
 * anuncia la carga una vez, no una por tarjeta.
 */
export function SalaWorkCardSkeleton({
  variant = "grid",
  ratio = "2/3",
  className,
}: {
  variant?: SalaWorkCardVariant;
  ratio?: SalaPosterRatio;
  className?: string;
}) {
  // Con colores forzados el relleno desaparece: queda el contorno.
  const bloque = "bg-sala-panel forced-colors:border forced-colors:border-[GrayText]";
  return (
    <div
      aria-hidden="true"
      data-sala-card-skeleton={variant}
      className={cn("min-w-0 animate-sala-wait motion-reduce:animate-none", CAJA[variant], className)}
    >
      <div className={POSTER[variant][ratio]}>
        <div className={cn("w-full", ratio === "16/9" ? "aspect-video" : "aspect-[2/3]", bloque)} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Mismo alto de línea que el título y los datos: al llegar la tarjeta, el texto no salta. */}
        <div className={cn(TITULO[variant], "relative")}>
          &nbsp;
          <span className={cn("absolute left-0 top-1/2 h-[0.7em] w-4/5 -translate-y-1/2", bloque)} />
        </div>
        <div className="relative sala-type-small">
          &nbsp;
          <span className={cn("absolute left-0 top-1/2 h-[0.7em] w-2/5 -translate-y-1/2", bloque)} />
        </div>
      </div>
    </div>
  );
}
