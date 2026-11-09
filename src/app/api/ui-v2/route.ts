// ============================================================
// KULTURA — Route Handler: GET /api/ui-v2?v=1|0&next=/es/lists (F0)
//
// Activa (`v=1`) o apaga (`v=0`) la UI v2 para este navegador con la cookie
// `ui_v2` y vuelve a `next` (solo rutas internas: `safeInternalPath`). Es un
// GET a propósito: Víctor y quien pruebe lo activan abriendo un enlace, sin
// pantalla de ajustes. Solo toca una cookie de preferencia de este navegador
// (nada en la base), así que un enlace ajeno como mucho cambia qué interfaz
// ve uno mismo; por eso basta `SameSite=Lax` y no hay comprobación de origen.
//
// Sin sesión lleva al login, pero la cookie se guarda igual: si no, quien abre el
// enlace entra y aterriza en la UI vieja, porque tras el login ya no pasa por
// aquí. Solo llega a la v2 anónima quien abre este enlace a propósito.
// Ver `src/lib/ui-v2.ts`.
// ============================================================

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/api/discover-params";
import { localeFromPath, loginRedirectPath, safeInternalPath } from "@/lib/utils/safe-redirect";
import { routing } from "@/i18n/routing";
import { UI_V2_COOKIE, UI_V2_COOKIE_MAX_AGE } from "@/lib/ui-v2";

/** Activar y apagar a mano: 20 por minuto sobran. */
const UI_V2_LIMIT = { windowMs: 60_000, max: 20 };

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!checkRateLimit(`${clientIp(request.headers)}:ui_v2`, UI_V2_LIMIT).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: NO_STORE });
  }

  const v = request.nextUrl.searchParams.get("v");
  if (v !== "1" && v !== "0") {
    return NextResponse.json({ error: "v must be 1 or 0" }, { status: 400, headers: NO_STORE });
  }

  // Solo páginas: volver a otra ruta de API no tiene sentido (y la de login
  // también la descarta, `resolveAuthNext`).
  const raw = safeInternalPath(request.nextUrl.searchParams.get("next"), "/");
  const next = raw === "/api" || raw.startsWith("/api/") || raw.startsWith("/api?") ? "/" : raw;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const target = user ? next : loginRedirectPath(localeFromPath(next) ?? routing.defaultLocale, next);
  const response = NextResponse.redirect(new URL(target, request.url), { status: 303, headers: NO_STORE });
  response.cookies.set(UI_V2_COOKIE, v, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: UI_V2_COOKIE_MAX_AGE,
  });
  return response;
}
