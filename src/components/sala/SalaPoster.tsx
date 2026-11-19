import * as React from "react";
import type { PixelSize } from "@/lib/design/image-fit";
import type { ImagePalette } from "@/lib/design/image-palette";
import { SALA_WORK_CLASS, workPaletteVars } from "@/lib/design/sala-palette";
import { cn } from "@/lib/utils/index";
import type { MediaType } from "@/types/media";
import { SalaPosterCappedImage, SalaPosterImage } from "./SalaPosterImage";

/**
 * Póster de «Sala» (fase 8.4): la imagen de una obra en tarjetas, listas y
 * rejillas. Convive con `PosterFrame`, `PosterImage` y `BestPoster`, que
 * siguen siendo los de las pantallas de hoy.
 *
 * - **Reserva su sitio.** La caja tiene la proporción antes de que llegue
 *   nada: al cargar la imagen no se mueve ni un píxel (CLS 0).
 * - **Nunca queda rota** (biblia §2). Mientras la imagen llega, si no la hay o
 *   si falla, se ve el campo de color con el título como rótulo. El campo es
 *   la franja: con `palette`, la de la obra; sin ella, la del contenedor.
 * - **La portada real, como hasta ahora** (biblia §2): llena la caja. El tope
 *   de ampliación de 1,25× es de la sala de la ficha y aquí se pide aparte
 *   (`capUpscale`): la imagen que no da para la caja se compone entonces como
 *   una pieza, entera y a su tamaño, centrada sobre el campo de color.
 * - **Esquinas rectas, sin sombra ni borde.**
 *
 * `alt` es obligatorio. Vacío (`alt=""`) cuando el título va escrito al lado
 * (una tarjeta): la imagen es adorno y el lector no la nombra dos veces. Con
 * texto cuando el póster va solo: ese texto nombra la imagen y, si no hay
 * imagen, nombra el sustituto.
 *
 * Sin `"use client"`: la caja, el campo de color y el rótulo salen del
 * servidor. De cliente solo es la imagen (`SalaPosterImage`), que tiene que
 * enterarse de si ha fallado para quitarse de en medio; con `capUpscale`,
 * además mide. El rótulo se esconde con CSS cuando la imagen ha cargado.
 */
export type SalaPosterRatio = "2/3" | "16/9";

/**
 * Proporción de la imagen que da cada formato. Todos los proveedores dan una
 * portada vertical cercana a 2:3 salvo RAWG, que da arte apaisado de 16:9: un
 * juego recortado a 2:3 pierde más de la mitad de la imagen y casi nunca llega
 * al tope de ampliación. Una rejilla que mezcla formatos fija `ratio="2/3"`
 * para que las filas cuadren.
 */
export const SALA_POSTER_RATIO: Record<MediaType, SalaPosterRatio> = {
  movie: "2/3",
  tv: "2/3",
  anime: "2/3",
  book: "2/3",
  comic: "2/3",
  manga: "2/3",
  game: "16/9",
};

const CAJA: Record<SalaPosterRatio, string> = {
  "2/3": "aspect-[2/3]",
  "16/9": "aspect-video",
};

/**
 * Anchura del rótulo del sustituto (eje de Anybody, 50–150 %): un título corto
 * va ancho y uno largo, estrecho, para que quepa en una caja pequeña. Las
 * escrituras sin eje de anchura (japonés, coreano) no cambian. Propuesta.
 */
export function salaPosterStretch(title: string): number {
  const largo = Array.from(title.trim()).length;
  const t = Math.min(1, Math.max(0, (largo - 8) / 32));
  return Math.round(110 - t * 35);
}

