import { cn } from "@/lib/utils/index";

/**
 * El dibujo de error de `SalaBlockState` (un aspa en un cuadrado), el mismo
 * trazo que `SalaStatusIcon tone="error"` (un test los compara).
 *
 * Va aparte a propósito: `SalaBlockState` está en la página de error de la app
 * (`error.js`, en todas las rutas) y `SalaStatusIcon` lo usan también los
 * avisos de la ficha. Importarlo aquí lo sacaba del trozo de `error.js` y la
 * portada se pasaba del presupuesto de script de Lighthouse (F2b, #274).
 */
export const SALA_BLOCK_ERROR_PATH = "M3 3h14v14H3zM7 7l6 6M13 7l-6 6";

export function SalaBlockStateErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      data-sala-tone-icon="error"
      className={cn("h-5 w-5 shrink-0 forced-colors:text-[color:CanvasText]", className)}
    >
      <path d={SALA_BLOCK_ERROR_PATH} />
    </svg>
  );
}
