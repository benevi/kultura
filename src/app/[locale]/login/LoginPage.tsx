"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { KButton } from "@/components/ui/KButton";
import { KInput } from "@/components/ui/KInput";
import { AvatarIconPicker } from "@/components/ui/AvatarIconPicker";
import { Logo } from "@/components/layout/Logo";
import { useAuthFlow } from "@/hooks/useAuthFlow";
import { AuthShell } from "./AuthShell";
import { PasswordField } from "./PasswordField";
import { TermsCheckbox } from "./TermsCheckbox";

// La lógica vive en `src/hooks/useAuthFlow.ts` (rescate F0); se reexporta lo
// que ya importaban otros módulos y los tests.
export { RESEND_COOLDOWN_SECONDS, welcomeHref } from "@/hooks/useAuthFlow";

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
  const {
    mode,
    accountNotice,
    form,
    setField,
    sent,
    cooldown,
    resending,
    resent,
    hydrated,
    inApp,
    intentHref,
    copied,
    emailRef,
    passwordRef,
    termsRef,
    sentHeadingRef,
    termsAccepted,
    changeTerms,
    avatarIcon,
    handleAvatarIconChange,
    handleSubmit,
    handleGoogleLogin,
    handleResend,
    copyLink,
    modeHref,
    backToForm,
  } = useAuthFlow(locale);

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
          onClick={backToForm}
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
          placeholder={tAuth("emailPlaceholder")}
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
              iconLabel={(key) => tAuth(`characters.${key}`)}
            />
          </div>
        )}

        {mode === "register" && (
          <TermsCheckbox
            ref={termsRef}
            id="terms"
            checked={termsAccepted}
            onChange={changeTerms}
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
