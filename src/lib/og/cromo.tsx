// ============================================================
// KULTURA — Piezas del álbum para las tarjetas de compartir (satori)
// Satori pinta un subconjunto de CSS (flex, sin `aspect-ratio` ni grid): estas
// piezas repiten el cromo, la caja del número y el logotipo de la web con
// medidas fijas. Las usan la tarjeta de los rankings y cualquier otra que
// quiera el mismo aspecto.
// ============================================================

import { C, OG_CROMO, OG_FONT } from "@/lib/og/brand";

/** Respaldo detrás de cada portada: dos paradas del mismo matiz (marino). */
const PLACEHOLDER = "linear-gradient(155deg, #274172, #0b2a6b)";

/** Logotipo `kultura.` con el punto rosa (Bricolage 700). */
export function OgWordmark({ size = 44, color = C.navy }: { size?: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", fontFamily: OG_FONT.logo, fontWeight: 700, fontSize: size, color, letterSpacing: -1 }}>
      kultura
      <span style={{ color: C.pink }}>.</span>
    </div>
  );
}

/** Caja del número (Lilita One, como `NumberBadge`). */
export function OgNumber({ n, size, bg = C.yellow, color = C.ink }: { n: number | string; size: number; bg?: string; color?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: size,
        height: size,
        padding: `0 ${Math.round(size * 0.16)}px`,
        borderRadius: OG_CROMO.radius * 0.6,
        background: bg,
        color,
        fontFamily: OG_FONT.display,
        fontSize: Math.round(size * 0.78),
        lineHeight: 1,
      }}
    >
      {String(n)}
    </div>
  );
}

/**
 * Cromo: la portada con su borde blanco y el respaldo de color SIEMPRE detrás
 * (si la portada no llegó, queda el color). `n` pinta la caja amarilla del
 * puesto en la esquina superior izquierda.
 */
export function OgCromo({
  uri,
  width,
  height,
  n,
  style,
}: {
  uri: string | null;
  width: number;
  height: number;
  n?: number;
  style?: Record<string, string | number>;
}) {
  const inner = { w: width - OG_CROMO.border * 2, h: height - OG_CROMO.border * 2 };
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width,
        height,
        padding: OG_CROMO.border,
        borderRadius: OG_CROMO.radius,
        background: C.white,
        ...style,
      }}
    >
      <div style={{ display: "flex", width: inner.w, height: inner.h, borderRadius: OG_CROMO.radius * 0.5, overflow: "hidden", background: PLACEHOLDER }}>
        {uri ? (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img src={uri} width={inner.w} height={inner.h} style={{ objectFit: "cover" }} />
        ) : null}
      </div>
      {n !== undefined ? (
        <div style={{ display: "flex", position: "absolute", left: OG_CROMO.border + 10, top: OG_CROMO.border + 10 }}>
          <OgNumber n={n} size={Math.round(width * 0.26)} />
        </div>
      ) : null}
    </div>
  );
}
