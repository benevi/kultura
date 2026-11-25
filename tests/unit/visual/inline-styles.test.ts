/**
 * @vitest-environment node
 *
 * Fase 8.4 · C13: los `style={…}` en línea no vuelven.
 *
 * Un estilo en línea esquiva los tokens: un color, un degradado o un ancho
 * clavado ahí no sigue al sistema de diseño y gana a cualquier clase del mismo
 * elemento (también a las de `hover:`). C13 pasó a clases todos los valores
 * estáticos; aquí quedan solo los que Tailwind no puede generar: las imágenes
 * de `next/og` (exigen estilos en línea), `global-error.tsx` (se pinta sin el
 * layout ni las hojas de estilo) y valores que se calculan en ejecución.
 *
 * Este test cuenta los `style={` de cada `src/**\/*.tsx` (sin las historias) y
 * lo compara con la lista cerrada de abajo:
 * - un archivo con MÁS de los permitidos (o que no está en la lista) falla:
 *   el valor nuevo va a una clase con su token;
 * - un archivo con MENOS también falla: se baja su número (o se quita de la
 *   lista) para que no quede hueco por el que vuelva otro.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, relative } from "node:path";

const ROOT = resolve(__dirname, "../../..");
const SRC = join(ROOT, "src");

/** Ruta relativa a la raíz (con `/`) → [número de `style={`, motivo]. */
const ALLOWED: Record<string, [number, string]> = {
  // ── Excepciones: van en línea a propósito ──────────────────────────────
  "src/app/[locale]/opengraph-image.tsx": [10, "OG: next/og solo admite estilos en línea"],
  "src/app/[locale]/best/[format]/[year]/opengraph-image.tsx": [11, "OG: next/og solo admite estilos en línea"],
  "src/app/[locale]/u/[username]/opengraph-image.tsx": [10, "OG: next/og solo admite estilos en línea"],
  "src/app/[locale]/u/[username]/l/[id]/opengraph-image.tsx": [10, "OG: next/og solo admite estilos en línea"],
  "src/app/[locale]/u/[username]/r/_lib/rated-card.tsx": [11, "OG: tarjeta de next/og de la reseña pública"],
  "src/app/global-error.tsx": [8, "global-error: se pinta sin layout ni hojas de estilo"],

  // ── Degradado de póster sin imagen: `posterGradient(id)` (matiz por hash del id) ──
  // C14: los marcos y miniaturas a mano pasan a `PosterFrame`, que lleva el
  // único `style` del degradado. Quedan /best (servidor sin `next/image`,
  // REN-1; comparte las clases con `posterFrameClass()`) y la ficha (otra
  // fórmula). ReorderableItems y SearchBar pasaron en el PR 11.
  "src/components/best/BestOfList.tsx": [2, "posterGradient(item.id) en las dos filas"],
  "src/components/best/BestTopRow.tsx": [1, "posterGradient(item.id)"],
  "src/components/media/MediaDetail.tsx": [1, "posterGradientFeature(item.id), la fórmula de la ficha"],
  "src/components/media/PosterFrame.tsx": [1, "posterGradient(seed), el de todos los pósteres y miniaturas"],

  // ── Colores que vienen de datos ─────────────────────────────────────────
  "src/app/[locale]/(app)/groups/GroupsClient.tsx": [1, "coverColor del grupo"],
  "src/app/[locale]/(app)/groups/[id]/page.tsx": [3, "coverColor del grupo (cabecera e icono) y color/zIndex de la pila de avatares"],
  "src/components/social/GroupCard.tsx": [1, "coverColor del grupo"],
  "src/components/social/ListCard.tsx": [1, "matiz de la portada por hash del id de la lista (0-359)"],
  "src/components/ui/Avatar.tsx": [1, "color del avatar del usuario"],
  "src/app/[locale]/(app)/settings/_components/AvatarRows.tsx": [1, "muestra de cada color de avatar"],
  "src/components/collection/PublicCollection.tsx": [1, "formatColor(tipo) del contador"],
  "src/components/media/MediaCard.tsx": [1, "acento radial con accentHue de la rejilla"],

  // ── Anchos y desplazamientos calculados ─────────────────────────────────
  "src/app/[locale]/(app)/settings/import/_components/ProgressBar.tsx": [1, "ancho en % del progreso"],
  "src/components/home/ContinueProgress.tsx": [1, "ancho en % del progreso"],
  "src/components/home/sala/SalaHomeProgress.tsx": [1, "ancho en % del progreso (Inicio en «Sala»)"],
  "src/components/library/ProgressInput.tsx": [1, "ancho en % del progreso"],
  "src/components/layout/LanguageSwitcher.tsx": [1, "translateX según el idioma activo"],
  "src/components/layout/Logo.tsx": [2, "medidas proporcionales a la prop size (y el radio de 3 px, fuera del set cerrado)"],
  "src/components/ui/Modal.tsx": [1, "translateY al arrastrar la hoja"],
  "src/components/ui/Toast.tsx": [1, "translateX y opacidad al arrastrar"],
  "src/components/sala/SalaToast.tsx": [1, "translateX al arrastrar"],

  // ── Portada (landing): encuadre y color de escena de cada póster ────────
  "src/components/landing/Landing.tsx": [4, "objectPosition por póster y --scene del primero"],
  "src/components/landing/WedgeLanding.tsx": [2, "--scene/--scene-ink del póster y su objectPosition"],

  // ── «Sala»: custom properties de la paleta de la obra y ajuste del rótulo ──
  "src/components/sala/SalaDialog.tsx": [1, "workPaletteVars(palette)"],
  "src/components/sala/SalaPoster.tsx": [2, "workPaletteVars(palette) y suelo/tope del rótulo"],
  "src/components/sala/SalaPosterImage.tsx": [3, "objectPosition del encuadre y escala de la pieza"],
  "src/components/sala/SalaStage.tsx": [1, "custom properties del escenario"],
  "src/components/sala/SalaTitle.tsx": [1, "salaTitleVars del rótulo e interlineado compuesto"],
};

const STYLE_ATTR = /\bstyle=\{/g;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".tsx") && !entry.name.endsWith(".stories.tsx") ? [full] : [];
  });
}

function countStyles(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const file of walk(SRC)) {
    const n = readFileSync(file, "utf8").match(STYLE_ATTR)?.length ?? 0;
    if (n > 0) counts.set(relative(ROOT, file).split("\\").join("/"), n);
  }
  return counts;
}

describe("estilos en línea (C13)", () => {
  const counts = countStyles();

  it("ningún archivo pasa de los style={…} que permite la lista", () => {
    const over = [...counts]
      .filter(([file, n]) => n > (ALLOWED[file]?.[0] ?? 0))
      .map(([file, n]) => `${file}: ${n} (permitidos ${ALLOWED[file]?.[0] ?? 0})`);
    expect(over, "Pasa el valor a una clase con su token; si de verdad es dinámico, añádelo a ALLOWED con su motivo.").toEqual([]);
  });

  it("la lista no deja hueco: cada archivo tiene exactamente su número", () => {
    const under = Object.entries(ALLOWED)
      .filter(([file, [n]]) => (counts.get(file) ?? 0) < n)
      .map(([file, [n]]) => `${file}: ${counts.get(file) ?? 0} (la lista dice ${n})`);
    expect(under, "Baja el número en ALLOWED (o quita el archivo) para que no vuelva otro style.").toEqual([]);
  });

  it("cada entrada lleva su motivo", () => {
    const sinMotivo = Object.entries(ALLOWED).filter(([, [, motivo]]) => motivo.trim().length === 0);
    expect(sinMotivo).toEqual([]);
  });
});
