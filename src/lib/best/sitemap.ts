// ============================================================
// KULTURA — Sitemap por secciones (SEO-3, D-16)
//
// `src/app/sitemap.ts` publica una sección por id (`/sitemap/{id}.xml`) y
// `src/app/sitemap.xml/route.ts` el índice que las enumera. Aquí se decide
// qué entra en cada una:
//   - pages:       portada, privacidad, términos, aviso legal y accesibilidad
//                  (sin /login: es noindex desde F-01).
//   - rankings:    hubs (/best y /best/{formato}) y los rankings con al menos
//                  BEST_INDEX_MIN_ITEMS títulos (los cortos son noindex).
//   - titles:      la ficha pública de cada título de esos rankings.
//   - collections: perfiles /u con ≥ 5 títulos en listas públicas y esas
//                  listas públicas con ≥ 5 títulos (lo que se lee sin cuenta).
// `lastModified` solo cuando hay una fecha real; nunca la hora de generar el
// XML ni la del recálculo diario de un ranking (que no cambia nada si salen
// los mismos títulos):
//   - ranking: el día en que su lista de títulos cambió por última vez. Se
//     guarda la primera vez que se ve cada huella de la lista (ids en orden)
//     en la caché de datos, sin caducidad: mientras la lista no cambie, la
//     fecha se conserva. Si la caché se vacía, la fecha se adelanta (nunca
//     se inventa una anterior).
//   - hubs: la más reciente de sus rankings.
//   - fichas: sin fecha (su contenido no depende del ranking).
//   - perfiles y listas: el último título añadido.
//
// Nada lanza: un proveedor o Supabase caídos dejan su sección más corta, no
// el sitemap entero en error.
// ============================================================

import type { MetadataRoute } from "next";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site-url";
import { publicEnv } from "@/lib/env.public";
import {
  BEST_FORMATS,
  bestItemPath,
  bestYears,
  getBestSelection,
  isIndexableRanking,
  type BestFormat,
  type BestSelection,
} from "@/lib/best/best-of";

export const SITEMAP_SECTIONS = ["pages", "rankings", "titles", "collections"] as const;
export type SitemapSection = (typeof SITEMAP_SECTIONS)[number];

/** Páginas fijas públicas e indexables (sin /login, noindex). Aviso legal y accesibilidad: F-19. */
export const STATIC_PATHS = ["/", "/privacy", "/terms", "/legal", "/accessibility"] as const;

/** Títulos mínimos en listas públicas para que un perfil o una lista entren. */
export const COLLECTION_MIN_TITLES = 5;

/** Plazo para Supabase: pausado por inactividad no debe colgar el sitemap. */
const SUPABASE_TIMEOUT_MS = 5000;
/** Tope de listas públicas leídas (el sitemap admite 50.000; esto es holgura). */
export const MAX_PUBLIC_LISTS = 2000;
/** Ids por consulta `.in()`: 100 UUID ≈ 3,7 KB de URL, lejos del límite de PostgREST. */
export const IN_BATCH = 100;
/** Filas por página (PostgREST corta en 1000 por defecto). */
export const PAGE_SIZE = 1000;

type Entry = MetadataRoute.Sitemap[number];

function localePath(locale: string, path: string): string {
  return `${siteUrl()}/${locale}${path === "/" ? "" : path}`;
}

/** Una entrada por idioma, cada una con sus alternativas hreflang. */
export function localizedEntries(
  path: string,
  opts: { lastModified?: string; changeFrequency?: Entry["changeFrequency"]; priority?: number } = {},
): Entry[] {
  const languages = Object.fromEntries(routing.locales.map((l) => [l, localePath(l, path)]));
  return routing.locales.map((locale) => {
    const entry: Entry = {
      url: localePath(locale, path),
      alternates: { languages },
    };
    if (opts.lastModified) entry.lastModified = opts.lastModified;
    if (opts.changeFrequency) entry.changeFrequency = opts.changeFrequency;
    if (opts.priority !== undefined) entry.priority = opts.priority;
    return entry;
  });
}

export function pagesSitemap(): Entry[] {
  return STATIC_PATHS.flatMap((path) =>
    localizedEntries(path, {
      changeFrequency: path === "/" ? "weekly" : "yearly",
      priority: path === "/" ? 1 : 0.3,
    }),
  );
}

