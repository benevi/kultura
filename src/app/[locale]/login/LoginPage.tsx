"use client";

import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
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
import { AuthShell } from "./AuthShell";
import { getSupabase } from "./supabase-lazy";
import { PasswordField } from "./PasswordField";
import { TermsCheckbox } from "./TermsCheckbox";
import { TERMS_VERSION } from "@/app/api/settings/identity";
import { chromeIntentUrl, detectInAppBrowser, type InAppBrowser } from "./in-app-browser";
import { referrerReturnPath } from "./return-path";
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
 * Personaje elegido en el registro ANTIGUO, aparcado en el navegador hasta la
 * primera sesión (E-AVATAR-ICONS). El registro ya no lo pide (correo,
 * contraseña y la casilla de edad y términos; el personaje se elige en
 * Ajustes), pero una elección hecha antes de confirmar el correo se sigue
 * aplicando al entrar.
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

/** Enlace de texto de la etiqueta: 44 px de alto táctil (ACC-12), en tinta. */
const TEXT_LINK =
  "inline-flex min-h-11 items-center rounded-lg font-body text-meta font-bold text-text-primary underline decoration-2 " +
  "underline-offset-4 hover:decoration-accent-pink " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

/** Aviso dentro de la etiqueta (estado, error): caja de papel con raya de 2 px. */
const NOTICE = "rounded-2xl border-2 px-4 py-3 font-body text-sm";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LoginPageProps {
  locale: string;
  /**
   * El sobre con los cromos (lo pinta el servidor y llega por `<Suspense>`).
   * Decorativo: sin él, la página es la misma.
   */
  wall?: ReactNode;
  /**
   * Navegador integrado detectado en el servidor por el user agent: así el
   * HTML ya sale sin «Continuar con Google» en Instagram, TikTok, X…
   */
  inApp?: InAppBrowser | null;
}

