// @vitest-environment node
/**
 * TXT-6 (glosario) y TXT-11 (voz, ver VOZ.md): una palabra por concepto y las
 * reglas de estilo que se pueden comprobar sin leer.
 *
 * - `FORBIDDEN`: sinónimos o formas que el glosario descarta, con la que va.
 * - `SAME_CONCEPT`: claves que nombran lo mismo en sitios distintos y tienen
 *   que decirlo igual (los estados, Ajustes, el correo, los formatos).
 * - Voz: sin emojis, "…" de un carácter, ningún "Error al…" sin salida.
 */
import { describe, it, expect } from "vitest";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";
import { flatten } from "./scan";

type Tree = { [key: string]: string | Tree };
const LOCALES = { es: flatten(es as Tree), en: flatten(en as Tree) } as const;
type Locale = keyof typeof LOCALES;
const OWN = (k: string) => !(k === "push" || k.startsWith("push."));

/** El texto que se lee: sin argumentos ICU (`{email}`) ni etiquetas (`<mail>`). */
const visible = (v: string) => v.replace(/<\/?[a-zA-Z]+>/g, " ").replace(/\{[a-zA-Z_]+\}/g, " ");

type Rule = { locale: Locale; bad: RegExp; use: string; except?: (key: string) => boolean };

export const FORBIDDEN: Rule[] = [
  { locale: "es", bad: /\bConfiguraci[oó]n\b/, use: "Ajustes" },
  { locale: "es", bad: /\be-?mails?\b/i, use: "correo / Correo electrónico" },
  { locale: "es", bad: /\b[Ee]n progreso\b/, use: "en curso" },
  { locale: "es", bad: /\bcolecci[oó]n(es)?\b|\bcoleccionar\b/i, use: "biblioteca (lo tuyo) o lista (una agrupación); «colección» solo es la página pública", except: (k) => k.startsWith("collection.") },
  { locale: "es", bad: /\busted(es)?\b/i, use: "tú" },
  { locale: "es", bad: /[ōū]/, use: "Shonen, Shojo (sin macrones)" },
  { locale: "en", bad: /\bAbandoned\b/i, use: "Dropped" },
  { locale: "en", bad: /\b(catalogue|favourites?|colours?|cancelled|organis(e|ation)|behaviour)\b/i, use: "ortografía de EE. UU. (catalog, favorites, canceled…)" },
  { locale: "en", bad: /\bLog ?in\b|\bLogin\b/i, use: "Sign in" },
  { locale: "en", bad: /\bE-mail\b/i, use: "Email" },
  { locale: "en", bad: /\bTV Shows?\b|\bMy Library\b/, use: "sentence case: TV show(s), My library" },
];

/** Grupos de claves que nombran el mismo concepto. */
export const SAME_CONCEPT: { concept: string; keys: string[] }[] = [
  { concept: "completado", keys: ["status.completed", "library.status.completed", "filters.completed"] },
  { concept: "en curso", keys: ["status.in_progress", "library.status.in_progress", "filters.inProgress", "library.counters.inProgress"] },
  { concept: "pendiente", keys: ["status.pending", "library.status.pending", "filters.pending"] },
  { concept: "abandonado", keys: ["library.status.abandoned", "filters.dropped"] },
  { concept: "ajustes", keys: ["nav.settings", "settings.title"] },
  { concept: "correo", keys: ["auth.email", "settings.email"] },
  { concept: "película", keys: ["media.movie", "discoverFilters.typeBadge.movie"] },
  { concept: "serie", keys: ["media.tv", "discoverFilters.typeBadge.tv"] },
  { concept: "videojuego", keys: ["media.game", "discoverFilters.typeBadge.game"] },
  { concept: "libro", keys: ["media.book", "discoverFilters.typeBadge.book"] },
  { concept: "cómic", keys: ["media.comic", "discoverFilters.typeBadge.comic"] },
  { concept: "películas", keys: ["media.movies", "filters.movie"] },
  { concept: "series", keys: ["media.tvs", "filters.tv"] },
  { concept: "videojuegos", keys: ["media.games", "filters.game"] },
];

