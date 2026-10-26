// ============================================================
// KULTURA — Hoja nativa de compartir con la tarjeta OG (MOV-9)
//
// `navigator.share` con la imagen `opengraph-image` de la página compartida
// (perfil público, ranking…) cuando el navegador acepta archivos
// (`navigator.canShare({ files })`, Android, iOS, Windows, ChromeOS); si no,
// el enlace solo, como antes.
//
// Safari exige que `share()` llegue enseguida tras el gesto: cualquier
// `await` de red entre el toque y `share()` lo agota (NotAllowedError). Por
// eso la imagen se adjunta SOLO si ya está descargada: se precarga antes del
// gesto (`preloadShareImage` al montar el botón, en un momento libre, y
// `prepareShareImage` al apuntar o enfocar). Si al tocar aún no ha llegado,
// se comparte el enlace solo y sin esperar.
// ============================================================

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
/** Tarjetas ya descargadas, listas para adjuntar sin esperar. */
const ready = new Map<string, File>();

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
  task.then((file) => {
    if (file) ready.set(src, file);
    // Un fallo no se queda guardado: la próxima vez se reintenta.
    else pending.delete(src);
  });
  return task;
}

/** La tarjeta de `path` si YA está descargada (sin esperar a nada). */
export function readyShareImage(path: string): File | null {
  return ready.get(ogImagePath(path, documentLocale())) ?? null;
}

/**
 * Precarga la tarjeta antes de cualquier gesto, cuando el navegador está
 * libre. Nada en navegadores sin archivos en la hoja ni con ahorro de datos.
 * Devuelve la función para cancelarla (al desmontar el botón).
 */
export function preloadShareImage(path: string): () => void {
  if (!canShareFiles() || typeof window === "undefined") return () => undefined;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return () => undefined;
  const run = () => void prepareShareImage(path);
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
    .requestIdleCallback;
  if (idle) {
    const id = idle(run, { timeout: 4000 });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(run, 1500);
  return () => window.clearTimeout(id);
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
  // Sin `await` antes de `share()`: solo vale la imagen ya descargada.
  const file = imagePath ? readyShareImage(imagePath) : null;
  if (imagePath && !file) void prepareShareImage(imagePath); // para la próxima vez
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
