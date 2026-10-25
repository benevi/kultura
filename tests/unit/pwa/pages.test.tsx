/**
 * F-23 — páginas: `/[locale]/offline` (sin sesión, ni cabeceras, ni
 * proveedores), los `loading.tsx` de chat y avisos (MOV-14) y los textos
 * `pwa` con paridad es/en.
 */
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";
import { retryTarget } from "@/components/pwa/retry";

const MESSAGES = { es, en } as Record<string, unknown>;
let currentLocale = "es";

function lookup(locale: string, dotted: string): string {
  const value = dotted.split(".").reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], MESSAGES[locale]);
  if (typeof value !== "string") throw new Error(`falta ${locale}:${dotted}`);
  return value;
}

vi.mock("next-intl/server", () => ({
  getTranslations: async (arg: string | { locale: string; namespace: string }) => {
    const { locale, namespace } = typeof arg === "string" ? { locale: currentLocale, namespace: arg } : arg;
    return (key: string) => lookup(locale, `${namespace}.${key}`);
  },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import OfflinePage, { generateMetadata } from "@/app/[locale]/offline/page";
import ChatLoading from "@/app/[locale]/(app)/chat/loading";
import NotificationsLoading from "@/app/[locale]/(app)/notifications/loading";

const ROOT = path.resolve(__dirname, "../../..");

describe("/[locale]/offline", () => {
  it.each(["es", "en"])("pinta el aviso en %s con reintentar y volver a la portada", async (locale) => {
    render(await OfflinePage({ params: Promise.resolve({ locale }) }));
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(lookup(locale, "pwa.offline.title"));
    expect(screen.getByRole("button", { name: lookup(locale, "pwa.offline.retry") })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: lookup(locale, "pwa.offline.home") })).toHaveAttribute("href", `/${locale}`);
  });

  it("no indexable y con título traducido", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(meta).toEqual({ title: en.pwa.offline.metaTitle, robots: { index: false, follow: false } });
  });

  it("idioma desconocido → 404", async () => {
    await expect(OfflinePage({ params: Promise.resolve({ locale: "fr" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("no depende de sesión, cookies, cabeceras ni proveedores (la cachea el worker y F-22 la sirve estática)", () => {
    const dir = path.join(ROOT, "src/app/[locale]/offline");
    const sources = [
      ...fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), "utf8")),
      fs.readFileSync(path.join(ROOT, "src/components/pwa/RetryButton.tsx"), "utf8"),
    ].join("\n");
    expect(sources).not.toMatch(/next\/headers|cookies\(|supabase|@\/lib\/api|getViewer|getUser|fetch\(/);
  });

  it("reintentar recarga la URL que falló; desde /offline va a la portada", () => {
    expect(retryTarget("/es/library", "/es")).toBeNull();
    expect(retryTarget("/en/offline", "/en")).toBe("/en");
    expect(retryTarget("/en/offline/", "/en")).toBe("/en");
  });
});

describe("MOV-14 · loading.tsx de chat y avisos", () => {
  it.each([
    ["chat", ChatLoading, "pwa.loading.chat"],
    ["notifications", NotificationsLoading, "pwa.loading.notifications"],
  ] as const)("%s: esqueleto con anuncio para lectores y pulso solo con motion-safe", async (_name, Loading, key) => {
    currentLocale = "es";
    const { container } = render(await Loading());
    expect(screen.getByRole("status")).toHaveTextContent(lookup("es", key));
    expect(container.querySelector("main")).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector(".motion-safe\\:animate-pulse")).not.toBeNull();
    // Ningún pulso sin la guarda de movimiento reducido.
    expect(container.querySelector('[class~="animate-pulse"]')).toBeNull();
  });
});

describe("textos `pwa`", () => {
  const keys = (obj: unknown, prefix = ""): string[] =>
    Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
      v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
    );

  it("mismas claves en es y en, ninguna vacía", () => {
    expect(keys(en.pwa)).toEqual(keys(es.pwa));
    for (const k of keys(es.pwa)) {
      expect(lookup("es", `pwa.${k}`).trim()).not.toBe("");
      expect(lookup("en", `pwa.${k}`).trim()).not.toBe("");
    }
  });

  it("van justo después de `demo` en los dos idiomas", () => {
    for (const messages of [es, en]) {
      const order = Object.keys(messages);
      expect(order[order.indexOf("demo") + 1]).toBe("pwa");
    }
  });
});
