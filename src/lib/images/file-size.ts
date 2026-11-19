// ============================================================
// KULTURA — Tamaño real del archivo de una imagen ya cargada
// ------------------------------------------------------------
// El tope de ampliación (biblia §2, `src/lib/design/image-fit.ts`) mide contra
// los píxeles del archivo. `naturalWidth` de un `<img>` con `srcset` de
// descriptores `w` y `sizes` (lo que genera `next/image`) NO es eso: el
// navegador lo divide por la densidad del candidato elegido, y da
// ancho real × `sizes` ÷ descriptor. Una portada de 780 px pedida como `828w`
// para una caja de 171 px dice medir 161.
//
// Aquí se mide el archivo: el mismo `currentSrc`, en un `Image` suelto, sin
// `srcset`. Sale de la caché (acaba de cargarse) y no se descodifica entero.
// ============================================================
import type { PixelSize } from "@/lib/design/image-fit";

const MAX_RECORDADAS = 256;
const medidas = new Map<string, Promise<PixelSize>>();

function sondear(url: string): Promise<PixelSize> {
  return new Promise<PixelSize>((resolve, reject) => {
    const sonda = new Image();
    sonda.onload = () => resolve({ width: sonda.naturalWidth, height: sonda.naturalHeight });
    sonda.onerror = () => reject(new Error("No se pudo medir la imagen"));
    sonda.src = url;
  });
}

/**
 * Tamaño en píxeles reales del archivo que está pintando `imagen`, que ya ha
 * cargado. Sin `srcset` el navegador no corrige nada y vale lo que dice la
 * propia imagen. Se rechaza si el archivo no se puede volver a leer.
 */
export function measureImageFile(imagen: HTMLImageElement): Promise<PixelSize> {
  if (!imagen.srcset) return Promise.resolve({ width: imagen.naturalWidth, height: imagen.naturalHeight });
  const url = imagen.currentSrc || imagen.src;
  let medida = medidas.get(url);
  if (!medida) {
    medida = sondear(url);
    medidas.set(url, medida);
    // Un fallo no se recuerda: la próxima vez se vuelve a intentar.
    medida.catch(() => medidas.delete(url));
    if (medidas.size > MAX_RECORDADAS) medidas.delete(medidas.keys().next().value as string);
  }
  return medida;
}

/** Solo para pruebas: olvida lo medido. */
export function forgetMeasuredFiles(): void {
  medidas.clear();
}
