// ============================================================
// KULTURA — Route Handler: /api/sala-prueba (fase 8.5)
//
// Pone o quita la cookie de prueba de «Sala»: con una bandera en `prueba`
// (`SALA_FICHA=prueba`…), solo quien la trae ve la pantalla nueva. Es el
// enlace que se da a los usuarios de P-Uso.
//
//   /api/sala-prueba?on=1   → pone la cookie (60 días) y vuelve a `next`
//   /api/sala-prueba?on=0   → la quita y vuelve a `next`
//
// La cookie solo vale `1`: ni cuenta, ni id, ni nada de la persona. httpOnly
// (no la lee ningún script) y sameSite lax. `next` solo admite una ruta de
// este sitio; si no, vuelve a la portada.
// ============================================================

import { NextResponse, type NextRequest } from "next/server";
import { salaTestCookie, salaTestNext } from "@/lib/flags/sala";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const on = request.nextUrl.searchParams.get("on");
  if (on !== "1" && on !== "0") {
    return NextResponse.json({ error: "on=1|0" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const target = new URL(salaTestNext(request.nextUrl.searchParams.get("next")), request.url);
  const response = NextResponse.redirect(target, 303);
  response.headers.set("Cache-Control", "no-store");
  const cookie = salaTestCookie(on === "1", process.env.NODE_ENV === "production");
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
