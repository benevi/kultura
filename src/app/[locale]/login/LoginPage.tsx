"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  callbackErrorKey,
  getAuthErrorKeyFromError,
  type AuthErrorKey,
  type AuthErrorLike,
} from "@/lib/utils/auth-errors";
import { resolveAuthNext, safeInternalPath } from "@/lib/utils/safe-redirect";
import { KButton } from "@/components/ui/KButton";
import { KInput } from "@/components/ui/KInput";
import { AvatarIconPicker } from "@/components/ui/AvatarIconPicker";
import { Logo } from "@/components/layout/Logo";
import { AuthShell } from "./AuthShell";
import { getSupabase } from "./supabase-lazy";
import { PasswordField } from "./PasswordField";
import { TermsCheckbox } from "./TermsCheckbox";
import { TERMS_VERSION } from "@/app/api/settings/identity";
import { chromeIntentUrl, detectInAppBrowser, type InAppBrowser } from "./in-app-browser";
import {
  attributionEntries,
  parseAttribution,
  toStoredAttribution,
  type AttributionParams,
} from "@/lib/analytics/attribution";
import { unsubscribeCurrentDevice } from "@/lib/push/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode = "login" | "register" | "reset";

/** Qué correo se acaba de enviar (pantalla "Revisa tu correo"). */
type SentKind = "signup" | "reset";

/**
 * Dónde se aparca el personaje elegido al registrarse hasta que hay sesión
 * (E-AVATAR-ICONS). La fila de `users` la crea un trigger de base de datos, y
 * el alta puede quedar pendiente de confirmar el correo, así que la elección
 * tiene que sobrevivir a ese hueco.
 */
const PENDING_AVATAR_ICON_KEY = "kultura:pending-avatar-icon";

/** Espera entre reenvíos: Supabase rechaza un segundo correo antes de 60 s. */
export const RESEND_COOLDOWN_SECONDS = 60;

interface FormState {
  email: string;
  password: string;
  error: string | null;
  errorKey: AuthErrorKey | null;
  fieldErrors: { email?: string; password?: string; terms?: string };
  loading: boolean;
}

const EMPTY_FORM: FormState = {
  email: "",
  password: "",
  error: null,
  errorKey: null,
  fieldErrors: {},
  loading: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidEmail(email: string): boolean {
  return email.includes("@") && email.includes(".");
}


/**
 * Origen al que Supabase debe devolver al usuario tras OAuth o el correo.
 *
 * Manda SIEMPRE el origen real del navegador: `NEXT_PUBLIC_SITE_URL` apunta al
 * dominio canónico de producción, así que tenerlo por delante hacía que un
 * login desde un preview de Vercel (o desde localhost) acabase autenticando en
 * producción — la sesión nunca volvía al despliegue en el que estabas probando.
 * El env var queda solo como red de seguridad para un render sin `window`.
 *
 * Recordatorio de configuración: cada origen desde el que se inicie sesión debe
 * estar en la allowlist de "Redirect URLs" de Supabase Auth (los previews de
 * Vercel admiten comodín).
 */
function authOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "";
}

/**
 * URL del callback con el destino final ya saneado. D-12: la atribución del
 * alta (`utm_*`, `ref`, `inv`) viaja también aquí, para Google y para el
 * enlace del correo, sin guardar nada en el navegador.
 */
function callbackUrl(next: string, attribution?: AttributionParams, flow?: "signup"): string {
  const params = new URLSearchParams({ next });
  if (attribution) for (const [key, value] of attributionEntries(attribution)) params.set(key, value);
  if (flow) params.set("flow", flow);
  return `${authOrigin()}/api/auth/callback?${params.toString()}`;
}

/** Tope de espera para registrar el alta antes de ir al onboarding. */
const SIGNUP_RECORD_TIMEOUT_MS = 3500;

