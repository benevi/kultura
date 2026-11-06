// KULTURA — Opciones fijas de la barra de Descubrir: años y tipos.
//
// Los iconos y el esqueleto (UI vieja) viven en
// `src/components/discover/discover-icons.ts` (rescate F0).

import { TYPE_ORDER, type DiscoverType } from "@/lib/discover/type-filters";

/**
 * Años relativos al actual: [actual, -1, -2] como YYYY + las 2 décadas
 * previas como YYYYs + 'classic' (formatos que parsea discover-params).
 */
export function buildYearBuckets(now = new Date().getFullYear()): { value: string; label: string }[] {
  const years = [now, now - 1, now - 2].map((y) => ({ value: String(y), label: String(y) }));
  // Década que contiene el año más antiguo listado, y la anterior.
  const baseDecade = Math.floor((now - 2) / 10) * 10;
  const decades = [baseDecade - 10, baseDecade - 20].map((d) => ({ value: `${d}s`, label: `${d}s` }));
  return [...years, ...decades, { value: "classic", label: "classic" }];
}

export function isDiscoverType(t: string): t is DiscoverType {
  return (TYPE_ORDER as readonly string[]).includes(t);
}
