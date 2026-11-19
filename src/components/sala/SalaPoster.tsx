"use client";

import * as React from "react";
import Image from "next/image";
import { IMAGE_MAX_UPSCALE, roomScale, type PixelSize } from "@/lib/design/image-fit";
import type { ImagePalette } from "@/lib/design/image-palette";
import { SALA_WORK_CLASS, workPaletteVars } from "@/lib/design/sala-palette";
import { posterLoader } from "@/lib/images/poster-url";
import { cn } from "@/lib/utils/index";
import type { MediaType } from "@/types/media";

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
 * - **No pixela** (biblia §2). Una imagen que para llenar la caja tendría que
 *   ampliarse más de 1,25 veces su tamaño natural no la llena: se compone como
 *   una pieza, entera y a su tamaño, centrada sobre el campo de color.
 * - **Esquinas rectas, sin sombra ni borde.**
 *
 * `alt` es obligatorio. Vacío (`alt=""`) cuando el título va escrito al lado
 * (una tarjeta): la imagen es adorno y el lector no la nombra dos veces. Con
 * texto cuando el póster va solo: ese texto nombra la imagen y, si no hay
 * imagen, nombra el sustituto.
 *
 * Es un componente de cliente porque tiene que enterarse de si la imagen ha
 * cargado, ha fallado o se queda corta; sin JavaScript se ve igual, salvo el
 * tope de ampliación.
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

type Estado = "loading" | "loaded" | "error";

interface Seguimiento {
  src: string | null;
  estado: Estado;
  natural: PixelSize | null;
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
  /** `false` deja ampliar la imagen sin tope. Solo para imágenes que no son fotos (un SVG). */
  capUpscale?: boolean;
  /** La imagen no ha cargado (404, proveedor caído). El sustituto ya está puesto. */
  onLoadError?: () => void;
}

/** La caja en píxeles físicos, que es en lo que mide el tope de ampliación. */
function medir(caja: HTMLElement): { room: PixelSize; dpr: number } {
  const { width, height } = caja.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  return { room: { width: width * dpr, height: height * dpr }, dpr };
}

/**
 * Tamaño CSS de la imagen cuando no puede llenar la caja: entera, ampliada como
 * mucho hasta el tope y sin salirse. `null` si la imagen da para la caja.
 */
export function pieceSize(
  natural: PixelSize,
  room: PixelSize,
  dpr: number,
  fit: "cover" | "contain"
): { width: number; height: number } | null {
  if (!(room.width > 0 && room.height > 0 && natural.width > 0 && natural.height > 0)) return null;
  const entera = Math.min(room.width / natural.width, room.height / natural.height);
  const necesita = fit === "cover" ? roomScale(natural, room) : entera;
  if (necesita <= IMAGE_MAX_UPSCALE) return null;
  const escala = Math.min(entera, IMAGE_MAX_UPSCALE) / dpr;
  return { width: Math.round(natural.width * escala), height: Math.round(natural.height * escala) };
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
    capUpscale = true,
    onLoadError,
    className,
    style,
    ...props
  },
  ref
) {
  const origen = src || null;
  const proporcion = ratio ?? (format ? SALA_POSTER_RATIO[format] : "2/3");

  const [seguimiento, setSeguimiento] = React.useState<Seguimiento>({ src: origen, estado: "loading", natural: null });
  // Otra imagen: se empieza de cero, en el mismo render (sin un fotograma con el estado de la anterior).
  if (seguimiento.src !== origen) setSeguimiento({ src: origen, estado: "loading", natural: null });
  const { estado, natural } = seguimiento.src === origen ? seguimiento : { estado: "loading" as Estado, natural: null };

  const cajaRef = React.useRef<HTMLDivElement | null>(null);
  const setRefs = React.useCallback(
    (nodo: HTMLDivElement | null) => {
      cajaRef.current = nodo;
      if (typeof ref === "function") ref(nodo);
      else if (ref) ref.current = nodo;
    },
    [ref]
  );

  // El tope de ampliación depende del tamaño de la caja: se vuelve a medir si cambia.
  const [pieza, setPieza] = React.useState<{ width: number; height: number } | null>(null);
  React.useEffect(() => {
    const caja = cajaRef.current;
    if (!caja || !natural || !capUpscale) {
      setPieza(null);
      return;
    }
    const calcular = () => {
      const { room, dpr } = medir(caja);
      const nueva = pieceSize(natural, room, dpr, fit);
      setPieza((antes) => (antes?.width === nueva?.width && antes?.height === nueva?.height ? antes : nueva));
    };
    calcular();
    if (typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(calcular);
    observador.observe(caja);
    return () => observador.disconnect();
  }, [natural, capUpscale, fit]);

  const hayImagen = origen !== null && estado !== "error";
  const cargada = hayImagen && estado === "loaded";
  // Sin imagen, el nombre lo lleva la caja; con ella, el `alt` de la imagen.
  const nombraLaCaja = !hayImagen && alt !== "";

  return (
    <div
      ref={setRefs}
      role={nombraLaCaja ? "img" : undefined}
      aria-label={nombraLaCaja ? alt : undefined}
      data-sala-poster={origen === null ? "empty" : estado}
      className={cn(
        "relative w-full overflow-hidden bg-sala-band text-sala-band-ink [container-type:inline-size]",
        // Con colores forzados el campo de color desaparece: que quede el contorno de la caja.
        "forced-colors:outline forced-colors:outline-1 forced-colors:-outline-offset-1 forced-colors:outline-[CanvasText]",
        CAJA[proporcion],
        palette && SALA_WORK_CLASS,
        className
      )}
      style={palette ? { ...(workPaletteVars(palette) as React.CSSProperties), ...style } : style}
      {...props}
    >
      {/* El rótulo va detrás y primero: es lo que se ve hasta que la imagen lo tapa. */}
      {fallback === "title" && !cargada ? (
        <span aria-hidden="true" data-sala-poster-title="" className="absolute inset-0 flex items-end overflow-hidden p-[8cqw]">
          <span
            lang={titleLang}
            // A este tamaño el interlineado del rótulo grande (0,9) hace chocar las líneas.
            className="line-clamp-4 sala-type-title leading-none [overflow-wrap:anywhere]"
            style={{ fontSize: "clamp(0.875rem, 13cqw, 2.5rem)", fontStretch: `${salaPosterStretch(title)}%` }}
          >
            {title}
          </span>
        </span>
      ) : null}
      {hayImagen ? (
        <span
          data-sala-poster-frame={pieza ? "piece" : "fill"}
          className={cn("absolute", pieza ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" : "inset-0")}
          style={pieza ?? undefined}
        >
          <Image
            loader={posterLoader}
            src={origen}
            alt={alt}
            fill
            sizes={sizes}
            priority={priority}
            loading={priority ? undefined : loading}
            className={fit === "contain" || pieza ? "object-contain" : "object-cover"}
            style={focus ? { objectPosition: focus } : undefined}
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              setSeguimiento({ src: origen, estado: "loaded", natural: { width: naturalWidth, height: naturalHeight } });
            }}
            onError={() => {
              setSeguimiento({ src: origen, estado: "error", natural: null });
              onLoadError?.();
            }}
          />
        </span>
      ) : null}
    </div>
  );
});
