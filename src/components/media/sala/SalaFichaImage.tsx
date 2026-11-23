"use client";

import * as React from "react";
import Image from "next/image";
import { backdropLoader, posterLoader } from "@/lib/images/poster-url";
import { paletteFromPixels } from "@/lib/design/image-palette";
import { SALA_WORK_CLASS, workPaletteVars } from "@/lib/design/sala-palette";
import { SALA_POSTER_MAX_SCALE, salaPosterFill } from "@/lib/design/sala-poster";

/**
 * La imagen de la sala de la ficha (fase 8.5, F1): la apaisada de la obra
 * (película, serie, juego, anime) o la portada (libro, manga, cómic).
 *
 * Lo único de cliente de la sala, y hace dos cosas:
 * - **El color sale de la imagen, en el navegador** (biblia §4): ya cargada,
 *   se pinta en un lienzo de 32×32, se sacan los papeles con
 *   `paletteFromPixels` y se ponen como variables en el contenedor
 *   `sala-work` más cercano. Sin estado de React: no se vuelve a pintar nada.
 *   Si el origen no deja leerla (Google Books) o no da color útil, se queda
 *   en los neutros.
 * - **Nunca queda rota**: si falla, se quita y se ve el campo de color.
 *
 * `crossOrigin="anonymous"` donde el CDN responde con CORS (TMDB, RAWG, Open
 * Library; comprobado en el navegador el 21-11-2026) o la imagen sale del
 * optimizador de Next (mismo origen). Con Google Books y AniList, sin él:
 * pedirla con CORS la rompería. Si aun así una imagen con CORS falla, se
 * pide otra vez sin él.
 */
export interface SalaFichaImageProps {
  src: string;
  sizes: string;
  /** `cover`: llena la sala. `contain`: la portada entera, a su proporción. */
  fit?: "cover" | "contain";
  /**
   * La vertical que llena la sala (F4): se pide como portada (no con el tope
   * de las apaisadas) y, ya cargada, se comprueba que no pasa de 1,25 veces
   * su tamaño natural; si pasa, la sala se compone como un libro.
   */
  vertical?: boolean;
}

/**
 * Sin CORS fiable: Google Books no lo manda; AniList lo manda a `curl`, pero
 * al navegador le llega a menudo sin él (su caché no distingue el origen) y
 * la imagen se tendría que pedir dos veces. Se quedan en los neutros.
 */
const NO_CORS_HOSTS = ["books.google.com", "s4.anilist.co"];

/** ¿Se pueden leer los píxeles de esta imagen sin romperla? */
export function paletteReadable(src: string): boolean {
  let host: string;
  try {
    host = new URL(src).hostname;
  } catch {
    // Relativa: mismo origen.
    return true;
  }
  return !(NO_CORS_HOSTS.includes(host) || host.endsWith(".googleusercontent.com"));
}

const SAMPLE = 32;

function applyPalette(img: HTMLImageElement) {
  const work = img.closest<HTMLElement>(`.${SALA_WORK_CLASS}`);
  if (!work) return;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE;
    canvas.height = SAMPLE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
    const palette = paletteFromPixels(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data);
    if (palette.neutral) return;
    for (const [name, value] of Object.entries(workPaletteVars(palette))) work.style.setProperty(name, value);
    work.dataset.salaPalette = "image";
  } catch {
    // Lienzo «manchado» (sin CORS): neutros.
  }
}

/**
 * F4: la sala con vertical (`data-sala-fill`) se queda llenando solo si la
 * imagen no pasa de 1,25 veces su tamaño natural. Si el proveedor la sirvió
 * más pequeña de lo que se suponía, baja el paso y la obra pasa a libro.
 *
 * Ojo: con `srcset` de anchos, `naturalWidth` viene dividido por la densidad
 * que eligió el navegador (con AniList, la misma URL para todos los anchos,
 * 460 px salían como 44). Los píxeles de verdad se leen de una imagen suelta
 * con la misma URL, ya en caché.
 */
function checkFill(img: HTMLImageElement) {
  const stage = img.closest<HTMLElement>("[data-sala-fill]");
  if (!stage || !img.currentSrc) return;
  const probe = new window.Image();
  // Con el mismo modo CORS, para que salga de la caché y no se pida otra vez.
  if (img.crossOrigin) probe.crossOrigin = img.crossOrigin;
  probe.onload = () => {
    const width = probe.naturalWidth;
    if (!width || getComputedStyle(img).objectFit !== "cover") return;
    if (img.clientWidth <= width * SALA_POSTER_MAX_SCALE) return;
    stage.dataset.salaFill = salaPosterFill(width);
  };
  probe.src = img.currentSrc;
}

type Attempt = "cors" | "plain" | "broken";

export function SalaFichaImage({ src, sizes, fit = "cover", vertical = false }: SalaFichaImageProps) {
  // El único estado: cómo ha ido con esta imagen. Otra imagen vuelve a empezar.
  const [failed, setFailed] = React.useState<{ src: string; attempt: Attempt } | null>(null);
  const first: Attempt = paletteReadable(src) ? "cors" : "plain";
  const attempt = failed?.src === src ? failed.attempt : first;
  if (attempt === "broken") return null;
  const cors = attempt === "cors";
  return (
    <Image
      key={`${src} ${attempt}`}
      // La apaisada (`cover`) con tope en w1280 de TMDB; la portada (y la vertical que llena la sala), como siempre.
      loader={fit === "cover" && !vertical ? backdropLoader : posterLoader}
      src={src}
      alt=""
      fill
      sizes={sizes}
      priority
      crossOrigin={cors ? "anonymous" : undefined}
      className={fit === "contain" ? "object-contain" : "object-cover"}
      onLoad={
        cors || vertical
          ? (event) => {
              if (vertical) checkFill(event.currentTarget);
              if (cors) applyPalette(event.currentTarget);
            }
          : undefined
      }
      // Con CORS, un CDN que a veces no lo manda (AniList detrás de su caché) rompe la imagen:
      // se pide otra vez sin él y la obra se queda en los neutros. Si tampoco, fuera.
      onError={() => setFailed({ src, attempt: cors ? "plain" : "broken" })}
    />
  );
}
