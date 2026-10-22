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
// no auto-pausa.
//
// Decisiones:
//  - `force-dynamic`: si Next cachease la respuesta, el cron dejaría de tocar
//    la base y el keep-alive sería un placebo — justo el fallo que parecería
//    funcionar hasta el día que el proyecto se pausa igual.
//  - Cliente admin (service-role): la consulta no depende de RLS ni de que haya
//    sesión, así que "hay error" significa de verdad "la base no responde".
//  - GET `select('id').limit(1)` sobre `users` (COD-3). Antes era un HEAD con
//    `count` sobre `profiles`, una tabla que NINGUNA migración crea: postgrest-js
//    convierte el 404 de un HEAD (cuerpo vacío) en éxito sin error, así que la
//    ruta respondía `ok` existiera la tabla o no. Con GET, un 404 trae cuerpo y
//    llega como error → 503. Se trae como mucho un id: la respuesta es mínima.
//  - El detalle del error NO se devuelve al cliente (puede filtrar esquema o
//    infraestructura): va al log del servidor.
//  - `?deep=1` (COD-2) añade una sonda barata por proveedor de catálogo, con el
//    resultado cacheado 1 h para no gastar cupo (ver `providers.ts`). La
//    respuesta sigue siendo 200 mientras la base responda; `ok` solo es `true`
//    si además responden todos los proveedores. Monitores: `/api/health` cada
//    5 min (base) y `?deep=1` cada 60 min con palabra clave `"ok":true`.
// ============================================================

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { getProvidersReport, type ProvidersReport } from "./providers";

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

  const deep = req.nextUrl.searchParams.get("deep") === "1";
  const startedAt = Date.now();
  // Las sondas de proveedores no dependen de la base: van en paralelo.
  const providersPromise: Promise<ProvidersReport | null> = deep
    ? getProvidersReport().catch((e) => {
        log.error(`health: las sondas de proveedores fallaron · ${e instanceof Error ? e.message : String(e)}`);
        return null;
      })
    : Promise.resolve(null);

  let dbUp = false;
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("users").select("id").limit(1);
    if (error) throw new Error(error.message);
    dbUp = true;
  } catch (e) {
    // En el MENSAJE, no en el contexto: el visor de logs de Vercel colapsa
    // `context:{…}` y ya nos dejó a ciegas una vez.
    log.error(
      `health: la base no responde · ${e instanceof Error ? e.message : String(e)}`
    );
  }
  const ms = Date.now() - startedAt;
  const headers = { "Cache-Control": "no-store" };

  if (!deep) {
    return dbUp
      ? NextResponse.json({ ok: true, db: "up", ms }, { headers })
      : NextResponse.json({ ok: false, db: "down" }, { status: 503, headers });
  }

  const report = await providersPromise;
  const body = {
    ok: dbUp && report?.ok === true,
    db: dbUp ? "up" : "down",
    ms,
    providers: report?.providers ?? {},
    checkedAt: report?.checkedAt ?? null,
  };
  return NextResponse.json(body, { status: dbUp ? 200 : 503, headers });
}
