"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorKey } from "@/lib/utils/auth-errors";
import { KButton } from "@/components/ui/KButton";
import { KInput } from "@/components/ui/KInput";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/utils/index";

// Misma "card feature grande" que la CTA final de Landing: superficie sólida
// + gradiente radial de acento en la esquina superior-izquierda (F0 §Cards
// feature grandes). Un solo acento decorativo (purple) para la tarjeta de
// auth, sin desenfoque.
const AUTH_CARD_BACKGROUND = {
  backgroundColor: "var(--surface-default)",
  backgroundImage:
    "radial-gradient(120% 100% at 20% 10%, rgba(155,107,255,0.3), transparent 55%)",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode = "login" | "register" | "reset";

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

  const [form, setForm] = useState<FormState>({
    email: "",
    password: "",
    confirmPassword: "",
    error: null,
    fieldErrors: {},
    loading: false,
    success: false,
  });

  // Redirect if already authenticated (only in login mode — register/reset allow new accounts)
  useEffect(() => {
    if (mode !== "login") return;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.push("/home");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Reset state when mode changes
  useEffect(() => {
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
      router.push("/home");
    } else {
      // Email confirmation required
      setForm((prev) => ({ ...prev, loading: false, success: true }));
    }
  }

  async function handleGoogleLogin() {
    setForm((prev) => ({ ...prev, loading: true, error: null }));
    const supabase = createClient();
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
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
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
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

  if (form.success && mode === "reset") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-surface-base px-4">
        <div
          className="w-full max-w-md rounded-bento-lg border border-surface-border p-8 text-center"
          style={AUTH_CARD_BACKGROUND}
        >
          <Logo size={32} className="justify-center" />
          <p className="mt-6 text-sm text-text-secondary">{tAuth("resetLinkSent")}</p>
        </div>
      </main>
    );
  }

  if (form.success && mode === "register") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-surface-base px-4">
        <div
          className="w-full max-w-md rounded-bento-lg border border-surface-border p-8 text-center"
          style={AUTH_CARD_BACKGROUND}
        >
          <Logo size={32} className="justify-center" />
          <p className="mt-6 text-sm text-text-secondary">{tAuth("checkEmail")}</p>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Render: main form
  // -------------------------------------------------------------------------

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface-base px-4 py-10">
      <div
        className="w-full max-w-sm overflow-hidden rounded-bento-lg border border-surface-border p-6 md:p-8"
        style={AUTH_CARD_BACKGROUND}
      >
        {/* Wordmark — mismo Logo de marca que el header autenticado, no un
            texto ad-hoc (F0 §Logo). */}
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={32} />
          <p className="mt-3 text-sm text-text-tertiary">
            {mode === "reset"
              ? tAuth("resetPassword")
              : tAuth("tagline")}
          </p>
        </div>

        {/* Tabs (hidden in reset mode) — chip pill sólido, mismo patrón que el
            radiogroup de tipo en Discover (F0 §Chips): activo = fondo de color
            vivo + texto on-color, inactivo = surface-elevated + borde. */}
        {mode !== "reset" && (
          <div role="tablist" className="mb-6 flex items-center gap-2">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => switchMode("login")}
              className={cn(
                "flex-1 rounded-full py-2.5 text-sm font-body font-bold border transition-all duration-base ease-standard active:scale-[0.98]",
                mode === "login"
                  ? "bg-accent-positive text-on-accent-positive border-accent-positive"
                  : "bg-surface-elevated text-text-secondary border-surface-border hover:text-text-primary hover:border-text-tertiary"
              )}
            >
              {tAuth("signIn")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              onClick={() => switchMode("register")}
              className={cn(
                "flex-1 rounded-full py-2.5 text-sm font-body font-bold border transition-all duration-base ease-standard active:scale-[0.98]",
                mode === "register"
                  ? "bg-accent-positive text-on-accent-positive border-accent-positive"
                  : "bg-surface-elevated text-text-secondary border-surface-border hover:text-text-primary hover:border-text-tertiary"
              )}
            >
              {tAuth("signUp")}
            </button>
          </div>
        )}

        {/* Google OAuth (oculto en reset — solo aplica a login/registro) */}
        {mode !== "reset" && (
          <>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={form.loading}
              className="flex w-full items-center justify-center gap-2 rounded-button border border-surface-border bg-surface-base py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-elevated disabled:opacity-50"
            >
              <GoogleIcon className="h-4 w-4 shrink-0" />
              {tAuth("continueWithGoogle")}
            </button>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-surface-border" />
              <span className="text-xs uppercase tracking-wider text-text-tertiary">
                {tAuth("or")}
              </span>
              <div className="h-px flex-1 bg-surface-border" />
            </div>
          </>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Email */}
          <KInput
            id="email"
            type="email"
            autoComplete="email"
            label={tAuth("email")}
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            error={form.fieldErrors.email}
            placeholder="you@example.com"
          />

          {/* Password (hidden in reset mode) */}
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

          {/* Confirm Password (register only) */}
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

          {/* Global auth error — semantic danger red */}
          {form.error && (
            <p className="rounded-button bg-accent-danger/10 px-3 py-2 text-sm text-accent-danger">
              {form.error}
            </p>
          )}

          {/* Submit */}
          <KButton
            type="submit"
            loading={form.loading}
            className="w-full"
          >
            {mode === "login"
              ? tAuth("signIn")
              : mode === "register"
                ? tAuth("signUp")
                : tAuth("sendResetLink")}
          </KButton>

          {/* Forgot password link (login mode only) */}
          {mode === "login" && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => switchMode("reset")}
                className="text-sm text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
              >
                {tAuth("forgotPassword")}
              </button>
            </div>
          )}

          {/* Back to login link (reset mode) */}
          {mode === "reset" && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-sm text-text-tertiary underline-offset-4 hover:text-text-primary hover:underline"
              >
                {tAuth("alreadyHaveAccount")} {tAuth("signIn")}
              </button>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
