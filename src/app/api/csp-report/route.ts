// ============================================================
// KULTURA — Route Handler: /api/csp-report (SEG-10, F-22)
// POST: informes de violaciones de la CSP (formatos en `report.ts`). Cada
// violación sale como una línea `warn` del logger (Vercel Logs; no va a
// Sentry: un navegador con extensiones genera decenas). Responde 204 salvo
// abuso: al navegador no le importa la respuesta.
// ============================================================

import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/api/discover-params";
import { createLogger } from "@/lib/logger";
import { ACCEPTED_TYPES, CSP_REPORT_MAX_BYTES, extractViolations } from "./report";

const log = createLogger("csp");

/** 30 peticiones por minuto e IP: una página rota no llena los logs. */
const CSP_REPORT_LIMIT = { windowMs: 60_000, max: 30 };

export async function POST(request: Request): Promise<Response> {
  const rl = checkRateLimit(`${clientIp(request.headers)}:csp_report`, CSP_REPORT_LIMIT);
  if (!rl.allowed) {
    return new Response(null, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } });
  }

  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ACCEPTED_TYPES.includes(type)) return new Response(null, { status: 415 });

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > CSP_REPORT_MAX_BYTES) return new Response(null, { status: 413 });
  const text = await request.text().catch(() => "");
  if (text.length > CSP_REPORT_MAX_BYTES) return new Response(null, { status: 413 });

  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }

  for (const violation of extractViolations(body)) {
    log.warn("csp violation", { ...violation });
  }
  return new Response(null, { status: 204 });
}
