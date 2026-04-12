import { describe, it, expect } from "vitest";
import { getAuthErrorKey } from "@/lib/utils/auth-errors";

describe("getAuthErrorKey", () => {
  it("mapea credenciales inválidas", () => {
    expect(getAuthErrorKey("Invalid login credentials")).toBe("invalidCredentials");
    expect(getAuthErrorKey("Wrong password provided")).toBe("invalidCredentials");
  });

  it("mapea email no confirmado", () => {
    expect(getAuthErrorKey("Email not confirmed")).toBe("emailNotConfirmed");
  });

  it("mapea usuario ya registrado", () => {
    expect(getAuthErrorKey("User already registered")).toBe("userAlreadyExists");
    expect(getAuthErrorKey("Email address has already been registered")).toBe("userAlreadyExists");
  });

  it("mapea contraseña demasiado corta", () => {
    expect(getAuthErrorKey("Password should be at least 6 characters")).toBe("passwordTooShort");
  });

  it("mapea demasiados intentos", () => {
    expect(getAuthErrorKey("For security purposes, you can only request this after 60 seconds")).toBe("tooManyRequests");
    expect(getAuthErrorKey("Too many requests from this IP")).toBe("tooManyRequests");
  });

  it("mapea email inválido", () => {
    expect(getAuthErrorKey("Invalid email format")).toBe("invalidEmail");
    expect(getAuthErrorKey("Unable to validate email address")).toBe("invalidEmail");
  });

  it("fallback para errores desconocidos", () => {
    expect(getAuthErrorKey("Some unexpected error")).toBe("somethingWentWrong");
    expect(getAuthErrorKey("")).toBe("somethingWentWrong");
  });

  it("es case-insensitive", () => {
    expect(getAuthErrorKey("INVALID LOGIN CREDENTIALS")).toBe("invalidCredentials");
    expect(getAuthErrorKey("email not confirmed")).toBe("emailNotConfirmed");
  });
});
