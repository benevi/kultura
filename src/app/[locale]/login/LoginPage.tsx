"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorKey } from "@/lib/utils/auth-errors";
import { KButton } from "@/components/ui/KButton";
import { KInput } from "@/components/ui/KInput";
import { AvatarIconPicker } from "@/components/ui/AvatarIconPicker";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/utils/index";

/**
 * La tarjeta de auth, literal del artboard Login del canvas "Kultura — Diseño
 * completo": `--surface` sólido, radio 32px, padding 44px y la SOMBRA DURA
 * `10px 10px 0 var(--surface-2)` — la misma de las hero cards de F0.
 *
 * Antes llevaba un gradiente radial purple y un borde. Ninguna de las dos cosas
 * está en el mockup: el acento radial es de las cards "feature" del bento, y la
 * separación aquí la da la sombra dura, no un `border`.
 */
const AUTH_CARD =
  "w-full max-w-[440px] rounded-bento-xl bg-surface-default p-7 md:p-11 " +
  "shadow-[10px_10px_0_var(--surface-elevated)]";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode = "login" | "register" | "reset";

/**
 * Dónde se aparca el personaje elegido al registrarse hasta que hay sesión
 * (E-AVATAR-ICONS). La fila de `users` la crea un trigger de base de datos, y
 * el alta puede quedar pendiente de confirmar el correo, así que la elección
 * tiene que sobrevivir a ese hueco.
 */
const PENDING_AVATAR_ICON_KEY = "kultura:pending-avatar-icon";

