/**
 * Textos que viajan al navegador (REN-5).
 *
 * `NextIntlClientProvider` serializa en el HTML todos los mensajes que recibe,
 * y sin filtro eran los ~40 KB del catálogo entero en cada página. Ahora va
 * solo lo que usan los componentes cliente, en dos niveles:
 *
 * - `SHELL_CLIENT_NAMESPACES`: lo que necesitan los componentes cliente que
 *   se pintan FUERA de la zona con sesión (landing, login, rankings, perfiles
 *   públicos, legales, 404, error) y los de la cabecera y la barra del layout
 *   de `(app)`, que quedan por encima del proveedor de la zona con sesión. Lo
 *   pone `[locale]/layout.tsx` y sobrevive a la navegación entre páginas.
 * - `APP_CLIENT_NAMESPACES`: todo lo que usan los componentes cliente de la
 *   zona con sesión.
 *   Lo pone `(app)/template.tsx` alrededor de cada página con sesión (un
 *   proveedor anidado SUSTITUYE los mensajes del de fuera, no los mezcla).
 *
 * Un namespace puede ser una rama (`"discoverFilters.typeBadge"`): se manda
 * solo ese subárbol. `tests/unit/shell/client-messages.test.ts` recorre el
 * grafo de imports de los componentes "use client" y falla si algún
 * `useTranslations` queda sin cubrir o si sobra algo en estas listas.
 */

export const SHELL_CLIENT_NAMESPACES = [
  "auth",
  // Solo la rama que usa `ShareRanking`, el único componente cliente de
  // /best (≈ 6 KB menos de textos en el HTML de cada página pública).
  "best.share",
  "demo",
  "errors",
  "nav",
] as const;

/**
 * `/[locale]/report` (denuncia pública sin cuenta): su formulario necesita
 * `report` (~4 KB), que no merece ir en todas las páginas públicas. Lo pone
 * `report/layout.tsx` con su propio proveedor, que sustituye al del shell, así
 * que lleva también lo que usen la cabecera y el pie de esa página.
 */
export const REPORT_CLIENT_NAMESPACES = ["report"] as const;

/**
 * `/[locale]/welcome` (onboarding tras el alta, fuera de `(app)`): pasos y
 * primeras recomendaciones. Mismo patrón que `/report`, con
 * `welcome/layout.tsx`, para no cargar `onboarding` en todas las públicas.
 */
export const WELCOME_CLIENT_NAMESPACES = [
  "aiRecommendations",
  "auth",
  "discoverFilters.typeBadge",
  "onboarding",
] as const;

/**
 * `/[locale]/u/**` (perfil y listas públicas, F-17): "Invitar amigos" del
 * dueño, la denuncia con sesión (`ReportButton`) y la etiqueta de formato de
 * `MediaCard` y el estado vacío de `MediaGrid` (`media`) en las listas
 * públicas (era la única página del shell que los
 * usaba). Mismo patrón que `/report`,
 * con `u/layout.tsx`, para no cargar `report` ni `invite` en todas las públicas.
 */
export const PUBLIC_PROFILE_CLIENT_NAMESPACES = ["discoverFilters.typeBadge", "invite", "media", "report"] as const;

/**
 * `/[locale]/media/…` (ficha pública, D-01, fuera de `(app)`): biblioteca,
 * listas, recomendar y denunciar. Mismo patrón que `/report`, con
 * `media/layout.tsx`; ahí la cabecera y la barra con sesión quedan FUERA de
 * este proveedor (usan las del shell), como en `(app)`.
 */
export const MEDIA_CLIENT_NAMESPACES = [
  // F-18: "Cerrar" y "Cargando…" de `Modal`/`Spinner` y las estrellas de
  // `StarRating` en los diálogos de biblioteca, listas y recomendar.
  "common",
  "errors",
  "library",
  "lists",
  "media_detail",
  "nav",
  "recommendations",
  "report",
] as const;

export const APP_CLIENT_NAMESPACES = [
  "aiRecommendations",
  "auth",
  "chat",
  "collection",
  "common",
  "demo",
  "discover",
  "discoverFilters",
  "errors",
  "filters",
  "friends",
  "groups",
  "home",
  "library",
  "lists",
  "media",
  "moderation",
  "nav",
  "notifications",
  "profile",
  "report",
  "search",
  "settings",
  "suggestions",
] as const;

type Tree = { [key: string]: unknown };

/**
 * Copia de `messages` con solo las ramas pedidas (rutas con puntos). Una ruta
 * que no existe se ignora: el test de arriba ya exige que todas existan.
 */
export function pickMessages(messages: Tree, paths: readonly string[]): Tree {
  const out: Tree = {};
  for (const path of paths) {
    const keys = path.split(".");
    let src: unknown = messages;
    for (const key of keys) {
      src = src && typeof src === "object" ? (src as Tree)[key] : undefined;
    }
    if (src === undefined) continue;
    let dst = out;
    keys.slice(0, -1).forEach((key) => {
      const next = dst[key];
      dst = (next && typeof next === "object" ? next : (dst[key] = {})) as Tree;
    });
    dst[keys[keys.length - 1]] = src;
  }
  return out;
}