export function LoginPage({ locale, wall, inApp: serverInApp = null }: LoginPageProps) {
  const tAuth = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawMode = searchParams.get("mode");
  const mode: Mode =
    rawMode === "register" || rawMode === "reset" ? rawMode : "login";

  // Destino tras entrar: el `next` saneado; sin él, la página de la que se
  // llegó (mismo origen, tras hidratar); y si no, el inicio (CRE-5).
  const nextParam = safeInternalPath(searchParams.get("next"), "");
  const [cameFrom, setCameFrom] = useState("");
  const cameFromRef = useRef("");
  const safeNext = nextParam || cameFrom;
  const dest = resolveAuthNext(safeNext, locale);
  // D-12: de dónde viene el alta (por la URL; nada en cookies ni almacenamiento).
  const attribution = useMemo(() => parseAttribution(searchParams), [searchParams]);

  // E-DEMO: `/api/auth/demo` vuelve aquí si la demo no está disponible; el
  // callback de auth, con su propio código de error (R1a).
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
  const [inApp, setInApp] = useState<InAppBrowser | null>(serverInApp);
  const [intentHref, setIntentHref] = useState<string | null>(null);
  const [copy, setCopy] = useState<"idle" | "copied" | "manual">("idle");
  const [pageHref, setPageHref] = useState("");

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);
  const manualRef = useRef<HTMLInputElement>(null);

  // SEG-7: casilla obligatoria de edad y términos en el registro por email.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const sentHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setHydrated(true);
    const detected = detectInAppBrowser(window.navigator.userAgent) ?? serverInApp;
    setInApp(detected);
    setPageHref(window.location.href);
    if (detected?.android) setIntentHref(chromeIntentUrl(window.location.href));
    if (!nextParam) {
      const back = referrerReturnPath(document.referrer, window.location.origin);
      cameFromRef.current = back;
      setCameFrom(back);
    }
    // Solo al montar: el user agent y la página de origen no cambian.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sesión ya abierta y enlaces de recuperación antiguos, tras el primer
  // pintado (REN-9):
  //  - al entrar con sesión → al destino;
  //  - en `mode=reset` con sesión → a la pantalla de contraseña nueva (R1);
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
        // El destino de AHORA: este efecto no ve el estado posterior al montaje.
        const now = resolveAuthNext(nextParam || cameFromRef.current, locale);
        router.replace(mode === "reset" ? `/${locale}/reset-password` : now);
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

  // Al pasar a "Revisa tu correo", el foco va al titular para que el lector
  // de pantalla lo anuncie (ACC-3).
  useEffect(() => {
    if (sent) sentHeadingRef.current?.focus();
  }, [sent]);

  useEffect(() => {
    if (copy === "manual") manualRef.current?.select();
  }, [copy]);

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
        // SEG-7: la aceptación la convierte en `terms_accepted_at` el
        // disparador `handle_new_user` (con la hora del servidor).
        data: {
          locale,
          terms_accepted: true,
          terms_version: TERMS_VERSION,
          // D-12: canal del alta (utm, ref o direct), sin la firma `inv`.
          attribution: toStoredAttribution(attribution),
        },
      },
    });

    if (error) return fail(error);

    if (data.session) {
      // Confirmación desactivada (D-08): alta inmediata, y al onboarding
      // (CRE-6), que termina en el destino original.
      await recordImmediateSignup(dest, attribution);
      router.replace(welcomeHref(locale, dest));
    } else {
      showSent("signup");
    }
  }

  /**
   * Aplica, ya con sesión, un personaje elegido en el registro antiguo y
   * aparcado en el navegador (E-AVATAR-ICONS). Un fallo nunca impide entrar.
   */
  async function applyPendingAvatarIcon() {
    let pending: string | null = null;
    try {
      pending = window.localStorage.getItem(PENDING_AVATAR_ICON_KEY);
    } catch {
      return;
    }
    if (!pending) return;

    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_icon: pending }),
    }).catch(() => {
      // El personaje se cambia en Ajustes.
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
    // R1: el enlace lleva a la pantalla de contraseña nueva.
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

  /**
   * Copia el enlace de esta página (con su `next`) para pegarlo en Safari o
   * Chrome. Algunos navegadores integrados no dejan escribir en el
   * portapapeles: entonces se enseña el enlace, seleccionado, para copiarlo a mano.
   */
  async function copyLink() {
    try {
      await window.navigator.clipboard.writeText(window.location.href);
      setCopy("copied");
    } catch {
      setCopy("manual");
    }
  }

  /** Enlace a otro modo conservando el destino (`next`) y la atribución. */
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
      <AuthShell backLabel={tAuth("backHome")} title={tAuth("checkEmail")} titleRef={sentHeadingRef} aside={wall}>
        <div role="status" className="flex flex-col gap-3">
          <p className="font-body text-base text-text-primary">
            {tAuth.rich(sent === "reset" ? "resetSentBody" : "checkEmailBody", {
              email: form.email,
              strong: (chunks) => <strong className="break-all font-bold">{chunks}</strong>,
            })}
          </p>
          <p className="font-body text-sm text-text-secondary">{tAuth("checkSpam")}</p>
          {resent ? <p className="font-body text-sm font-bold text-text-primary">{tAuth("resent")}</p> : null}
        </div>

        {form.error ? (
          <p role="alert" className={`${NOTICE} mt-4 border-accent-danger text-accent-danger`}>
            {form.error}
          </p>
        ) : null}

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
          className={`${TEXT_LINK} mt-2`}
        >
          {tAuth("useAnotherEmail")}
        </button>
      </AuthShell>
    );
  }

  // -------------------------------------------------------------------------
  // Render: main form
  // -------------------------------------------------------------------------

  const title =
    mode === "login" ? tAuth("loginTitle") : mode === "register" ? tAuth("registerTitle") : tAuth("resetPassword");
  const showGoogle = mode !== "reset" && !inApp;

  return (
    <AuthShell
      backLabel={tAuth("backHome")}
      title={title}
      lead={mode === "reset" ? tAuth("resetIntro") : tAuth("valueLine")}
      aside={wall}
    >
      {accountNotice ? (
        <p role="status" className={`${NOTICE} mb-5 border-text-primary text-text-primary`}>
          {accountNotice}
        </p>
      ) : null}

      {/* Google arriba, salvo en los navegadores integrados de las apps
          sociales (MOV-11): allí Google responde 403 disallowed_useragent,
          así que ni se pinta y va primero el correo. */}
      {showGoogle ? (
        <>
          <KButton
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleGoogleLogin}
            disabled={form.loading || !hydrated}
            className="w-full"
          >
            <GoogleIcon className="h-4 w-4 shrink-0" />
            {tAuth("continueWithGoogle")}
          </KButton>

          <div className="my-5 flex items-center gap-3" aria-hidden="true">
            <div className="h-0.5 flex-1 bg-surface-border" />
            <span className="font-body text-meta text-text-secondary">{tAuth("or")}</span>
            <div className="h-0.5 flex-1 bg-surface-border" />
          </div>
        </>
      ) : null}

      {/* `method="post"`: si algo enviase el formulario sin JS, los datos no
          irían en la URL. */}
      <form onSubmit={handleSubmit} noValidate method="post" className="flex flex-col gap-[18px]">
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
          placeholder={tAuth("emailPlaceholder")}
        />

        {mode !== "reset" ? (
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
        ) : null}

        {mode === "register" ? (
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
        ) : null}

        {/* Error global: se anuncia (ACC-3). */}
        {form.error ? (
          <div role="alert" className={`${NOTICE} border-accent-danger text-accent-danger`}>
            <p>{form.error}</p>
            {form.errorKey === "emailNotConfirmed" ? (
              <button type="button" onClick={() => handleResend("signup")} disabled={resending} className={TEXT_LINK}>
                {tAuth("resendConfirmation")}
              </button>
            ) : null}
          </div>
        ) : null}

        {/* La única acción rosa de la pantalla; «gratis» va dentro del registro. */}
        <KButton type="submit" loading={form.loading} disabled={!hydrated} size="lg" className="mt-1 w-full">
          {mode === "login" ? tAuth("signIn") : mode === "register" ? tAuth("createAccount") : tAuth("sendResetLink")}
        </KButton>
      </form>

      {/* En el navegador de otra app: una línea para abrirlo fuera y entrar
          con Google, con el enlace de esta página (y su `next`) copiado. */}
      {mode !== "reset" && inApp ? (
        <div role="note" className="mt-5 border-t-2 border-surface-border pt-4">
          <p className="font-body text-sm text-text-primary">{tAuth("inAppHint")}</p>
          <div className="flex flex-wrap gap-x-5">
            <button type="button" onClick={copyLink} className={TEXT_LINK}>
              {tAuth("inAppCopy")}
            </button>
            {inApp.android && intentHref ? (
              <a href={intentHref} className={TEXT_LINK}>
                {tAuth("inAppOpenChrome")}
              </a>
            ) : null}
          </div>
          <p aria-live="polite" className="font-body text-meta text-text-secondary">
            {copy === "copied" ? tAuth("inAppCopied") : null}
          </p>
          {copy === "manual" ? (
            <KInput
              ref={manualRef}
              id="page-link"
              label={tAuth("inAppCopyManual")}
              value={pageHref}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
            />
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col items-start border-t-2 border-surface-border pt-2">
        {mode === "login" ? (
          <Link href={modeHref("reset")} className={TEXT_LINK}>
            {tAuth("forgotPassword")}
          </Link>
        ) : null}
        {/* Cambio de modo como enlace de verdad (ROJO-10): funciona antes de
            hidratar y se puede abrir en otra pestaña. */}
        {mode === "reset" ? (
          <Link href={modeHref("login")} className={TEXT_LINK}>
            {tAuth("backToSignIn")}
          </Link>
        ) : (
          <p className="font-body text-meta text-text-secondary">
            {mode === "login" ? tAuth("dontHaveAccount") : tAuth("alreadyHaveAccount")}{" "}
            <Link href={modeHref(mode === "login" ? "register" : "login")} className={TEXT_LINK}>
              {mode === "login" ? tAuth("createAccount") : tAuth("signIn")}
            </Link>
          </p>
        )}
      </div>
    </AuthShell>
  );
}

