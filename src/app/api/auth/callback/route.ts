import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { routing } from "@/i18n/routing";
import { isValidAvatarIcon } from "@/components/icons/avatars";
import { isDemoUser } from "@/lib/demo";
import { localeFromPath, resolveAuthNext } from "@/lib/utils/safe-redirect";
import { needsOnboarding } from "@/app/api/settings/account-state";
import {
  getCallbackErrorCode,
  getProviderErrorCode,
  type AuthErrorLike,
  type CallbackErrorCode,
} from "@/lib/utils/auth-errors";

/** Tipos de enlace del correo que se canjean aquí (el resto no los enviamos). */
const OTP_TYPES: readonly EmailOtpType[] = ["signup", "email", "recovery", "email_change"];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as readonly string[]).includes(value);
}

type ServerClient = ReturnType<typeof createClient>;

/**
 * Personaje elegido en el alta (E-AVATAR-ICONS). Con confirmación por correo
 * no hay sesión al registrarse, y si el enlace se abre en otro navegador la
 * elección aparcada en `localStorage` no está: por eso viaja también en los
 * metadatos del `signUp` y se aplica aquí, al primer canje. Solo si el perfil
 * aún no tiene personaje, y se borra de los metadatos para no reaplicarlo
 * después (p. ej. si el usuario lo quita en Ajustes). Un fallo nunca impide
 * entrar: el personaje se puede cambiar en Ajustes.
 */
async function applySignupAvatar(supabase: ServerClient): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    const icon = user?.user_metadata?.avatar_icon;
    if (!user || icon === undefined || icon === null) return;
    if (isValidAvatarIcon(icon) && !isDemoUser(user)) {
      await supabase
        .from("users")
        .update({ avatar_icon: icon })
        .eq("id", user.id)
        .is("avatar_icon", null);
    }
    await supabase.auth.updateUser({ data: { avatar_icon: null } });
  } catch {
    // Columna sin migrar, red… nada que enseñar.
  }
}

/**
 * ¿Cuenta sin onboarding? (F-12). Cualquier fallo → no: entrar nunca depende
 * de esto, y el onboarding se puede saltar.
 */
async function shouldWelcome(supabase: ServerClient): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user ? await needsOnboarding(supabase, data.user) : false;
  } catch {
    return false;
  }
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
 *
 * Con "Secure email change" el PRIMER enlace (de las dos direcciones) vuelve
 * con `?message=Confirmation link accepted…` y sin código: no es un error,
 * se va al destino (Ajustes ya explica que falta confirmar la otra).
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
  const done = async (supabase?: ServerClient) => {
    let welcome = false;
    if (supabase && type !== "recovery" && type !== "email_change") {
      await applySignupAvatar(supabase);
      welcome = await shouldWelcome(supabase);
    }
    const next =
      type === "recovery" ? `/${locale}/reset-password` : resolveAuthNext(rawNext, locale);
    // CRE-6: las cuentas nuevas (correo confirmado o primera vez con Google)
    // pasan por el onboarding, que termina en el destino original.
    const target =
      welcome && !next.startsWith(`/${locale}/welcome`)
        ? `/${locale}/welcome?next=${encodeURIComponent(next)}`
        : next;
    return NextResponse.redirect(`${origin}${target}`);
  };

  // Supabase devuelve aquí los errores del enlace (caducado, ya usado…).
  const providerError = getProviderErrorCode(
    searchParams.get("error_code"),
    searchParams.get("error")
  );
  if (providerError) return fail(providerError);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");

  if (!code && !tokenHash && searchParams.get("message")) return done();

  if (tokenHash) {
    if (!isOtpType(type)) return fail("auth_callback_error");
    const supabase = createClient();
    const { error } = await supabase.auth
      .verifyOtp({ type, token_hash: tokenHash })
      .catch((e: unknown) => ({ error: e as AuthErrorLike }));
    return error ? fail(getCallbackErrorCode(error)) : done(supabase);
  }

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth
      .exchangeCodeForSession(code)
      .catch((e: unknown) => ({ error: e as AuthErrorLike }));
    return error ? fail(getCallbackErrorCode(error)) : done(supabase);
  }

  return fail("auth_callback_error");
}
