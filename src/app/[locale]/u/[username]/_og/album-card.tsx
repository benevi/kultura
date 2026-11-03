// ============================================================
// KULTURA — Piezas de las tarjetas de compartir de /u (next/og, 1200×630)
//
// Las tarjetas son una página impresa del álbum, como las páginas a las
// que llevan: campo de color plano (cian el perfil y la nota, amarillo la
// lista), tinta marina, titulares en Lilita One y las portadas como cromos
// con su borde blanco (`OgCromo`, el mismo de los rankings). El rasterizador
// no entiende OKLCH: los hex exactos viven en `@/lib/og/brand` (`C`).
// ============================================================

import { C, loadDisplayFont, loadFont, loadLogoFont } from "@/lib/og/brand";
import { OgCromo, OgWordmark } from "@/lib/og/cromo";

export { C as INK, OgWordmark as Wordmark };

/** Lilita (titulares y números), Figtree (texto) y el logotipo, recortados a sus glifos. */
export async function albumFonts(display: string, text: string) {
  return Promise.all([loadDisplayFont(display), loadFont("Figtree", 700, text), loadLogoFont()]);
}

/** Rejilla 2×2 de cromos (la página derecha de la tarjeta), numerados si el orden es un puesto. */
export function CromoGrid({ posters, numbered }: { posters: Array<string | null>; numbered: boolean }) {
  const W = 176;
  const H = 264;
  const GAP = 28;
  const cells = posters.slice(0, 4);
  while (cells.length < 4) cells.push(null);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {[0, 2].map((row) => (
        <div key={row} style={{ display: "flex", marginTop: row === 0 ? 0 : GAP }}>
          {[row, row + 1].map((i) => (
            <div key={i} style={{ display: "flex", marginLeft: i % 2 === 0 ? 0 : GAP }}>
              <OgCromo uri={cells[i]} width={W} height={H} n={numbered ? i + 1 : undefined} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
