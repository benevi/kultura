import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { routing } from "@/i18n/routing";

const log = createLogger("auth/demo");

/** Idioma del formulario, saneado contra la lista de locales de la app. */
function pickLocale(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "";
  return (routing.locales as readonly string[]).includes(value) ? value : routing.defaultLocale;
}

/**
 * POST /api/auth/demo — entra en la cuenta demo de solo lectura (E-DEMO).
 *
 * Sin contraseña: el servidor genera un enlace mágico para la cuenta demo con
 * el cliente admin y lo canjea en el acto con el cliente de sesión, que deja
 * las cookies puestas. Nada viaja por email y no hay credenciales que filtrar.
 * Que la cuenta sea de solo lectura no depende de esto, sino de
 * `app_metadata.demo` (ver `src/lib/demo.ts`).
 *
 * Es POST (un formulario en la landing), no un enlace: cambia la sesión, y un
 * GET lo dispararía cualquier precarga del navegador.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const { origin } = new URL(request.url);
  const form = await request.formData().catch(() => null);
  const locale = pickLocale(form?.get("locale") ?? null);
  const fail = () => NextResponse.redirect(`${origin}/${locale}/login?error=demo_unavailable`, 303);

  const email = env.DEMO_USER_EMAIL;
  if (!email) return fail();

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`${ip}:demo-login`, LIMITS.demo_login);
  if (!rl.allowed) return fail();

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    log.error("[E-DEMO] generateLink falló", { message: error?.message });
    return fail();
  }

  const supabase = createClient();
  const { data: session, error: verifyError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });
  // Red de seguridad: si el email de DEMO_USER_EMAIL apuntara por error a una
  // cuenta normal, se entraría en ella SIN contraseña. Solo se acepta una
  // sesión de una cuenta marcada como demo.
  if (verifyError || session.user?.app_metadata?.demo !== true) {
    log.error("[E-DEMO] la sesión no es de una cuenta demo", { message: verifyError?.message });
    await supabase.auth.signOut();
    return fail();
  }

  return NextResponse.redirect(`${origin}/${locale}/home`, 303);
}
