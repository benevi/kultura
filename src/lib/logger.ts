/**
 * KULTURA — Logger estructurado (C2)
 *
 * Reemplaza los `console.error` dispersos por un logger con niveles y
 * contexto consistente. En producción emite una línea JSON por evento (Vercel
 * la indexa y permite filtrar por `level`/`scope`); en desarrollo emite texto
 * legible en consola.
 *
 * Edge-safe a propósito (sin dependencias de Node): `middleware.ts` corre en
 * el runtime Edge y podría importar este módulo en el futuro.
 *
 * Los eventos `error` con `NEXT_PUBLIC_SENTRY_DSN` configurado se reenvían a
 * Sentry vía import dinámico (`loadSentry`, ver C1 y `instrumentation*.ts`). Si Sentry no
 * está configurado o falla al cargar, el logging local no se ve afectado —
 * el reenvío es best-effort y nunca bloquea ni lanza.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

const isProd = process.env.NODE_ENV === "production";

function serializeContext(context?: LogContext): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    out[key] = value instanceof Error
      ? { name: value.name, message: value.message, stack: value.stack }
      : value;
  }
  return out;
}

function emit(level: LogLevel, scope: string, message: string, context?: LogContext): void {
  const ctx = serializeContext(context);

  if (isProd) {
    // Una línea JSON por evento — Vercel Logs / cualquier log drain la indexa.
    const line = {
      level,
      scope,
      message,
      time: new Date().toISOString(),
      ...(ctx ? { context: ctx } : {}),
    };
    const out = JSON.stringify(line);
    if (level === "error") console.error(out);
    else if (level === "warn") console.warn(out);
    else console.log(out);
    return;
  }

  // Desarrollo: texto legible, sin serializar a JSON.
  const prefix = `[${scope}]`;
  const args: unknown[] = ctx ? [prefix, message, ctx] : [prefix, message];
  if (level === "error") console.error(...args);
  else if (level === "warn") console.warn(...args);
  else if (level === "debug") console.debug(...args);
  else console.log(...args);
}

type SentryModule = typeof import("@sentry/nextjs");

let sentryPromise: Promise<SentryModule> | null = null;

/**
 * Sentry bajo demanda (REN-2, F-22). El SDK pesa ~60 KB gz y no va en el JS
 * inicial de ninguna página: en el navegador lo pide `instrumentation-client.ts`
 * cuando el hilo queda libre, o este logger con el primer error, lo que llegue
 * antes; los dos comparten esta promesa, así que se descarga e inicializa una
 * sola vez. En el servidor y el edge el SDK ya lo inicializa
 * `instrumentation.ts`: aquí solo se importa.
 *
 * Sin `NEXT_PUBLIC_SENTRY_DSN` devuelve null y no descarga nada.
 */
export function loadSentry(): Promise<SentryModule> | null {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return null;
  if (!sentryPromise) {
    sentryPromise = import("@sentry/nextjs").then((Sentry) => {
      if (typeof window !== "undefined") initBrowserSentry(Sentry);
      return Sentry;
    });
    // Si falla la descarga (sin red, bloqueador) se reintenta con el próximo error.
    sentryPromise.catch(() => {
      sentryPromise = null;
    });
  }
  return sentryPromise;
}

/**
 * Inicializa el SDK del navegador una sola vez. REN-2: solo captura de errores
 * (sin Replay ni trazas del navegador, que `clientSentryDefines` quita además
 * del build). Un fallo aquí no impide capturar con lo que haya.
 */
function initBrowserSentry(Sentry: SentryModule): void {
  try {
    if (!Sentry.getClient()) Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN });
  } catch {
    // SDK a medias (o doble de test sin `init`): se sigue sin inicializar.
  }
}

/** Solo para tests: olvida la promesa compartida. */
export function _resetSentryForTests(): void {
  sentryPromise = null;
}

type VercelRequestContext = { get?: () => { waitUntil?: (task: Promise<unknown>) => void } | undefined };

/**
 * En el SERVIDOR el evento se captura y el SDK lo envía en segundo plano, pero
 * en Vercel la función se congela al terminar la respuesta y el envío se queda
 * a medias. El SDK solo lo evita en el runtime Edge (`vercelWaitUntil` de
 * `@sentry/core` no hace nada en Node). Medido el 17-11-2026: el aviso de
 * «circuito abierto» de Open Library salió en el log de Vercel y en Sentry no
 * apareció ningún evento en toda la semana.
 *
 * Aquí se vacía la cola (máx. 2 s) y se le pide a la plataforma que espere a
 * ese vaciado, con el mismo contexto de petición que usa `@vercel/functions`
 * (`waitUntil`). Fuera de Vercel o sin petición en curso solo se vacía.
 * En el navegador no hace nada: allí la página sigue viva.
 */
export function flushSentryInBackground(Sentry: { flush?: (timeout?: number) => PromiseLike<boolean> }): void {
  if (typeof window !== "undefined" || typeof Sentry.flush !== "function") return;
  try {
    const task = Promise.resolve(Sentry.flush(2000)).catch(() => false);
    const ctx = (globalThis as Record<symbol, unknown>)[Symbol.for("@vercel/request-context")] as
      | VercelRequestContext
      | undefined;
    ctx?.get?.()?.waitUntil?.(task);
  } catch {
    // Sin flush ni contexto: el evento sale si la función sigue viva.
  }
}

/** Reenvío best-effort a Sentry. Nunca lanza, nunca bloquea al caller. */
function reportToSentry(message: string, context?: LogContext, level: "error" | "warning" = "error"): void {
  const pending = loadSentry();
  if (!pending) return;
  const err = context?.err ?? context?.error;
  pending
    .then((Sentry) => {
      if (err instanceof Error) {
        Sentry.captureException(err, { extra: { message, ...context } });
      } else {
        Sentry.captureMessage(message, { level, extra: context });
      }
      flushSentryInBackground(Sentry);
    })
    .catch(() => {
      // Sentry no disponible o falló al cargar — no interrumpe el flujo.
    });
}

/**
 * Logger con scope fijo. Uso: `const log = createLogger('chat')` una vez por
 * módulo, luego `log.error('mensaje', { contexto })`.
 */
export function createLogger(scope: string) {
  return {
    debug: (message: string, context?: LogContext) => emit("debug", scope, message, context),
    info: (message: string, context?: LogContext) => emit("info", scope, message, context),
    warn: (message: string, context?: LogContext) => emit("warn", scope, message, context),
    /**
     * Aviso que alguien tiene que leer aunque no sea un fallo (saneamiento
     * 10.3: cada denuncia nueva). Va a Sentry con nivel `warning`.
     */
    notice: (message: string, context?: LogContext) => {
      emit("warn", scope, message, context);
      reportToSentry(message, context, "warning");
    },
    error: (message: string, context?: LogContext) => {
      emit("error", scope, message, context);
      reportToSentry(message, context);
    },
  };
}

/** Logger sin scope explícito, para call-sites que no justifican un módulo dedicado. */
export const logger = createLogger("app");
