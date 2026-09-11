import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { publicEnv } from "@/lib/env";
import { buildCsp } from "@/lib/csp";

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  // C7: nonce único por request — habilita script-src sin 'unsafe-inline' en
  // producción. crypto.randomUUID() está disponible en el runtime Edge.
  const nonce = crypto.randomUUID();
  const isDev = process.env.NODE_ENV === "development";
  const csp = buildCsp({ nonce, isDev });

  // Start with a response that forwards the request as-is.
  // We'll replace it if the session gets refreshed.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          // Write refreshed cookies into the forwarded request headers so
          // the Route Handler (or Server Component) receives the updated JWT.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Rebuild the supabaseResponse with the mutated request so the
          // refreshed cookies flow downstream.
          supabaseResponse = NextResponse.next({ request });
          // Also set them on the response so the browser updates its cookies.
          cookiesToSet.forEach(({ name, value, options }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            supabaseResponse.cookies.set(name, value, options as any)
          );
        },
      },
    }
  );

  // Validate session against auth server; refreshes token if expired.
  // HOTFIX (incidente prod 2026-09-11): sin timeout, un Supabase lento/caído
  // cuelga esta llamada hasta que Vercel mata el middleware por timeout →
  // 504 en TODO el sitio (el matcher cubre casi cualquier request). Peor caso
  // con el timeout: esta request sigue sin sesión refrescada — las páginas/
  // rutas protegidas hacen su propio check de auth y redirigen a login si
  // hace falta — preferible a un 504 global.
  const AUTH_CHECK_TIMEOUT_MS = 4000;
  try {
    await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("auth check timed out")), AUTH_CHECK_TIMEOUT_MS)
      ),
    ]);
  } catch {
    // Timeout o error del auth server: seguimos sin sesión refrescada en vez
    // de bloquear la respuesta indefinidamente.
  }

  // For API routes: return the Supabase response (carries refreshed session).
  if (request.nextUrl.pathname.startsWith("/api/")) {
    supabaseResponse.headers.set("Content-Security-Policy", csp);
    supabaseResponse.headers.set("x-nonce", nonce);
    return supabaseResponse;
  }

  // For page routes: let next-intl handle locale routing, then merge cookies.
  const intlResponse = intlMiddleware(request);

  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie);
  });

  intlResponse.headers.set("Content-Security-Policy", csp);
  intlResponse.headers.set("x-nonce", nonce);

  return intlResponse;
}

export const config = {
  matcher: [
    "/",
    "/(es|en)/:path*",
    "/api/:path*",
    "/((?!_next|_vercel|dev(?:/.*)?|.*\\..*).*)",
  ],
};
