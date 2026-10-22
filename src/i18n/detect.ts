import { routing } from "./routing";

export type AppLocale = (typeof routing.locales)[number];

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (routing.locales as readonly string[]).includes(value);
}

/** Idioma por el primer segmento de la ruta (`/en/...` → `en`). */
export function localeFromPathname(pathname: string | null | undefined): AppLocale {
  const first = (pathname ?? "").split("/")[1];
  return isAppLocale(first) ? first : routing.defaultLocale;
}

/**
 * Idioma preferido según `Accept-Language` (con sus pesos `q`), para las
 * páginas que se pintan fuera de `/[locale]` (la 404 raíz). Sin cabecera o sin
 * ningún idioma soportado, el idioma por defecto.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): AppLocale {
  if (!header) return routing.defaultLocale;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return { lang: tag.trim().toLowerCase().split("-")[0], weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((entry) => entry.lang && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  return ranked.map((entry) => entry.lang).find(isAppLocale) ?? routing.defaultLocale;
}