export interface SalaPosterProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title" | "children"> {
  /** La portada. Sin ella (`null`, `undefined` o vacía) se pinta el sustituto. */
  src?: string | null;
  /** Texto alternativo. `""` si el título va escrito al lado. */
  alt: string;
  /** Título de la obra: el rótulo del sustituto. Es adorno; el nombre lo da `alt`. */
  title: string;
  /** Idioma del título si no es el de la página (`ja`, `ko`): elige la fuente. */
  titleLang?: string;
  /** Formato de la obra: de él sale la proporción. */
  format?: MediaType;
  /** Proporción a mano; gana a la del formato. Sin ninguna, 2:3. */
  ratio?: SalaPosterRatio;
  /** `cover` llena la caja y recorta lo que sobra; `contain` enseña la portada entera. */
  fit?: "cover" | "contain";
  /** Punto de interés del recorte (`object-position`). Por defecto, el centro. */
  focus?: string;
  /** Ancho que ocupa en pantalla, como en `next/image`. Obligatorio: sin él se pide de más. */
  sizes: string;
  /** Solo para lo que se ve sin hacer scroll: la precarga. */
  priority?: boolean;
  loading?: "lazy" | "eager";
  /** Paleta de la obra para el campo de color. Sin ella, la del contenedor. */
  palette?: ImagePalette;
  /** `plain`: el sustituto es solo el campo de color (miniaturas donde el rótulo no cabe). */
  fallback?: "title" | "plain";
  /**
   * Tope de ampliación (biblia §2): la imagen no se amplía más de 1,25 veces
   * el tamaño de su archivo; la que no da para la caja va como pieza. Apagado
   * por defecto: en tarjetas y listas la portada llena la caja. Encendido, la
   * imagen no se pinta hasta saber cuánto mide (hace falta JavaScript).
   */
  capUpscale?: boolean;
  /**
   * Con `capUpscale`: tamaño en píxeles reales del mayor archivo que se puede
   * pedir para este `src`. Con él se decide al montar, sin esperar a que la
   * imagen cargue ni volver a leerla. Sin él, se mide el archivo ya cargado.
   */
  naturalSize?: PixelSize;
  /** La imagen no ha cargado (404, proveedor caído). El sustituto ya está puesto. Solo desde un componente de cliente. */
  onLoadError?: () => void;
}

export const SalaPoster = React.forwardRef<HTMLDivElement, SalaPosterProps>(function SalaPoster(
  {
    src,
    alt,
    title,
    titleLang,
    format,
    ratio,
    fit = "cover",
    focus,
    sizes,
    priority = false,
    loading,
    palette,
    fallback = "title",
    capUpscale = false,
    naturalSize,
    onLoadError,
    className,
    style,
    ...props
  },
  ref
) {
  const origen = src || null;
  const proporcion = ratio ?? (format ? SALA_POSTER_RATIO[format] : "2/3");
  // Sin imagen, el nombre lo lleva la caja; con ella, el `alt` de la imagen (o su hueco, si falla).
  const nombraLaCaja = origen === null && alt !== "";
  const imagen = { alt, sizes, priority, loading, fit, focus, onLoadError };

  return (
    <div
      ref={ref}
      role={nombraLaCaja ? "img" : undefined}
      aria-label={nombraLaCaja ? alt : undefined}
      data-sala-poster={origen === null ? "empty" : "image"}
      className={cn(
        "group/sala-poster relative w-full overflow-hidden bg-sala-band text-sala-band-ink [container-type:inline-size]",
        // Con colores forzados el campo de color desaparece: que quede el contorno de la caja.
        // Cada una en una sola clase: por separado, `cn` las toma por repetidas y se queda con una.
        "forced-colors:[outline:1px_solid_CanvasText] forced-colors:[outline-offset:-1px]",
        CAJA[proporcion],
        palette && SALA_WORK_CLASS,
        className
      )}
      style={palette ? { ...(workPaletteVars(palette) as React.CSSProperties), ...style } : style}
      {...props}
    >
      {/* El rótulo va detrás y primero: es lo que se ve hasta que la imagen lo tapa. Cargada, se esconde. */}
      {fallback === "title" ? (
        <span
          aria-hidden="true"
          data-sala-poster-title=""
          className="absolute inset-0 flex items-end overflow-hidden p-[8cqw] group-has-[[data-sala-poster-image=loaded]]/sala-poster:hidden"
        >
          <span
            lang={titleLang}
            // A este tamaño el interlineado del rótulo grande (0,9) hace chocar las líneas.
            // Una palabra que no cabe se parte con guion donde el idioma lo sabe poner; si no, por donde toque.
            className="line-clamp-4 hyphens-auto sala-type-title leading-none [overflow-wrap:anywhere]"
            style={{ fontSize: "clamp(0.875rem, 13cqw, 2.5rem)", fontStretch: `${salaPosterStretch(title)}%` }}
          >
            {title}
          </span>
        </span>
      ) : null}
      {origen === null ? null : capUpscale ? (
        <SalaPosterCappedImage src={origen} naturalSize={naturalSize} {...imagen} />
      ) : (
        <SalaPosterImage src={origen} {...imagen} />
      )}
    </div>
  );
});
