"use client";

import * as React from "react";
import Image from "next/image";
import { watchBox } from "@/lib/design/box-watch";
import { posterFit, type PixelSize, type PosterFit } from "@/lib/design/image-fit";
import { measureImageFile } from "@/lib/images/file-size";
import { posterLoader } from "@/lib/images/poster-url";
import { applyImagePalette, paletteReadable } from "@/lib/design/image-palette-dom";

/**
 * Lo único de cliente de `SalaPoster`: la imagen. No se usa suelta; la monta
 * `SalaPoster`, que pone la caja, el campo de color y el rótulo en servidor.
 *
 * - `SalaPosterImage` (la de siempre): se entera de si la imagen ha fallado,
 *   para quitarla, y marca cuándo ha cargado. No mide nada ni observa la caja,
 *   y al cargar no vuelve a pintar nada.
 * - `SalaPosterCappedImage` (con tope de ampliación): además mide el archivo y
 *   la caja, y decide si la imagen la llena o va como pieza.
 *
 * El estado va en `data-sala-poster-image` (`loading`, `loaded`, `error`): el
 * rótulo del póster se esconde con CSS cuando pasa a `loaded`.
 */
export interface SalaPosterImageProps {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  loading?: "lazy" | "eager";
  fit?: "cover" | "contain";
  focus?: string;
  onLoadError?: () => void;
  /**
   * Saca el color de la imagen ya cargada y lo pone en el `sala-work` más
   * cercano (biblia §4; `image-palette-dom`). La imagen se pide con CORS
   * donde el origen lo permite; si así falla, se pide otra vez sin él y el
   * contenedor se queda en los neutros. Solo `SalaPosterImage`.
   */
  readPalette?: boolean;
}

export interface SalaPosterCappedImageProps extends SalaPosterImageProps {
  /** Tamaño del archivo en píxeles reales, si se sabe. Sin él, se mide al cargar. */
  naturalSize?: PixelSize;
}

type Estado = "loading" | "loaded" | "error";

/**
 * La imagen falló: no queda `<img>` (ni icono de imagen rota). El campo de
 * color y el rótulo ya están debajo y esto no los tapa: es solo la marca del
 * estado y, si la imagen llevaba nombre, quien lo hereda.
 */
function Rota({ alt }: { alt: string }) {
  return alt ? (
    <span data-sala-poster-image="error" role="img" aria-label={alt} className="sr-only" />
  ) : (
    <span data-sala-poster-image="error" hidden />
  );
}

/** Cargada: lo dice el marco. Es un atributo, no estado: nada se vuelve a pintar. */
function marcarCargada(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.parentElement?.setAttribute("data-sala-poster-image", "loaded");
}

export function SalaPosterImage({
  src,
  alt,
  sizes,
  priority = false,
  loading,
  fit = "cover",
  focus,
  onLoadError,
  readPalette = false,
}: SalaPosterImageProps) {
  // El único estado: qué imagen ha fallado y cómo. Otra imagen vuelve a intentarlo.
  // Con `readPalette`, un fallo con CORS no la rompe: se pide otra vez sin él.
  const [fallo, setFallo] = React.useState<{ src: string; cors: boolean } | null>(null);
  const corsPrimero = readPalette && paletteReadable(src);
  const actual = fallo?.src === src ? fallo : null;
  const rota = actual !== null && (!actual.cors || !corsPrimero);
  if (fallo !== null && fallo.src !== src) setFallo(null);
  if (rota) return <Rota alt={alt} />;
  const cors = corsPrimero && actual === null;
  return (
    // `key`: con otra imagen (o sin CORS) el marco es otro y vuelve a nacer en `loading`.
    <span key={`${src} ${cors}`} data-sala-poster-image="loading" data-sala-poster-frame="fill" className="absolute inset-0">
      <Image
        loader={posterLoader}
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : loading}
        crossOrigin={cors ? "anonymous" : undefined}
        className={fit === "contain" ? "object-contain" : "object-cover"}
        style={focus ? { objectPosition: focus } : undefined}
        onLoad={(event) => {
          marcarCargada(event);
          if (cors) applyImagePalette(event.currentTarget);
        }}
        onError={() => {
          if (cors) {
            setFallo({ src, cors: true });
            return;
          }
          setFallo({ src, cors: false });
          onLoadError?.();
        }}
      />
    </span>
  );
}

