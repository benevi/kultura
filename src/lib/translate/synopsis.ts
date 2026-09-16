// ============================================================
// KULTURA — Traducción de sinopsis al idioma activo (E-SINOPSIS-I18N)
//
// El problema: AniList (anime), RAWG (videojuegos) y ComicVine (cómics) solo
// publican texto en inglés, y MangaDex/Google Books caen a inglés cuando un
// título no tiene versión traducida. Resultado: con la app en español, media
// ficha salía en inglés.
//
// Por qué NO se usa la traducción del navegador (Translator API de Chrome):
//   - Solo existe en Chromium 138+; Firefox y Safari se quedarían igual.
//   - Exige descargar un modelo local tras un gesto del usuario, así que la
//     primera ficha se vería en inglés de todas formas.
//   - Traduce en el cliente, luego el resultado no se puede cachear ni
//     compartir: cada visita de cada usuario lo repetiría.
//   - El autotraductor de página completa pasaría también por la UI, que ya
//     está traducida con next-intl → textos traducidos dos veces.
//
// Y por qué el coste no es el problema que parece: se traduce UNA VEZ POR
// TÍTULO y el resultado se guarda en `media_translations`, compartido por
// todos los usuarios. Una sinopsis son ~300 tokens de entrada y ~350 de
// salida con Haiku; el catálogo completo que la app llega a enseñar cuesta
// unos pocos euros EN TOTAL, no por visita. Encima, la mayoría de textos ni
// llegan al modelo: `needsTranslation` descarta gratis los que ya están en el
// idioma pedido (todo TMDB en español, por ejemplo).
//
// Tres capas de caché, de la más barata a la más cara:
//   1. Detección de idioma  → coste 0, evita la llamada entera.
//   2. Memoria del proceso  → coste 0, sirve las visitas seguidas.
//   3. Tabla Supabase       → una lectura indexada, compartida y permanente.
//   4. Claude Haiku         → solo lo que no cayó en ninguna de las anteriores.
//
// Degradación: sin clave, con la tabla sin migrar o con el modelo caído se
// devuelve el texto ORIGINAL. Una sinopsis en inglés es peor que en español,
// pero infinitamente mejor que una ficha rota.
//
// Server-only: importa `env` (ANTHROPIC_API_KEY) y la service-role key.
// ============================================================

import { createHash } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApiLocale, type ApiLocale } from "@/lib/api/locale";
import { needsTranslation } from "@/lib/translate/language";
import { createLogger } from "@/lib/logger";

const log = createLogger("translate/synopsis");

/**
 * Modelo: Haiku. La traducción es una tarea mecánica y acotada — no hay
 * criterio que un modelo mayor pueda aportar aquí — y es justo la decisión que
 * mantiene el coste de esta función en el terreno de "céntimos por título".
 */
const MODEL = "claude-haiku-4-5";

/** Textos más cortos que esto no son una sinopsis (un "N/A", una coletilla). */
const MIN_SOURCE_CHARS = 24;

/**
 * Tope de longitud. Por encima, el texto no es una sinopsis sino una ficha
 * técnica volcada (RAWG a veces devuelve la página entera) y no compensa.
 */
const MAX_SOURCE_CHARS = 8000;

/** Campo dentro de la ficha. Hoy solo sinopsis; la tabla admite más. */
const FIELD = "synopsis";

/**
 * Caché en memoria del proceso. Es un extra sobre la tabla, no un sustituto:
 * en serverless cada instancia arranca vacía, así que lo que de verdad evita
 * pagar dos veces es Supabase.
 */
const memoryCache = new Map<string, string>();
const MEMORY_CACHE_MAX = 500;

function rememberInMemory(key: string, value: string) {
  // Descarte FIFO simple: la entrada más vieja sale cuando se llena. No hace
  // falta LRU — perder una entrada solo cuesta una lectura a Supabase.
  if (memoryCache.size >= MEMORY_CACHE_MAX) {
    const oldest = memoryCache.keys().next().value;
    if (oldest !== undefined) memoryCache.delete(oldest);
  }
  memoryCache.set(key, value);
}

