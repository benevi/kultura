// ============================================================
// KULTURA — SEO de la ficha pública (SEO-1, SEO-2)
//
// Funciones puras para `media/[type]/[id]/page.tsx`: URL canónica, si la
// ficha se indexa, la descripción para buscadores y el JSON-LD.
//
// Reglas:
//   - `noindex` si el título es adulto (`nsfw-filter`) o si le falta portada o
//     sinopsis: una ficha sin las dos es contenido fino ("Rastreada, sin
//     indexar") y no aporta nada a quien llega desde un buscador.
//   - JSON-LD con el tipo de schema.org de cada formato y SIN
//     `aggregateRating` en ninguna familia: la nota del proveedor no es
//     nuestra (marcado engañoso, VERIF-C), el plan no lo pide y en
//     `VideoGame` sin `offers` Google lo da por error. La nota de KULTURA se
//     enseña en la ficha, no se marca.
//   - `BreadcrumbList` con lo mismo que la miga de pan visible de la ficha.
// ============================================================

import type { MediaItem, MediaType } from "@/types/media";

/** Tipo de schema.org de cada formato (el anime es una serie; el manga, una serie de cómic). */
export const SCHEMA_TYPE: Record<MediaType, string> = {
  movie: "Movie",
  tv: "TVSeries",
  anime: "TVSeries",
  game: "VideoGame",
  book: "Book",
  manga: "ComicSeries",
  comic: "ComicIssue",
};

export function mediaPath(locale: string, type: MediaType, externalId: string): string {
  return `/${locale}/media/${type}/${encodeURIComponent(externalId)}`;
}

/** ¿Se puede indexar? Ni adulto ni sin portada o sinopsis. */
export function isIndexable(item: Pick<MediaItem, "poster" | "synopsis">, nsfw: boolean): boolean {
  return !nsfw && Boolean(item.poster) && Boolean(item.synopsis?.trim());
}

/** Texto para `description`: limpio y cortado en una palabra (≤ `max` caracteres). */
export function metaDescription(text: string | undefined | null, max = 155): string | undefined {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:—-]+$/, "")}…`;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
const strList = (v: unknown, max = 5): string[] =>
  Array.isArray(v) ? v.map(str).filter((s): s is string => Boolean(s)).slice(0, max) : [];

const people = (names: string[]) => names.map((name) => ({ "@type": "Person", name }));
const orgs = (names: string[]) => names.map((name) => ({ "@type": "Organization", name }));
/** Un solo elemento va suelto; varios, en lista; ninguno, fuera. */
const oneOrMany = <T,>(list: T[]): T | T[] | undefined =>
  list.length === 0 ? undefined : list.length === 1 ? list[0] : list;

export interface Crumb {
  name: string;
  /** Absoluta. El último (la propia ficha) también la lleva. */
  url: string;
}

export interface MediaJsonLdInput {
  item: MediaItem;
  genreLabels: string[];
  /** Sinopsis en el idioma de la página (si ya está traducida). */
  description?: string;
  /** URL canónica absoluta de la ficha. */
  url: string;
  locale: string;
  /** Página del título en el proveedor. */
  sameAs?: string;
  breadcrumbs: Crumb[];
}

/** Datos propios de cada formato (los que el proveedor da de verdad). */
function typeSpecific(item: MediaItem): Record<string, unknown> {
  const m = item.metadata ?? {};
  const year = item.year ? String(item.year) : undefined;
  switch (item.type) {
    case "movie":
      return {
        datePublished: year,
        director: oneOrMany(people(str(m.director) ? [str(m.director)!] : [])),
        actor: oneOrMany(people(strList(m.cast))),
        duration: num(m.runtime) ? `PT${Math.round(num(m.runtime)!)}M` : undefined,
      };
    case "tv":
      return {
        startDate: year,
        numberOfEpisodes: num(m.episodes),
        numberOfSeasons: num(m.seasons),
        actor: oneOrMany(people(strList(m.cast))),
      };
    case "anime":
      return {
        startDate: year,
        numberOfEpisodes: num(m.episodes),
        productionCompany: oneOrMany(orgs(str(m.studio) ? [str(m.studio)!] : [])),
      };
    case "game":
      return {
        datePublished: year,
        gamePlatform: oneOrMany(strList(m.platforms, 8)),
        author: oneOrMany(orgs(strList(m.developers, 3))),
        publisher: oneOrMany(orgs(strList(m.publishers, 3))),
      };
    case "book":
      return {
        datePublished: year,
        author: oneOrMany(people(strList(m.authors, 3))),
        publisher: oneOrMany(orgs(str(m.publisher) ? [str(m.publisher)!] : [])),
        numberOfPages: num(m.pageCount),
      };
    case "manga":
      return {
        startDate: year,
        author: oneOrMany(people(strList(m.authors, 3))),
      };
    case "comic":
      return { datePublished: year };
    default:
      return {};
  }
}

/** Quita claves vacías para no publicar `"director": undefined` ni listas vacías. */
function compact(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0))
  );
}

/** `@graph` con la obra y su miga de pan. */
export function buildMediaJsonLd(input: MediaJsonLdInput): Record<string, unknown> {
  const { item, url } = input;
  const work = compact({
    "@type": SCHEMA_TYPE[item.type],
    "@id": `${url}#work`,
    name: item.title,
    alternateName: item.originalTitle && item.originalTitle !== item.title ? item.originalTitle : undefined,
    url,
    image: item.poster,
    description: metaDescription(input.description ?? item.synopsis, 500),
    genre: oneOrMany(input.genreLabels.slice(0, 5)),
    sameAs: input.sameAs,
    ...typeSpecific(item),
  });
  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: input.breadcrumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };
  return { "@context": "https://schema.org", "@graph": [compact(work), breadcrumb] };
}

/** JSON para un `<script type="application/ld+json">` (sin `<` que cierre la etiqueta). */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
