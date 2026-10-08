import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDemoUser } from "@/lib/demo";
import { routing } from "@/i18n/routing";

/**
 * POST /api/auth/demo/exit — sale de la demo y lleva al registro (E-DEMO).
 *
 * El login redirige a Inicio a quien ya tiene sesión, así que el botón
 * "Crear cuenta" del aviso de la demo tiene que cerrarla antes. Solo cierra
 * sesiones DEMO: a una cuenta normal no la desconecta un formulario ajeno.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const { origin } = new URL(request.url);
  const form = await request.formData().catch(() => null);
  const raw = form?.get("locale");
  const locale =
    typeof raw === "string" && (routing.locales as readonly string[]).includes(raw)
      ? raw
      : routing.defaultLocale;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (isDemoUser(user)) await supabase.auth.signOut();

  return NextResponse.redirect(`${origin}/${locale}/login?mode=register`, 303);
}
