import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route Handler: Supabase Auth code exchange.
 *
 * Supabase redirige aquí tras confirmación de email o reset de contraseña.
 * Intercambia el `code` por una sesión activa y redirige al destino.
 *
 * Parámetros de query:
 *   - code: PKCE authorization code de Supabase
 *   - next: ruta de destino tras el exchange (default "/")
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Error in exchange — redirect to login with error indicator
  return NextResponse.redirect(
    `${origin}/login?error=auth_callback_error`
  );
}
