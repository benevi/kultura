// ============================================================
// KULTURA — Capa HTTP única para los proveedores de catálogo (COD-1, COD-2)
//
// Antes cada cliente (`tmdb.ts`, `rawg.ts`, `anilist.ts`…) tenía su propio
// `fetch → if (!ok) throw → res.json() as T`. Consecuencias que se vieron en
// producción:
//   - Sin plazo máximo: un proveedor colgado mantenía la función ocupada hasta
//     que Vercel la cortaba.
//   - Sin validar la respuesta: si el proveedor cambiaba la forma (RAWG dejó de
//     mandar `metacritic` en los listados), la respuesta "válida" se guardaba
//     una hora y nadie se enteraba.
//   - Sin memoria de fallos: con AniList devolviendo 403 durante días, cada
//     petición de anime lo volvía a intentar antes de ir al respaldo.
//
// `providerFetch` concentra todo eso en un sitio:
//   1. Plazo de 6 s por intento (8 s como máximo, Open Library) y 8 s en total
//      por llamada contando el reintento (`AbortController` + carrera con un
//      temporizador: aunque el proveedor ignore la señal, la petición termina).
//   2. Reintento SOLO ante 5xx, solo si el cliente lo pide (`retries`) y solo
//      si queda presupuesto.
//   3. Contrato con Zod (`schema`, siempre permisivo: `looseObject` y casi todo
//      opcional). Modo `PROVIDER_CONTRACT_MODE`:
//        - `log` (por defecto): si la respuesta no cumple, se avisa (log +
//          Sentry con la etiqueta `provider`) y se sirve igual. Es el modo de
//          la primera semana: un esquema demasiado estricto no puede tumbar
//          producción, solo avisar.
//        - `enforce`: lanza `ProviderContractError` y la respuesta NO se
//          guarda en caché.
//   4. Errores dentro del cuerpo (`checkBody`): ComicVine responde
//      `status_code` ≠ 1 y AniList `errors[]` aun con HTTP 200. Se lanzan y,
//      como cualquier error, no se cachean.
//   5. Circuit breaker por proveedor: 5 fallos en 5 min lo abren 10 min. Con
//      el circuito abierto la petición falla al instante (sin llamar al
//      proveedor) y el que llama salta a su respaldo (anime → TMDB). Al abrirse
//      se avisa a Sentry con la etiqueta `provider`.
//   6. Caché: `unstable_cache` alrededor de TODO lo anterior, de modo que solo
//      se guarda lo que ha pasado las comprobaciones (`unstable_cache` no
//      guarda rechazos). Fuera de Next (tests, scripts de contrato) no hay
//      caché incremental y se llama directamente.
//   7. User-Agent único con la URL real del proyecto y, si existe,
//      `PROVIDER_CONTACT` (D-18). Nunca un dominio ajeno.
//
// El estado del breaker vive en memoria de cada instancia. En Vercel una
// instancia caliente atiende muchas peticiones seguidas, que es justo el caso
// que importa (una ráfaga contra un proveedor caído); un estado compartido
// entre instancias necesitaría Redis y se puede añadir sin cambiar la API.
// ============================================================

import { unstable_cache } from "next/cache";
import type { ZodType } from "zod";
import { createLogger } from "@/lib/logger";
import { PROVIDER_REVALIDATE_SECONDS } from "@/lib/api/fetch-cache";

const log = createLogger("providers");

// ── Proveedores ───────────────────────────────────────────────────────────────