export interface RankingSnapshot {
  format: BestFormat;
  year: number;
  selection: BestSelection | null;
  /** Día en que cambió por última vez la lista de títulos (ISO). */
  changedAt?: string;
}

/** Huella de una lista: sus ids en orden. Cambia si entra, sale o se mueve un título. */
export function listFingerprint(items: Array<{ id: string }>): string {
  return createHash("sha256").update(items.map((i) => i.id).join("\n")).digest("hex").slice(0, 24);
}

/**
 * Primera vez que se vio esta huella de este ranking. Sin `revalidate` ni
 * etiqueta: ni el paso del tiempo ni `/api/revalidate` la mueven; una lista
 * nueva tiene huella nueva y, por tanto, fecha nueva.
 */
const firstSeen = unstable_cache(
  // Los argumentos solo forman la clave de la caché (`unstable_cache` los incluye).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (format: string, year: number, fingerprint: string) => new Date().toISOString(),
  ["best-list-first-seen-v1"],
  { revalidate: false },
);

/** Selección de cada ranking publicado; `null` si su proveedor no respondió. */
export async function loadRankings(today: Date = new Date()): Promise<RankingSnapshot[]> {
  const jobs = BEST_FORMATS.flatMap((format) => bestYears(today).map((year) => ({ format, year })));
  return Promise.all(
    jobs.map(async ({ format, year }): Promise<RankingSnapshot> => {
      const selection = await getBestSelection(format, year).catch(() => null);
      if (!selection) return { format, year, selection };
      const changedAt = await firstSeen(format, year, listFingerprint(selection.items)).catch(() => undefined);
      return { format, year, selection, changedAt };
    }),
  );
}

/** La fecha ISO más reciente (las ISO se ordenan como texto). */
const latest = (dates: Array<string | undefined>): string | undefined =>
  dates.filter((d): d is string => Boolean(d)).sort().pop();

const isIndexable = (s: RankingSnapshot) => Boolean(s.selection && isIndexableRanking(s.selection.items.length));

export function rankingsSitemap(snapshots: RankingSnapshot[]): Entry[] {
  const indexable = snapshots.filter(isIndexable);
  const hub = localizedEntries("/best", {
    lastModified: latest(indexable.map((s) => s.changedAt)),
    changeFrequency: "daily",
    priority: 0.8,
  });
  const formatHubs = BEST_FORMATS.flatMap((format) =>
    localizedEntries(`/best/${format}`, {
      lastModified: latest(indexable.filter((s) => s.format === format).map((s) => s.changedAt)),
      changeFrequency: "daily",
      priority: 0.7,
    }),
  );
  const rankings = indexable.flatMap((s) =>
    localizedEntries(`/best/${s.format}/${s.year}`, {
      lastModified: s.changedAt,
      changeFrequency: "daily",
      priority: 0.7,
    }),
  );
  return [...hub, ...formatHubs, ...rankings];
}

/** Fichas de los títulos de los rankings indexables, sin repetir y sin fecha. */
export function titlesSitemap(snapshots: RankingSnapshot[]): Entry[] {
  const paths = new Set<string>();
  for (const s of snapshots) {
    if (!isIndexable(s)) continue;
    for (const item of s.selection!.items) paths.add(bestItemPath(item));
  }
  return Array.from(paths).flatMap((path) => localizedEntries(path, { changeFrequency: "weekly", priority: 0.6 }));
}

// ── Colecciones públicas (lectura anónima: lo mismo que ve un visitante) ─────

export interface PublicListRow {
  id: string;
  owner_id: string;
  created_at: string | null;
}
export interface ListItemRow {
  list_id: string;
  added_at: string | null;
}
export interface OwnerRow {
  id: string;
  username: string;
}