/**
 * Alta inmediata (D-08): avisa al callback, con la sesión recién abierta, para
 * que guarde la atribución, registre `signup_completed` y aplique la
 * invitación. No cambia la navegación (sigue yendo a /welcome) y un fallo o
 * una espera larga nunca la frenan.
 */
async function recordImmediateSignup(next: string, attribution: AttributionParams): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      fetch(callbackUrl(next, attribution, "signup"), {
        credentials: "same-origin",
        redirect: "manual",
        keepalive: true,
      }),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, SIGNUP_RECORD_TIMEOUT_MS);
      }),
    ]);
  } catch {
    // Sin red o bloqueado: el alta ya está hecha; solo se pierde la medida.
  } finally {
    clearTimeout(timer);
  }
}

/** Onboarding (CRE-6) con el destino final como `next`. */
export function welcomeHref(locale: string, dest: string): string {
  return `/${locale}/welcome?next=${encodeURIComponent(dest)}`;
}

/** "9 de noviembre de 2026" / "November 9, 2026". */
function formatDay(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/** Ejecuta tras el primer pintado sin competir con él (REN-9). */
function afterPaint(fn: () => void): () => void {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    const id = window.requestIdleCallback(fn, { timeout: 1500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 0);
  return () => clearTimeout(id);
}

// Logo oficial de Google (multicolor) — marca de terceros, no forma parte
// del set de iconos propio de Kultura: se mantiene tal cual exige su guía
// de marca para botones "Continuar con Google".
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
      />
      <path
        fill="#FF3D00"
        d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
      />
      <path
        fill="#1976D2"
        d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
      />
    </svg>
  );
}

/** Enlace de texto del pie de la tarjeta: 44px de alto táctil (ACC-12). */
const FOOT_LINK =
  "inline-block py-3 font-body text-meta underline-offset-4 hover:underline";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LoginPageProps {
  locale: string;
}

