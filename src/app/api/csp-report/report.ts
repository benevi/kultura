// ============================================================
// KULTURA — /api/csp-report: lectura de los informes (SEG-10, F-22)
// POST: informes de violaciones de la CSP que mandan los navegadores.
// - `report-uri` (Firefox, Safari): `application/csp-report`, un objeto
//   `{ "csp-report": { … } }` con claves en kebab-case.
// - `report-to` (Chromium, Reporting API): `application/reports+json`, una
//   lista de `{ type: "csp-violation", body: { … } }` en camelCase.
// Cada violación sale como una línea `warn` del logger (Vercel Logs; no va a
// Sentry: un navegador con extensiones genera decenas). Sin query ni
// fragmento en las URL (pueden llevar datos) y sin cookies ni IP en el log.
// Responde siempre 204 (salvo abuso): al navegador no le importa la respuesta.
// ============================================================

/** Un informe ocupa ~1 KB; 16 KB caben de sobra en un lote del Reporting API. */
export const CSP_REPORT_MAX_BYTES = 16 * 1024;
/** Violaciones registradas por petición (un lote puede traer varias). */
export const CSP_REPORT_MAX_ITEMS = 10;
export const ACCEPTED_TYPES = ["application/csp-report", "application/reports+json", "application/json"];

export interface CspViolation {
  documentUrl: string | null;
  blockedUrl: string | null;
  directive: string | null;
  disposition: string | null;
  sourceFile: string | null;
  line: number | null;
  sample: string | null;
}

type Raw = Record<string, unknown>;

/**
 * URL sin query ni fragmento. Las palabras clave de la CSP (`inline`, `eval`,
 * `data`, `blob`…) pasan tal cual; lo que no es una URL ni una palabra
 * corta se descarta.
 */
export function scrubUrl(value: unknown): string | null {
  if (typeof value !== "string" || value === "") return null;
  if (/^[a-z-]{1,20}$/i.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "data:" || url.protocol === "blob:") return url.protocol.slice(0, -1);
    return `${url.origin}${url.pathname}`.slice(0, 300);
  } catch {
    return null;
  }
}

function str(value: unknown, max = 120): string | null {
  return typeof value === "string" && value !== "" ? value.slice(0, max) : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Una violación en cualquiera de los dos formatos → forma común. */
export function normalizeViolation(raw: Raw): CspViolation {
  const pick = (camel: string, kebab: string) => raw[camel] ?? raw[kebab];
  return {
    documentUrl: scrubUrl(pick("documentURL", "document-uri")),
    blockedUrl: scrubUrl(pick("blockedURL", "blocked-uri")),
    directive: str(pick("effectiveDirective", "effective-directive") ?? raw["violated-directive"]),
    disposition: str(raw.disposition),
    sourceFile: scrubUrl(pick("sourceFile", "source-file")),
    line: num(pick("lineNumber", "line-number")),
    // Los primeros 40 caracteres del script o estilo bloqueado (si el
    // navegador los manda por `report-sample`): ayudan a reconocer extensiones.
    sample: str(pick("sample", "script-sample"), 40),
  };
}

/** Saca las violaciones de un cuerpo ya parseado (los dos formatos). */
export function extractViolations(body: unknown): CspViolation[] {
  if (Array.isArray(body)) {
    return body
      .filter((r): r is Raw => !!r && typeof r === "object" && (r as Raw).type === "csp-violation")
      .map((r) => (r.body && typeof r.body === "object" ? normalizeViolation(r.body as Raw) : null))
      .filter((v): v is CspViolation => v !== null)
      .slice(0, CSP_REPORT_MAX_ITEMS);
  }
  if (body && typeof body === "object") {
    const report = (body as Raw)["csp-report"];
    if (report && typeof report === "object") return [normalizeViolation(report as Raw)];
  }
  return [];
}

