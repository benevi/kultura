// Prototipo fase 8.3 — carga la ficha con el MISMO cargador que la página real
// (`loadMediaDetail`: obra, géneros, tráiler, proveedores, Steam y fuente) y la
// deja lista para pintar. Sin sesión y sin nada del usuario.

import * as React from "react";
import { getTranslations } from "next-intl/server";
import { loadMediaDetail } from "@/lib/media/detail-data";
import { synopsisLang } from "@/lib/media/synopsis-lang";
import type { MediaItem } from "@/types/media";
import { wideArt } from "./art";
import { coverSource } from "./cover";
import { labelsFor, type Labels } from "./labels";
import type { Fact, FichaData, Rating } from "./types";
import { WORKS } from "./works";

const dedupe: <T extends (...args: never[]) => unknown>(fn: T) => T =
  (React as unknown as { cache?: <T>(fn: T) => T }).cache ?? ((fn) => fn);

/** `lang` de un texto por su escritura: hangul → ko, kana → ja, solo han → ja (anime/manga) o zh. */
export function scriptLang(text: string, type: MediaItem["type"]): string | undefined {
  if (/[가-힯ᄀ-ᇿ]/.test(text)) return "ko";
  if (/[぀-ヿ]/.test(text)) return "ja";
  if (/[一-鿿]/.test(text)) return type === "anime" || type === "manga" ? "ja" : "zh";
  if (/[Ѐ-ӿ]/.test(text)) return "ru";
  return undefined;
}

/**
 * `lang` del título principal, solo cuando los datos lo dicen (no se adivina):
 *  · por su escritura (hangul, kana, han, cirílico);
 *  · TMDB (película, serie): si no hay traducción al idioma pedido devuelve el
 *    título original, y `original_language` dice en qué idioma está;
 *  · AniList (`al-…`): el título es su campo `english` cuando hay una
 *    romanización distinta guardada como «original».
 * Open Library, Google Books, MangaDex (su `en` suele ser una romanización),
 * RAWG y ComicVine no dicen el idioma del título: se queda sin `lang`.
 */
export function titleLang(item: MediaItem, locale: string): string | undefined {
  const title = item.title.trim();
  const byScript = scriptLang(title, item.type);
  if (byScript) return byScript;
  const page = locale.slice(0, 2).toLowerCase();
  let lang: string | undefined;
  if (item.type === "movie" || item.type === "tv") {
    const ol = item.metadata?.originalLanguage;
    // Sin `originalTitle`, el normalizador vio título y título original iguales.
    if (typeof ol === "string" && /^[a-z]{2}$/.test(ol) && ol !== "xx" && !item.originalTitle) lang = ol === "cn" ? "zh" : ol;
  } else if (/^al-[0-9]+$/.test(item.externalId)) {
    const native = item.metadata?.nativeTitle;
    if (item.originalTitle && item.originalTitle.trim() !== title && native !== item.title) lang = "en";
  }
  return lang && lang !== page ? lang : undefined;
}

function facts(item: MediaItem, typeLabel: string, l: Labels): Fact[] {
  const out: Fact[] = [];
  const m = item.metadata ?? {};
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  if (item.year) out.push({ key: "year", label: l.year, value: String(item.year) });
  out.push({ key: "format", label: l.format, value: typeLabel });
  if (item.type === "movie" && n(m.runtime)) out.push({ key: "duration", label: l.duration, value: `${n(m.runtime)} ${l.minutes}` });
  if ((item.type === "tv" || item.type === "anime") && n(m.episodes)) out.push({ key: "episodes", label: l.episodes, value: String(n(m.episodes)) });
  if (item.type === "manga" && n(m.chapters)) out.push({ key: "chapters", label: l.chapters, value: String(n(m.chapters)) });
  if (item.type === "book" && n(m.pageCount)) out.push({ key: "pages", label: l.pages, value: String(n(m.pageCount)) });
  return out;
}

/** Misma selección que `getCredits` de `MediaDetail`: solo lo que el proveedor da. */
function credits(item: MediaItem, l: Labels): Fact[] {
  const m = item.metadata ?? {};
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const list = (v: unknown, max: number) =>
    Array.isArray(v) ? v.map(text).filter((s): s is string => Boolean(s)).slice(0, max).join(", ") || null : null;
  const count = (v: unknown) => (typeof v === "number" && v > 0 ? String(v) : null);
  const byType: Record<MediaItem["type"], [keyof Labels, string | null][]> = {
    movie: [["director", text(m.director)], ["cast", list(m.cast, 5)]],
    tv: [["seasons", count(m.seasons)], ["cast", list(m.cast, 5)]],
    anime: [["studio", text(m.studio)]],
    manga: [["authors", list(m.authors, 3)]],
    book: [["authors", list(m.authors, 3)], ["publisher", text(m.publisher)]],
    game: [["developers", list(m.developers, 3)], ["platforms", list(m.platforms, 8)]],
    comic: [],
  };
  return (byType[item.type] ?? [])
    .filter((e): e is [keyof Labels, string] => Boolean(e[1]))
    .map(([key, value]) => ({ key, label: l[key] as string, value }));
}

export const loadProtoFicha = dedupe(async (type: string, id: string, locale: string): Promise<FichaData | null> => {
  const data = await loadMediaDetail(type, id, locale);
  if (!data) return null;
  const { item } = data;
  const tMedia = await getTranslations({ locale, namespace: "media" });
  const typeLabel = tMedia(item.type as Parameters<typeof tMedia>[0]);
  const l = labelsFor(locale);
  const decimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const ratings: Rating[] = [];
  if (item.rating !== undefined && item.ratingSource) {
    ratings.push({ key: "provider", label: item.ratingSource, value: `${decimal.format(item.rating)}/10` });
  }
  if (data.steam?.metacritic) ratings.push({ key: "metacritic", label: "Metacritic", value: `${data.steam.metacritic}/100` });
  // AniList guarda el título en su escritura en `metadata.nativeTitle` (el «original» es el romaji).
  const native = item.metadata?.nativeTitle;
  const original = (typeof native === "string" && native.trim() ? native : item.originalTitle)?.trim();
  // APAÑO DE PROTOTIPO: las cinco obras fijas llevan su título en el idioma de
  // la página escrito a mano (`works.ts`); el del proveedor pasa a «original».
  const fixed = WORKS.find((w) => w.type === item.type && w.id === id);
  const title = fixed ? fixed.titles[locale === "en" ? "en" : "es"] : item.title;
  const orig = fixed
    ? original && scriptLang(original, item.type)
      ? { text: original, lang: scriptLang(original, item.type) }
      : fixed.original
    : original
      ? { text: original, lang: scriptLang(original, item.type) }
      : undefined;
  const originalTitle = orig && orig.text !== title.trim() ? orig.text : undefined;
  return {
    locale,
    item,
    type: item.type,
    typeLabel,
    title,
    titleLang: fixed ? undefined : titleLang(item, locale),
    originalTitle,
    originalTitleLang: originalTitle ? orig?.lang : undefined,
    year: item.year,
    genres: (data.genreLabels.length ? data.genreLabels : item.genres ?? []).slice(0, 6),
    facts: facts(item, typeLabel, l),
    credits: credits(item, l),
    ratings,
    synopsis: item.synopsis?.trim() || undefined,
    synopsisLang: synopsisLang(item.synopsis, locale),
    cover: coverSource(item.poster, item.type),
    art: await wideArt(item),
    trailerKey: data.trailerKey,
    providers: data.providers,
    watchLink: data.watchLink,
    steam: data.steam,
    source: data.source,
    labels: l,
  };
});
