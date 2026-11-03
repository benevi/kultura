// ============================================================
// KULTURA — Cifras y fechas con el formato del idioma (WIG: Intl)
//
// En español la nota es «8,5», no «8.5»; los miles van con punto («1.234»)
// y el «hace 3 días» lo escribe `Intl.RelativeTimeFormat`, no una cadena
// propia. Puras y sin React: las usan componentes de servidor y de cliente.
// ============================================================

const scoreCache = new Map<string, Intl.NumberFormat>();
const numberCache = new Map<string, Intl.NumberFormat>();
const relativeCache = new Map<string, Intl.RelativeTimeFormat>();

/** Nota con un decimal fijo: 8,5 · 7,0 (es) / 8.5 · 7.0 (en). */
export function formatScore(value: number, locale: string): string {
  let fmt = scoreCache.get(locale);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    scoreCache.set(locale, fmt);
  }
  return fmt.format(value);
}

/** Entero con separador de miles del idioma: 1.234 (es) / 1,234 (en). */
export function formatCount(value: number, locale: string): string {
  let fmt = numberCache.get(locale);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    numberCache.set(locale, fmt);
  }
  return fmt.format(value);
}

const DAY = 86_400_000;

/**
 * «hoy», «ayer», «hace 3 días», «hace 2 semanas», «hace 5 meses»… desde
 * `date` hasta `now`. Las fechas futuras se tratan como «hoy» (un reloj
 * desajustado no debe pintar «dentro de 2 días» en una tarjeta de estado).
 */
export function formatSince(date: Date | string | number, locale: string, now: number = Date.now()): string {
  const time = new Date(date).getTime();
  let rtf = relativeCache.get(locale);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    relativeCache.set(locale, rtf);
  }
  if (!Number.isFinite(time)) return "";
  const days = Math.max(0, Math.floor((startOfDay(now) - startOfDay(time)) / DAY));
  if (days < 7) return rtf.format(-days, "day");
  if (days < 30) return rtf.format(-Math.floor(days / 7), "week");
  if (days < 365) return rtf.format(-Math.floor(days / 30), "month");
  return rtf.format(-Math.floor(days / 365), "year");
}

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
