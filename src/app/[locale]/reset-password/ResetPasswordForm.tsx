"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { KButton } from "@/components/ui/KButton";
import { Logo } from "@/components/layout/Logo";
import { isDemoUser } from "@/lib/demo";
import { getAuthErrorKeyFromError } from "@/lib/utils/auth-errors";
import { resolveAuthNext } from "@/lib/utils/safe-redirect";
import { AuthShell } from "../login/AuthShell";
import { getSupabase } from "../login/supabase-lazy";
import { PasswordField } from "../login/PasswordField";

type Status = "checking" | "ready" | "invalid" | "demo" | "done";


interface ResetPasswordFormProps {
  locale: string;
}

/**
 * Pantalla "Elige una contraseña nueva" (R1).
 *
 * Necesita una sesión: la deja el canje del enlace de recuperación en
 * `/api/auth/callback`, o es la del usuario que viene de Ajustes. También
 * escucha `PASSWORD_RECOVERY`, por si el enlace llega en formato implícito
 * (`#access_token=…`) y la sesión aparece después de montar.
 *
 * Sin sesión → "el enlace ya no sirve" con un botón para pedir otro.
 * La cuenta demo no puede cambiarla (la comparte todo el mundo).
 */
export function ResetPasswordForm({ locale }: ResetPasswordFormProps) {
  const tAuth = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const searchParams = useSearchParams();
  const dest = resolveAuthNext(searchParams.get("next"), locale);

  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; repeat?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");

  const passwordRef = useRef<HTMLInputElement>(null);
  const repeatRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const supabase = await getSupabase();
      if (cancelled) return;
      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
          setStatus((prev) =>
            prev === "done" ? prev : isDemoUser(session.user) ? "demo" : "ready"
          );
        }
      });
      unsubscribe = () => listener.subscription.unsubscribe();

      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const session = data.session;
      setEmail(session?.user?.email ?? "");
      setStatus((prev) => {
        if (prev !== "checking") return prev;
        if (!session) return "invalid";
        return isDemoUser(session.user) ? "demo" : "ready";
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (status === "done") doneRef.current?.focus();
  }, [status]);

  function validate(): boolean {
    const errors: typeof fieldErrors = {};
    if (password.length < 8) errors.password = tErrors("passwordTooShort");
    else if (password !== repeat) errors.repeat = tErrors("passwordMismatch");
    setFieldErrors(errors);
    setError(null);
    if (errors.password) passwordRef.current?.focus();
    else if (errors.repeat) repeatRef.current?.focus();
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status !== "ready" || !validate()) return;
    setSaving(true);

    const supabase = await getSupabase();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setSaving(false);
      const key = getAuthErrorKeyFromError(updateError);
      if (key === "sessionExpired") {
        setStatus("invalid");
        return;
      }
      setError(tErrors(key));
      return;
    }

    // Quien recupera una contraseña puede estar echando a alguien que la
    // conocía: se cierran las demás sesiones. Un fallo aquí no deshace el
    // cambio, así que no se enseña.
    await supabase.auth.signOut({ scope: "others" }).catch(() => undefined);

    setSaving(false);
    setPassword("");
    setRepeat("");
    setStatus("done");
  }

  return (
    <AuthShell backLabel={tAuth("backHome")}>
      <div className="flex justify-center">
        <Logo size={32} />
      </div>
      <h1 className="mt-7 text-center font-display text-xl font-extrabold text-text-primary">
        {tAuth("newPasswordTitle")}
      </h1>

      {status === "checking" && (
        <p role="status" className="mt-6 text-center font-body text-sm text-text-tertiary">
          {tAuth("checkingLink")}
        </p>
      )}

      {status === "invalid" && (
        <div className="mt-6 flex flex-col gap-5 text-center">
          <p role="alert" className="font-body text-sm text-text-secondary">
            {tAuth("resetLinkInvalid")}
          </p>
          <KButton size="lg" className="w-full" asChild>
            <Link href="/login?mode=reset">{tAuth("requestNewLink")}</Link>
          </KButton>
        </div>
      )}

      {status === "demo" && (
        <div className="mt-6 flex flex-col gap-5 text-center">
          <p role="alert" className="font-body text-sm text-text-secondary">
            {tAuth("demoNoPassword")}
          </p>
          <KButton size="lg" className="w-full" asChild>
            <Link href="/login?mode=register">{tAuth("createAccount")}</Link>
          </KButton>
        </div>
      )}

      {status === "done" && (
        <div className="mt-6 flex flex-col gap-5 text-center">
          <p
            ref={doneRef}
            tabIndex={-1}
            role="status"
            className="font-body text-sm text-text-secondary outline-none"
          >
            {tAuth("passwordUpdated")}
          </p>
          <KButton size="lg" className="w-full" onClick={() => router.replace(dest)}>
            {tAuth("continue")}
          </KButton>
        </div>
      )}

      {status === "ready" && (
        <form onSubmit={handleSubmit} noValidate method="post" className="mt-6 flex flex-col gap-[18px]">
          {/* Para que el gestor de contraseñas sepa a qué cuenta guardar la
              nueva: campo de usuario invisible con el email de la sesión. */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={email}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
          />
          <PasswordField
            ref={passwordRef}
            id="new-password"
            name="new-password"
            autoComplete="new-password"
            label={tAuth("newPassword")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            hint={tAuth("passwordHint")}
            aria-required="true"
            aria-invalid={fieldErrors.password ? true : undefined}
            showText={tAuth("showPassword")}
            hideText={tAuth("hidePassword")}
            showLabel={tAuth("showPasswordLabel")}
            hideLabel={tAuth("hidePasswordLabel")}
          />
          <PasswordField
            ref={repeatRef}
            id="repeat-password"
            name="repeat-password"
            autoComplete="new-password"
            label={tAuth("repeatPassword")}
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            error={fieldErrors.repeat}
            aria-required="true"
            aria-invalid={fieldErrors.repeat ? true : undefined}
            showText={tAuth("showPassword")}
            hideText={tAuth("hidePassword")}
            showLabel={tAuth("showPasswordLabel")}
            hideLabel={tAuth("hidePasswordLabel")}
          />

          {error && (
            <p
              role="alert"
              className="rounded-2xl bg-accent-danger/10 px-[18px] py-3 font-body text-sm text-accent-danger"
            >
              {error}
            </p>
          )}

          <KButton type="submit" size="lg" loading={saving} className="mt-2 w-full">
            {tAuth("savePassword")}
          </KButton>
        </form>
      )}
    </AuthShell>
  );
}
