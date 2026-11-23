// ============================================================
// KULTURA — El título original de una obra, con su idioma (biblia §3)
// ------------------------------------------------------------
// Para el rótulo de «Sala»: «Parásitos» / 기생충, marcado con `lang` para que
// el lector de pantalla lo pronuncie bien y salga con su fuente (Noto Sans
// KR / JP). Lo que da cada proveedor:
//   - TMDB: `originalTitle` (en su escritura) y su idioma (`originalLanguage`;
//     en películas desde F4).
//   - AniList: el nativo (`metadata.nativeTitle`, japonés casi siempre); si
//     no lo hay, el romaji (`ja-Latn`).
// Sin idioma seguro devuelve `lang: null`: se enseña, pero sin marcar.
// `originalTitleFact` es el de la franja de datos (F4): el original tal como
// lo da el proveedor (el romaji en AniList), con el nombre de su idioma.
// ============================================================

import type { MediaItem } from "@/types/media";

export interface OriginalTitle {
  text: string;
  lang: string | null;
}

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
const KANA = /[぀-ヿㇰ-ㇿ]/;
const HAN = /[㐀-䶿一-鿿]/;
const LANG = /^[a-z]{2,3}$/;
/** Códigos de TMDB que no son BCP 47: `cn` es su cantonés; `xx` y `zxx`, sin idioma. */
const TMDB_LANG: Record<string, string | null> = { cn: "yue", xx: null, zxx: null };

function bcp47(code: string | undefined): string | null {
  if (!code || !LANG.test(code)) return null;
  return code in TMDB_LANG ? TMDB_LANG[code] : code;
}

/** Idioma por la escritura, solo donde no hay duda (hangul → coreano, kana → japonés). */
export function scriptLang(text: string): string | null {
  if (HANGUL.test(text)) return "ko";
  if (KANA.test(text)) return "ja";
  return null;
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function originalTitleOf(item: MediaItem): OriginalTitle | null {
  const m = item.metadata ?? {};
  const japaneseSource = item.type === "anime" || item.type === "manga";

  const native = text(m.nativeTitle);
  if (native && native !== item.title) {
    // AniList: sin hangul ni kana, un título solo con kanji sigue siendo japonés.
    return { text: native, lang: scriptLang(native) ?? (HAN.test(native) ? "ja" : null) };
  }

  const original = text(item.originalTitle);
  if (!original || original === item.title) return null;
  return { text: original, lang: originalLang(item, original, japaneseSource) };
}

function originalLang(item: MediaItem, original: string, japaneseSource: boolean): string | null {
  const declared = bcp47(text(item.metadata?.originalLanguage)?.toLowerCase());
  if (declared) return declared;
  const byScript = scriptLang(original);
  if (byScript) return byScript;
  // El romaji de AniList y MangaDex: japonés en letra latina.
  if (japaneseSource && !HAN.test(original)) return "ja-Latn";
  return null;
}

/**
 * El título original para la franja de datos (F4): el que da el proveedor
 * (`originalTitle`: el de TMDB, el romaji de AniList) o, sin él, el nativo.
 * Solo si no es el título que se ve.
 */
export function originalTitleFact(item: MediaItem): OriginalTitle | null {
  const original = text(item.originalTitle);
  if (original && original !== item.title) {
    return { text: original, lang: originalLang(item, original, item.type === "anime" || item.type === "manga") };
  }
  return originalTitleOf(item);
}

/** El nombre de un idioma en el de la página («japonés»), o `null` si no se sabe. */
export function languageName(lang: string | null, locale: string): string | null {
  if (!lang) return null;
  const code = lang.split("-")[0];
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(code);
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
}
