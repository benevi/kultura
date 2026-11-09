import { isUiV2Enabled } from "@/lib/ui-v2";
import "./tokens.css";
import "./skin.css";

// ============================================================
// KULTURA v2 — Ámbito del interruptor
//
// Envuelve un layout o una página dinámica. Con la UI v2 activa, marca el árbol
// con `data-ui="v2"`, lo que enciende `skin.css`; sin ella, no añade ni un nodo.
// `display: contents`: no altera la maquetación de lo que envuelve.
//
// Solo en rutas dinámicas: lee cookies (ver `src/lib/ui-v2.ts`).
// ============================================================

export async function V2Scope({ children }: { children: React.ReactNode }) {
  if (!(await isUiV2Enabled())) return <>{children}</>;
  // Solo con la UI v2: la fuente de display no viaja a quien sigue en la vieja.
  const { bricolagePortada, kulturaDisplay } = await import("@/app/fonts");
  return (
    <div
      data-ui="v2"
      className={`k2 ${kulturaDisplay.variable} ${bricolagePortada.variable}`}
      style={{ display: "contents" }}
    >
      {children}
    </div>
  );
}
