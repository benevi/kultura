// ============================================================
// KULTURA — Hoja nativa de compartir con la tarjeta OG (MOV-9)
//
// `navigator.share` con la imagen `opengraph-image` de la página compartida
// (perfil público, ranking…) cuando el navegador acepta archivos
// (`navigator.canShare({ files })`, Android, iOS, Windows, ChromeOS); si no,
// el enlace solo, como antes. La imagen se pide al mostrar intención
// (puntero encima, foco) para tenerla lista al tocar: Safari exige que
// `share()` llegue poco después del gesto y una descarga larga lo agota. Al
// tocar se espera como mucho `IMAGE_BUDGET_MS`; si no ha llegado, sin imagen.
// ============================================================

export const IMAGE_BUDGET_MS = 1200;
const FETCH_TIMEOUT_MS = 4000;
const LOCALE_PREFIX = /^\/(?:es|en)(?:\/|$)/;

export type ShareOutcome = "shared" | "cancelled" | "unavailable";

/**
 * Ruta de la tarjeta OG de una página (convención `opengraph-image` de Next).
 * Las rutas sin idioma (`/u/ana`) se completan con el del documento para no
 * pasar por la redirección del middleware.
 */
export function ogImagePath(path: string, locale = "es"): string {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const withLocale = LOCALE_PREFIX.test(clean) ? clean : `/${locale}${clean === "/" ? "" : clean}`;
  return `${withLocale}/opengraph-image`;
}

const pending = new Map<string, Promise<File | null>>();

function documentLocale(): string {
  const lang = typeof document !== "undefined" ? document.documentElement.lang : "";
  return lang === "en" ? "en" : "es";
}

function canShareFiles(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.canShare === "function";
}

/** Descarga (una vez por ruta) la tarjeta como `File` compartible, o `null`. */
export function prepareShareImage(path: string): Promise<File | null> {
  if (!canShareFiles()) return Promise.resolve(null);
  const src = ogImagePath(path, documentLocale());
  const cached = pending.get(src);
  if (cached) return cached;
  const task = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(src, { signal: controller.signal, credentials: "omit" });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("image/")) return null;
      const blob = await res.blob();
      const file = new File([blob], `kultura.${type.includes("png") ? "png" : "jpg"}`, { type });
      return navigator.canShare({ files: [file] }) ? file : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  })();
  pending.set(src, task);
  // Un fallo no se queda guardado: la próxima vez se reintenta.
  task.then((file) => {
    if (!file) pending.delete(src);
  });
  return task;
}

function within<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

const isAbort = (err: unknown) => err instanceof DOMException && err.name === "AbortError";

/**
 * Abre la hoja nativa. `unavailable` = no hay hoja o el navegador la rechazó:
 * quien llama pone su alternativa (copiar el enlace, menú…).
 */
export async function shareNative({
  title,
  text,
  url,
  imagePath,
}: {
  title: string;
  text?: string;
  url: string;
  /** Página cuya tarjeta OG se adjunta (sin ella, solo el enlace). */
  imagePath?: string;
}): Promise<ShareOutcome> {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return "unavailable";
  const data: ShareData = text ? { title, text, url } : { title, url };
  const file = imagePath ? await within(prepareShareImage(imagePath), IMAGE_BUDGET_MS, null) : null;
  if (file) {
    try {
      await navigator.share({ ...data, files: [file] });
      return "shared";
    } catch (err) {
      if (isAbort(err)) return "cancelled";
      // Con archivo no ha querido (p. ej. NotAllowedError): sin él.
    }
  }
  try {
    await navigator.share(data);
    return "shared";
  } catch (err) {
    return isAbort(err) ? "cancelled" : "unavailable";
  }
}