export const PROVIDER_IDS = [
  "tmdb",
  "rawg",
  "anilist",
  "jikan",
  "comicvine",
  "mangadex",
  "openlibrary",
  "googlebooks",
  "steam",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

// ── Parámetros ────────────────────────────────────────────────────────────────

/** Plazo por defecto de cada intento. */
export const PROVIDER_TIMEOUT_MS = 6000;

/**
 * Plazo máximo que un cliente puede pedir para un intento (Open Library usa
 * 8 s: su búsqueda de catálogo es la más pesada y con 6 s sus picos lentos
 * abrirían el circuito sin estar caído).
 */
export const PROVIDER_MAX_TIMEOUT_MS = 8000;

/**
 * Presupuesto TOTAL de una llamada, reintento y espera incluidos. Sin él, un
 * cliente con reintento (AniList, Jikan) podía tardar 6 s + 0,4 s + 6 s. Con
 * él: el segundo intento solo usa lo que quede, y si queda menos de
 * `MIN_RETRY_BUDGET_MS` no se reintenta (un intento de medio segundo solo
 * gastaría cupo).
 */
export const PROVIDER_TOTAL_BUDGET_MS = 8000;
const MIN_RETRY_BUDGET_MS = 1000;

/** Fallos dentro de la ventana que abren el circuito. */
export const CIRCUIT_FAILURE_THRESHOLD = 5;
/** Ventana en la que se cuentan los fallos. */
export const CIRCUIT_WINDOW_MS = 5 * 60_000;
/** Tiempo que el circuito se queda abierto antes de dejar pasar una prueba. */
export const CIRCUIT_OPEN_MS = 10 * 60_000;

/** 5xx que merece la pena reintentar: fallos del servidor del proveedor. */
const DEFAULT_RETRY_ON: ReadonlySet<number> = new Set([500, 502, 503, 504]);
const DEFAULT_RETRY_DELAY_MS = 400;

/** Un aviso de contrato en modo `log` como mucho cada 10 min por endpoint. */
const CONTRACT_REPORT_INTERVAL_MS = 10 * 60_000;

/** URL pública por defecto (la de producción) para el User-Agent. */
const DEFAULT_SITE_URL = "https://kulturaapp.vercel.app";

// ── Errores ───────────────────────────────────────────────────────────────────

export type ProviderErrorKind =
  | "http"
  | "network"
  | "timeout"
  | "contract"
  | "upstream"
  | "circuit_open";

/**
 * Fallo de un proveedor con el `status` accesible (mismo patrón que
 * `JikanError`/`AniListError`): quien lo captura distingue cuota (429), caída
 * (5xx) o contrato roto sin leer el mensaje con una regex.
 */
export class ProviderError extends Error {
  readonly provider: ProviderId;
  readonly kind: ProviderErrorKind;
  readonly status?: number;

  constructor(
    provider: ProviderId,
    kind: ProviderErrorKind,
    message: string,
    options: { status?: number; cause?: unknown } = {}
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "ProviderError";
    this.provider = provider;
    this.kind = kind;
    this.status = options.status;
  }
}

/** La respuesta no cumple el contrato mínimo (solo se lanza en modo `enforce`). */
export class ProviderContractError extends ProviderError {
  readonly issues: string[];

  constructor(provider: ProviderId, label: string, issues: string[]) {
    super(
      provider,
      "contract",
      `${provider} ${label} → contrato roto: ${issues.slice(0, 3).join("; ")}`
    );
    this.name = "ProviderContractError";
    this.issues = issues;
  }
}

/** Circuito abierto: no se ha llamado al proveedor. El que llama usa su respaldo. */
export class ProviderUnavailableError extends ProviderError {
  readonly retryAt: number;

  constructor(provider: ProviderId, retryAt: number) {
    super(provider, "circuit_open", `${provider} → circuito abierto`, { status: 503 });
    this.name = "ProviderUnavailableError";
    this.retryAt = retryAt;
  }
}

// ── Configuración en tiempo de ejecución ──────────────────────────────────────

export type ProviderContractMode = "log" | "enforce";

/** `enforce` solo si se pide explícitamente; cualquier otro valor es `log`. */
export function providerContractMode(): ProviderContractMode {
  return process.env.PROVIDER_CONTRACT_MODE?.trim().toLowerCase() === "enforce"
    ? "enforce"
    : "log";
}

/** Deja solo caracteres imprimibles válidos en una cabecera (y sin paréntesis). */
function headerSafe(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, "").replace(/[()]/g, "").trim();
}

/**
 * User-Agent único para todos los proveedores (D-18 / ROJO-11). Lleva la URL
 * real del proyecto y, si está configurado, el contacto de `PROVIDER_CONTACT`,
 * para que un proveedor que vea abuso escriba a quien corresponde.
 */