function hashSource(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

function buildCacheKey(mediaId: string, locale: ApiLocale, sourceHash: string) {
  return `${mediaId}|${FIELD}|${locale}|${sourceHash}`;
}

const LANGUAGE_NAME: Record<ApiLocale, string> = {
  es: "español de España",
  en: "English",
};

/**
 * Lee la caché persistente. Nunca lanza: si la tabla aún no existe (migración
 * sin aplicar) se comporta como un fallo de caché.
 */
async function readCache(cacheKey: string): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("media_translations")
      .select("content")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (error) return null;
    return (data?.content as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Escribe la caché persistente. Un fallo aquí solo cuesta traducir otra vez. */
async function writeCache(params: {
  cacheKey: string;
  mediaId: string;
  locale: ApiLocale;
  sourceHash: string;
  content: string;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("media_translations").upsert(
      {
        cache_key: params.cacheKey,
        media_id: params.mediaId,
        field: FIELD,
        locale: params.locale,
        source_hash: params.sourceHash,
        content: params.content,
      },
      { onConflict: "cache_key" }
    );
  } catch (err) {
    log.warn("No se pudo guardar la traducción en caché", { err: String(err) });
  }
}

/** Llama al modelo. Devuelve null ante cualquier problema (sin clave incluido). */
async function callModel(text: string, target: ApiLocale): Promise<string | null> {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });
    // Streaming: una sinopsis larga puede acercarse al tope de salida y la
    // petición sin stream es la que se queda colgada en ese caso.
    const message = await client.messages
      .stream({
        model: MODEL,
        // El español ocupa ~20% más que el inglés; se deja margen sobre esa
        // estimación y se acota para que un texto enorme no dispare el coste.
        max_tokens: Math.min(4096, Math.max(512, Math.ceil(text.length / 2))),
        system:
          `Eres un traductor profesional de sinopsis culturales (cine, series, ` +
          `anime, manga, libros, cómics y videojuegos). Traduce el texto del ` +
          `usuario a ${LANGUAGE_NAME[target]}.\n` +
          `Reglas estrictas:\n` +
          `- Devuelve ÚNICAMENTE la traducción, sin preámbulos, comillas ni notas.\n` +
          `- Conserva los saltos de párrafo del original.\n` +
          `- No resumas, no amplíes, no censures: misma información.\n` +
          `- Deja en su forma original los nombres propios de personajes, ` +
          `lugares y obras, salvo que exista un título oficial consolidado en ` +
          `el idioma destino.\n` +
          `- Si el texto ya está en ${LANGUAGE_NAME[target]}, devuélvelo tal cual.`,
        messages: [{ role: "user", content: text }],
      })
      .finalMessage();

    const out = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return out.length > 0 ? out : null;
  } catch (err) {
    log.warn("Traducción fallida, se sirve el texto original", {
      err: String(err),
    });
    return null;
  }
}

export interface TranslateSynopsisOptions {
  /** Texto tal cual lo sirve el proveedor. */
  text: string | null | undefined;
  /** Locale activo de la app (`es` | `en`, o cualquier variante regional). */
  locale?: string | null;
  /** Id prefijado del ítem (`anime_al-1535`) — identifica la entrada en caché. */
  mediaId: string;
  /**
   * `true` = no llamar al modelo, solo mirar la caché. Se usa donde la
   * latencia importa más que el idioma (metadatos OG/SEO): si otro visitante
   * ya pagó la traducción se aprovecha, y si no, se sirve el original.
   */
  cacheOnly?: boolean;
}

/**
 * Devuelve la sinopsis en el idioma activo.
 *
 * Contrato: NUNCA lanza y NUNCA devuelve vacío si la entrada no lo estaba —
 * ante cualquier fallo se sirve el texto original.
 */
export async function translateSynopsis({
  text,
  locale,
  mediaId,
  cacheOnly = false,
}: TranslateSynopsisOptions): Promise<string> {
  const source = text?.trim() ?? "";
  if (source.length === 0) return "";

  const target = resolveApiLocale(locale);

  // Capa 1 — gratis: el proveedor ya lo sirvió en el idioma pedido.
  if (!needsTranslation(source, target)) return source;

  // Fuera de rango: ni merece la pena ni es una sinopsis de verdad.
  if (source.length < MIN_SOURCE_CHARS || source.length > MAX_SOURCE_CHARS) {
    return source;
  }

  const sourceHash = hashSource(source);
  const cacheKey = buildCacheKey(mediaId, target, sourceHash);

  // Capa 2 — memoria del proceso.
  const inMemory = memoryCache.get(cacheKey);
  if (inMemory) return inMemory;

  // Capa 3 — caché compartida entre usuarios y despliegues.
  const cached = await readCache(cacheKey);
  if (cached) {
    rememberInMemory(cacheKey, cached);
    return cached;
  }

  if (cacheOnly) return source;

  // Capa 4 — el modelo. Único punto que cuesta dinero, y solo la primera vez
  // que alguien abre este título en este idioma.
  const translated = await callModel(source, target);
  if (!translated) return source;

  rememberInMemory(cacheKey, translated);
  // Sin await: la traducción ya está lista para este usuario; guardarla es
  // para los siguientes y no debe retrasar la respuesta.
  void writeCache({ cacheKey, mediaId, locale: target, sourceHash, content: translated });

  return translated;
}
