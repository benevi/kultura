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
import type { LoginCover } from "@/lib/landing/login-covers";
import { CoverRow } from "./CoverRow";
import { startCoverRow, type CoverRowHandle } from "./cover-row-engine";
import { getSupabase } from "./supabase-lazy";
import { TERMS_VERSION } from "@/app/api/settings/identity";
import { chromeIntentUrl, detectInAppBrowser, type InAppBrowser } from "./in-app-browser";
import {
  attributionEntries,
  parseAttribution,
  toStoredAttribution,
  type AttributionParams,
} from "@/lib/analytics/attribution";
import { unsubscribeCurrentDevice } from "@/lib/push/client";
import "./login.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode = "login" | "register" | "reset";

/** Qué correo se acaba de enviar (pantalla "Revisa tu correo"). */
type SentKind = "signup" | "reset";

/**
 * Personaje aparcado por altas anteriores a /welcome (E-AVATAR-ICONS): el registro
 * ya no lo pide, pero quien se dio de alta antes y aún no ha entrado lo conserva.
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
  /** Error con el que se llega a la página: va sobre el formulario y recibe el foco. */
  early: boolean;
}

const EMPTY_FORM: FormState = {
  email: "",
  password: "",
  error: null,
  errorKey: null,
  fieldErrors: {},
  loading: false,
  early: false,
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LoginPageProps {
  locale: string;
  /** Portadas de la fila. Sin ellas la pantalla sigue funcionando, sin fila. */
  covers?: LoginCover[];
}

const NO_COVERS: LoginCover[] = [];

export function LoginPage({ locale, covers = NO_COVERS }: LoginPageProps) {
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

  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM, error: initialError, early: !!initialError });
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
  const headingRef = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  // La fila: mostrar la contraseña o tener el foco en ella gira las portadas.
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const slotImageRef = useRef<HTMLImageElement>(null);
  const capTitleRef = useRef<HTMLSpanElement>(null);
  const capLabelRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CoverRowHandle | null>(null);

  useEffect(() => {
    if (!covers.length || !rowRef.current) return;
    const engine = startCoverRow({
      root: rootRef.current!,
      row: rowRef.current,
      slot: slotRef.current!,
      panel: panelRef.current!,
      slotImage: slotImageRef.current!,
      capTitle: capTitleRef.current!,
      capLabel: capLabelRef.current!,
      live: liveRef.current!,
      canvas: canvasRef.current!,
      covers,
    });
    engineRef.current = engine;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPaused(true);
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [covers]);

  function togglePause() {
    const next = !paused;
    setPaused(next);
    engineRef.current?.setPaused(next);
  }

  /** Final: la fila se lleva el formulario. Sin fila, o con movimiento reducido, no espera. */
  async function leaveRoom() {
    await engineRef.current?.leave(tAuth("signedIn"));
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
    setForm((prev) => ({ ...EMPTY_FORM, email: prev.email }));
    setSent(null);
    setResent(false);
    setShowPassword(false);
    document.documentElement.scrollTop = 0;
    headingRef.current?.focus({ preventScroll: true });
  }, [mode]);

  // Se llega con un error en la URL: se anuncia y recibe el foco.
  useEffect(() => {
    if (initialError) alertRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Credenciales incorrectas: el foco vuelve a la contraseña, ya seleccionada.
  useEffect(() => {
    if (form.errorKey !== "invalidCredentials") return;
    passwordRef.current?.focus();
    passwordRef.current?.select();
  }, [form.errorKey]);

  // Cuenta atrás del reenvío.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Al pasar a "Revisa tu correo", el foco va al título para que el lector de
  // pantalla lo anuncie (ACC-3).
  useEffect(() => {
    if (!sent) return;
    document.documentElement.scrollTop = 0;
    headingRef.current?.focus({ preventScroll: true });
  }, [sent]);

  // -------------------------------------------------------------------------
  // Field helpers
  // -------------------------------------------------------------------------

  function setField(key: "email" | "password", value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function fail(error: AuthErrorLike | null) {
    const key = getAuthErrorKeyFromError(error);
    setForm((prev) => ({ ...prev, loading: false, error: tErrors(key), errorKey: key, early: false }));
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

  function validate(email: string, password: string): boolean {
    const fieldErrors: FormState["fieldErrors"] = {};

    if (!isValidEmail(email)) {
      fieldErrors.email = tErrors("invalidEmail");
    }

    if (mode !== "reset" && !password) {
      fieldErrors.password = tAuth("passwordRequired");
    } else if (mode !== "reset" && password.length < 8) {
      fieldErrors.password = tErrors("passwordTooShort");
    }

    if (mode === "register" && !termsAccepted) {
      fieldErrors.terms = tAuth("termsRequired");
    }

    setForm((prev) => ({ ...prev, email, password, fieldErrors, error: null, errorKey: null, early: false }));

    // ACC-3: el foco va al primer campo con error.
    if (fieldErrors.email) emailRef.current?.focus();
    else if (fieldErrors.password) passwordRef.current?.focus();
    else if (fieldErrors.terms) termsRef.current?.focus();

    return Object.keys(fieldErrors).length === 0;
  }

  // -------------------------------------------------------------------------
  // Submit handlers
  // -------------------------------------------------------------------------

  async function handleLogin(email: string, password: string) {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return fail(error);

    await applyPendingAvatarIcon();
    await leaveRoom();
    router.replace(dest);
  }

  async function handleRegister(email: string, password: string) {
    const supabase = await getSupabase();
    // Sale de la demo (o de otra cuenta) antes de crear la nueva; F-33: sin
    // llevarse los avisos push de la cuenta anterior.
    await unsubscribeCurrentDevice();
    await supabase.auth.signOut();
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
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

  /** Guarda el personaje aparcado por un alta anterior, ya con sesión. */
  async function applyPendingAvatarIcon() {
    let pending: string | null = null;
    try {
      pending = window.localStorage.getItem(PENDING_AVATAR_ICON_KEY);
    } catch {
      // Modo privado o almacenamiento bloqueado: no hay nada aparcado.
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

  async function handleReset(email: string) {
    const supabase = await getSupabase();
    // R1: el enlace lleva a la pantalla de contraseña nueva, no de vuelta a
    // este formulario (que solo volvía a pedir el correo).
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
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
    if (!hydrated || form.loading) return;

    // Los gestores de contraseñas no siempre avisan al rellenar: manda lo que hay en el formulario.
    const data = new FormData(e.currentTarget as HTMLFormElement);
    const email = String(data.get("email") ?? form.email);
    const password = String(data.get("password") ?? form.password);

    // Intro en el correo con la contraseña aún vacía: se pasa al siguiente campo sin reñir.
    if (mode !== "reset" && isValidEmail(email) && !password && document.activeElement === emailRef.current) {
      setField("email", email);
      passwordRef.current?.focus();
      return;
    }
    // Se envía como contraseña: con el campo en texto, el gestor podría no ofrecer guardarla.
    setShowPassword(false);

    if (!validate(email, password)) return;

    setForm((prev) => ({ ...prev, loading: true, error: null, errorKey: null, early: false }));

    if (mode === "login") await handleLogin(email, password);
    else if (mode === "register") await handleRegister(email, password);
    else await handleReset(email);
  }

  async function copyLink() {
    try {
      await window.navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopied(false);
      setCopyFailed(true);
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
  // Render
  // -------------------------------------------------------------------------

  const title = sent
    ? tAuth("checkEmail")
    : mode === "login"
      ? tAuth("enter")
      : mode === "register"
        ? tAuth("createAccount")
        : tAuth("recoverPassword");

  const otherMode: Mode = mode === "login" ? "register" : "login";
  const formatWord = (f: string) => function FormatWord(chunks: React.ReactNode) { return (
    <span className="kh-f" data-f={f}>
      {chunks}
    </span>
  ); };

  const errorBlock = form.error ? (
    <div className="kh-say is-bad" role="alert" tabIndex={-1} ref={alertRef}>
      <p id="login-alert">{form.error}</p>
      {form.errorKey === "emailNotConfirmed" && (
        <button type="button" className="kh-link" onClick={() => handleResend("signup")} disabled={resending}>
          {tAuth("resendConfirmation")}
        </button>
      )}
      {form.early && (errorParam === "auth_link_expired" || errorParam === "auth_link_other_browser") && (
        <div className="kh-acts">
          <Link href={modeHref("reset")} className="kh-link">
            {tAuth("requestNewLink")}
          </Link>
        </div>
      )}
      {form.errorKey === "invalidCredentials" && (
        <div className="kh-acts">
          <Link href={modeHref("reset")} className="kh-link">
            {tAuth("forgotPassword")}
          </Link>
          <Link href={modeHref("register")} className="kh-link">
            {tAuth("createAccount")}
          </Link>
        </div>
      )}
    </div>
  ) : null;

  const shut = !sent && mode !== "reset" && (showPassword || passwordFocus);

  return (
    <div ref={rootRef} className="kh" data-shut={shut ? "" : undefined}>
      <header>
        <Link href="/" aria-label={tAuth("backHome")} className="kh-brand kh-display">
          KULTURA
        </Link>
        {(mode !== "reset" || sent) && (
          <Link href={modeHref(otherMode)} className="kh-swap">
            {mode === "login" ? tAuth("createAccount") : tAuth("enter")}
          </Link>
        )}
      </header>

      {covers.length > 0 && <CoverRow ref={rowRef} canvasRef={canvasRef} covers={covers} />}

      <main id="main" tabIndex={-1} className="kh-stage">
        <div ref={slotRef} className="kh-slot">
          <div ref={panelRef} className="kh-panel" data-m={sent ? "sent" : mode}>
            <h1 ref={headingRef} tabIndex={-1} className="kh-title kh-display">
              {title}
            </h1>

            {sent ? (
              <div className="kh-body">
                <div role="status" className="kh-stack">
                  <div>
                    <p className="kh-lead" style={{ margin: 0 }}>
                      {tAuth(sent === "reset" ? "resetSentBody" : "checkEmailBody")}
                    </p>
                    <p className="kh-small">{tAuth("checkSpam")}</p>
                  </div>
                  {resent && <p className="kh-say">{tAuth("resent")}</p>}
                </div>
                <div className="kh-stack" style={{ marginTop: 18 }}>
                  {errorBlock}
                  <button
                    type="button"
                    className="kh-btn kh-alt"
                    style={{ margin: 0 }}
                    onClick={() => {
                      if (cooldown <= 0 && !resending) void handleResend(sent);
                    }}
                    aria-disabled={cooldown > 0 || resending ? true : undefined}
                  >
                    {cooldown > 0 ? tAuth("resendIn", { seconds: cooldown }) : tAuth("resend")}
                  </button>
                  <div className="kh-foot">
                    <button
                      type="button"
                      className="kh-link is-dim"
                      onClick={() => {
                        setSent(null);
                        setForm((prev) => ({ ...prev, password: "", error: null, errorKey: null }));
                      }}
                    >
                      {tAuth("useAnotherEmail")}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {mode === "reset" ? (
                  <p className="kh-lead">{tAuth("resetIntro")}</p>
                ) : accountNotice ? (
                  <p className="kh-say" role="status" style={{ marginTop: 16 }}>
                    {accountNotice}
                  </p>
                ) : (
                  <p className="kh-lead">
                    {tAuth.rich("valueLine", {
                      movie: formatWord("movie"),
                      tv: formatWord("tv"),
                      anime: formatWord("anime"),
                      manga: formatWord("manga"),
                      game: formatWord("game"),
                      book: formatWord("book"),
                      comic: formatWord("comic"),
                    })}
                  </p>
                )}

                <div className="kh-body">
                  {/* \`method="post"\`: si algo enviase el formulario sin JS, los datos no irían en la URL. */}
                  <form onSubmit={handleSubmit} noValidate method="post" className="kh-form">
                    {form.early && errorBlock}

                    {/* MOV-11: Google no deja entrar desde el navegador integrado de las
                        apps sociales. Se avisa ANTES de que el botón lleve a un error. */}
                    {mode !== "reset" && inApp && (
                      <div className="kh-say" role="note">
                        <p>{tAuth(inApp.android ? "inAppBodyAndroid" : "inAppBodyIos")}</p>
                        <div className="kh-acts">
                          {inApp.android && intentHref && (
                            <a href={intentHref} className="kh-link">
                              {tAuth("inAppOpenChrome")}
                            </a>
                          )}
                          <button type="button" onClick={copyLink} className="kh-link">
                            <span aria-live="polite">
                              {copied ? tAuth("inAppCopied") : copyFailed ? tAuth("inAppCopyFailed") : tAuth("inAppCopy")}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}

                    {mode !== "reset" && !inApp && (
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={!hydrated}
                        aria-busy={form.loading ? true : undefined}
                        className="kh-btn kh-alt"
                      >
                        <GoogleIcon />
                        {tAuth("continueWithGoogle")}
                      </button>
                    )}

                    <div className="kh-field">
                      <input
                        ref={emailRef}
                        id="email"
                        name="email"
                        type="email"
                        inputMode="email"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        enterKeyHint={mode === "reset" ? "send" : "next"}
                        placeholder=" "
                        value={form.email}
                        onChange={(e) => {
                          const value = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            email: value,
                            // El error se va solo cuando el dato ya es válido.
                            fieldErrors: isValidEmail(value) ? { ...prev.fieldErrors, email: undefined } : prev.fieldErrors,
                          }));
                        }}
                        aria-required="true"
                        aria-invalid={form.fieldErrors.email ? true : undefined}
                        aria-describedby={form.fieldErrors.email ? "email-error" : undefined}
                      />
                      <label htmlFor="email">{tAuth("email")}</label>
                      {form.fieldErrors.email && (
                        <p id="email-error" className="kh-note is-bad">
                          {form.fieldErrors.email}
                        </p>
                      )}
                    </div>

                    {mode !== "reset" && (
                      <div
                        className="kh-field kh-pw"
                        onFocus={() => setPasswordFocus(true)}
                        onBlur={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget)) setPasswordFocus(false);
                        }}
                      >
                        <input
                          ref={passwordRef}
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete={mode === "register" ? "new-password" : "current-password"}
                          autoCapitalize="none"
                          spellCheck={false}
                          enterKeyHint="go"
                          placeholder=" "
                          value={form.password}
                          onChange={(e) => {
                            const value = e.target.value;
                            setForm((prev) => ({
                              ...prev,
                              password: value,
                              fieldErrors: value.length >= 8 ? { ...prev.fieldErrors, password: undefined } : prev.fieldErrors,
                            }));
                          }}
                          aria-required="true"
                          aria-invalid={form.fieldErrors.password || form.errorKey === "invalidCredentials" ? true : undefined}
                          aria-describedby={
                            form.errorKey === "invalidCredentials"
                              ? "login-alert"
                              : form.fieldErrors.password || mode === "register"
                                ? "password-note"
                                : undefined
                          }
                        />
                        <label htmlFor="password">{tAuth("password")}</label>
                        <button
                          type="button"
                          className="kh-eye"
                          // Sin quitar el foco del campo: en el móvil cerraría el teclado.
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setShowPassword((v) => !v)}
                          aria-controls="password"
                          aria-pressed={showPassword}
                          aria-label={showPassword ? tAuth("hidePasswordLabel") : tAuth("showPasswordLabel")}
                        >
                          {showPassword ? tAuth("hidePassword") : tAuth("showPassword")}
                        </button>
                        {form.fieldErrors.password ? (
                          <p id="password-note" className="kh-note is-bad">
                            {form.fieldErrors.password}
                          </p>
                        ) : (
                          mode === "register" && (
                            <p id="password-note" className="kh-note">
                              {tAuth("passwordHint")}
                            </p>
                          )
                        )}
                      </div>
                    )}

                    {/* SEG-7: casilla obligatoria de edad y términos en el registro por correo. */}
                    {mode === "register" && (
                      <div>
                        <label htmlFor="terms" className="kh-terms">
                          <input
                            ref={termsRef}
                            id="terms"
                            name="terms"
                            type="checkbox"
                            checked={termsAccepted}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setTermsAccepted(checked);
                              if (checked && form.fieldErrors.terms) {
                                setForm((prev) => ({ ...prev, fieldErrors: { ...prev.fieldErrors, terms: undefined } }));
                              }
                            }}
                            aria-required="true"
                            aria-invalid={form.fieldErrors.terms ? true : undefined}
                            aria-describedby={form.fieldErrors.terms ? "terms-error" : undefined}
                          />
                          <span>
                            {tAuth.rich("termsLabel", {
                              terms: (chunks) => (
                                <Link href="/terms" target="_blank" rel="noopener">
                                  {chunks}
                                </Link>
                              ),
                              privacy: (chunks) => (
                                <Link href="/privacy" target="_blank" rel="noopener">
                                  {chunks}
                                </Link>
                              ),
                            })}
                          </span>
                        </label>
                        {form.fieldErrors.terms && (
                          <p id="terms-error" role="alert" className="kh-note is-bad" style={{ marginTop: 0 }}>
                            {form.fieldErrors.terms}
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!hydrated}
                      aria-busy={form.loading ? true : undefined}
                      className="kh-btn kh-go"
                    >
                      {form.loading
                        ? tAuth(mode === "login" ? "entering" : mode === "register" ? "creatingAccount" : "sending")
                        : mode === "login"
                          ? tAuth("enter")
                          : mode === "register"
                            ? tAuth("createAccount")
                            : tAuth("sendResetLink")}
                    </button>

                    {!form.early && errorBlock}
                  </form>

                  {mode === "login" && form.errorKey !== "invalidCredentials" && (
                    <div className="kh-foot">
                      <Link href={modeHref("reset")} className="kh-link is-dim">
                        {tAuth("forgotPassword")}
                      </Link>
                    </div>
                  )}
                  {mode === "reset" && (
                    <div className="kh-foot">
                      <Link href={modeHref("login")} className="kh-link is-dim">
                        {tAuth("backToSignIn")}
                      </Link>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="kh-slotback" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- la pone el motor al entrar */}
            <img ref={slotImageRef} alt="" />
          </div>
        </div>
      </main>

      {covers.length > 0 && (
        <>
          <div className="kh-cap">
            <p aria-hidden="true">
              <span ref={capTitleRef} style={{ color: "inherit", fontWeight: "inherit" }} />
              <span ref={capLabelRef} />
            </p>
            <button
              type="button"
              className="kh-pause"
              onClick={togglePause}
              aria-label={paused ? tAuth("resumeCovers") : tAuth("pauseCovers")}
            >
              {paused ? (
                <svg viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M3 1l10 6-10 6z" />
                </svg>
              ) : (
                <svg viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M2 1h3.5v12H2zM8.5 1H12v12H8.5z" />
                </svg>
              )}
            </button>
          </div>
          <p ref={liveRef} role="status" className="kh-sr" />
        </>
      )}
    </div>
  );
}