export function providerUserAgent(): string {
  const rawSite = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
  const site = headerSafe(rawSite).replace(/\/+$/, "") || DEFAULT_SITE_URL;
  const contact = headerSafe(process.env.PROVIDER_CONTACT ?? "");
  return `KULTURA/1.0 (+${site}${contact ? `; ${contact}` : ""})`;
}

// ── Avisos (log + Sentry con etiqueta `provider`) ─────────────────────────────

function reportIncident(
  provider: ProviderId,
  kind: string,
  message: string,
  extra?: Record<string, unknown>
): void {
  // En el MENSAJE y no solo en el contexto: el visor de logs de Vercel colapsa
  // `context:{…}` (ver `api/health`).
  log.warn(message, { provider, kind, ...extra });
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.captureMessage(message, {
        level: "warning",
        tags: { provider, provider_incident: kind },
        extra,
      });
    })
    .catch(() => {
      // Sentry no disponible: el aviso ya está en el log.
    });
}

const lastContractReport = new Map<string, number>();

function reportContractViolation(
  provider: ProviderId,
  label: string,
  issues: string[],
  mode: ProviderContractMode
): void {
  const key = `${provider} ${label}`;
  const now = Date.now();
  const last = lastContractReport.get(key);
  if (last !== undefined && now - last < CONTRACT_REPORT_INTERVAL_MS) return;
  lastContractReport.set(key, now);
  reportIncident(
    provider,
    "contract",
    `proveedor ${provider} ${label}: la respuesta no cumple el contrato (modo ${mode}) · ${issues
      .slice(0, 3)
      .join("; ")}`,
    { label, issues: issues.slice(0, 10), mode }
  );
}

// ── Circuit breaker ───────────────────────────────────────────────────────────

type CircuitStateName = "closed" | "open" | "half-open";

interface CircuitState {
  failures: number[];
  openUntil: number;
  /** Tras abrirse y vencer el plazo, la siguiente petición es una prueba. */
  halfOpen: boolean;
  probeInFlight: boolean;
}

const circuits = new Map<ProviderId, CircuitState>();

function circuitFor(provider: ProviderId): CircuitState {
  let state = circuits.get(provider);
  if (!state) {
    state = { failures: [], openUntil: 0, halfOpen: false, probeInFlight: false };
    circuits.set(provider, state);
  }
  return state;
}

/** Estado del circuito de un proveedor (para `/api/health?deep=1`). */
export function providerCircuitState(provider: ProviderId): CircuitStateName {
  const state = circuits.get(provider);
  if (!state) return "closed";
  if (state.openUntil > Date.now()) return "open";
  return state.halfOpen ? "half-open" : "closed";
}

/** Vacía el estado de los circuitos y de los avisos. Pensado para los tests. */
export function resetProviderCircuits(): void {
  circuits.clear();
  lastContractReport.clear();
}

/**
 * ¿Este error dice algo de la SALUD del proveedor? Un 404 o un 400 son
 * respuestas normales (título inexistente, consulta mal formada) y no deben
 * abrir el circuito; una caída, un plazo agotado, una cuota o un bloqueo sí.
 */
export function isProviderHealthFailure(e: unknown): boolean {
  if (e instanceof ProviderUnavailableError) return false;
  if (e instanceof ProviderError && e.kind !== "http" && e.kind !== "upstream") {
    return true; // network, timeout, contract
  }
  const status = (e as { status?: unknown } | null)?.status;
  if (typeof status === "number") {
    return status >= 500 || status === 401 || status === 403 || status === 429;
  }
  // Sin status y sin tipo conocido (p. ej. un TypeError de red sin envolver).
  return !(e instanceof ProviderError);
}

function beforeCall(provider: ProviderId): { probe: boolean } {
  const state = circuitFor(provider);
  const now = Date.now();
  if (state.openUntil > now) {
    throw new ProviderUnavailableError(provider, state.openUntil);
  }
  if (state.halfOpen) {
    // Solo una prueba a la vez: el resto sigue yendo al respaldo.
    if (state.probeInFlight) throw new ProviderUnavailableError(provider, now);
    state.probeInFlight = true;
    return { probe: true };
  }
  return { probe: false };
}