/** Lo que se sabe de la imagen que hay puesta. `medido`: el archivo; `false`, no se pudo medir. */
interface CargaConTope {
  src: string;
  estado: Estado;
  medido: PixelSize | false | null;
}

const LLENA: PosterFit = { frame: "fill" };

const mismoAjuste = (a: PosterFit | null, b: PosterFit | null) =>
  a?.frame === b?.frame && (a?.frame !== "piece" || b?.frame !== "piece" || (a.scale === b.scale && a.width === b.width));

export function SalaPosterCappedImage({
  src,
  alt,
  sizes,
  priority = false,
  loading,
  fit = "cover",
  focus,
  onLoadError,
  naturalSize,
}: SalaPosterCappedImageProps) {
  const [carga, setCarga] = React.useState<CargaConTope>({ src, estado: "loading", medido: null });
  const { estado, medido } = carga.src === src ? carga : { estado: "loading" as Estado, medido: null };
  const rota = estado === "error";

  // Mandan las medidas que llegan por props: con ellas se decide al montar, sin esperar a la imagen.
  const natural = naturalSize ?? medido;
  const sinMedida = natural === false;
  const ancho = natural ? natural.width : 0;
  const alto = natural ? natural.height : 0;

  const marco = React.useRef<HTMLSpanElement | null>(null);
  // `null`: aún no se sabe. La imagen no se pinta hasta saberlo: nunca se ve llenar y luego encoger.
  const [ajuste, setAjuste] = React.useState<PosterFit | null>(null);
  React.useLayoutEffect(() => {
    const caja = marco.current?.parentElement;
    const decidir = (nuevo: PosterFit | null) => setAjuste((antes) => (mismoAjuste(antes, nuevo) ? antes : nuevo));
    // No se pudo medir el archivo: mejor entera y quizá blanda que escondida para siempre.
    if (sinMedida) return decidir(LLENA);
    if (rota || !caja || !ancho || !alto) return decidir(null);
    return watchBox(caja, (room, dpr) => decidir(posterFit({ width: ancho, height: alto }, room, dpr, fit)));
  }, [ancho, alto, sinMedida, fit, rota]);

  if (rota) return <Rota alt={alt} />;

  const pieza = ajuste?.frame === "piece" ? ajuste : null;
  return (
    <span
      ref={marco}
      // El rótulo se queda hasta que la imagen está cargada y colocada.
      data-sala-poster-image={estado === "loaded" && ajuste ? "loaded" : "loading"}
      data-sala-poster-frame={ajuste ? ajuste.frame : "pending"}
      className={ajuste ? "absolute inset-0" : "invisible absolute inset-0"}
      // La pieza se encoge con `transform`: la caja del marco no cambia y no hay salto de maquetación.
      style={pieza ? { transform: `scale(${pieza.scale})` } : undefined}
    >
      <Image
        loader={posterLoader}
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : loading}
        className={fit === "contain" || pieza ? "object-contain" : "object-cover"}
        style={focus && !pieza ? { objectPosition: focus } : undefined}
        onLoad={(event) => {
          const cargada = event.currentTarget;
          setCarga((antes) => ({ src, estado: "loaded", medido: antes.src === src ? antes.medido : null }));
          if (naturalSize) return;
          // Se mide en cada carga: al crecer la caja el navegador puede pasar a un archivo mayor.
          const guardar = (medida: PixelSize | false) =>
            setCarga((antes) => (antes.src === src && antes.estado !== "error" ? { ...antes, medido: medida } : antes));
          measureImageFile(cargada).then(guardar, () => guardar(false));
        }}
        onError={() => {
          setCarga({ src, estado: "error", medido: null });
          onLoadError?.();
        }}
      />
    </span>
  );
}
