import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente Supabase para uso en Server Components, Route Handlers y Server Actions.
 * Lee y escribe cookies de sesión via next/headers.
 *
 * IMPORTANTE: El catch en setAll es necesario porque los Server Components
 * no pueden escribir cookies directamente — solo el middleware y los Route Handlers pueden.
 * La sesión se refresca correctamente via el middleware.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Los Server Components no pueden escribir cookies.
            // El middleware se encarga de refrescar la sesión.
          }
        },
      },
    }
  );
}