function onSuccess(provider: ProviderId, probe: boolean): void {
  const state = circuitFor(provider);
  if (probe) {
    state.probeInFlight = false;
    state.halfOpen = false;
    log.info(`proveedor ${provider}: circuito cerrado, vuelve a responder`, { provider });
  }
  state.failures = [];
}

function onFailure(provider: ProviderId, probe: boolean, e: unknown): void {
  const state = circuitFor(provider);
  if (probe) state.probeInFlight = false;
  if (!isProviderHealthFailure(e)) {
    // Respuesta normal (404…): si era la prueba, el proveedor está vivo.
    if (probe) state.halfOpen = false;
    return;
  }
  const now = Date.now();
  if (probe) {
    open(provider, state, now, e, "la prueba ha vuelto a fallar");
    return;
  }
  state.failures = state.failures.filter((t) => now - t < CIRCUIT_WINDOW_MS);
  state.failures.push(now);
  if (state.failures.length >= CIRCUIT_FAILURE_THRESHOLD) {
    open(provider, state, now, e, `${state.failures.length} fallos en 5 min`);
  }
}

function open(
  provider: ProviderId,
  state: CircuitState,
  now: number,
  e: unknown,
  why: string
): void {
  state.openUntil = now + CIRCUIT_OPEN_MS;
  state.halfOpen = true;
  state.failures = [];
  const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  reportIncident(
    provider,
    "circuit_open",
    `proveedor ${provider}: circuito abierto 10 min (${why}) · ${detail}`,
    { why, until: new Date(state.openUntil).toISOString() }
  );
}

// ── providerFetch ─────────────────────────────────────────────────────────────

export interface ProviderFetchOptions {
  /** Contrato mínimo de la respuesta (permisivo: `looseObject`, casi todo opcional). */
  schema?: ZodType;
  /** Plazo por intento: por defecto `PROVIDER_TIMEOUT_MS`, como máximo `PROVIDER_MAX_TIMEOUT_MS`. */
  timeoutMs?: number;
  /** Reintentos ante 5xx (por defecto 0). */
  retries?: number;
  retryDelayMs?: number;
  retryOn?: ReadonlySet<number>;
  /** `false` = sin caché. Por defecto, una hora en la caché de datos de Next. */
  cache?: false | { revalidate: number };
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  /** Error a lanzar ante un HTTP no-ok (conserva las clases de cada cliente). */
  httpError?: (status: number) => Error;
  /** Errores que el proveedor manda DENTRO de un 200 (GraphQL, ComicVine). */
  checkBody?: (json: unknown) => void;
  /** Nombre del endpoint para logs (nunca la URL: lleva claves). */
  label?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function labelFor(url: string, opts: ProviderFetchOptions): string {
  if (opts.label) return opts.label;
  try {
    return new URL(url).pathname;
  } catch {
    return "?";
  }
}

function formatIssues(error: unknown): string[] {
  const issues = (error as { issues?: { path: PropertyKey[]; message: string }[] })?.issues;
  if (!Array.isArray(issues)) return [String(error)];
  return issues.map(
    (i) => `${i.path.map(String).join(".") || "(raíz)"}: ${i.message}`
  );
}

/** Un intento: fetch + lectura del cuerpo, todo dentro del plazo. */
async function attemptOnce(
  provider: ProviderId,
  url: string,
  label: string,
  opts: ProviderFetchOptions,
  timeoutMs: number
): Promise<{ ok: true; json: unknown } | { ok: false; status: number }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new ProviderError(provider, "timeout", `${provider} ${label} → sin respuesta en ${timeoutMs} ms`)
      );
    }, timeoutMs);
  });

  const request = (async () => {
    const init: RequestInit & { next?: { revalidate: number } } = {
      method: opts.method ?? "GET",
      headers: { Accept: "application/json", ...opts.headers, "User-Agent": providerUserAgent() },
      signal: controller.signal,
    };
    if (opts.body !== undefined) init.body = opts.body;
    // Dentro de `unstable_cache` Next fuerza no-store en el fetch interno; el
    // `revalidate` solo evita que, fuera de él, el fetch se marque dinámico.
    if (opts.cache !== false) {
      init.next = { revalidate: opts.cache?.revalidate ?? PROVIDER_REVALIDATE_SECONDS };
    }
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError(provider, "network", `${provider} ${label} → error de red`, { cause: e });
    }
    if (!res.ok) return { ok: false as const, status: res.status };
    try {
      return { ok: true as const, json: (await res.json()) as unknown };
    } catch (e) {
      throw new ProviderError(provider, "contract", `${provider} ${label} → la respuesta no es JSON`, {
        status: res.status,
        cause: e,
      });
    }
  })();

  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
    // Si ganó el plazo, el fetch abortado rechazará más tarde: que no quede
    // como rechazo sin capturar.
    request.catch(() => {});
  }
}

