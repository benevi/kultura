// ============================================================
// KULTURA — Plantilla de tarjeta para compartir (OG) en «Sala» (fase 8.5, M1).
// Aún no la usa ninguna ruta: M2 la conecta detrás de `SALA_MARCA`.
//
// 1200×630, fondo de «Sala» de noche, el logotipo en trazados (no depende de
// la fuente), el titular en Anybody 800 y el lema en Instrument Sans. A la
// derecha, la imagen que pase quien la use (p. ej. la portada de una obra con
// `posterDataUri`); sin imagen, un campo del color del panel. El rasterizador
// de next/og no entiende OKLCH ni variables CSS: van los hex de los tokens.
// ============================================================

import { loadFont } from "@/lib/og/brand";
import { SALA_COLOR } from "@/lib/design/sala-tokens";
import { SALA_LOGO_HEIGHT, SALA_LOGOTYPE_WIDTH, SALA_SYMBOL_PATH, SALA_WORD_PATH } from "@/lib/brand/sala-logo";

export const SALA_OG_SIZE = { width: 1200, height: 630 } as const;

const DARK = SALA_COLOR.dark;

/** Las fuentes de la tarjeta, recortadas a su texto. Sin red, satori usa la suya. */
export async function salaCardFonts(title: string, lema: string) {
  const fonts = await Promise.all([loadFont("Anybody", 800, title.toUpperCase()), loadFont("Instrument+Sans", 500, lema)]);
  return fonts.filter((f) => f !== null);
}

/** El logotipo como elemento de satori, a `height` px de alto. */
export function SalaLogotype({ height, color = DARK.ink }: { height: number; color?: string }) {
  const width = Math.round((height * SALA_LOGOTYPE_WIDTH) / SALA_LOGO_HEIGHT);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${SALA_LOGOTYPE_WIDTH} ${SALA_LOGO_HEIGHT}`}>
      <path fill={color} fillRule="evenodd" d={SALA_SYMBOL_PATH} />
      <path fill={color} d={SALA_WORD_PATH} />
    </svg>
  );
}

export interface SalaSiteCardProps {
  /** Titular (va en caja alta). */
  title: string;
  /** Lema corto debajo. */
  lema: string;
  /** Imagen de la derecha (data URI o URL absoluta); sin ella, campo de color. */
  image?: string | null;
}

export function SalaSiteCard({ title, lema, image }: SalaSiteCardProps) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: DARK.background, color: DARK.ink }}>
      <div
        style={{
          width: 600,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 56px",
        }}
      >
        <SalaLogotype height={64} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontFamily: "Anybody",
              fontWeight: 800,
              fontSize: 64,
              lineHeight: 0.98,
              textTransform: "uppercase",
            }}
          >
            {title}
          </div>
          <div style={{ fontFamily: "Instrument Sans", fontWeight: 500, fontSize: 26, color: DARK.inkSecondary, marginTop: 18 }}>
            {lema}
          </div>
        </div>
      </div>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- satori pinta <img>, no next/image
        <img src={image} alt="" width={600} height={630} style={{ objectFit: "cover" }} />
      ) : (
        <div style={{ width: 600, height: "100%", background: DARK.panel }} />
      )}
    </div>
  );
}
