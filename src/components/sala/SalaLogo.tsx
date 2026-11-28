import { SALA_LOGO_HEIGHT, SALA_LOGOTYPE_WIDTH, SALA_SYMBOL_PATH, SALA_WORD_PATH } from "@/lib/brand/sala-logo";

/**
 * Logo de «Sala» (fase 8.5, D1 «Bloque»; trazados en `src/lib/brand/sala-logo.ts`).
 * Pinta en `currentColor`: la tinta de donde esté. Su nombre accesible es
 * «Kultura»; dentro de un enlace, ese es el nombre del enlace.
 *
 * Sin hooks ni 'use client': vale en la cabecera pública (servidor, sin JS) y
 * en la de la app.
 */
export function SalaLogo({
  height,
  variant = "logotype",
  className,
}: {
  /** Alto en px; el ancho sale de la proporción. */
  height: number;
  /** `symbol`: solo el bloque con la K. */
  variant?: "logotype" | "symbol";
  className?: string;
}) {
  const vbWidth = variant === "symbol" ? SALA_LOGO_HEIGHT : SALA_LOGOTYPE_WIDTH;
  const width = Math.round((height * vbWidth) / SALA_LOGO_HEIGHT);
  return (
    <svg
      role="img"
      aria-label="Kultura"
      width={width}
      height={height}
      viewBox={`0 0 ${vbWidth} ${SALA_LOGO_HEIGHT}`}
      fill="currentColor"
      className={className}
      data-sala-logo=""
    >
      <path fillRule="evenodd" d={SALA_SYMBOL_PATH} />
      {variant === "logotype" ? <path d={SALA_WORD_PATH} /> : null}
    </svg>
  );
}