/** ★ (nota) y ▶ (seguir) son glifos tipográficos, no emojis. */
const EMOJI = new RegExp("(?![\\u2605\\u25B6\\u00A9\\u00AE\\u2122])\\p{Extended_Pictographic}", "u");

const entries = (locale: Locale) => Array.from(LOCALES[locale]).filter(([k]) => OWN(k));

describe("TXT-6 — glosario", () => {
  it.each(FORBIDDEN.map((r) => [r.locale, r.bad.source, r] as const))("%s: nada de /%s/", (_l, _s, rule) => {
    const hits = entries(rule.locale)
      .filter(([k, v]) => !rule.except?.(k) && rule.bad.test(visible(v)))
      .map(([k, v]) => `${k}: ${v.slice(0, 80)} → ${rule.use}`);
    expect(hits).toEqual([]);
  });

  it.each(SAME_CONCEPT)("«$concept» se dice igual en todas sus claves", ({ keys }) => {
    for (const locale of ["es", "en"] as const) {
      const values = keys.map((k) => LOCALES[locale].get(k));
      expect(values.every((v) => v !== undefined), `${locale}: ${keys.join(", ")}`).toBe(true);
      expect(new Set(values).size, `${locale}: ${keys.map((k, i) => `${k}=${values[i]}`).join(" · ")}`).toBe(1);
    }
  });
});

describe("TXT-11 — reglas de voz comprobables", () => {
  it.each(["es", "en"] as const)("%s: sin emojis en los textos (DIS-11)", (locale) => {
    expect(entries(locale).filter(([, v]) => EMOJI.test(v)).map(([k, v]) => `${k}: ${v}`)).toEqual([]);
  });

  it.each(["es", "en"] as const)("%s: puntos suspensivos de un solo carácter", (locale) => {
    expect(entries(locale).filter(([, v]) => v.includes("...")).map(([k]) => k)).toEqual([]);
  });

  it("ningún error empieza por «Error al…» / «Failed to…»: dice qué pasó y qué hacer", () => {
    const es = entries("es").filter(([, v]) => /^Error\b|\bError al\b/.test(v)).map(([k]) => k);
    const en = entries("en").filter(([, v]) => /^(Failed|Error)\b/.test(v)).map(([k]) => k);
    expect([...es, ...en]).toEqual([]);
  });

  it("una sola fórmula para los fallos: «No hemos podido… Reintenta» / «We couldn't… Try again»", () => {
    const es = entries("es")
      .filter(([, v]) => /\bNo se (ha |han )?pud|\bNo se pudieron\b|\bInt[ée]ntalo\b|\bVuelve a intentarlo\b|\bIntentarlo otra vez\b/i.test(v))
      .map(([k]) => k);
    const en = entries("en").filter(([, v]) => /\bPlease try again\b|^Could not\b|^Couldn['’]t\b/i.test(v)).map(([k]) => k);
    expect([...es, ...en]).toEqual([]);
  });

  it("mayúsculas sostenidas solo en las pegatinas (badges)", () => {
    const ALLOWED = /(Badge|badge)$/;
    const SIGLAS = /\b(KULTURA|JSON|CSV|HTTPS?|RGPD|GDPR|LSSI|LSSICE|ISBN|IMDb|TMDB|RAWG|URL|WCAG|PWA|DSA|XML|ZIP|AEPD|NSFW|SMTP|LOPDGDD|OADIS|NEXT_LOCALE|OK)\b/g;
    const shouting = (["es", "en"] as const).flatMap((l) =>
      entries(l)
        .filter(([k, v]) => !ALLOWED.test(k) && /[A-ZÁÉÍÓÚÑ]{5,}/.test(visible(v).replace(SIGLAS, "")))
        .map(([k, v]) => `${l}:${k}: ${v.slice(0, 60)}`),
    );
    expect(shouting).toEqual([]);
  });
});
