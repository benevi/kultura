import "server-only";
import { cookies } from "next/headers";
import { UI_V2_COOKIE, resolveUiV2 } from "./ui-v2-shared";

// ============================================================
// KULTURA — Interruptor de UI v2 (F0, PLAN_ESTRATEGICO §7.3)
//
// Cada `page.tsx` que tenga pantalla nueva pregunta `isUiV2Enabled()` y
// renderiza la vieja o la de `src/v2/`. Las pantallas nuevas viven fuera de
// `app/` para que no colisionen rutas: la URL no cambia, cambia lo que se pinta.
//
// Prioridad:
//   1. cookie `ui_v2` = "1" → nueva · "0" → vieja (la pone `/api/ui-v2`)
//   2. variable `UI_V2_DEFAULT` = "1" → nueva para todo el que no haya elegido
//   3. por defecto → vieja
//
// La cookie "0" gana a `UI_V2_DEFAULT=1`: cuando la nueva sea la de todos,
// quien la apague sigue viendo la vieja hasta el borrado (Anexo B).
//
// Solo en rutas dinámicas: leer `cookies()` saca la página de la caché del
// CDN, así que una ruta cacheable (`STATIC_CSP_ROUTES`, `lib/csp.ts`) no puede
// usar esto sin rediseñar su caché antes. Lo vigila
// `tests/unit/ui-v2/static-routes.test.ts`.
//
// Lo que NO cambia con el interruptor (a tener en cuenta al generalizarlo):
// - `loading.tsx` y `error.tsx` de la carpeta siguen siendo los de la UI vieja.
// - El cambio se aplica con una navegación de documento entero (303 desde
//   `/api/ui-v2`); al volver atrás, la caché del navegador o el Router Cache
//   pueden enseñar un momento la UI anterior hasta recargar.
// ============================================================

export { UI_V2_COOKIE, resolveUiV2 };
/** 30 días: lo justo para una ronda de pruebas sin tener que reactivarlo. */
export const UI_V2_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** ¿Pinta esta petición la UI v2? Para Server Components de rutas dinámicas. */
export async function isUiV2Enabled(): Promise<boolean> {
  const store = await cookies();
  return resolveUiV2(store.get(UI_V2_COOKIE)?.value, process.env.UI_V2_DEFAULT);
}
