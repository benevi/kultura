// ============================================================
// KULTURA — Ficha cacheable para visitantes sin sesión (bandera FICHA_ISR)
// ------------------------------------------------------------
// Lo usa el middleware (apto para el edge: sin imports de servidor).
//
// Con `FICHA_ISR=1`, una petición GET a /{es|en}/media/{tipo}/{id} sin cookie
// de sesión de Supabase (`sb-…`) y sin la cookie de prueba de «Sala» se
// reescribe a la copia cacheable /{es|en}/media-anonima/{tipo}/{id} (ISR, 6 h),
// con la CSP fija de D-02 en vez de la del nonce. Con sesión o con la cookie
// de prueba sigue la ficha de siempre, dinámica y con nonce.
//
// Por qué la CSP fija: un HTML guardado en la caché es el mismo para todos y
// no puede llevar un nonce por petición. Next solo pone nonce a sus scripts si
// la PETICIÓN trae la cabecera `content-security-policy` con él; aquí no se
// manda, así que el HTML sale sin nonce y lo autoriza `script-src 'self'
// 'unsafe-inline'` (la excepción firmada de D-02: sin datos de usuario).
// ============================================================

/** Segmento interno de la copia cacheable. */
export const FICHA_ISR_SEGMENT = "media-anonima";

const FICHA_PATH = /^\/(es|en)\/media\/(movie|tv|anime|manga|book|comic|game)\/([^/]+)\/?$/;
const INTERNAL_PATH = new RegExp(`^/(es|en)/${FICHA_ISR_SEGMENT}(?:/|$)`);

/** Cookie de prueba de «Sala» (`SALA_TEST_COOKIE` de `src/lib/flags/sala.ts`). */
const SALA_TEST_COOKIE = "kultura_sala_prueba";

/** ¿Está encendida la bandera? Solo con `FICHA_ISR=1`. */
export function fichaIsrEnabled(): boolean {
  return process.env.FICHA_ISR?.trim() === "1";
}

/**
 * ¿Puede esta petición recibir la ficha cacheable? Sin cookie de sesión de
 * Supabase (se llama `sb-<proyecto>-auth-token`, a veces troceada) y sin la de
 * prueba de «Sala» (esa ficha depende de la cookie).
 */
export function isAnonymousForFichaIsr(cookieNames: readonly string[]): boolean {
  return !cookieNames.some((name) => name.startsWith("sb-") || name === SALA_TEST_COOKIE);
}

/** Ruta interna cacheable para una ficha pública, o `null` si no es una ficha. */
export function fichaIsrPath(pathname: string): string | null {
  const match = FICHA_PATH.exec(pathname);
  if (!match) return null;
  const [, locale, type, id] = match;
  return `/${locale}/${FICHA_ISR_SEGMENT}/${type}/${id}`;
}

/** La ruta interna no se sirve por su nombre (404 en el middleware). */
export function isFichaIsrInternalPath(pathname: string): boolean {
  return INTERNAL_PATH.test(pathname);
}

/**
 * ¿Pide esta petición algo desde JavaScript (el router de Next) estando el
 * navegador en una ficha servida con la CSP fija? La misma defensa que
 * `isRouterFetchFromStaticRoute` (revisión #47): la página de destino se
 * pintaría dentro del documento de la ficha y heredaría su CSP. El middleware
 * solo la aplica cuando la ficha de origen salió de la caché (bandera
 * encendida y petición sin sesión ni cookie de prueba).
 */
export function isRouterFetchFromFicha(headers: Headers): boolean {
  if (headers.get("sec-fetch-dest") !== "empty") return false;
  try {
    return fichaIsrPath(new URL(headers.get("referer") ?? "").pathname) !== null;
  } catch {
    return false;
  }
}
