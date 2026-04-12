"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorKey } from "@/lib/utils/auth-errors";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/index";

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

  // Redirect if already authenticated
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.push("/home");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function handleReset() {
    const supabase = createClient();
    const callbackUrl = `${window.location.origin}/api/auth/callback?next=/${locale}/login?mode=reset`;

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
      <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center">
          <h1 className="font-display text-5xl tracking-widest text-accent">
            KULTURA
          </h1>
          <p className="mt-6 text-text">{tAuth("resetLinkSent")}</p>
        </div>
      </main>
    );
  }

  if (form.success && mode === "register") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center">
          <h1 className="font-display text-5xl tracking-widest text-accent">
            KULTURA
          </h1>
          <p className="mt-6 text-text">{tAuth("checkEmail")}</p>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Render: main form
  // -------------------------------------------------------------------------

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-5xl tracking-widest text-accent">
            KULTURA
          </h1>
          <p className="mt-2 text-sm text-muted">
            {mode === "reset"
              ? tAuth("resetPassword")
              : "Descubre tu cultura"}
          </p>
        </div>

        {/* Tabs (hidden in reset mode) */}
        {mode !== "reset" && (
          <div className="mb-6 flex gap-0 rounded-lg border border-border p-1">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={cn(
                "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
                mode === "login"
                  ? "bg-accent text-white"
                  : "text-muted hover:text-text"
              )}
            >
              {tAuth("signIn")}
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={cn(
                "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
                mode === "register"
                  ? "bg-accent text-white"
                  : "text-muted hover:text-text"
              )}
            >
              {tAuth("signUp")}
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-text"
            >
              {tAuth("email")}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              className={cn(
                "w-full rounded-md border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent",
                form.fieldErrors.email ? "border-red-500" : "border-border"
              )}
              placeholder="you@example.com"
            />
            {form.fieldErrors.email && (
              <p className="mt-1 text-xs text-red-500">
                {form.fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password (hidden in reset mode) */}
          {mode !== "reset" && (
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-text"
              >
                {tAuth("password")}
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                className={cn(
                  "w-full rounded-md border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent",
                  form.fieldErrors.password ? "border-red-500" : "border-border"
                )}
                placeholder="••••••••"
              />
              {form.fieldErrors.password && (
                <p className="mt-1 text-xs text-red-500">
                  {form.fieldErrors.password}
                </p>
              )}
            </div>
          )}

          {/* Confirm Password (register only) */}
          {mode === "register" && (
            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1 block text-sm font-medium text-text"
              >
                {tAuth("confirmPassword")}
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => setField("confirmPassword", e.target.value)}
                className={cn(
                  "w-full rounded-md border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent",
                  form.fieldErrors.confirmPassword
                    ? "border-red-500"
                    : "border-border"
                )}
                placeholder="••••••••"
              />
              {form.fieldErrors.confirmPassword && (
                <p className="mt-1 text-xs text-red-500">
                  {form.fieldErrors.confirmPassword}
                </p>
              )}
            </div>
          )}

          {/* Global error */}
          {form.error && (
            <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {form.error}
            </p>
          )}

          {/* Submit */}
          <Button
            type="submit"
            loading={form.loading}
            className="w-full"
          >
            {mode === "login"
              ? tAuth("signIn")
              : mode === "register"
                ? tAuth("signUp")
                : tAuth("sendResetLink")}
          </Button>

          {/* Forgot password link (login mode only) */}
          {mode === "login" && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => switchMode("reset")}
                className="text-sm text-muted underline-offset-4 hover:text-text hover:underline"
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
                className="text-sm text-muted underline-offset-4 hover:text-text hover:underline"
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
