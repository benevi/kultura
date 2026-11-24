// ============================================================
// KULTURA — «Dónde ver»: variantes de un mismo servicio en un grupo (F6)
// ------------------------------------------------------------
// TMDB (datos de JustWatch) da cada variante como un proveedor aparte:
// «Amazon Prime Video» y «Amazon Prime Video with Ads», «HBO Max» y «HBO Max
// Amazon Channel»… Decisión de Víctor: juntarlas en una tarjeta. Solo es
// presentación y en el momento (revisión de términos, F6): no se inventa
// ningún nombre ni logo. La tarjeta lleva el nombre y el logo literales de la
// variante principal (la que se llama como el servicio, o si no la primera
// que da TMDB) y las demás se pueden abrir, cada una con su nombre literal.
// ============================================================

/**
 * Sufijos que TMDB añade al nombre del servicio para una variante. Se quitan
 * para hallar el servicio; nunca se muestran nombres sin ellos que TMDB no dé.
 */
const VARIANT_SUFFIXES = [
  /\s+(standard|basic|premium)\s+with\s+ads$/i,
  /\s+with\s+ads$/i,
  /\s+amazon\s+channels?$/i,
  /\s+apple\s+tv\s+channels?$/i,
  /\s+roku\s+premium\s+channel$/i,
] as const;

/**
 * Alias de servicio: nombres distintos de TMDB que son el mismo servicio.
 * Clave y valor en minúsculas, sin sufijos.
 */
const SERVICE_ALIASES: Readonly<Record<string, string>> = {
  max: "hbo max",
};

/** El servicio al que pertenece un nombre de TMDB (clave interna, nunca se enseña). */
export function providerServiceKey(name: string): string {
  let key = name.trim();
  for (let changed = true; changed; ) {
    changed = false;
    for (const re of VARIANT_SUFFIXES) {
      const next = key.replace(re, "");
      if (next !== key && next.length > 0) {
        key = next;
        changed = true;
      }
    }
  }
  const lower = key.toLowerCase();
  return SERVICE_ALIASES[lower] ?? lower;
}

export interface ProviderGroup<T extends { name: string }> {
  /** La variante que da nombre y logo a la tarjeta. */
  main: T;
  /** Las demás variantes del mismo servicio, en el orden de TMDB. */
  variants: T[];
}

/**
 * Agrupa por servicio, conservando el orden de TMDB (el del primer elemento
 * de cada servicio). Principal: la variante cuyo nombre es el del servicio, o
 * la primera.
 */
export function groupProviderVariants<T extends { name: string }>(items: T[]): ProviderGroup<T>[] {
  const byKey = new Map<string, T[]>();
  for (const item of items) {
    const key = providerServiceKey(item.name);
    const list = byKey.get(key);
    if (list) list.push(item);
    else byKey.set(key, [item]);
  }
  return [...byKey.entries()].map(([key, list]) => {
    const main = list.find((p) => p.name.trim().toLowerCase() === key) ?? list[0];
    return { main, variants: list.filter((p) => p !== main) };
  });
}
