/**
 * Mapea errores de Supabase Auth a claves de i18n del namespace `errors`.
 *
 * Supabase Auth devuelve mensajes en inglés hard-coded y, en las versiones
 * recientes, un `code` estable. Se mira primero el código y, si no se conoce,
 * el texto.
 *
 * Uso en componentes:
 *   const t = useTranslations("errors");
 *   const key = getAuthErrorKeyFromError(error);
 *   return <p>{t(key)}</p>
 */

export type AuthErrorKey =
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "userAlreadyExists"
  | "passwordTooShort"
  | "tooManyRequests"
  | "invalidEmail"
  | "emailNotAuthorized"
  | "emailRateLimit"
  | "samePassword"
  | "weakPassword"
  | "signupDisabled"
  | "sessionExpired"
  | "somethingWentWrong";

/** Lo mínimo que se lee de un `AuthError`. */
export interface AuthErrorLike {
  message?: string | null;
  code?: string | null;
}

/** Códigos de error de Supabase Auth (docs: "Error codes"). */
const CODE_TO_KEY: Record<string, AuthErrorKey> = {
  invalid_credentials: "invalidCredentials",
  email_not_confirmed: "emailNotConfirmed",
  user_already_exists: "userAlreadyExists",
  email_exists: "userAlreadyExists",
  weak_password: "weakPassword",
  same_password: "samePassword",
  over_request_rate_limit: "tooManyRequests",
  over_email_send_rate_limit: "emailRateLimit",
  email_address_not_authorized: "emailNotAuthorized",
  email_address_invalid: "invalidEmail",
  signup_disabled: "signupDisabled",
  email_provider_disabled: "signupDisabled",
  session_not_found: "sessionExpired",
  session_expired: "sessionExpired",
  refresh_token_not_found: "sessionExpired",
};

/**
 * Convierte un mensaje de error de Supabase Auth en una clave de i18n
 * del namespace "errors".
 */
export function getAuthErrorKey(message: string): AuthErrorKey {
  const lower = message.toLowerCase();

  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid email or password") ||
    lower.includes("wrong password")
  ) {
    return "invalidCredentials";
  }

  if (lower.includes("email not confirmed") || lower.includes("confirm your email")) {
    return "emailNotConfirmed";
  }

  // SMTP por defecto de Supabase: solo entrega a direcciones del equipo del
  // proyecto. Antes acababa en "Algo salió mal".
  if (lower.includes("not authorized") && lower.includes("email")) {
    return "emailNotAuthorized";
  }

  // Va antes del límite genérico: el texto también contiene "rate limit".
  if (lower.includes("email rate limit")) {
    return "emailRateLimit";
  }

  if (
    lower.includes("user already registered") ||
    lower.includes("already been registered") ||
    lower.includes("already exists")
  ) {
    return "userAlreadyExists";
  }

  if (lower.includes("should be different from the old password")) {
    return "samePassword";
  }

  if (lower.includes("password is known to be weak") || lower.includes("weak password")) {
    return "weakPassword";
  }

  if (lower.includes("password should be at least") || lower.includes("password is too short")) {
    return "passwordTooShort";
  }

  if (
    lower.includes("too many requests") ||
    lower.includes("for security purposes") ||
    lower.includes("rate limit")
  ) {
    return "tooManyRequests";
  }

  if (lower.includes("signups not allowed") || lower.includes("signup is disabled")) {
    return "signupDisabled";
  }

  if (lower.includes("auth session missing") || lower.includes("session not found")) {
    return "sessionExpired";
  }

  if (lower.includes("invalid email") || lower.includes("unable to validate email")) {
    return "invalidEmail";
  }

  return "somethingWentWrong";
}

/** Igual que `getAuthErrorKey`, pero con el `AuthError` entero (usa `code`). */
export function getAuthErrorKeyFromError(error: AuthErrorLike | null | undefined): AuthErrorKey {
  if (!error) return "somethingWentWrong";
  const byCode = error.code ? CODE_TO_KEY[error.code] : undefined;
  if (byCode) return byCode;
  return getAuthErrorKey(error.message ?? "");
}

// ---------------------------------------------------------------------------
// Errores del callback (`/api/auth/callback` → `/{locale}/login?error=…`)
// ---------------------------------------------------------------------------

export type CallbackErrorCode =
  | "auth_callback_error"
  | "auth_link_other_browser"
  | "auth_link_expired";

const CALLBACK_ERROR_KEYS: Record<CallbackErrorCode, string> = {
  auth_callback_error: "authCallbackError",
  auth_link_other_browser: "authLinkOtherBrowser",
  auth_link_expired: "authLinkExpired",
};

/**
 * Clasifica un fallo al canjear el enlace del correo.
 *
 * Con PKCE el `code_verifier` vive en una cookie del navegador que pidió el
 * correo: si el enlace se abre en otro (el navegador interno de Gmail en el
 * móvil, por ejemplo), el canje falla siempre y hay que decirlo así.
 */
export function getCallbackErrorCode(error: AuthErrorLike | null | undefined): CallbackErrorCode {
  const code = error?.code ?? "";
  const lower = (error?.message ?? "").toLowerCase();
  if (code === "bad_code_verifier" || code === "flow_state_not_found" || lower.includes("code verifier")) {
    return "auth_link_other_browser";
  }
  if (
    code === "otp_expired" ||
    code === "flow_state_expired" ||
    lower.includes("expired") ||
    lower.includes("already been used")
  ) {
    return "auth_link_expired";
  }
  return "auth_callback_error";
}

/**
 * Error que Supabase pone en la URL de vuelta (`?error=…&error_code=…`)
 * cuando ni siquiera llega a dar un código.
 */
export function getProviderErrorCode(
  errorCode: string | null | undefined,
  error: string | null | undefined
): CallbackErrorCode | null {
  if (!errorCode && !error) return null;
  if (errorCode === "otp_expired" || errorCode === "flow_state_expired") return "auth_link_expired";
  return "auth_callback_error";
}

/** Clave de `errors` para el `?error=` del login, o `null` si no es nuestro. */
export function callbackErrorKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return (CALLBACK_ERROR_KEYS as Record<string, string>)[raw] ?? null;
}
