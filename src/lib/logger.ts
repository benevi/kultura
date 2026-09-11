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
 * Sentry vía import dinámico (ver C1, `sentry.*.config.ts`). Si Sentry no
 * está configurado o falla al cargar, el logging local no se ve afectado —
 * el reenvío es best-effort y nunca bloquea ni lanza.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

const isProd = process.env.NODE_ENV === "production";
const hasSentry = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

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

/** Reenvío best-effort a Sentry. Nunca lanza, nunca bloquea al caller. */
function reportToSentry(message: string, context?: LogContext): void {
  if (!hasSentry) return;
  const err = context?.err ?? context?.error;
  import("@sentry/nextjs")
    .then((Sentry) => {
      if (err instanceof Error) {
        Sentry.captureException(err, { extra: { message, ...context } });
      } else {
        Sentry.captureMessage(message, { level: "error", extra: context });
      }
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
    error: (message: string, context?: LogContext) => {
      emit("error", scope, message, context);
      reportToSentry(message, context);
    },
  };
}

/** Logger sin scope explícito, para call-sites que no justifican un módulo dedicado. */
export const logger = createLogger("app");