interface FormState {
  email: string;
  password: string;
  confirmPassword: string;
  error: string | null;
  fieldErrors: { email?: string; password?: string; confirmPassword?: string };
  loading: boolean;
  success: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidEmail(email: string): boolean {
  return email.includes("@") && email.includes(".");
}

/**
 * Origen al que Supabase debe devolver al usuario tras OAuth o el correo de
 * reseteo.
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
}

export function LoginPage({ locale }: LoginPageProps) {
  const tAuth = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawMode = searchParams.get("mode");
  const mode: Mode =
    rawMode === "register" || rawMode === "reset" ? rawMode : "login";
  // E-DEMO: `/api/auth/demo` vuelve aquí si la demo no está disponible (sin
  // configurar, o el límite por IP); se dice en vez de dejar al usuario en un
  // login en blanco sin saber por qué.
  const initialError =
    searchParams.get("error") === "demo_unavailable" ? tAuth("demoUnavailable") : null;

  const [form, setForm] = useState<FormState>({
    email: "",
    password: "",
    confirmPassword: "",
    error: initialError,
    fieldErrors: {},
    loading: false,
    success: false,
  });

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

  // Redirect if already authenticated (only in login mode — register/reset allow new accounts)
  useEffect(() => {
    if (mode !== "login") return;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.push("/home");
    });
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
    setForm({
      email: "",
      password: "",
      confirmPassword: "",
      error: null,
      fieldErrors: {},
      loading: false,
      success: false,
    });
  }, [mode]);

  // -------------------------------------------------------------------------
  // Field helpers
  // -------------------------------------------------------------------------

  function setField<K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  function validate(): boolean {
    const fieldErrors: FormState["fieldErrors"] = {};

    if (!isValidEmail(form.email)) {
      fieldErrors.email = tErrors("invalidEmail");
    }

    if (mode !== "reset") {
      if (form.password.length < 8) {
        fieldErrors.password = tErrors("passwordTooShort");
      }

      if (mode === "register" && form.password !== form.confirmPassword) {
        fieldErrors.confirmPassword = tErrors("passwordMismatch");
      }
    }

    setForm((prev) => ({ ...prev, fieldErrors, error: null }));
    return Object.keys(fieldErrors).length === 0;
  }

  // -------------------------------------------------------------------------
  // Submit handlers
  // -------------------------------------------------------------------------

  async function handleLogin() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (error) {
      const key = getAuthErrorKey(error.message);
      setForm((prev) => ({
        ...prev,
        loading: false,
        error: tErrors(key),
      }));
      return;
    }

    await applyPendingAvatarIcon();
    router.push("/home");
  }

  async function handleRegister() {
    const supabase = createClient();
    await supabase.auth.signOut();
    const { error, data } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (error) {
      const key = getAuthErrorKey(error.message);
      setForm((prev) => ({
        ...prev,
        loading: false,
        error: tErrors(key),
      }));
      return;
    }

    if (data.session) {
      await applyPendingAvatarIcon();
      router.push("/home");
    } else {
      // Email confirmation required
      setForm((prev) => ({ ...prev, loading: false, success: true }));
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
    setForm((prev) => ({ ...prev, loading: true, error: null }));
    const supabase = createClient();
    const origin = authOrigin();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/api/auth/callback?next=/${locale}/home`,
      },
    });

    // Éxito → el navegador redirige a Google, no hay nada más que hacer aquí.
    if (error) {
      const key = getAuthErrorKey(error.message);
      setForm((prev) => ({
        ...prev,
        loading: false,
        error: tErrors(key),
      }));
    }
  }

  async function handleReset() {
    const supabase = createClient();
    const origin = authOrigin();
    const callbackUrl = `${origin}/api/auth/callback?next=/${locale}/login?mode=reset`;

    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: callbackUrl,
    });

    if (error) {
      const key = getAuthErrorKey(error.message);
      setForm((prev) => ({
        ...prev,
        loading: false,
        error: tErrors(key),
      }));
      return;
    }

    setForm((prev) => ({ ...prev, loading: false, success: true }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setForm((prev) => ({ ...prev, loading: true, error: null }));

    if (mode === "login") await handleLogin();
    else if (mode === "register") await handleRegister();
    else await handleReset();
  }

  // -------------------------------------------------------------------------
  // Tab navigation
  // -------------------------------------------------------------------------

  function switchMode(nextMode: Mode) {
    router.push(`/login?mode=${nextMode}`);
  }

  // -------------------------------------------------------------------------
  // Render: success states
  // -------------------------------------------------------------------------

  if (form.success && (mode === "reset" || mode === "register")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-surface-base px-4 py-10">
        <div className={cn(AUTH_CARD, "text-center")}>
          <Logo size={32} className="justify-center" />
          <p className="mt-7 font-body text-sm text-text-tertiary">
            {mode === "reset" ? tAuth("resetLinkSent") : tAuth("checkEmail")}
          </p>
        </div>
      </main>
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface-base px-4 py-10">
      <div className={AUTH_CARD}>
        {/* Logo de marca centrado, encima de los campos (F0 §Logo). */}
        <div className="mb-8 flex justify-center">
          <Logo size={32} />
        </div>

        <h1 className="sr-only">{heading}</h1>

        {/* Google OAuth (oculto en reset — solo aplica a login/registro).
            El canvas no dibuja este botón, así que se usa el primitivo que sí
            existe: pill secundario (borde 2px, peso 700) de F0. */}
        {mode !== "reset" && (
          <>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={form.loading}
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

        {/* Form — gap 18px entre campos, literal del mockup. */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[18px]">
          <KInput
            id="email"
            type="email"
            autoComplete="email"
            label={tAuth("email")}
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            error={form.fieldErrors.email}
            placeholder="tucorreo@ejemplo.com"
          />

          {mode !== "reset" && (
            <KInput
              id="password"
              type="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              label={tAuth("password")}
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              error={form.fieldErrors.password}
              placeholder="••••••••"
            />
          )}

          {mode === "register" && (
            <KInput
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              label={tAuth("confirmPassword")}
              value={form.confirmPassword}
              onChange={(e) => setField("confirmPassword", e.target.value)}
              error={form.fieldErrors.confirmPassword}
              placeholder="••••••••"
            />
          )}

          {/* Personaje del avatar (E-AVATAR-ICONS) — opcional: quien no elija
              se queda con sus iniciales, igual que las cuentas de siempre. */}
          {mode === "register" && (
            <div className="flex flex-col gap-2">
              <span className="font-body text-[13px] font-bold text-text-tertiary">
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

          {/* Error global — rojo semántico, radio de campo (14px) para que no
              parezca un chip. */}
          {form.error && (
            <p className="rounded-[14px] bg-accent-danger/10 px-[18px] py-3 font-body text-sm text-accent-danger">
              {form.error}
            </p>
          )}

          {/* Submit — pink, que desde E-BOTON-PINK es el defecto del primario;
              ya no hace falta forzarlo aquí. */}
          <KButton
            type="submit"
            loading={form.loading}
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
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => switchMode("reset")}
              className="font-body text-[13px] text-text-tertiary underline-offset-4 hover:text-text-primary hover:underline"
            >
              {tAuth("forgotPassword")}
            </button>
          </div>
        )}

        {/* Cambio de modo al PIE, como el mockup ("¿No tienes cuenta?
            Regístrate"). Sustituye a las dos pestañas que había arriba: el
            artboard de Login no las tiene, y con el encabezado nuevo competían
            por el mismo sitio. */}
        <p className="mt-5 text-center font-body text-[13px] text-text-tertiary">
          {mode === "login" ? tAuth("dontHaveAccount") : tAuth("alreadyHaveAccount")}{" "}
          {/* Imperativo, no infinitivo: el artboard pone "Regístrate", y dentro de
              la frase "¿No tienes cuenta? Registrarse" chirría. Clave propia
              para no tocar `signUp`/`signIn`, que son etiquetas de botón en
              media app. */}
          <button
            type="button"
            onClick={() => switchMode(mode === "login" ? "register" : "login")}
            className="font-bold text-accent-pink underline-offset-4 hover:underline"
          >
            {mode === "login" ? tAuth("signUpAction") : tAuth("signInAction")}
          </button>
        </p>
      </div>
    </main>
  );
}
