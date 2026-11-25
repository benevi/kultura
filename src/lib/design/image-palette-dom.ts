// ============================================================
// KULTURA — El color de una obra a partir de su imagen, en el navegador
// (biblia §4). Lo comparten la sala de la ficha (`SalaFichaImage`) y el hero
// «Continuando» de Inicio (`SalaPoster` con `readPalette`).
//
// La imagen ya cargada se pinta en un lienzo de 32×32, se sacan los papeles
// con `paletteFromPixels` (ya ajustados a AA en claro y oscuro) y se ponen
// como variables en el contenedor `sala-work` más cercano. Ni servidor ni
// peticiones nuevas: es la misma imagen que ya está en pantalla. Si el origen
// no deja leerla o no da color útil, el contenedor se queda en los neutros.
// ============================================================

import { paletteFromPixels } from "./image-palette";
import { SALA_WORK_CLASS, workPaletteVars } from "./sala-palette";

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

/**
 * Pone la paleta de `img` (ya cargada, pedida con CORS) en el `sala-work` más
 * cercano y lo marca con `data-sala-palette="image"`. Sin estado de React: no
 * se vuelve a pintar nada. Devuelve si la ha puesto.
 */
export function applyImagePalette(img: HTMLImageElement): boolean {
  const work = img.closest<HTMLElement>(`.${SALA_WORK_CLASS}`);
  if (!work) return false;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE;
    canvas.height = SAMPLE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
    const palette = paletteFromPixels(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data);
    if (palette.neutral) return false;
    for (const [name, value] of Object.entries(workPaletteVars(palette))) work.style.setProperty(name, value);
    work.dataset.salaPalette = "image";
    return true;
  } catch {
    // Lienzo «manchado» (sin CORS): neutros.
    return false;
  }
}