export function collectionsFromRows(lists: PublicListRow[], items: ListItemRow[], owners: OwnerRow[]): Entry[] {
  const username = new Map(owners.map((o) => [o.id, o.username] as const));
  const perList = new Map<string, { count: number; last?: string }>();
  for (const row of items) {
    const cur = perList.get(row.list_id) ?? { count: 0 };
    cur.count += 1;
    cur.last = latest([cur.last, row.added_at ?? undefined]);
    perList.set(row.list_id, cur);
  }
  const perOwner = new Map<string, { count: number; last?: string }>();
  const listEntries: Entry[] = [];
  for (const list of lists) {
    const name = username.get(list.owner_id);
    const stats = perList.get(list.id);
    if (!name || !stats) continue;
    const last = latest([stats.last, list.created_at ?? undefined]);
    const owner = perOwner.get(list.owner_id) ?? { count: 0 };
    owner.count += stats.count;
    owner.last = latest([owner.last, last]);
    perOwner.set(list.owner_id, owner);
    if (stats.count >= COLLECTION_MIN_TITLES) {
      listEntries.push(
        ...localizedEntries(`/u/${encodeURIComponent(name)}/l/${list.id}`, {
          lastModified: last,
          changeFrequency: "weekly",
          priority: 0.4,
        }),
      );
    }
  }
  const profileEntries = Array.from(perOwner.entries())
    .filter(([, o]) => o.count >= COLLECTION_MIN_TITLES)
    .flatMap(([ownerId, o]) =>
      localizedEntries(`/u/${encodeURIComponent(username.get(ownerId)!)}`, {
        lastModified: o.last,
        changeFrequency: "weekly",
        priority: 0.5,
      }),
    );
  return [...profileEntries, ...listEntries];
}

function anonClient() {
  return createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS) }),
    },
  });
}

function chunk<T>(items: T[], size = IN_BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type Page<T> = { data: T[] | null; error: unknown };

/**
 * Filas de una consulta, de PAGE_SIZE en PAGE_SIZE, hasta `max` como mucho.
 * Cada rango pedido es válido (`from ≤ to`): nunca se pide más allá del tope.
 * Lanza si una página falla.
 */
export async function allPages<T>(
  query: (from: number, to: number) => PromiseLike<Page<T>>,
  max = Number.POSITIVE_INFINITY,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE, max) - 1;
    const { data, error } = await query(from, to);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < to - from + 1) break;
  }
  return out.slice(0, max);
}

/**
 * Perfiles y listas públicos. `[]` si Supabase no responde. Los `.in()` van
 * en lotes de IN_BATCH ids (una URL con 2.000 UUID no la acepta el servidor)
 * y cada lote se pagina (PostgREST devuelve como mucho 1.000 filas).
 */
export async function collectionsSitemap(): Promise<Entry[]> {
  try {
    const supabase = anonClient();
    const lists = await allPages<PublicListRow>((from, to) =>
      supabase
        .from("lists")
        .select("id, owner_id, created_at")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<Page<PublicListRow>>,
      MAX_PUBLIC_LISTS,
    );
    if (lists.length === 0) return [];
    const listIds = lists.map((l) => l.id);
    const ownerIds = Array.from(new Set(lists.map((l) => l.owner_id)));
    const [items, owners] = await Promise.all([
      Promise.all(
        chunk(listIds).map((ids) =>
          allPages<ListItemRow>((from, to) =>
            supabase
              .from("list_items")
              .select("list_id, added_at")
              .in("list_id", ids)
              .order("id", { ascending: true })
              .range(from, to) as unknown as PromiseLike<Page<ListItemRow>>,
          ),
        ),
      ).then((pages) => pages.flat()),
      Promise.all(
        chunk(ownerIds).map((ids) =>
          allPages<OwnerRow>((from, to) =>
            supabase
              .from("users")
              .select("id, username")
              .in("id", ids)
              .order("id", { ascending: true })
              .range(from, to) as unknown as PromiseLike<Page<OwnerRow>>,
          ),
        ),
      ).then((pages) => pages.flat()),
    ]);
    return collectionsFromRows(lists, items, owners);
  } catch {
    return [];
  }
}

export async function sectionSitemap(section: string): Promise<Entry[]> {
  switch (section) {
    case "pages":
      return pagesSitemap();
    case "rankings":
      return rankingsSitemap(await loadRankings());
    case "titles":
      return titlesSitemap(await loadRankings());
    case "collections":
      return collectionsSitemap();
    default:
      return [];
  }
}

/** XML del índice de sitemaps (`/sitemap.xml`). */
export function sitemapIndexXml(): string {
  const base = siteUrl();
  const body = SITEMAP_SECTIONS.map((id) => `<sitemap><loc>${base}/sitemap/${id}.xml</loc></sitemap>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>\n`;
}