async function fetchAndValidate<T>(
  provider: ProviderId,
  url: string,
  opts: ProviderFetchOptions
): Promise<T> {
  const label = labelFor(url, opts);
  const timeoutMs = Math.min(opts.timeoutMs ?? PROVIDER_TIMEOUT_MS, PROVIDER_MAX_TIMEOUT_MS);
  const deadline = Date.now() + PROVIDER_TOTAL_BUDGET_MS;
  const retries = Math.max(0, opts.retries ?? 0);
  const retryOn = opts.retryOn ?? DEFAULT_RETRY_ON;

  let lastStatus = 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
      if (deadline - Date.now() - delay < MIN_RETRY_BUDGET_MS) break;
      await sleep(delay);
    }
    const budget = Math.min(timeoutMs, deadline - Date.now());
    const result = await attemptOnce(provider, url, label, opts, budget);
    if (result.ok) {
      opts.checkBody?.(result.json);
      if (opts.schema) {
        const parsed = opts.schema.safeParse(result.json);
        if (!parsed.success) {
          const mode = providerContractMode();
          const issues = formatIssues(parsed.error);
          reportContractViolation(provider, label, issues, mode);
          if (mode === "enforce") throw new ProviderContractError(provider, label, issues);
        }
      }
      // Se devuelve el JSON tal cual (no la salida de Zod): el contrato vigila,
      // no transforma. Así el modo `log` es exactamente el comportamiento previo.
      return result.json as T;
    }
    lastStatus = result.status;
    if (!retryOn.has(result.status)) break;
  }
  throw (
    opts.httpError?.(lastStatus) ??
    new ProviderError(provider, "http", `${provider} ${label} → ${lastStatus}`, { status: lastStatus })
  );
}

async function guarded<T>(
  provider: ProviderId,
  url: string,
  opts: ProviderFetchOptions
): Promise<T> {
  const { probe } = beforeCall(provider);
  try {
    const value = await fetchAndValidate<T>(provider, url, opts);
    onSuccess(provider, probe);
    return value;
  } catch (e) {
    onFailure(provider, probe, e);
    throw e;
  }
}

function isMissingIncrementalCache(e: unknown): boolean {
  return e instanceof Error && e.message.includes("incrementalCache missing");
}

/**
 * Pide JSON a un proveedor con plazo, contrato, breaker y caché.
 *
 * Solo se cachea lo que ha pasado todas las comprobaciones: los errores (HTTP,
 * plazo, cuerpo con error, contrato en modo `enforce`) se lanzan dentro de
 * `unstable_cache`, que no guarda rechazos.
 */
export async function providerFetch<T>(
  provider: ProviderId,
  url: string,
  opts: ProviderFetchOptions = {}
): Promise<T> {
  const run = () => guarded<T>(provider, url, opts);
  if (opts.cache === false) return run();

  const revalidate = opts.cache?.revalidate ?? PROVIDER_REVALIDATE_SECONDS;
  const cached = unstable_cache(run, ["provider-fetch-v1", provider, opts.method ?? "GET", url, opts.body ?? ""], {
    revalidate,
    tags: [`provider:${provider}`],
  });
  try {
    return await cached();
  } catch (e) {
    // Fuera de Next (tests, scripts de contrato) no existe la caché
    // incremental: se llama directamente, sin caché.
    if (isMissingIncrementalCache(e)) return run();
    throw e;
  }
}
