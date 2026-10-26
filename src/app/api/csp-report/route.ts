// ============================================================
// KULTURA — Route Handler: /api/csp-report (SEG-10, F-22)
// POST: informes de violaciones de la CSP (formatos en `report.ts`). Cada
// violación sale como una línea `warn` del logger (Vercel Logs; no va a
// Sentry: un navegador con extensiones genera decenas). Responde 204 salvo
// abuso: al navegador no le importa la respuesta.
// ============================================================

import { checkRateLimitDistributed } from "@/lib/rate-limit";
import { clientIp } from "@/lib/api/discover-params";
import { createLogger } from "@/lib/logger";
import { ACCEPTED_TYPES, CSP_REPORT_MAX_BYTES, extractViolations, readBodyCapped } from "./report";

const log = createLogger("csp");

/**
 * 30 peticiones por minuto e IP, compartido entre instancias (Upstash; sin
 * él, el límite en memoria): una página rota no llena los logs.
 */
const CSP_REPORT_LIMIT = { windowMs: 60_000, max: 30 };

export async function POST(request: Request): Promise<Response> {
  const rl = await checkRateLimitDistributed(`${clientIp(request.headers)}:csp_report`, CSP_REPORT_LIMIT);
  if (!rl.allowed) {
    return new Response(null, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } });
  }

  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ACCEPTED_TYPES.includes(type)) return new Response(null, { status: 415 });

  // Content-Length declarado de más: ni se empieza a leer.
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > CSP_REPORT_MAX_BYTES) return new Response(null, { status: 413 });
  // Sin Content-Length (o mintiendo): se lee por trozos y se corta al pasar el tope.
  const text = await readBodyCapped(request, CSP_REPORT_MAX_BYTES);
  if (text === null) return new Response(null, { status: 413 });

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
