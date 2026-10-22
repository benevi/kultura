/**
 * Mensajes de Supabase Auth → claves de `errors`, y errores del callback.
 */
import { describe, it, expect } from "vitest";
import {
  getAuthErrorKey,
  getAuthErrorKeyFromError,
  getCallbackErrorCode,
  callbackErrorKey,
} from "@/lib/utils/auth-errors";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";

describe("getAuthErrorKey — casos que antes acababan en 'Algo salió mal'", () => {
  it("SMTP por defecto: dirección fuera del equipo", () => {
    expect(getAuthErrorKey("Email address not authorized")).toBe("emailNotAuthorized");
  });

  it("límite de envío de correos", () => {
    expect(getAuthErrorKey("email rate limit exceeded")).toBe("emailRateLimit");
  });

  it("misma contraseña y contraseña débil", () => {
    expect(getAuthErrorKey("New password should be different from the old password.")).toBe(
      "samePassword"
    );
    expect(
      getAuthErrorKey("Password is known to be weak and easy to guess, please choose a different one.")
    ).toBe("weakPassword");
  });

  it("registro cerrado y sesión ausente", () => {
    expect(getAuthErrorKey("Signups not allowed for this instance")).toBe("signupDisabled");
    expect(getAuthErrorKey("Auth session missing!")).toBe("sessionExpired");
  });

  it("mantiene los mapeos que ya había", () => {
    expect(getAuthErrorKey("Invalid login credentials")).toBe("invalidCredentials");
    expect(getAuthErrorKey("Email not confirmed")).toBe("emailNotConfirmed");
    expect(getAuthErrorKey("For security purposes, you can only request this after 42 seconds."))
      .toBe("tooManyRequests");
  });
});

describe("getAuthErrorKeyFromError — el `code` manda sobre el texto", () => {
  it("usa el código cuando lo hay", () => {
    expect(getAuthErrorKeyFromError({ message: "whatever", code: "email_address_not_authorized" }))
      .toBe("emailNotAuthorized");
    expect(getAuthErrorKeyFromError({ message: "x", code: "over_email_send_rate_limit" }))
      .toBe("emailRateLimit");
    expect(getAuthErrorKeyFromError({ message: "x", code: "email_exists" })).toBe("userAlreadyExists");
    expect(getAuthErrorKeyFromError({ message: "x", code: "same_password" })).toBe("samePassword");
  });

  it("cae al texto si el código no se conoce", () => {
    expect(getAuthErrorKeyFromError({ message: "Invalid login credentials", code: "nuevo" }))
      .toBe("invalidCredentials");
    expect(getAuthErrorKeyFromError(null)).toBe("somethingWentWrong");
  });
});

describe("callback de auth", () => {
  it("PKCE sin verificador (enlace abierto en otro navegador)", () => {
    // Código real de supabase-js 2.103 (AuthPKCECodeVerifierMissingError).
    expect(getCallbackErrorCode({ message: "x", code: "pkce_code_verifier_not_found" })).toBe("auth_link_other_browser");
    expect(getCallbackErrorCode({ message: "x", code: "flow_state_not_found" })).toBe("auth_link_other_browser");
    expect(
      getCallbackErrorCode({ message: "invalid request: both auth code and code verifier should be non-empty" })
    ).toBe("auth_link_other_browser");
  });

  it("enlace caducado o ya usado", () => {
    expect(getCallbackErrorCode({ message: "x", code: "otp_expired" })).toBe("auth_link_expired");
    expect(getCallbackErrorCode({ message: "Email link is invalid or has expired" })).toBe("auth_link_expired");
  });

  it("resto → genérico", () => {
    expect(getCallbackErrorCode({ message: "boom" })).toBe("auth_callback_error");
  });

  it("cada código de la URL tiene su texto en los dos idiomas", () => {
    for (const code of ["auth_callback_error", "auth_link_other_browser", "auth_link_expired"]) {
      const key = callbackErrorKey(code);
      expect(key).not.toBeNull();
      expect((es.errors as Record<string, string>)[key!]).toBeTruthy();
      expect((en.errors as Record<string, string>)[key!]).toBeTruthy();
    }
    expect(callbackErrorKey("otra_cosa")).toBeNull();
    expect(callbackErrorKey(null)).toBeNull();
  });

  it("todas las claves que puede devolver el mapeo existen en es y en", () => {
    const keys = [
      "emailNotAuthorized", "emailRateLimit", "samePassword", "weakPassword",
      "signupDisabled", "sessionExpired",
    ];
    for (const k of keys) {
      expect((es.errors as Record<string, string>)[k]).toBeTruthy();
      expect((en.errors as Record<string, string>)[k]).toBeTruthy();
    }
  });
});
