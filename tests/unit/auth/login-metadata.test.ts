/**
 * Metadatos del login y de la contraseña nueva (TXT-5, SEO-6).
 */
import { describe, it, expect, vi } from "vitest";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";

vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => {
    const messages = (locale === "en" ? en : es) as unknown as Record<string, Record<string, string>>;
    return (key: string) => messages[namespace][key];
  },
}));
vi.mock("@/app/[locale]/login/LoginPage", () => ({ LoginPage: () => null }));
vi.mock("@/app/[locale]/reset-password/ResetPasswordForm", () => ({ ResetPasswordForm: () => null }));

import { generateMetadata as loginMetadata } from "@/app/[locale]/login/page";
import { generateMetadata as resetMetadata } from "@/app/[locale]/reset-password/page";

describe("metadatos del login", () => {
  // Regresión: era `title: "Acceso"` fijo en español, también en /en/login.
  it("/en/login con título y descripción en inglés", async () => {
    const meta = await loginMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(meta.title).toBe(en.auth.metaTitle);
    expect(meta.description).toBe(en.auth.metaDescription);
    expect(meta.title).not.toBe(es.auth.metaTitle);
  });

  it("fuera del índice y con canonical sin ?mode=", async () => {
    const meta = await loginMetadata({ params: Promise.resolve({ locale: "es" }) });
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.alternates?.canonical).toBe("/es/login");
    expect(meta.openGraph).toMatchObject({ siteName: "KULTURA", url: "/es/login", locale: "es_ES" });
  });

  it("la contraseña nueva tampoco se indexa", async () => {
    const meta = await resetMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(meta.title).toBe(en.auth.resetMetaTitle);
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});
