// ============================================================
// KULTURA — «Guardar» de un ranking sin cuenta (funciones puras)
//
// El ranking es HTML cacheado (ISR): no sabe si quien lo mira tiene la cuenta abierta.
// El enlace «Guardar» del HTML lleva a la ficha (sin JS, ahí está el botón de
// añadir); con JS, `BestSaveEnhancer` decide al tocarlo:
// - sin cuenta abierta → alta, y al terminar vuelve a la ficha con `?guardar=1`;
// - con la cuenta abierta → directo a la ficha con `?guardar=1`.
// La ficha es la que conoce la biblioteca de la persona (y no pisa un título
// que ya tenga con otro estado o nota). Ningún enlace al login va en el HTML
// del ranking (F-15): se construye al tocar.
// ============================================================

import { signUpHref } from "@/lib/best/hrefs";

/** Parámetro que pide a la ficha guardar el título como pendiente. */
export const SAVE_PARAM = "guardar";

/**
 * ¿Hay una cookie de Supabase de la cuenta abierta? (`sb-…`, la misma señal que usa el
 * middleware). Si se equivoca, no pasa nada grave: con la cuenta abierta, el alta manda
 * a la ficha; sin ella, la ficha enseña el alta.
 */
export function hasSessionCookie(cookie: string): boolean {
  return cookie.split(";").some((c) => c.trim().startsWith("sb-"));
}

/** Ficha con la petición de guardar (`/es/media/anime/al-1?guardar=1`). */
export function saveIntentPath(fichaPath: string): string {
  const [path, hash] = fichaPath.split("#");
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${SAVE_PARAM}=1${hash ? `#${hash}` : ""}`;
}

/** A dónde lleva «Guardar» al tocarlo, según la cuenta esté abierta o no. */
export function saveDestination(locale: string, fichaPath: string, signedIn: boolean): string {
  const target = saveIntentPath(fichaPath);
  return signedIn ? target : signUpHref(locale, target);
}
