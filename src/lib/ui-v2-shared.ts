// ============================================================
// KULTURA — Interruptor de UI v2: la parte sin dependencias de servidor (apta
// también para el Edge; el middleware ya no la usa desde D-H2).
// `src/lib/ui-v2.ts` añade la lectura de cookies para Server Components.
// ============================================================

export const UI_V2_COOKIE = "ui_v2";

export function resolveUiV2(cookieValue: string | undefined, envDefault: string | undefined): boolean {
  if (cookieValue === "1") return true;
  if (cookieValue === "0") return false;
  return envDefault === "1";
}
