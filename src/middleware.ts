import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  // Acumula las cookies que Supabase quiere escribir en la respuesta
  const pendingCookies: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];

  // 1. Crear cliente Supabase en el contexto del middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach((cookie) => pendingCookies.push(cookie));
        },
      },
    }
  );

  // 2. Refrescar sesión — getUser() valida contra el servidor de auth,
  //    más seguro que getSession() que solo verifica la firma local.
  await supabase.auth.getUser();

  // Para rutas API: solo refrescar el token, no aplicar routing de idioma.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    pendingCookies.forEach(({ name, value, options }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response.cookies.set(name, value, options as any);
    });
    return response;
  }

  // 3. Dejar que next-intl procese el routing de idioma
  const response = intlMiddleware(request);

  // 4. Aplicar cookies de sesión de Supabase a la respuesta de next-intl
  pendingCookies.forEach(({ name, value, options }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response.cookies.set(name, value, options as any);
  });

  return response;
}

export const config = {
  matcher: [
    // Rutas raíz y con prefijo de locale
    "/",
    "/(es|en)/:path*",
    // Rutas API — para refrescar sesión Supabase antes de llegar al Route Handler
    "/api/:path*",
    // Todo excepto: _next, _vercel, archivos con extensión
    "/((?!_next|_vercel|.*\\..*).*)",
  ],
};
