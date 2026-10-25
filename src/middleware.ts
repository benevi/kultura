import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { publicEnv } from "@/lib/env.public";
import { buildCsp } from "@/lib/csp";
import { DEMO_READ_ONLY_ERROR, isBlockedForDemo, isDemoUser } from "@/lib/demo";

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  // SEG-4a: la app no usa Server Actions. Next 14 procesa cualquier POST con
  // `Next-Action` aunque no exista la acción (vía de DoS de la rama 14), así
  // que se corta aquí, antes de gastar una llamada a Supabase. Al migrar a
  // Next 15 y si algún día se usan Server Actions, quitar este bloque.
  if (request.headers.has("next-action")) {
    return new NextResponse(null, { status: 400 });
  }

  // C7: nonce único por request — habilita script-src sin 'unsafe-inline' en
  // producción. crypto.randomUUID() está disponible en el runtime Edge.
  const nonce = crypto.randomUUID();
  const isDev = process.env.NODE_ENV === "development";
  const csp = buildCsp({ nonce, isDev });

  // Cabeceras para el render, en la PETICIÓN (nunca en la respuesta, SEG-10):
  // - `content-security-policy`: de aquí saca Next el nonce que pone en sus
  //   <script> (patrón documentado; Next 14 además copia las de la respuesta).
  // - `x-nonce`: para los Server Components que necesiten firmar un <script>.
  // - `x-pathname`: ruta + query originales, para construir el `next` de las
  //   redirecciones a /login. Se sobrescribe siempre: lo que mande el cliente
  //   no vale. `NextResponse.next({ request })` y next-intl reenvían estas
  //   cabeceras tal cual.
  request.headers.set("content-security-policy", csp);
  request.headers.set("x-nonce", nonce);
  request.headers.set("x-pathname", request.nextUrl.pathname + request.nextUrl.search);

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
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
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

  // E-DEMO: la cuenta demo es de solo lectura. Aquí se cortan las rutas que
  // escriben con el cliente ADMIN (ignoran RLS); lo que va directo a la base lo
  // corta la migración `demo_read_only`. Ver `src/lib/demo.ts`.
  if (isDemoUser(user) && isBlockedForDemo(request.method, request.nextUrl.pathname)) {
    const blocked = NextResponse.json({ error: DEMO_READ_ONLY_ERROR }, { status: 403 });
    supabaseResponse.cookies.getAll().forEach((cookie) => blocked.cookies.set(cookie));
    blocked.headers.set("Content-Security-Policy", csp);
    return blocked;
  }

  // For API routes: return the Supabase response (carries refreshed session).
  if (request.nextUrl.pathname.startsWith("/api/")) {
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
