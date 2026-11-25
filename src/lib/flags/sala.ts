// ============================================================
// KULTURA — Banderas de «Sala» (fase 8.5, docs/fase8/8-5-pantallas.md)
// ------------------------------------------------------------
// Una bandera por pantalla, leída en el servidor como `QUICK_ADD`:
//   - `0` o sin definir: la pantalla de hoy, sin cambios;
//   - `1`: «Sala» para todos;
//   - `prueba`: «Sala» solo para quien trae la cookie de prueba, que se pone
//     y se quita con el enlace `/api/sala-prueba?on=1|0` (para los usuarios
//     de P-Uso). La cookie no lleva datos personales: solo `1`.
// ============================================================

/** Cookie de prueba de «Sala»: la misma para todas las pantallas con bandera. */
export const SALA_TEST_COOKIE = "kultura_sala_prueba";
/** Lo que vale la cookie cuando está puesta. */
export const SALA_TEST_COOKIE_VALUE = "1";
/** Caducidad de la cookie: lo que dura una bandera (docs/banderas.json, 60 días). */
export const SALA_TEST_COOKIE_MAX_AGE = 60 * 24 * 60 * 60;

export type SalaFlagMode = "off" | "on" | "test";

/** Modo de una bandera de «Sala» a partir del valor de su variable de entorno. */
export function salaFlagMode(raw: string | undefined): SalaFlagMode {
  const value = raw?.trim().toLowerCase();
  if (value === "1") return "on";
  if (value === "prueba") return "test";
  return "off";
}

/** ¿Trae la petición la cookie de prueba? */
export function hasSalaTestCookie(value: string | undefined): boolean {
  return value === SALA_TEST_COOKIE_VALUE;
}

/** ¿Se ve «Sala» con este modo y esta cookie? */
export function salaEnabled(mode: SalaFlagMode, cookieValue: string | undefined): boolean {
  if (mode === "on") return true;
  if (mode === "test") return hasSalaTestCookie(cookieValue);
  return false;
}

/** La cookie de prueba que pone (`on`) o quita el enlace `/api/sala-prueba`. */
export function salaTestCookie(on: boolean, secure: boolean) {
  return {
    name: SALA_TEST_COOKIE,
    value: on ? SALA_TEST_COOKIE_VALUE : "",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure,
      path: "/",
      maxAge: on ? SALA_TEST_COOKIE_MAX_AGE : 0,
    },
  };
}

/**
 * A dónde vuelve el enlace de prueba: una ruta de este sitio
 * (`/es/media/movie/496243`), nunca otra web (`//x.com`, `/\x.com`,
 * `/<tab>/x.com`: el analizador de URL quita tabuladores y saltos de línea,
 * así que también se rechaza cualquier carácter de control).
 */
// eslint-disable-next-line no-control-regex -- justo lo que se busca rechazar
const UNSAFE_NEXT = /[\u0000-\u001F\u007F\\]/;

export function salaTestNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || UNSAFE_NEXT.test(raw)) return "/";
  return raw;
}

/** Una bandera de «Sala» en el servidor. Solo lee la cookie con la bandera en `prueba`. */
async function salaFlagEnabled(raw: string | undefined): Promise<boolean> {
  const mode = salaFlagMode(raw);
  if (mode === "on") return true;
  if (mode !== "test") return false;
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return salaEnabled(mode, store.get(SALA_TEST_COOKIE)?.value);
}

/**
 * Ficha en «Sala» (`SALA_FICHA`). Solo lee la cookie con la bandera en
 * `prueba`: con `0` la ficha sale como hoy.
 */
export function salaFichaEnabled(): Promise<boolean> {
  return salaFlagEnabled(process.env.SALA_FICHA);
}

/**
 * Biblioteca en «Sala» (`SALA_BIBLIOTECA`, fase 8.5 B1). La misma cookie y la
 * misma lógica que `SALA_FICHA`: con `0` la biblioteca sale como hoy.
 */
export function salaBibliotecaEnabled(): Promise<boolean> {
  return salaFlagEnabled(process.env.SALA_BIBLIOTECA);
}

/**
 * Descubrir en «Sala» (`SALA_DESCUBRIR`, fase 8.5 D1): la barra de búsqueda y
 * la rejilla. La misma cookie y la misma lógica que las otras: con `0`
 * Descubrir sale como hoy.
 */
export function salaDescubrirEnabled(): Promise<boolean> {
  return salaFlagEnabled(process.env.SALA_DESCUBRIR);
}

/**
 * Inicio en «Sala» (`SALA_INICIO`, fase 8.5 I1): el título, «Continúa donde
 * lo dejaste» y las filas de amigos y novedades. La misma cookie y la misma
 * lógica que las otras: con `0` Inicio sale como hoy.
 */
export function salaInicioEnabled(): Promise<boolean> {
  return salaFlagEnabled(process.env.SALA_INICIO);
}
