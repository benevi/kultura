/**
 * Mapea mensajes de error de Supabase Auth a claves de i18n.
 *
 * Supabase Auth devuelve mensajes en inglés hard-coded.
 * Este helper los traduce a claves tipadas que next-intl puede resolver.
 *
 * Uso en componentes:
 *   const t = useTranslations("errors");
 *   const key = getAuthErrorKey(error);
 *   return <p>{t(key)}</p>
 */

type AuthErrorKey =
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "userAlreadyExists"
  | "passwordTooShort"
  | "tooManyRequests"
  | "invalidEmail"
  | "somethingWentWrong";

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

  if (
    lower.includes("user already registered") ||
    lower.includes("already been registered") ||
    lower.includes("already exists")
  ) {
    return "userAlreadyExists";
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

  if (lower.includes("invalid email") || lower.includes("unable to validate email")) {
    return "invalidEmail";
  }

  return "somethingWentWrong";
}