export function LoginPage({ locale }: LoginPageProps) {
  const tAuth = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawMode = searchParams.get("mode");
  const mode: Mode =
    rawMode === "register" || rawMode === "reset" ? rawMode : "login";

  // Destino tras entrar: el `next` saneado, o el inicio (CRE-5).
  const rawNext = searchParams.get("next");
  const safeNext = safeInternalPath(rawNext, "");
  const dest = resolveAuthNext(rawNext, locale);
  // D-12: de dónde viene el alta (por la URL; nada en cookies ni almacenamiento).
  const attribution = useMemo(() => parseAttribution(searchParams), [searchParams]);

  // E-DEMO: `/api/auth/demo` vuelve aquí si la demo no está disponible; el
  // callback de auth, con su propio código de error (R1a). Antes el segundo
  // caso no se mostraba y el fallo era invisible.
  const errorParam = searchParams.get("error");
  const callbackKey = callbackErrorKey(errorParam);
  // ROJO-7: vuelta de Ajustes tras borrar la cuenta (o programar el borrado).
  const accountParam = searchParams.get("account");
  const purgeAt = searchParams.get("purge_at");
  const accountNotice =
    accountParam === "deletion_scheduled" && purgeAt && !Number.isNaN(Date.parse(purgeAt))
      ? tAuth("deletionScheduled", { date: formatDay(purgeAt, locale) })
      : accountParam === "deleted"
        ? tAuth("accountDeleted")
        : null;

  const initialError =
    errorParam === "demo_unavailable"
      ? tAuth("demoUnavailable")
      : callbackKey
        ? tErrors(callbackKey)
        : null;

  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM, error: initialError });
  const [sent, setSent] = useState<SentKind | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // ROJO-10: hasta hidratar, el botón no envía. Sin JS el formulario no hace
  // nada en vez de recargar la página con los datos en la URL.
  const [hydrated, setHydrated] = useState(false);
  const [inApp, setInApp] = useState<InAppBrowser | null>(null);
  const [intentHref, setIntentHref] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);

  // SEG-7: casilla obligatoria de edad y términos en el registro por email.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const sentHeadingRef = useRef<HTMLHeadingElement>(null);

  // E-AVATAR-ICONS: el personaje elegido al registrarse. Se guarda también en el
  // navegador porque el alta puede quedar pendiente de confirmar el correo y la
  // elección tendría que sobrevivir hasta el primer inicio de sesión.
  const [avatarIcon, setAvatarIcon] = useState<string | null>(null);

  function handleAvatarIconChange(icon: string | null) {
    setAvatarIcon(icon);
    try {
      if (icon) window.localStorage.setItem(PENDING_AVATAR_ICON_KEY, icon);
      else window.localStorage.removeItem(PENDING_AVATAR_ICON_KEY);
    } catch {
      // Modo privado o almacenamiento bloqueado: se pierde solo si además hay
      // confirmación por correo de por medio, y siempre queda Ajustes.
    }
  }

  useEffect(() => {
    setHydrated(true);
    const detected = detectInAppBrowser(window.navigator.userAgent);
    setInApp(detected);
    if (detected?.android) setIntentHref(chromeIntentUrl(window.location.href));
  }, []);

  // Sesión ya abierta y enlaces de recuperación antiguos, tras el primer
  // pintado (REN-9):
  //  - al entrar con sesión → al destino;
  //  - en `mode=reset` con sesión → a la pantalla de contraseña nueva. Es
  //    donde aterrizan los correos de recuperación enviados antes de existir
  //    esa pantalla (`next=/login?mode=reset`): con sesión abierta y sin forma
  //    de cambiar la contraseña (R1).
  //  - `PASSWORD_RECOVERY` (enlace en formato implícito) → misma pantalla.
  // En el registro no se redirige: se puede crear otra cuenta desde la demo.
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const cancelIdle = afterPaint(() => {
      void (async () => {
        const supabase = await getSupabase();
        if (cancelled) return;
        const { data: listener } = supabase.auth.onAuthStateChange((event) => {
          if (event === "PASSWORD_RECOVERY") router.replace(`/${locale}/reset-password`);
        });
        unsubscribe = () => listener.subscription.unsubscribe();
        if (mode === "register") return;
        const { data } = await supabase.auth.getSession();
        if (cancelled || !data.session) return;
        router.replace(mode === "reset" ? `/${locale}/reset-password` : dest);
      })();
    });
    return () => {
      cancelled = true;
      cancelIdle();
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Reset state when mode changes — solo cuando CAMBIA, no en el montaje: ahí
  // borraría el aviso de `initialError` (E-DEMO) antes de que se llegue a ver.
  // Se compara con el modo anterior y no con un "ya montado" porque el modo
  // estricto de React ejecuta los efectos dos veces al montar.
  const prevMode = useRef(mode);
  useEffect(() => {
    if (prevMode.current === mode) return;
    prevMode.current = mode;
    setForm(EMPTY_FORM);
    setSent(null);
    setResent(false);
  }, [mode]);

  // Cuenta atrás del reenvío.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Al pasar a "Revisa tu correo", el foco va al título para que el lector de
  // pantalla lo anuncie (ACC-3).
  useEffect(() => {
    if (sent) sentHeadingRef.current?.focus();
  }, [sent]);

  // -------------------------------------------------------------------------
  // Field helpers
  // -------------------------------------------------------------------------

  function setField(key: "email" | "password", value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function fail(error: AuthErrorLike | null) {
    const key = getAuthErrorKeyFromError(error);
    setForm((prev) => ({ ...prev, loading: false, error: tErrors(key), errorKey: key }));
  }

  function showSent(kind: SentKind) {
    setForm((prev) => ({ ...prev, loading: false, error: null, errorKey: null }));
    setResent(false);
    setSent(kind);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  function validate(): boolean {
    const fieldErrors: FormState["fieldErrors"] = {};

    if (!isValidEmail(form.email)) {
      fieldErrors.email = tErrors("invalidEmail");
    }

    if (mode !== "reset" && form.password.length < 8) {
      fieldErrors.password = tErrors("passwordTooShort");
    }

    if (mode === "register" && !termsAccepted) {
      fieldErrors.terms = tAuth("termsRequired");
    }

    setForm((prev) => ({ ...prev, fieldErrors, error: null, errorKey: null }));

    // ACC-3: el foco va al primer campo con error.
    if (fieldErrors.email) emailRef.current?.focus();
    else if (fieldErrors.password) passwordRef.current?.focus();
    else if (fieldErrors.terms) termsRef.current?.focus();

    return Object.keys(fieldErrors).length === 0;
  }

  // -------------------------------------------------------------------------
  // Submit handlers
  // -------------------------------------------------------------------------

  async function handleLogin() {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (error) return fail(error);

    await applyPendingAvatarIcon();
    router.replace(dest);
  }

  async function handleRegister() {
    const supabase = await getSupabase();
    // Sale de la demo (o de otra cuenta) antes de crear la nueva; F-33: sin
    // llevarse los avisos push de la cuenta anterior.
    await unsubscribeCurrentDevice();
    await supabase.auth.signOut();
    const { error, data } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        // R2: sin esto el enlace de confirmación volvía a la Site URL sin
        // canjear el código. El idioma viaja a los metadatos para que las
        // plantillas del correo salgan en el idioma del alta.
        emailRedirectTo: callbackUrl(dest, attribution),
        // El personaje también viaja aquí: si se confirma desde otro
        // navegador, el callback lo aplica (el `localStorage` no está allí).
        // SEG-7: la aceptación la convierte en `terms_accepted_at` el
        // disparador `handle_new_user` (con la hora del servidor).
        data: {
          locale,
          terms_accepted: true,
          terms_version: TERMS_VERSION,
          // D-12: canal del alta (utm, ref o direct), sin la firma `inv`.
          attribution: toStoredAttribution(attribution),
          ...(avatarIcon ? { avatar_icon: avatarIcon } : {}),
        },
      },
    });

    if (error) return fail(error);

    if (data.session) {
      // Confirmación desactivada (D-08): alta inmediata, y al onboarding
      // (CRE-6), que termina en el destino original.
      await applyPendingAvatarIcon();
      await recordImmediateSignup(dest, attribution);
      router.replace(welcomeHref(locale, dest));
    } else {
      showSent("signup");
    }
  }

  /**
   * Guarda el personaje elegido durante el registro (E-AVATAR-ICONS).
   *
   * La fila de `users` la crea un trigger de base de datos al dar de alta la
   * cuenta, así que el personaje no puede viajar en el propio `signUp`: se
   * escribe justo después, ya con sesión. Y como el alta puede exigir confirmar
   * el correo (sin sesión todavía), la elección queda aparcada en el navegador
   * y se aplica al primer inicio de sesión — si no, se perdería sin avisar.
   */
  async function applyPendingAvatarIcon() {
    let pending: string | null = null;
    try {
      pending = avatarIcon ?? window.localStorage.getItem(PENDING_AVATAR_ICON_KEY);
    } catch {
      pending = avatarIcon;
    }
    if (!pending) return;

    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_icon: pending }),
    }).catch(() => {
      // Un fallo aquí no puede impedir entrar: el personaje se cambia en Ajustes.
    });

    try {
      window.localStorage.removeItem(PENDING_AVATAR_ICON_KEY);
    } catch {
      // Modo privado o almacenamiento bloqueado: nada que limpiar.
    }
  }

  async function handleGoogleLogin() {
    setForm((prev) => ({ ...prev, loading: true, error: null, errorKey: null }));
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl(dest, attribution) },
    });

    // Éxito → el navegador redirige a Google, no hay nada más que hacer aquí.
    if (error) fail(error);
  }

  async function handleReset() {
    const supabase = await getSupabase();
    // R1: el enlace lleva a la pantalla de contraseña nueva, no de vuelta a
    // este formulario (que solo volvía a pedir el correo).
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: callbackUrl(`/${locale}/reset-password`),
    });

    if (error) return fail(error);
    showSent("reset");
  }

  /** Reenvía el último correo (confirmación o recuperación). */
  async function handleResend(kind: SentKind) {
    setResending(true);
    setResent(false);
    const supabase = await getSupabase();
    const { error } =
      kind === "signup"
        ? await supabase.auth.resend({
            type: "signup",
            email: form.email,
            options: { emailRedirectTo: callbackUrl(dest, attribution) },
          })
        : await supabase.auth.resetPasswordForEmail(form.email, {
            redirectTo: callbackUrl(`/${locale}/reset-password`),
          });
    setResending(false);

    if (error) return fail(error);
    if (sent) {
      setResent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } else {
      showSent(kind);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hydrated || !validate()) return;

    setForm((prev) => ({ ...prev, loading: true, error: null, errorKey: null }));

    if (mode === "login") await handleLogin();
    else if (mode === "register") await handleRegister();
    else await handleReset();
  }

  async function copyLink() {
    try {
      await window.navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  /** Enlace a otro modo conservando el destino (`next`). */
  function modeHref(nextMode: Mode): string {
    const params = new URLSearchParams();
    if (nextMode !== "login") params.set("mode", nextMode);
    if (safeNext) params.set("next", safeNext);
    for (const [key, value] of attributionEntries(attribution)) params.set(key, value);
    const query = params.toString();
    return query ? `/login?${query}` : "/login";
  }

  // -------------------------------------------------------------------------
  // Render: "Revisa tu correo"
  // -------------------------------------------------------------------------

  if (sent) {
    return (
      <AuthShell backLabel={tAuth("backHome")} cardClassName="text-center">
        <Logo size={32} className="justify-center" />
        <h1
          ref={sentHeadingRef}
          tabIndex={-1}
          className="mt-7 font-display text-xl font-extrabold text-text-primary outline-none"
        >
          {tAuth("checkEmail")}
        </h1>
        <div role="status" className="mt-3 flex flex-col gap-3">
          <p className="font-body text-sm text-text-secondary">
            {tAuth.rich(sent === "reset" ? "resetSentBody" : "checkEmailBody", {
              email: form.email,
              strong: (chunks) => (
                <strong className="break-all font-bold text-text-primary">{chunks}</strong>
              ),
            })}
          </p>
          <p className="font-body text-meta text-text-tertiary">{tAuth("checkSpam")}</p>
          {resent && (
            <p className="font-body text-meta font-bold text-text-secondary">{tAuth("resent")}</p>
          )}
        </div>

        {form.error && (
          <p
            role="alert"
            className="mt-4 rounded-2xl bg-accent-danger/10 px-[18px] py-3 text-left font-body text-sm text-accent-danger"
          >
            {form.error}
          </p>
        )}

        <KButton
          type="button"
          variant="secondary"
          size="lg"
          className="mt-6 w-full"
          onClick={() => handleResend(sent)}
          loading={resending}
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? tAuth("resendIn", { seconds: cooldown }) : tAuth("resend")}
        </KButton>

        <button
          type="button"
          onClick={() => {
            setSent(null);
            setForm((prev) => ({ ...prev, password: "", error: null, errorKey: null }));
          }}
          className={`${FOOT_LINK} mt-2 text-text-tertiary hover:text-text-primary`}
        >
          {tAuth("useAnotherEmail")}
        </button>
      </AuthShell>
    );
  }

  // -------------------------------------------------------------------------
  // Render: main form
  // -------------------------------------------------------------------------

  // El encabezado visible del artboard se quitó a petición del usuario
  // (08/10/2026): la tarjeta va del logo a los campos. Se conserva SOLO para
  // lectores de pantalla, porque la página necesita un <h1> que diga qué es.
  const heading =
    mode === "login"
      ? tAuth("welcomeBack")
      : mode === "register"
        ? tAuth("createAccount")
        : tAuth("resetPassword");

  return (
    <AuthShell backLabel={tAuth("backHome")}>
      {/* Logo de marca centrado, encima de los campos (F0 §Logo), con una
          línea de valor debajo (CRE-5 / DIS-13). */}
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Logo size={32} />
        <p className="font-body text-sm text-text-secondary">
          {mode === "reset" ? tAuth("resetIntro") : tAuth("valueLine")}
        </p>
      </div>

      <h1 className="sr-only">{heading}</h1>

      {accountNotice && (
        <p
          role="status"
          className="mb-5 rounded-2xl bg-surface-elevated px-[18px] py-3 font-body text-sm text-text-secondary"
        >
          {accountNotice}
        </p>
      )}

      {/* MOV-11: Google no deja entrar desde el navegador integrado de las
          apps sociales. Se avisa ANTES de que el botón lleve a un error. */}
      {mode !== "reset" && inApp && (
        <div
          role="note"
          className="mb-5 rounded-2xl bg-surface-elevated px-[18px] py-3 font-body text-sm text-text-secondary"
        >
          <p className="font-bold text-text-primary">{tAuth("inAppTitle")}</p>
          <p className="mt-1">{tAuth("inAppBody")}</p>
          <div className="flex flex-wrap gap-x-5">
            {inApp.android && intentHref && (
              <a href={intentHref} className={`${FOOT_LINK} font-bold text-accent-pink`}>
                {tAuth("inAppOpenChrome")}
              </a>
            )}
            <button
              type="button"
              onClick={copyLink}
              className={`${FOOT_LINK} font-bold text-accent-pink`}
            >
              <span aria-live="polite">{copied ? tAuth("inAppCopied") : tAuth("inAppCopy")}</span>
            </button>
          </div>
        </div>
      )}

      {/* Google OAuth arriba (oculto en reset — solo aplica a login/registro).
          El canvas no dibuja este botón, así que se usa el primitivo que sí
          existe: pill secundario (borde 2px, peso 700) de F0. */}
      {mode !== "reset" && (
        <>
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={form.loading || !hydrated}
            className="flex w-full items-center justify-center gap-2 rounded-pill border-2 border-surface-border py-[13px] font-body text-sm font-bold text-text-secondary transition-colors duration-base ease-standard hover:bg-surface-elevated hover:text-text-primary disabled:opacity-50"
          >
            <GoogleIcon className="h-4 w-4 shrink-0" />
            {tAuth("continueWithGoogle")}
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-surface-border" />
            <span className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary">
              {tAuth("or")}
            </span>
            <div className="h-px flex-1 bg-surface-border" />
          </div>
        </>
      )}

      {/* Form — gap 18px entre campos, literal del mockup. `method="post"`:
          si algo enviase el formulario sin JS, los datos no irían en la URL. */}
      <form
        onSubmit={handleSubmit}
        noValidate
        method="post"
        className="flex flex-col gap-[18px]"
      >
        <KInput
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          label={tAuth("email")}
          value={form.email}
          onChange={(e) => setField("email", e.target.value)}
          error={form.fieldErrors.email}
          aria-required="true"
          aria-invalid={form.fieldErrors.email ? true : undefined}
          placeholder="tucorreo@ejemplo.com"
        />

        {mode !== "reset" && (
          <PasswordField
            ref={passwordRef}
            id="password"
            name="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            label={tAuth("password")}
            value={form.password}
            onChange={(e) => setField("password", e.target.value)}
            error={form.fieldErrors.password}
            hint={mode === "register" ? tAuth("passwordHint") : undefined}
            aria-required="true"
            aria-invalid={form.fieldErrors.password ? true : undefined}
            placeholder="••••••••"
            showText={tAuth("showPassword")}
            hideText={tAuth("hidePassword")}
            showLabel={tAuth("showPasswordLabel")}
            hideLabel={tAuth("hidePasswordLabel")}
          />
        )}

        {/* Personaje del avatar (E-AVATAR-ICONS) — opcional: quien no elija
            se queda con sus iniciales, igual que las cuentas de siempre. */}
        {mode === "register" && (
          <div className="flex flex-col gap-2">
            <span className="font-body text-meta font-bold text-text-tertiary">
              {tAuth("chooseCharacter")}
            </span>
            <AvatarIconPicker
              value={avatarIcon}
              onChange={handleAvatarIconChange}
              label={tAuth("chooseCharacter")}
              noneLabel={tAuth("chooseCharacterNone")}
            />
          </div>
        )}

        {mode === "register" && (
          <TermsCheckbox
            ref={termsRef}
            id="terms"
            checked={termsAccepted}
            onChange={(checked) => {
              setTermsAccepted(checked);
              if (checked && form.fieldErrors.terms) {
                setForm((prev) => ({ ...prev, fieldErrors: { ...prev.fieldErrors, terms: undefined } }));
              }
            }}
            error={form.fieldErrors.terms}
          />
        )}

        {/* Error global — rojo semántico, radio de campo (14px) para que no
            parezca un chip. `role="alert"` para que se anuncie (ACC-3). */}
        {form.error && (
          <div
            role="alert"
            className="rounded-2xl bg-accent-danger/10 px-[18px] py-3 font-body text-sm text-accent-danger"
          >
            <p>{form.error}</p>
            {form.errorKey === "emailNotConfirmed" && (
              <button
                type="button"
                onClick={() => handleResend("signup")}
                disabled={resending}
                className="mt-1 inline-block py-2 font-bold underline underline-offset-4"
              >
                {tAuth("resendConfirmation")}
              </button>
            )}
          </div>
        )}

        {/* Submit — pink, que desde E-BOTON-PINK es el defecto del primario. */}
        <KButton
          type="submit"
          loading={form.loading}
          disabled={!hydrated}
          size="lg"
          className="mt-2 w-full"
        >
          {mode === "login"
            ? tAuth("signIn")
            : mode === "register"
              ? tAuth("signUp")
              : tAuth("sendResetLink")}
        </KButton>

      </form>

      {/* Enlace a contraseña olvidada (solo al entrar) */}
      {mode === "login" && (
        <div className="mt-3 text-center">
          <Link
            href={modeHref("reset")}
            className={`${FOOT_LINK} text-text-tertiary hover:text-text-primary`}
          >
            {tAuth("forgotPassword")}
          </Link>
        </div>
      )}

      {/* Cambio de modo al PIE, como el mockup ("¿No tienes cuenta?
          Regístrate"), como enlace de verdad (ROJO-10): se puede abrir en otra
          pestaña y funciona antes de hidratar. */}
      <p className="mt-2 text-center font-body text-meta text-text-tertiary">
        {mode === "reset" ? (
          <Link
            href={modeHref("login")}
            className={`${FOOT_LINK} font-bold text-accent-pink`}
          >
            {tAuth("backToSignIn")}
          </Link>
        ) : (
          <>
            {mode === "login" ? tAuth("dontHaveAccount") : tAuth("alreadyHaveAccount")}{" "}
            {/* Imperativo, no infinitivo: el artboard pone "Regístrate". */}
            <Link
              href={modeHref(mode === "login" ? "register" : "login")}
              className={`${FOOT_LINK} font-bold text-accent-pink`}
            >
              {mode === "login" ? tAuth("signUpAction") : tAuth("signInAction")}
            </Link>
          </>
        )}
      </p>
    </AuthShell>
  );
}
