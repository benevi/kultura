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
// `lastModified` solo cuando hay una fecha real (la de la selección o la del
// último título añadido); nunca la hora de generar el XML.
//
// Nada lanza: un proveedor o Supabase caídos dejan su sección más corta, no
// el sitemap entero en error.
// ============================================================

import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site-url";
import { publicEnv } from "@/lib/env";
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
const MAX_PUBLIC_LISTS = 2000;

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
}

/** Selección de cada ranking publicado; `null` si su proveedor no respondió. */
export async function loadRankings(today: Date = new Date()): Promise<RankingSnapshot[]> {
  const jobs = BEST_FORMATS.flatMap((format) => bestYears(today).map((year) => ({ format, year })));
  return Promise.all(
    jobs.map(async ({ format, year }) => ({
      format,
      year,
      selection: await getBestSelection(format, year).catch(() => null),
    })),
  );
}

/** La fecha ISO más reciente (las ISO se ordenan como texto). */
const latest = (dates: Array<string | undefined>): string | undefined =>
  dates.filter((d): d is string => Boolean(d)).sort().pop();

export function rankingsSitemap(snapshots: RankingSnapshot[]): Entry[] {
  const indexable = snapshots.filter((s) => s.selection && isIndexableRanking(s.selection.items.length));
  const hub = localizedEntries("/best", {
    lastModified: latest(indexable.map((s) => s.selection?.updatedAt)),
    changeFrequency: "daily",
    priority: 0.8,
  });
  const formatHubs = BEST_FORMATS.flatMap((format) =>
    localizedEntries(`/best/${format}`, {
      lastModified: latest(indexable.filter((s) => s.format === format).map((s) => s.selection?.updatedAt)),
      changeFrequency: "daily",
      priority: 0.7,
    }),
  );
  const rankings = indexable.flatMap((s) =>
    localizedEntries(`/best/${s.format}/${s.year}`, {
      lastModified: s.selection!.updatedAt,
      changeFrequency: "daily",
      priority: 0.7,
    }),
  );
  return [...hub, ...formatHubs, ...rankings];
}

/** Fichas de los títulos de los rankings indexables, sin repetir. */
export function titlesSitemap(snapshots: RankingSnapshot[]): Entry[] {
  const seen = new Map<string, string | undefined>();
  for (const s of snapshots) {
    if (!s.selection || !isIndexableRanking(s.selection.items.length)) continue;
    for (const item of s.selection.items) {
      const path = bestItemPath(item);
      seen.set(path, latest([seen.get(path), s.selection.updatedAt]));
    }
  }
  return Array.from(seen.entries()).flatMap(([path, lastModified]) =>
    localizedEntries(path, { lastModified, changeFrequency: "weekly", priority: 0.6 }),
  );
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

/** Perfiles y listas públicos. `[]` si Supabase no responde. */
export async function collectionsSitemap(): Promise<Entry[]> {
  try {
    const supabase = anonClient();
    const { data: lists, error } = await supabase
      .from("lists")
      .select("id, owner_id, created_at")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(MAX_PUBLIC_LISTS);
    if (error || !lists?.length) return [];
    const listIds = (lists as PublicListRow[]).map((l) => l.id);
    const ownerIds = Array.from(new Set((lists as PublicListRow[]).map((l) => l.owner_id)));
    const [itemsRes, ownersRes] = await Promise.all([
      supabase.from("list_items").select("list_id, added_at").in("list_id", listIds),
      supabase.from("users").select("id, username").in("id", ownerIds),
    ]);
    if (itemsRes.error || ownersRes.error) return [];
    return collectionsFromRows(
      lists as PublicListRow[],
      (itemsRes.data ?? []) as ListItemRow[],
      (ownersRes.data ?? []) as OwnerRow[],
    );
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
