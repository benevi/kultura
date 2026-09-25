// ============================================================
// KULTURA — Route Handler: /api/health (E-KEEPALIVE)
//
// Dos usos, un mismo endpoint:
//
//  1. **Keep-alive de Supabase.** El plan gratuito PAUSA el proyecto tras unos
//     días sin actividad, y un proyecto pausado deja de resolver por DNS: la
//     app entera cae con `ERR_NAME_NOT_RESOLVED` sin que nadie haya tocado
//     nada. El cron diario de `vercel.json` llama aquí, esto hace una consulta
//     real a la base y el contador de inactividad vuelve a cero.
//  2. **Monitor de caídas.** Un uptime check externo puede golpear esta ruta y
//     avisar en minutos en vez de enterarse por un usuario.
//
// AVISO, para no confiarse: esto MITIGA la pausa, no la garantiza — depende de
// que Supabase cuente esta petición como actividad, que es comportamiento no
// documentado. La única garantía real para producción es un plan de pago, que
// no auto-pausa. Ver CLAUDE.md.
//
// Decisiones:
//  - `force-dynamic`: si Next cachease la respuesta, el cron dejaría de tocar
//    la base y el keep-alive sería un placebo — justo el fallo que parecería
//    funcionar hasta el día que el proyecto se pausa igual.
//  - Cliente admin (service-role): la consulta no depende de RLS ni de que haya
//    sesión, así que "hay error" significa de verdad "la base no responde".
//  - `head: true`: cuenta filas sin traerlas. La petición viaja a Postgres
//    (que es lo que cuenta como actividad) y la respuesta es mínima.
//  - El detalle del error NO se devuelve al cliente (puede filtrar esquema o
//    infraestructura): va al log del servidor.
// ============================================================

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("health");

/** Público y barato, pero no gratis: tope por IP para que no se pueda martillear. */
const HEALTH_LIMIT = { windowMs: 60_000, max: 30 };

/** Sin caché: el objetivo del endpoint es tocar la base en CADA llamada. */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`${ip}:health`, HEALTH_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const startedAt = Date.now();
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });

    if (error) throw new Error(error.message);

    return NextResponse.json(
      { ok: true, db: "up", ms: Date.now() - startedAt },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    // En el MENSAJE, no en el contexto: el visor de logs de Vercel colapsa
    // `context:{…}` y ya nos dejó a ciegas una vez.
    log.error(
      `health: la base no responde · ${e instanceof Error ? e.message : String(e)}`
    );
    return NextResponse.json(
      { ok: false, db: "down" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
