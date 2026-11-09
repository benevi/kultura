// ============================================================
// KULTURA v2 — Bloque-logotipo: siete letras, siete formatos, siete colores.
// Decorativo: el nombre de la marca ya está en la página.
// ============================================================

const LETTERS = [
  ["K", "tv", 100],
  ["U", "movie", 72],
  ["L", "anime", 88],
  ["T", "manga", 62],
  ["U", "book", 94],
  ["R", "comic", 76],
  ["A", "game", 84],
] as const;

const TOKEN_PREFIX = "--k-";

/** Variable CSS del color de un formato (definidas en `tokens.css`). */
export const formatVar = (format: string) => `var(${TOKEN_PREFIX}${format})`;

export function Blocks({ className }: { className?: string }) {
  return (
    <div className={className ? `k2-blocks ${className}` : "k2-blocks"} aria-hidden="true">
      {LETTERS.map(([letter, format, height], i) => (
        <span
          key={i}
          className="k2-blocks__letter"
          style={{ "--block": formatVar(format), "--h": `${height}%` } as React.CSSProperties}
        >
          {letter}
        </span>
      ))}
    </div>
  );
}
