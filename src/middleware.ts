import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { publicEnv } from "@/lib/env.public";
import {
  CSP_REPORT_PATH,
  buildCsp,
  isInvalidBestPath,
  isRouterFetchFromStaticRoute,
  isStaticCspRoute,
} from "@/lib/csp";
import { DEMO_READ_ONLY_ERROR, isBlockedForDemo, isDemoUser } from "@/lib/demo";

const intlMiddleware = createIntlMiddleware(routing);

/**
 * ¿Trae la petición la cookie de sesión de Supabase? Se llama
 * `sb-<proyecto>-auth-token` y puede ir troceada (`.0`, `.1`…).
 */
function hasSupabaseSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
}

export async function middleware(request: NextRequest) {
  // SEG-4a: la app no usa Server Actions. Cualquier POST con `Next-Action` se
  // corta aquí, antes de gastar una llamada a Supabase. Si algún día se usan
  // Server Actions, quitar este bloque.
  if (request.headers.has("next-action")) {
    return new NextResponse(null, { status: 400 });
  }

  const { pathname } = request.nextUrl;

  // Informes de CSP (SEG-10): los manda el navegador solo, a veces varios por
  // página; no necesitan sesión ni idioma. Sin pasar por Supabase.
  if (pathname === CSP_REPORT_PATH) {
    return NextResponse.next();
  }

  // `x-pathname`: ruta + query originales, para construir el `next` de las
  // redirecciones a /login. Va en la PETICIÓN y se sobrescribe siempre: lo
  // que mande el cliente no vale. `NextResponse.next({ request })` y
  // next-intl reenvían las cabeceras de la petición tal cual.
  request.headers.set("x-pathname", pathname + request.nextUrl.search);

  // D-02: rutas cacheables en el CDN (portadas, rankings, legales, /offline).
  // Su HTML es el mismo para todos: sin nonce (la CSP fija la pone
  // `next.config.mjs`), sin sesión (no la leen) y sin cookies en la respuesta
  // (una `Set-Cookie` saca la respuesta de la caché del CDN). Solo next-intl,
  // que resuelve el idioma.
  // Un ranking que no existe (/es/best/movie/abc) no llega a la página: se
  // guardaría en la caché ISR, una entrada por URL inventada. Va a la 404
  // dinámica (abajo), con nonce y sin caché.
  const invalidBest = isInvalidBestPath(pathname);

  if (isStaticCspRoute(pathname) && !invalidBest) {
    const response = intlMiddleware(request);
    // next-intl recuerda el idioma con la cookie NEXT_LOCALE; en una página
    // cacheable no se manda (la pone la primera página dinámica que se visite).
    response.headers.delete("set-cookie");
    return response;
  }

  // Defensa en profundidad (revisión #47): una navegación del router de Next
  // desde una página con la CSP fija hacia una con nonce pintaría el destino
  // dentro del documento de origen, que conserva su CSP `'unsafe-inline'`. Las
  // páginas cacheables solo enlazan con `<a>` (test del grafo de imports),
  // pero si algo se cuela, una respuesta que no es RSC hace que el router
  // cargue el documento entero (`doMpaNavigation`), con su propia CSP.
  if (!pathname.startsWith("/api/") && isRouterFetchFromStaticRoute(request.headers)) {
    return new NextResponse(null, { status: 409, headers: { "Cache-Control": "no-store" } });
  }

  // C7: nonce único por request — habilita script-src sin 'unsafe-inline' en
  // producción. crypto.randomUUID() está disponible en el runtime Edge.
  const nonce = crypto.randomUUID();
  const isDev = process.env.NODE_ENV === "development";
  const csp = buildCsp({ nonce, isDev });

  // Cabeceras para el render, en la PETICIÓN (nunca en la respuesta, SEG-10):
  // - `content-security-policy`: de aquí saca Next el nonce que pone en sus
  //   <script> (patrón documentado).
  // - `x-nonce`: para los Server Components que necesiten firmar un <script>.
  request.headers.set("content-security-policy", csp);
  request.headers.set("x-nonce", nonce);

  if (invalidBest) {
    // `[locale]/[...rest]` es dinámica y responde `notFound()` (404 del idioma).
    const locale = pathname.split("/")[1];
    const notFound = NextResponse.rewrite(new URL(`/${locale}/no-existe`, request.url), {
      request: { headers: request.headers },
    });
    notFound.headers.set("Content-Security-Policy", csp);
    notFound.headers.set("Cache-Control", "private, no-store");
    return notFound;
  }

  // Start with a response that forwards the request as-is.
  // We'll replace it if the session gets refreshed.
  let supabaseResponse = NextResponse.next({ request });

  // Validate session against auth server; refreshes token if expired.
  // Sin cookie de Supabase no hay sesión que validar ni refrescar: el
  // visitante anónimo no gasta una llamada a Auth (SEO-11, F-22).
  // HOTFIX (incidente prod 2026-09-11): sin timeout, un Supabase lento/caído
  // cuelga esta llamada hasta que Vercel mata el middleware por timeout →
  // 504 en TODO el sitio (el matcher cubre casi cualquier request). Peor caso
  // con el timeout: esta request sigue sin sesión refrescada — las páginas/
  // rutas protegidas hacen su propio check de auth y redirigen a login si
  // hace falta — preferible a un 504 global.
  const AUTH_CHECK_TIMEOUT_MS = 4000;
  let user: User | null = null;
  if (hasSupabaseSessionCookie(request)) {
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

    try {
      const result = await Promise.race([
        supabase.auth.getUser(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("auth check timed out")), AUTH_CHECK_TIMEOUT_MS)
        ),
      ]);
      user = result.data.user;
    } catch {
      // Timeout o error del auth server: seguimos sin sesión refrescada en vez
      // de bloquear la respuesta indefinidamente.
    }
  }

  // E-DEMO: la cuenta demo es de solo lectura. Aquí se cortan las rutas que
  // escriben con el cliente ADMIN (ignoran RLS); lo que va directo a la base lo
  // corta la migración `demo_read_only`. Ver `src/lib/demo.ts`.
  if (isDemoUser(user) && isBlockedForDemo(request.method, pathname)) {
    const blocked = NextResponse.json({ error: DEMO_READ_ONLY_ERROR }, { status: 403 });
    supabaseResponse.cookies.getAll().forEach((cookie) => blocked.cookies.set(cookie));
    blocked.headers.set("Content-Security-Policy", csp);
    return blocked;
  }

  // For API routes: return the Supabase response (carries refreshed session).
  if (pathname.startsWith("/api/")) {
    supabaseResponse.headers.set("Content-Security-Policy", csp);
    return supabaseResponse;
  }

  // For page routes: let next-intl handle locale routing, then merge cookies.
  const intlResponse = intlMiddleware(request);

  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie);
  });

  intlResponse.headers.set("Content-Security-Policy", csp);

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
