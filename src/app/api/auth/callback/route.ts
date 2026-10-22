import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { routing } from "@/i18n/routing";
import { localeFromPath, resolveAuthNext } from "@/lib/utils/safe-redirect";
import {
  getCallbackErrorCode,
  getProviderErrorCode,
  type CallbackErrorCode,
} from "@/lib/utils/auth-errors";

/** Tipos de enlace del correo que se canjean aquí (el resto no los enviamos). */
const OTP_TYPES: readonly EmailOtpType[] = ["signup", "email", "recovery", "email_change"];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as readonly string[]).includes(value);
}

/** Locale de la vuelta: el del `next`, si no el de la cookie de next-intl. */
function pickLocale(request: NextRequest, rawNext: string | null): string {
  const fromNext = localeFromPath(rawNext);
  if (fromNext) return fromNext;
  const fromCookie = request.cookies.get("NEXT_LOCALE")?.value ?? null;
  if (fromCookie && (routing.locales as readonly string[]).includes(fromCookie)) return fromCookie;
  return routing.defaultLocale;
}

/**
 * Route Handler: vuelta de Google y de los enlaces del correo.
 *
 * Admite las dos formas de enlace:
 *  - `?code=` (PKCE): Google, y las plantillas por defecto de Supabase
 *    (`{{ .ConfirmationURL }}`). Solo funciona en el MISMO navegador que pidió
 *    el correo, porque el `code_verifier` vive en una cookie.
 *  - `?token_hash=&type=`: las plantillas propias. Funciona en cualquier
 *    navegador, que es lo que hace falta para la recuperación de contraseña
 *    cuando el correo se abre en la app de Gmail.
 *
 * `next` se sanea (`resolveAuthNext`): solo rutas internas y nunca de vuelta al
 * login. Una recuperación va SIEMPRE a la pantalla de contraseña nueva.
 * Cualquier fallo vuelve a `/{locale}/login?error=<código>`, que el login
 * muestra con un texto propio.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const rawNext = searchParams.get("next");
  const locale = pickLocale(request, rawNext);
  const type = searchParams.get("type");

  const fail = (code: CallbackErrorCode) =>
    NextResponse.redirect(`${origin}/${locale}/login?error=${code}`);
  const done = () => {
    const next =
      type === "recovery" ? `/${locale}/reset-password` : resolveAuthNext(rawNext, locale);
    return NextResponse.redirect(`${origin}${next}`);
  };

  // Supabase devuelve aquí los errores del enlace (caducado, ya usado…).
  const providerError = getProviderErrorCode(
    searchParams.get("error_code"),
    searchParams.get("error")
  );
  if (providerError) return fail(providerError);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");

  if (tokenHash) {
    if (!isOtpType(type)) return fail("auth_callback_error");
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    return error ? fail(getCallbackErrorCode(error)) : done();
  }

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? fail(getCallbackErrorCode(error)) : done();
  }

  return fail("auth_callback_error");
}
